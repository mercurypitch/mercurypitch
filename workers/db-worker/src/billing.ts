// ── Billing: DB-driven pricing + Stripe checkout/portal/webhook ──────
//
// Routes (handled by handleBilling):
//   GET  /api/billing/pricing   — public; tiers + packs from pricingPlans
//   GET  /api/billing/me        — auth; credit balance + entitlements
//   POST /api/billing/checkout  — auth; { planId } → Stripe Checkout url
//   GET  /api/billing/portal    — auth; Stripe Customer Portal url
//   POST /api/billing/webhook   — Stripe; signature-verified, idempotent
//   POST /api/billing/uvr-admit — auth; pre-dispatch credit + rate-limit gate
//   POST /api/billing/debit     — auth; meter a server UVR job (idempotent)
//   POST /api/billing/refund    — service (X-Service-Key); undo a job's debit
//
// Design (see docs/plans/premium.md):
//  • Prices live in the DB (pricingPlans), never in the repo. `amount` NULL
//    renders as "Soon" and is not purchasable — except a donation row with
//    customAmount = 1, whose Stripe price uses custom_unit_amount so the donor
//    names the amount on Stripe's page.
//  • Donations (kind = 'donation') are one-time payments that grant a
//    time-boxed `supporter` entitlement. They never gate a feature.
//  • Stripe-hosted UI only; the webhook is the sole writer of credits/
//    entitlements. Credits are an append-only ledger; balance = SUM(delta).
//  • Inert until configured: with STRIPE_SECRET_KEY unset, checkout/portal
//    return 501 and pricing still renders (as "Soon").
//
// Pure helpers (pricing mapping, balance, webhook signature) live in
// billing-core.ts so they're unit-testable without the worker runtime.

import type { Env } from './auth'
import { checkRateLimit, getAuth } from './auth'
import { sendBillingAlert, sendPurchaseThankYou } from './email'
import type { PricingRow } from './billing-core'
import {
  UVR_TIER_PLAN_IDS,
  bestSupporterLevel,
  creditBalance,
  donationDays,
  extendSupporterExpiry,
  isUvrTier,
  isValidJobRef,
  mapPricingPlans,
  sourcePlanId,
  supporterLevel,
  timingSafeEqualStr,
  uvrDebitKey,
  uvrJobCost,
  uvrModelCredits,
  uvrRefundKey,
  verifyStripeSignature,
} from './billing-core'

type Respond = (body: object | null, init?: ResponseInit) => Response

const STRIPE_API = 'https://api.stripe.com/v1'

const ALLOWED_ORIGINS = [
  'https://mercurypitch.com',
  'https://dev.mercurypitch.com',
  'https://localhost:3000',
  'http://localhost:3000',
]

function isStripeConfigured(env: Env): boolean {
  return env.STRIPE_SECRET_KEY != null && env.STRIPE_SECRET_KEY !== ''
}

function appOrigin(request: Request): string {
  const origin = request.headers.get('Origin') ?? ''
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
}

// ── Stripe REST (form-encoded; no SDK) ───────────────────────────────

async function stripeRequest(
  env: Env,
  path: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY as string}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

async function stripeGet(
  env: Env,
  pathWithQuery: string,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${STRIPE_API}${pathWithQuery}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY as string}` },
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

interface UserBillingRow {
  email: string | null
  authProvider: string
  stripeCustomerId: string | null
}

/** Reuse the user's Stripe customer, creating one on first checkout. */
async function ensureStripeCustomer(
  env: Env,
  userId: string,
  row: UserBillingRow,
): Promise<string | null> {
  if (row.stripeCustomerId != null && row.stripeCustomerId !== '') {
    return row.stripeCustomerId
  }
  const params: Record<string, string> = { 'metadata[userId]': userId }
  if (row.email != null && row.email !== '') params.email = row.email
  const created = await stripeRequest(env, '/customers', params)
  if (!created.ok || typeof created.data.id !== 'string') return null
  const customerId = created.data.id
  await env.DB.prepare(
    'UPDATE users SET stripeCustomerId = ?, updatedAt = ? WHERE id = ?',
  )
    .bind(customerId, new Date().toISOString(), userId)
    .run()
  return customerId
}

// ── Endpoint handlers ────────────────────────────────────────────────

async function handlePricing(env: Env, respond: Respond): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM pricingPlans WHERE active = 1 ORDER BY sortOrder ASC',
  ).all<PricingRow>()
  const pricing = mapPricingPlans(results)
  // Per-model job costs for the GPU tier (base tier credits × model
  // multiplier) so the app can label quality choices ("1 credit" vs
  // "2 credits · slower") without hardcoding prices.
  const gpuBase =
    results.find((r) => r.id === UVR_TIER_PLAN_IDS.gpu)?.credits ?? 0
  return respond(
    {
      ...pricing,
      uvrModelCredits: uvrModelCredits(gpuBase),
      stripeConfigured: isStripeConfigured(env),
    },
    // Public + cacheable: pricing changes are infrequent.
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  )
}

async function handleMe(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })

  const ledger = await env.DB.prepare(
    'SELECT delta FROM creditLedger WHERE userId = ?',
  )
    .bind(auth.userId)
    .all<{ delta: number }>()
  // sourceLabel resolves `donation:<planId>` to that tier's display name, so
  // the badge can say "Voice supporter" from this one call. It stays editable
  // in the DB — the client never hardcodes a tier name.
  const { results: entitlements } = await env.DB.prepare(
    `SELECT e.feature, e.source, e.expiresAt, p.label AS sourceLabel
       FROM entitlements e
       LEFT JOIN pricingPlans p ON p.id = REPLACE(e.source, 'donation:', '')
      WHERE e.userId = ?`,
  )
    .bind(auth.userId)
    .all<{
      feature: string
      source: string | null
      expiresAt: string | null
      sourceLabel: string | null
    }>()

  return respond({
    creditBalance: creditBalance(ledger.results),
    entitlements,
    stripeConfigured: isStripeConfigured(env),
  })
}

interface CheckoutBody {
  planId?: string
}

async function handleCheckout(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  if (!isStripeConfigured(env)) {
    return respond({ error: 'Billing not configured' }, { status: 501 })
  }
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  // Anonymous accounts can't be billed — they must upgrade (email/Google)
  // first so receipts and the customer record have a real identity.
  if (auth.provider === 'anonymous') {
    return respond(
      { error: 'Create an account first so we can send you a receipt' },
      { status: 403 },
    )
  }

  let body: CheckoutBody
  try {
    body = await request.json<CheckoutBody>()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (body.planId == null || body.planId === '') {
    return respond({ error: 'planId required' }, { status: 400 })
  }

  const plan = await env.DB.prepare(
    'SELECT * FROM pricingPlans WHERE id = ? AND active = 1',
  )
    .bind(body.planId)
    .first<PricingRow>()
  if (!plan) return respond({ error: 'Unknown plan' }, { status: 404 })
  const isDonation = plan.kind === 'donation'
  // A custom_unit_amount price genuinely has no fixed amount — the donor names
  // it on Stripe's page — so only a missing Stripe price makes it unavailable.
  const priceless = plan.customAmount === 1 ? false : plan.amount == null
  if (priceless || (plan.stripePriceId ?? '') === '') {
    // Price not wired yet — the page shows it as "Soon".
    return respond({ error: 'This plan is not available yet' }, { status: 409 })
  }

  const user = await env.DB.prepare(
    'SELECT email, authProvider, stripeCustomerId FROM users WHERE id = ?',
  )
    .bind(auth.userId)
    .first<UserBillingRow>()
  if (!user) return respond({ error: 'User not found' }, { status: 404 })

  const customerId = await ensureStripeCustomer(env, auth.userId, user)
  if (customerId == null) {
    return respond({ error: 'Could not create customer' }, { status: 502 })
  }

  const origin = appOrigin(request)
  const params: Record<string, string> = {
    mode: 'payment',
    customer: customerId,
    'line_items[0][price]': plan.stripePriceId as string,
    'line_items[0][quantity]': '1',
    success_url: `${origin}/#/${isDonation ? 'donate/thanks' : 'billing/success'}`,
    cancel_url: `${origin}/#/${isDonation ? 'settings/credits' : 'pricing'}`,
    client_reference_id: auth.userId,
    'metadata[userId]': auth.userId,
    'metadata[planId]': plan.id,
    'metadata[credits]': String(plan.credits ?? 0),
  }
  if (isDonation) {
    // `kind` is what the webhook branches on; the rest is enough to grant the
    // entitlement without re-reading the plan row (which could have been
    // edited between checkout and the webhook landing).
    params['metadata[kind]'] = 'donation'
    params['metadata[entitlementDays]'] = String(plan.entitlementDays ?? 0)
    params['metadata[customAmount]'] = plan.customAmount === 1 ? '1' : '0'
    // Stripe's button reads "Donate" instead of "Pay".
    params.submit_type = 'donate'
  }
  const session = await stripeRequest(env, '/checkout/sessions', params)
  if (!session.ok || typeof session.data.url !== 'string') {
    console.error(
      '[billing] checkout session failed',
      session.status,
      session.data,
    )
    return respond({ error: 'Could not start checkout' }, { status: 502 })
  }
  return respond({ url: session.data.url })
}

async function handlePortal(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  if (!isStripeConfigured(env)) {
    return respond({ error: 'Billing not configured' }, { status: 501 })
  }
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })

  const user = await env.DB.prepare(
    'SELECT stripeCustomerId FROM users WHERE id = ?',
  )
    .bind(auth.userId)
    .first<{ stripeCustomerId: string | null }>()
  if (!user?.stripeCustomerId) {
    return respond({ error: 'No billing account yet' }, { status: 404 })
  }

  const portal = await stripeRequest(env, '/billing_portal/sessions', {
    customer: user.stripeCustomerId,
    return_url: `${appOrigin(request)}/#/pricing`,
  })
  if (!portal.ok || typeof portal.data.url !== 'string') {
    return respond({ error: 'Could not open portal' }, { status: 502 })
  }
  return respond({ url: portal.data.url })
}

/** Outcome of processing one checkout event — lets the reconciliation job
 *  report exactly what happened without re-deriving it from the ledger. */
interface GrantOutcome {
  /** Credits (or supporter days) written by THIS call — 0 for duplicates and
   *  unusable metadata. `unit` says which. */
  granted: number
  userId: string | null
  duplicate: boolean
  /** What `granted` counts, for logs and the reconciliation alert. */
  unit: 'credits' | 'supporter days'
}

/** Process one completed checkout. Credits and donations both arrive as
 *  `checkout.session.completed`; the session metadata says which. Routing both
 *  through here means the reconciliation sweep (which calls this same function)
 *  recovers missed donations for free — do NOT add a second recovery path. */
async function grantForCheckout(
  env: Env,
  eventId: string,
  session: Record<string, unknown>,
): Promise<GrantOutcome> {
  const metadata =
    (session.metadata as Record<string, unknown> | undefined) ?? {}
  return metadata.kind === 'donation'
    ? grantSupporterEntitlement(env, eventId, session)
    : grantCheckoutCredits(env, eventId, session)
}

/** Grant a time-boxed `supporter` entitlement for a completed donation.
 *
 *  Idempotency reuses the credit ledger: a delta-0 row keyed `evt:<eventId>`
 *  wins or loses the UNIQUE(idempotencyKey) race exactly once, so a redelivered
 *  webhook — or a reconciliation sweep running alongside it — can never extend
 *  the entitlement twice. It also leaves a donation audit trail without moving
 *  anyone's balance. */
async function grantSupporterEntitlement(
  env: Env,
  eventId: string,
  session: Record<string, unknown>,
): Promise<GrantOutcome> {
  const metadata =
    (session.metadata as Record<string, unknown> | undefined) ?? {}
  const userId = typeof metadata.userId === 'string' ? metadata.userId : ''
  const planId = typeof metadata.planId === 'string' ? metadata.planId : null
  const amountTotal =
    typeof session.amount_total === 'number' ? session.amount_total : null
  const days = donationDays(
    {
      entitlementDays: Number(metadata.entitlementDays ?? 0),
      customAmount: metadata.customAmount === '1' ? 1 : 0,
    },
    amountTotal,
  )

  if (userId === '' || days <= 0) {
    // A paid donation we cannot attribute is a wiring bug — never drop it
    // silently; the reconciliation alert surfaces it for manual granting.
    console.error(
      `[billing] donation ${eventId}: no grant (userId=${userId || 'missing'}, days=${days})`,
    )
    return { granted: 0, userId: null, duplicate: false, unit: 'supporter days' }
  }

  const now = new Date().toISOString()
  const claimed = await env.DB.prepare(
    `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
     VALUES (?, ?, ?, 0, 'donation', ?, ?)`,
  )
    .bind(crypto.randomUUID(), now, userId, planId, `evt:${eventId}`)
    .run()
  if (claimed.meta.changes === 0) {
    console.log(`[billing] donation ${eventId}: [duplicate, skipped]`)
    return { granted: 0, userId, duplicate: true, unit: 'supporter days' }
  }

  // From here the claim row exists but the entitlement does not, so ANY failure
  // below must release the claim — otherwise Stripe's retry (and the
  // reconciliation sweep) would both see "duplicate" and skip, leaving a paid
  // donation with no perks and no way to notice. The credits path needs no such
  // care: there the ledger row IS the grant, one atomic statement.
  try {
    // Read-then-write is safe because the claim above admits exactly one caller
    // per event, and D1 serializes writes. Two DIFFERENT donations from the
    // same user in the same instant could still interleave — at donation volume
    // that is a manual fix, not worth a compare-and-swap loop.
    const existing = await env.DB.prepare(
      "SELECT expiresAt, source FROM entitlements WHERE userId = ? AND feature = 'supporter'",
    )
      .bind(userId)
      .first<{ expiresAt: string | null; source: string | null }>()
    const expiresAt = extendSupporterExpiry(existing?.expiresAt, now, days)

    // Name the level from what was PAID, not from which card was clicked — that
    // is what lets a custom EUR 59 wear the Anthem badge instead of a nameless
    // "Other amount" one. Stacking keeps the high-water mark.
    const { results: tiers } = await env.DB.prepare(
      "SELECT id, amount FROM pricingPlans WHERE kind = 'donation' AND customAmount = 0 AND active = 1",
    ).all<{ id: string; amount: number | null }>()
    const level =
      bestSupporterLevel(
        tiers,
        sourcePlanId(existing?.source),
        supporterLevel(tiers, amountTotal),
      ) ?? planId

    await env.DB.prepare(
      `INSERT INTO entitlements (id, createdAt, updatedAt, userId, feature, source, expiresAt)
       VALUES (?, ?, ?, ?, 'supporter', ?, ?)
       ON CONFLICT(userId, feature) DO UPDATE SET
         updatedAt = excluded.updatedAt,
         source    = excluded.source,
         expiresAt = excluded.expiresAt`,
    )
      .bind(
        crypto.randomUUID(),
        now,
        now,
        userId,
        `donation:${level ?? 'unknown'}`,
        expiresAt,
      )
      .run()

    console.log(
      `[billing] donation ${eventId}: +${days}d supporter user=${userId} level=${level ?? 'unknown'} until=${expiresAt}`,
    )
    return { granted: days, userId, duplicate: false, unit: 'supporter days' }
  } catch (err) {
    await env.DB.prepare('DELETE FROM creditLedger WHERE idempotencyKey = ?')
      .bind(`evt:${eventId}`)
      .run()
      .catch(() => {
        // Releasing the claim is itself best-effort. If even this fails the
        // event stays claimed-but-ungranted, which the thrown error below
        // surfaces as a 500 → Stripe retry → the reconciliation alert.
        console.error(
          `[billing] donation ${eventId}: claim release FAILED — grant may need manual repair`,
        )
      })
    throw err
  }
}

/** Grant credits for a completed checkout, idempotent on the event id. */
async function grantCheckoutCredits(
  env: Env,
  eventId: string,
  session: Record<string, unknown>,
): Promise<GrantOutcome> {
  const metadata =
    (session.metadata as Record<string, unknown> | undefined) ?? {}
  const userId = typeof metadata.userId === 'string' ? metadata.userId : ''
  const credits = Number(metadata.credits ?? 0)
  if (userId === '' || !Number.isFinite(credits) || credits <= 0) {
    // A paid session without usable metadata is a wiring bug (or a session
    // created outside handleCheckout) — surface it, never silently drop it.
    console.error(
      `[billing] checkout ${eventId}: no grant (userId=${userId || 'missing'}, credits=${String(metadata.credits)})`,
    )
    return { granted: 0, userId: null, duplicate: false, unit: 'credits' }
  }

  const planId = typeof metadata.planId === 'string' ? metadata.planId : null
  const now = new Date().toISOString()

  // idempotencyKey ties the grant to the event, so a redelivered webhook
  // (or a retry) can never double-credit — the UNIQUE constraint drops it.
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
     VALUES (?, ?, ?, ?, 'purchase', ?, ?)`,
  )
    .bind(crypto.randomUUID(), now, userId, credits, planId, `evt:${eventId}`)
    .run()
  console.log(
    `[billing] checkout ${eventId}: +${credits} credits user=${userId}` +
      (res.meta.changes === 0 ? ' [duplicate, skipped]' : ''),
  )

  // Purchase "thank you" email — best-effort. Only on a real (non-duplicate)
  // grant, only when Resend is configured, and NEVER allowed to throw: the
  // paid credits already landed and must not be undone by an email failure.
  if (res.meta.changes > 0 && env.RESEND_API_KEY) {
    try {
      const info = await env.DB.prepare(
        `SELECT u.email       AS email,
                p.displayName AS name,
                pp.label      AS planLabel,
                pp.amount     AS amountMinor,
                pp.currency   AS currency,
                (SELECT COALESCE(SUM(delta), 0) FROM creditLedger WHERE userId = ?) AS balance
           FROM users u
           LEFT JOIN userProfiles p  ON p.id  = u.id
           LEFT JOIN pricingPlans pp ON pp.id = ?
          WHERE u.id = ?`,
      )
        .bind(userId, planId, userId)
        .first<{
          email: string | null
          name: string | null
          planLabel: string | null
          amountMinor: number | null
          currency: string | null
          balance: number
        }>()
      if (info?.email) {
        await sendPurchaseThankYou(
          { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
          info.email,
          {
            displayName: info.name,
            packLabel: info.planLabel ?? 'credit',
            credits,
            balance: info.balance,
            amountMinor: info.amountMinor ?? 0,
            currency: info.currency ?? 'eur',
            orderDateIso: now,
          },
        )
      } else {
        console.log(
          `[billing] checkout ${eventId}: no email on file — thank-you skipped`,
        )
      }
    } catch (err) {
      console.error(
        `[billing] thank-you email failed (non-fatal): ${String(err)}`,
      )
    }
  }
  return {
    granted: res.meta.changes > 0 ? credits : 0,
    userId,
    duplicate: res.meta.changes === 0,
    unit: 'credits',
  }
}

/** Mark a Stripe event as fully processed (idempotent). */
async function recordBillingEvent(
  env: Env,
  eventId: string,
  type: string | null,
): Promise<void> {
  await env.DB.prepare(
    'INSERT OR IGNORE INTO billingEvents (id, createdAt, type) VALUES (?, ?, ?)',
  )
    .bind(eventId, new Date().toISOString(), type)
    .run()
}

// ── UVR job metering (debit / refund) ────────────────────────────────

interface DebitBody {
  tier?: string
  jobRef?: string
  /** Registry model name (e.g. "roformer") — scales the tier's base cost
   *  by the model's credit multiplier. Absent = base cost. */
  model?: string
}

const MODEL_NAME_RE = /^[A-Za-z0-9._-]{1,80}$/

async function getUvrQuote(
  env: Env,
  userId: string,
  tier: 'gpu' | 'cpu',
  model?: string,
): Promise<{ cost: number; balance: number }> {
  const plan = await env.DB.prepare(
    'SELECT credits FROM pricingPlans WHERE id = ? AND active = 1',
  )
    .bind(UVR_TIER_PLAN_IDS[tier])
    .first<{ credits: number | null }>()
  const cost = uvrJobCost(plan?.credits ?? 0, model)
  const ledger = await env.DB.prepare(
    'SELECT delta FROM creditLedger WHERE userId = ?',
  )
    .bind(userId)
    .all<{ delta: number }>()
  return { cost, balance: creditBalance(ledger.results) }
}

/** Fail-closed admission gate for paid UVR dispatch.
 *
 * Runs before the main worker stages an input or creates a RunPod job. Two
 * atomic D1 counters bound bursts and sustained starts per authenticated user;
 * the quote check avoids starting a job that cannot be paid for. The later
 * debit remains authoritative and atomic against concurrent requests. */
async function handleUvrAdmission(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })

  let body: Pick<DebitBody, 'tier' | 'model'>
  try {
    body = await request.json<Pick<DebitBody, 'tier' | 'model'>>()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!isUvrTier(body.tier)) {
    return respond({ error: 'tier must be "gpu" or "cpu"' }, { status: 400 })
  }
  if (body.model !== undefined && !MODEL_NAME_RE.test(body.model)) {
    return respond({ error: 'Invalid model' }, { status: 400 })
  }

  const rateKey = `user:${auth.userId}`
  for (const bucket of ['uvr-process-burst', 'uvr-process-hour'] as const) {
    const limit = await checkRateLimit(env.DB, rateKey, bucket)
    if (!limit.allowed) {
      const retryAfter = limit.retryAfter ?? 60
      return respond(
        {
          error: `Too many server separations. Try again in ${retryAfter} seconds.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        },
      )
    }
  }

  const quote = await getUvrQuote(env, auth.userId, body.tier, body.model)
  if (quote.cost <= 0) {
    return respond(
      { error: 'Server processing metering is unavailable' },
      { status: 503 },
    )
  }
  if (quote.balance < quote.cost) {
    return respond(
      {
        error: 'Not enough credits',
        required: quote.cost,
        balance: quote.balance,
      },
      { status: 402 },
    )
  }
  return respond({ allowed: true, ...quote })
}

/** Debit a server-side separation job against the user's credit balance.
 *
 *  Called by the main worker when a RunPod job is accepted (jobRef = the
 *  `rp_<tier>_<id>` session id). Idempotent per jobRef. While the tier's
 *  credit cost is unset in pricingPlans the debit no-ops (debited 0), so the
 *  endpoint is safe to wire before pricing is decided. */
async function handleDebit(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })

  let body: DebitBody
  try {
    body = await request.json<DebitBody>()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!isUvrTier(body.tier)) {
    return respond({ error: 'tier must be "gpu" or "cpu"' }, { status: 400 })
  }
  if (!isValidJobRef(body.jobRef)) {
    return respond({ error: 'jobRef required' }, { status: 400 })
  }
  if (body.model !== undefined && !MODEL_NAME_RE.test(body.model)) {
    return respond({ error: 'Invalid model' }, { status: 400 })
  }

  const { cost, balance } = await getUvrQuote(
    env,
    auth.userId,
    body.tier,
    body.model,
  )

  if (cost <= 0) {
    // Tier not metered yet — nothing to charge.
    return respond({ debited: 0, cost: 0, balance })
  }

  // One conditional INSERT: the balance check and the debit are a single
  // atomic statement, so concurrent jobs can't overdraw; the UNIQUE
  // idempotencyKey turns a retried jobRef into a no-op, never a double debit.
  const key = uvrDebitKey(body.jobRef)
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
     SELECT ?, ?, ?, ?, 'uvr-job', ?, ?
     WHERE (SELECT COALESCE(SUM(delta), 0) FROM creditLedger WHERE userId = ?) >= ?`,
  )
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      auth.userId,
      -cost,
      body.jobRef,
      key,
      auth.userId,
      cost,
    )
    .run()

  if (inserted.meta.changes === 0) {
    // Nothing inserted: either this jobRef was already debited (a retry —
    // fine) or the balance is short. The key's presence tells them apart.
    const existing = await env.DB.prepare(
      'SELECT delta FROM creditLedger WHERE idempotencyKey = ?',
    )
      .bind(key)
      .first<{ delta: number }>()
    if (existing) {
      return respond({ debited: -existing.delta, cost, balance, duplicate: true })
    }
    console.warn(
      `[billing] debit ${body.jobRef}: refused (user=${auth.userId} balance=${balance} required=${cost})`,
    )
    return respond(
      { error: 'Insufficient credits', required: cost, balance },
      { status: 402 },
    )
  }
  console.log(
    `[billing] debit ${body.jobRef}: -${cost}${body.model !== undefined ? ` (${body.model})` : ''} user=${auth.userId} balance=${balance - cost}`,
  )
  return respond({ debited: cost, cost, balance: balance - cost })
}

/** Refund a failed/cancelled job's debit.
 *
 *  Service-to-service only (X-Service-Key must match BILLING_SERVICE_KEY —
 *  the main worker holds the same value): a user JWT must NOT be able to
 *  refund its own successful jobs, so user auth is deliberately not accepted.
 *  Idempotent — at most one refund per jobRef, safe to call repeatedly. */
async function handleRefund(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const configured = env.BILLING_SERVICE_KEY
  if (configured == null || configured === '') {
    return respond({ error: 'Refunds not configured' }, { status: 503 })
  }
  const presented = request.headers.get('X-Service-Key') ?? ''
  if (!timingSafeEqualStr(presented, configured)) {
    return respond({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { jobRef?: string }
  try {
    body = await request.json<{ jobRef?: string }>()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!isValidJobRef(body.jobRef)) {
    return respond({ error: 'jobRef required' }, { status: 400 })
  }

  const debit = await env.DB.prepare(
    'SELECT userId, delta FROM creditLedger WHERE idempotencyKey = ?',
  )
    .bind(uvrDebitKey(body.jobRef))
    .first<{ userId: string; delta: number }>()
  if (!debit || debit.delta >= 0) {
    // Never debited (unmetered job or unknown ref) — nothing to refund.
    return respond({ refunded: 0 })
  }

  const amount = -debit.delta
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
     VALUES (?, ?, ?, ?, 'uvr-refund', ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      debit.userId,
      amount,
      body.jobRef,
      uvrRefundKey(body.jobRef),
    )
    .run()
  if (res.meta.changes > 0) {
    console.log(
      `[billing] refund ${body.jobRef}: +${amount} user=${debit.userId}`,
    )
  }
  return respond({ refunded: amount, duplicate: res.meta.changes === 0 })
}

async function handleWebhook(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const secret = env.STRIPE_WEBHOOK_SECRET
  if (secret == null || secret === '') {
    return respond({ error: 'Webhook not configured' }, { status: 503 })
  }
  const sig = request.headers.get('Stripe-Signature') ?? ''
  const payload = await request.text()
  const valid = await verifyStripeSignature(
    payload,
    sig,
    secret,
    Math.floor(Date.now() / 1000),
  )
  if (!valid) return respond({ error: 'Invalid signature' }, { status: 400 })

  let event: {
    id?: string
    type?: string
    data?: { object?: Record<string, unknown> }
  }
  try {
    event = JSON.parse(payload)
  } catch {
    return respond({ error: 'Invalid payload' }, { status: 400 })
  }
  if (typeof event.id !== 'string') {
    return respond({ error: 'Missing event id' }, { status: 400 })
  }

  // Idempotency: an event id already in billingEvents was FULLY processed —
  // ack the redelivery as a duplicate. The id is recorded only after the
  // grant succeeds (below): recording first would turn a mid-grant failure
  // (500 → Stripe retry → "duplicate") into permanently lost credits. A
  // concurrent double delivery can reach the grant twice, but the ledger's
  // UNIQUE idempotencyKey (`evt:<id>`) makes the second write a no-op.
  const seen = await env.DB.prepare('SELECT id FROM billingEvents WHERE id = ?')
    .bind(event.id)
    .first<{ id: string }>()
  if (seen) return respond({ received: true, duplicate: true })

  if (event.type === 'checkout.session.completed') {
    await grantForCheckout(env, event.id, event.data?.object ?? {})
  }
  // Other event types are acknowledged (200) without action for now.
  await recordBillingEvent(env, event.id, event.type ?? null)
  return respond({ received: true })
}

// ── Reconciliation (cron) ────────────────────────────────────────────
// Webhooks fail silently: Stripe keeps the money, we never learn a grant was
// missed (2026-07: the endpoints pointed at a dead host for 10 days). This
// sweep is the safety net for ANY delivery failure — it asks Stripe for
// recent checkout completions and processes every event billingEvents has
// never seen, through the exact same grant path the webhook uses.

/** How far back the sweep looks. Stripe's events list retains 30 days —
 *  wide enough to survive a long outage, tiny at our purchase volume. */
const RECONCILE_WINDOW_DAYS = 30
/** Pagination bound (100 events/page). Purely a runaway guard. */
const RECONCILE_MAX_PAGES = 10

interface StripeEventListItem {
  id?: string
  type?: string
  data?: { object?: Record<string, unknown> }
}

/** Sweep Stripe's recent `checkout.session.completed` events and grant any
 *  the webhook missed. Safe to run at any frequency: already-seen events are
 *  skipped, and the grant itself is idempotent per event id. Alerts by email
 *  (BILLING_ALERT_EMAIL) when it had to recover anything — a recovery means
 *  webhook delivery is broken and needs looking at. */
export async function reconcileBilling(env: Env): Promise<void> {
  if (!isStripeConfigured(env)) {
    console.log('[billing] reconcile: Stripe not configured — skipped')
    return
  }
  const since =
    Math.floor(Date.now() / 1000) - RECONCILE_WINDOW_DAYS * 24 * 60 * 60
  const recovered: string[] = []
  let checked = 0
  let startingAfter: string | undefined
  for (let page = 0; page < RECONCILE_MAX_PAGES; page++) {
    const qs = new URLSearchParams({
      type: 'checkout.session.completed',
      limit: '100',
      'created[gte]': String(since),
    })
    if (startingAfter !== undefined) qs.set('starting_after', startingAfter)
    const res = await stripeGet(env, `/events?${qs.toString()}`)
    if (!res.ok) {
      console.error(
        `[billing] reconcile: Stripe events list failed (${res.status})`,
      )
      break
    }
    const events = Array.isArray(res.data.data)
      ? (res.data.data as StripeEventListItem[])
      : []
    for (const ev of events) {
      if (typeof ev.id !== 'string') continue
      checked++
      const seen = await env.DB.prepare(
        'SELECT id FROM billingEvents WHERE id = ?',
      )
        .bind(ev.id)
        .first<{ id: string }>()
      if (seen) continue
      const outcome = await grantForCheckout(env, ev.id, ev.data?.object ?? {})
      await recordBillingEvent(env, ev.id, ev.type ?? null)
      recovered.push(
        `${ev.id}: +${outcome.granted} ${outcome.unit}, user=${outcome.userId ?? 'UNKNOWN (bad metadata — investigate!)'}`,
      )
    }
    if (res.data.has_more !== true || events.length === 0) break
    if (page === RECONCILE_MAX_PAGES - 1) {
      // Never truncate silently — at this volume something is very wrong.
      console.error(
        `[billing] reconcile: page cap hit (${RECONCILE_MAX_PAGES}) with more events pending — sweep incomplete`,
      )
    }
    startingAfter = events[events.length - 1].id
  }
  console.log(
    `[billing] reconcile: ${checked} event(s) checked, ${recovered.length} recovered`,
  )
  if (recovered.length > 0) {
    console.error(
      `[billing] reconcile RECOVERED missed grants — webhook delivery is broken:\n${recovered.join('\n')}`,
    )
    await sendBillingAlert(
      { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
      env.BILLING_ALERT_EMAIL ?? '',
      `Recovered ${recovered.length} missed grant(s)`,
      [
        'The billing reconciliation sweep found paid checkouts (credits or',
        'donations) whose webhook event was never processed, and granted them',
        'now. This means',
        'Stripe webhook delivery is BROKEN — check the endpoint URL and its',
        'recent deliveries in the Stripe dashboard.',
        '',
        ...recovered,
      ],
    )
  }
}

/** Route /api/billing/* requests. Returns null when the path doesn't match. */
export async function handleBilling(
  request: Request,
  env: Env,
  pathname: string,
  respond: Respond,
): Promise<Response | null> {
  if (!pathname.startsWith('/api/billing/')) return null
  const route = pathname.slice('/api/billing/'.length)
  const method = request.method

  if (route === 'pricing' && method === 'GET')
    return handlePricing(env, respond)
  if (route === 'me' && method === 'GET') return handleMe(request, env, respond)
  if (route === 'checkout' && method === 'POST') {
    return handleCheckout(request, env, respond)
  }
  if (route === 'portal' && method === 'GET') {
    return handlePortal(request, env, respond)
  }
  if (route === 'webhook' && method === 'POST') {
    return handleWebhook(request, env, respond)
  }
  if (route === 'uvr-admit' && method === 'POST') {
    return handleUvrAdmission(request, env, respond)
  }
  if (route === 'debit' && method === 'POST') {
    return handleDebit(request, env, respond)
  }
  if (route === 'refund' && method === 'POST') {
    return handleRefund(request, env, respond)
  }
  return respond({ error: 'Not found' }, { status: 404 })
}
