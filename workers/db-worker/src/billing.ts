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
//                                 From the native app, /me, the admission and
//                                 the debit see only the app's songs: never
//                                 web credits (S7 D9, app-songs.ts)
//   POST /api/billing/refund    — service (X-Service-Key); undo a job's debit
//   POST /api/billing/promo/redeem — auth + verified email; { code } → credits
//   GET  /api/billing/promo/featured — public; the code the app offers with
//                                      one click, only while it is open
//   POST /api/billing/review-access — auth, Android app; Play's review code →
//                                     a few songs, once (review-access.ts)
//   POST /api/billing/revenuecat — RevenueCat; secret header, idempotent: the
//                                   Karaoke subscription's songs (revenuecat.ts)
//   GET  /api/billing/withdrawals — auth; the packs that can still be cancelled
//   POST /api/billing/withdrawals — auth; { purchaseId, name, email } → the
//                                    14-day withdrawal statement, its refund
//                                    and acknowledgement (withdrawal.ts)
//
// Design (see docs/plans/premium.md):
//  • Prices live in the DB (pricingPlans), never in the repo. `amount` NULL
//    renders as "Soon" and is not purchasable — except a donation row with
//    customAmount = 1, whose Stripe price uses custom_unit_amount so the donor
//    names the amount on Stripe's page.
//  • Donations (kind = 'donation') are one-time payments that grant a
//    time-boxed `supporter` entitlement. They never gate a feature.
//  • Stripe-hosted UI only. The webhook is the sole writer of entitlements
//    and, with promo redemption, one of two writers of credits. Credits are
//    an append-only ledger; balance = SUM(delta).
//  • Inert until configured: with STRIPE_SECRET_KEY unset, checkout/portal
//    return 501 and pricing still renders (as "Soon").
//
// Pure helpers (pricing mapping, balance, webhook signature) live in
// billing-core.ts so they're unit-testable without the worker runtime.

import type { Env } from './auth'
import { checkRateLimit, getAuth } from './auth'
import { confirmPurchase, consentCheckoutParams, withdrawalMode, } from './checkout-consent'
import { sendBillingAlert } from './email'
import type { AppDebit } from './app-songs'
import { debitAppSongs, giveFreeSongBack, readAppSongs, spenderOf, } from './app-songs'
import { LedgerBusy } from './ledger'
import type { FeaturedPromoRow } from './promo-rules'
import { featuredPromoView } from './promo-rules'
import { handlePromoRedeem, readPromoClaims } from './promo-claim'
import { PURCHASE_RECORD } from './purchase-record'
import { finisherCheckoutParams, grantFinisherBonus, readFinisherOffer, } from './launch-finisher'
import { handleReviewAccess } from './review-access'
import { handleRevenueCatWebhook } from './revenuecat'
import { songAllowance, songsSummary } from './songs-allowance'
import { isStripeConfigured, stripeGet, stripeRequest } from './stripe-api'
import type { StripeGet } from './stripe-charge'
import type { StripeEventInput, StripeEventResult } from './stripe-payments'
import { applyMoneyBack, isCheckoutPaidEvent, isMoneyBackEvent, paymentIntentOf, readWebhookEvent, settleEarlyMoneyBack, } from './stripe-payments'
import { sweepStripeEvents } from './stripe-sweep'
import { handleWithdrawals } from './withdrawal'
import { WITHDRAWAL_DAYS } from './withdrawal-wording'
import type { PricingRow } from './billing-core'
import { UVR_TIER_PLAN_IDS, bestSupporterLevel, creditBalance, donationDays, extendSupporterExpiry, isUvrTier, isValidJobRef, mapPricingPlans, sourcePlanId, supporterLevel, timingSafeEqualStr, uvrDebitKey, uvrJobCost, uvrModelCredits, uvrRefundKey, verifyStripeSignature, } from './billing-core'

type Respond = (body: object | null, init?: ResponseInit) => Response

const ALLOWED_ORIGINS = [
  'https://mercurypitch.com',
  'https://dev.mercurypitch.com',
  'https://localhost:3000',
  'http://localhost:3000',
]

function appOrigin(request: Request): string {
  const origin = request.headers.get('Origin') ?? ''
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
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
      // The withdrawal model the packs are sold under: the footnote under
      // them and Settings › Credits follow it (withdrawal-wording.ts).
      withdrawal: { mode: withdrawalMode(env), days: WITHDRAWAL_DAYS },
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

  // The native app sees the songs it can spend, in every field that says
  // what can be spent, and never credits bought on the web (S7 D9).
  const app =
    spenderOf(request) === 'app'
      ? await readAppSongs(env, auth.userId, Date.now())
      : null
  const ledger =
    app === null
      ? await env.DB.prepare('SELECT delta FROM creditLedger WHERE userId = ?')
          .bind(auth.userId)
          .all<{ delta: number }>()
      : null
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

  const promoClaims = await readPromoClaims(env, auth.userId)
  // The launch offer is the web's, like the credits it counts.
  const offer = app === null ? await readFinisherOffer(env, auth.userId) : null

  const balance = app?.left ?? creditBalance(ledger?.results ?? [])
  return respond({
    creditBalance: balance,
    entitlements,
    // The same balance in the native app's words, with the Karaoke
    // subscription around it (songs-allowance.ts).
    songs: songsSummary(
      entitlements,
      balance,
      songAllowance(env),
      Date.now(),
      app ?? undefined,
    ),
    // The codes alone, as clients before promoClaims read them.
    redeemedPromos: promoClaims.map((claim) => claim.code),
    promoClaims,
    // Where the account stands in the launch offer (launch-finisher.ts), or
    // null when it has none.
    offer,
    // Managed testers receive synthetic credits and perks from Mission
    // Control. Report billing as unavailable for this caller so the client
    // does not present purchase controls that checkout will reject.
    stripeConfigured: isStripeConfigured(env) && !auth.isTestAccount,
  })
}

interface CheckoutBody {
  planId?: string
}

/** 429 for the shared checkout/portal bucket. */
function tooManyStripeSessions(
  respond: Respond,
  rl: { retryAfter?: number },
): Response {
  const after = rl.retryAfter ?? 60
  return respond(
    {
      error: `Too many payment attempts. Try again in ${after} seconds.`,
    },
    { status: 429, headers: { 'Retry-After': String(after) } },
  )
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
  const rl = await checkRateLimit(
    env.DB,
    `user:${auth.userId}`,
    'billing-checkout',
  )
  if (!rl.allowed) return tooManyStripeSessions(respond, rl)
  if (auth.isTestAccount) {
    return respond(
      { error: 'Billing is disabled for managed testing accounts' },
      { status: 403 },
    )
  }
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
  // The launch offer's bonus, when the account has it unlocked: metadata
  // for the webhook and a line above the pay button.
  Object.assign(
    params,
    await finisherCheckoutParams(env, auth.userId, plan.kind),
  )
  // A pack's withdrawal checkbox, and our line before the offer's above the
  // pay button (checkout-consent.ts).
  Object.assign(
    params,
    consentCheckoutParams(
      env,
      plan.kind,
      params['custom_text[submit][message]'],
    ),
  )
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
  // Shares the checkout bucket: both routes mint a Stripe session, and a
  // caller looping one is the same problem as looping the other.
  const rl = await checkRateLimit(
    env.DB,
    `user:${auth.userId}`,
    'billing-checkout',
  )
  if (!rl.allowed) return tooManyStripeSessions(respond, rl)
  if (auth.isTestAccount) {
    return respond(
      { error: 'Billing is disabled for managed testing accounts' },
      { status: 403 },
    )
  }

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
  /** The session is not paid yet, so nothing was granted: its
   *  `checkout.session.async_payment_succeeded` grants it. */
  unpaid?: boolean
}

/** Process one completed checkout. Credits and donations both arrive as
 *  `checkout.session.completed`; the session metadata says which. Routing both
 *  through here means the reconciliation sweep (which calls this same function)
 *  recovers missed donations for free — do NOT add a second recovery path.
 *
 *  Only a paid session grants. A delayed payment method (a bank debit)
 *  completes the session before the money arrives, with `payment_status`
 *  'unpaid'; its `checkout.session.async_payment_succeeded` carries the same
 *  session, paid, and grants then, under its own event id. A payment that
 *  fails grants nothing. */
async function grantForCheckout(
  env: Env,
  eventId: string,
  session: Record<string, unknown>,
  eventCreated?: number,
): Promise<GrantOutcome> {
  const metadata =
    (session.metadata as Record<string, unknown> | undefined) ?? {}
  const donation = metadata.kind === 'donation'
  if (session.payment_status !== 'paid') {
    // 'unpaid' is a delayed payment on its way. Nothing else should reach
    // here: no session is created with a discount that could make it free.
    const log =
      session.payment_status === 'unpaid' ? console.log : console.error
    log(
      `[billing] checkout ${eventId}: payment ${String(session.payment_status)}, nothing granted until it is paid`,
    )
    return {
      granted: 0,
      userId: null,
      duplicate: false,
      unit: donation ? 'supporter days' : 'credits',
      unpaid: true,
    }
  }
  return donation
    ? grantSupporterEntitlement(env, eventId, session)
    : grantCheckoutCredits(env, eventId, session, eventCreated)
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
    return {
      granted: 0,
      userId: null,
      duplicate: false,
      unit: 'supporter days',
    }
  }

  const now = new Date().toISOString()
  const claimed = await env.DB.prepare(
    `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey, paymentIntentId)
     VALUES (?, ?, ?, 0, 'donation', ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      now,
      userId,
      planId,
      `evt:${eventId}`,
      paymentIntentOf(session),
    )
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
  eventCreated?: number,
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
  // The PaymentIntent is what a refund or a dispute names (stripe-payments.ts).
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey, paymentIntentId)
     VALUES (?, ?, ?, ?, 'purchase', ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      now,
      userId,
      credits,
      planId,
      `evt:${eventId}`,
      paymentIntentOf(session),
    )
    .run()
  console.log(
    `[billing] checkout ${eventId}: +${credits} credits user=${userId}` +
      (res.meta.changes === 0 ? ' [duplicate, skipped]' : ''),
  )
  // The launch offer's bonus, when the pack was bought with it. Written on a
  // redelivery too: if it failed after the pack's row, Stripe's retry finds
  // the pack a duplicate and this writes the bonus (launch-finisher.ts).
  const bonus = await grantFinisherBonus(env, session, userId)

  // The withdrawal consent the session carried, and the purchase mail that
  // confirms it, each recorded (checkout-consent.ts). On a redelivery too:
  // the consent is kept once per session and the mail goes only while it has
  // not, so a delivery cut off after the credits landed loses neither. It
  // throws only when the consent row cannot be written: the webhook answers
  // 500 and records nothing, and Stripe's next delivery finds the credits
  // granted and writes the row. Nothing undoes the credits that landed.
  await confirmPurchase(env, {
    eventId,
    eventCreated,
    session,
    userId,
    planId,
    credits,
    bonus,
    grantedAt: now,
  })
  return {
    granted: (res.meta.changes > 0 ? credits : 0) + bonus,
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
  /** Client-declared song length — adds the long-song surcharge blocks
   *  (uvrLengthFactor). The RunPod handler probes the REAL duration and
   *  rejects a job whose actual factor exceeds the declared one, so this
   *  can only over-pay, never under-pay. Absent = base factor. */
  durationSeconds?: number
  /** `app`: the main worker spends for the native app, which spends only
   *  its own songs (app-songs.ts). Anything else is the web's spend. */
  from?: unknown
}

const MODEL_NAME_RE = /^[A-Za-z0-9._-]{1,80}$/

/** Sane declared-duration bounds: positive, finite, under a day. */
const isValidDuration = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value > 0 &&
  value < 86_400

async function getUvrCost(
  env: Env,
  tier: 'gpu' | 'cpu',
  model?: string,
  durationSeconds?: number,
): Promise<number> {
  const plan = await env.DB.prepare(
    'SELECT credits FROM pricingPlans WHERE id = ? AND active = 1',
  )
    .bind(UVR_TIER_PLAN_IDS[tier])
    .first<{ credits: number | null }>()
  return uvrJobCost(plan?.credits ?? 0, model, durationSeconds)
}

async function getUvrQuote(
  env: Env,
  userId: string,
  tier: 'gpu' | 'cpu',
  model?: string,
  durationSeconds?: number,
): Promise<{ cost: number; balance: number }> {
  const cost = await getUvrCost(env, tier, model, durationSeconds)
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

  let body: Pick<DebitBody, 'tier' | 'model' | 'durationSeconds' | 'from'>
  try {
    body =
      await request.json<
        Pick<DebitBody, 'tier' | 'model' | 'durationSeconds' | 'from'>
      >()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!isUvrTier(body.tier)) {
    return respond({ error: 'tier must be "gpu" or "cpu"' }, { status: 400 })
  }
  if (body.model !== undefined && !MODEL_NAME_RE.test(body.model)) {
    return respond({ error: 'Invalid model' }, { status: 400 })
  }
  if (
    body.durationSeconds !== undefined &&
    !isValidDuration(body.durationSeconds)
  ) {
    return respond({ error: 'Invalid durationSeconds' }, { status: 400 })
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

  const quote =
    spenderOf(request, body.from) === 'app'
      ? {
          cost: await getUvrCost(
            env,
            body.tier,
            body.model,
            body.durationSeconds,
          ),
          balance: (await readAppSongs(env, auth.userId, Date.now())).left,
        }
      : await getUvrQuote(
          env,
          auth.userId,
          body.tier,
          body.model,
          body.durationSeconds,
        )
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
  if (
    body.durationSeconds !== undefined &&
    !isValidDuration(body.durationSeconds)
  ) {
    return respond({ error: 'Invalid durationSeconds' }, { status: 400 })
  }
  if (spenderOf(request, body.from) === 'app') {
    return handleAppDebit(
      env,
      auth,
      { ...body, tier: body.tier, jobRef: body.jobRef },
      respond,
    )
  }

  const { cost, balance } = await getUvrQuote(
    env,
    auth.userId,
    body.tier,
    body.model,
    body.durationSeconds,
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
      return respond({
        debited: -existing.delta,
        cost,
        balance,
        duplicate: true,
      })
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

interface AppJob {
  tier: 'gpu' | 'cpu'
  jobRef: string
}

/** The native app's debit: its songs only, the month's free song first
 *  (app-songs.ts). Same answers as the web's, in the same shape. */
async function handleAppDebit(
  env: Env,
  auth: { userId: string },
  body: DebitBody & AppJob,
  respond: Respond,
): Promise<Response> {
  const cost = await getUvrCost(
    env,
    body.tier,
    body.model,
    body.durationSeconds,
  )
  if (cost <= 0) {
    const { left } = await readAppSongs(env, auth.userId, Date.now())
    return respond({ debited: 0, cost: 0, balance: left })
  }
  let spent: AppDebit
  try {
    spent = await debitAppSongs(env, auth.userId, body.jobRef, cost)
  } catch (error) {
    if (!(error instanceof LedgerBusy)) throw error
    // Nothing was written, and the debit is idempotent per job: the main
    // worker asks again (uvr-metering.ts) rather than cancel the job.
    console.warn(`[billing] app debit ${body.jobRef}: ${error.message}`)
    return respond(
      { error: 'Billing is busy. Try again.', retryable: true },
      { status: 503, headers: { 'Retry-After': '1' } },
    )
  }
  if (spent.outcome === 'duplicate') {
    return respond({
      debited: spent.songs,
      cost,
      balance: spent.left,
      duplicate: true,
    })
  }
  if (spent.outcome === 'short') {
    console.warn(
      `[billing] app debit ${body.jobRef}: refused (user=${auth.userId} songs=${spent.left} required=${cost})`,
    )
    return respond(
      { error: 'Insufficient credits', required: cost, balance: spent.left },
      { status: 402 },
    )
  }
  console.log(
    `[billing] app debit ${body.jobRef}: -${cost}${spent.free > 0 ? ' (free song)' : ''} user=${auth.userId} songs=${spent.left}`,
  )
  return respond({
    debited: cost,
    cost,
    balance: spent.left,
    ...(spent.free > 0 ? { freeSong: true } : {}),
  })
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
  if (!debit) {
    // Never debited (unmetered job or unknown ref) — nothing to refund.
    return respond({ refunded: 0 })
  }
  if (debit.delta >= 0) {
    // No credits taken: the month's free song paid for all of it, in the
    // native app (app-songs.ts). It comes back; there is nothing else to.
    const freeSong = await giveFreeSongBack(env, debit.userId, body.jobRef)
    return respond({ refunded: 0, ...(freeSong ? { freeSong: true } : {}) })
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
  // A longer song the free song paid part of: that part comes back too.
  await giveFreeSongBack(env, debit.userId, body.jobRef)
  return respond({ refunded: amount, duplicate: res.meta.changes === 0 })
}

/** What a checkout event's grant came to, as the sweep's alert lists it. */
function grantDetail(outcome: GrantOutcome): string {
  return `+${outcome.granted} ${outcome.unit}, user=${outcome.userId ?? 'UNKNOWN (bad metadata, investigate)'}`
}

async function applyCheckoutEvent(
  env: Env,
  get: StripeGet,
  event: StripeEventInput,
): Promise<StripeEventResult> {
  const outcome = await grantForCheckout(
    env,
    event.id,
    event.object,
    event.created > 0 ? event.created : undefined,
  )
  // A refund or dispute that reached us before this purchase took nothing:
  // the purchase takes it back now. On a redelivery too, in case the first
  // delivery failed between the grant and this.
  if (outcome.userId !== null && outcome.unit === 'credits') {
    await settleEarlyMoneyBack(
      env,
      get,
      event.id,
      event.object,
      outcome.userId,
      PURCHASE_RECORD,
    )
  }
  // Only the claim winner may mark the event processed. A duplicate here
  // means another delivery (or the sweep) holds the claim RIGHT NOW - if
  // that winner fails and releases it, recording the event on the loser's
  // behalf would make every retry and sweep skip it forever: paid, no
  // grant, no trace. The winner records it below on its own success.
  if (outcome.duplicate) return { kind: 'duplicate' }
  await recordBillingEvent(env, event.id, event.type)
  return outcome.unpaid === true
    ? { kind: 'unpaid' }
    : { kind: 'applied', detail: grantDetail(outcome) }
}

/**
 * Apply one Stripe event. The webhook and the reconciliation sweep both come
 * here, so an event applies the same way whichever reaches it first, and
 * once: billingEvents records it when it is done, and a recorded event is
 * skipped. Throws on anything that may pass on a retry (D1, Stripe, a busy
 * ledger), and leaves the event unrecorded.
 */
async function applyStripeEvent(
  env: Env,
  get: StripeGet,
  event: StripeEventInput,
): Promise<StripeEventResult> {
  if (!isCheckoutPaidEvent(event.type) && !isMoneyBackEvent(event.type)) {
    return { kind: 'ignored', reason: 'unhandled event type' }
  }
  // Idempotency: an event id already in billingEvents was FULLY processed.
  // The id is recorded only after the event is applied: recording first
  // would turn a failure halfway (500, Stripe retries, "duplicate") into a
  // grant or a take-back lost for good. A concurrent double delivery can
  // reach the work twice; the ledger's UNIQUE idempotencyKey (`evt:<id>`,
  // `clawback:<id>`) makes the second write a no-op.
  const seen = await env.DB.prepare('SELECT id FROM billingEvents WHERE id = ?')
    .bind(event.id)
    .first<{ id: string }>()
  if (seen) return { kind: 'duplicate' }
  if (isCheckoutPaidEvent(event.type)) {
    return applyCheckoutEvent(env, get, event)
  }
  const result = await applyMoneyBack(env, get, event, PURCHASE_RECORD)
  await recordBillingEvent(env, event.id, event.type)
  return result
}

/** Stripe's REST GET, for the money-back handler and the sweep. */
function stripeReader(env: Env): StripeGet {
  return (pathWithQuery) => stripeGet(env, pathWithQuery)
}

function webhookAnswer(result: StripeEventResult): object {
  if (result.kind === 'duplicate') return { received: true, duplicate: true }
  if (result.kind === 'ignored') {
    return { received: true, ignored: result.reason }
  }
  return { received: true }
}

/**
 * Stripe's webhook. Stripe redelivers any event it does not get a 2xx for,
 * for three days, so the answer says whether a retry can help: 400 for a
 * signature that does not verify (or is older than five minutes), 500 for a
 * failure that may pass (D1 or Stripe out of reach), and 200 for everything
 * else, including what never will: a body Stripe signed that nobody can
 * read, a charge Stripe no longer knows, a type nothing here handles. The
 * 500 says nothing about why; the log does.
 */
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

  const event = readWebhookEvent(payload)
  if ('ignored' in event) {
    return respond({ received: true, ignored: event.ignored })
  }
  try {
    return respond(
      webhookAnswer(await applyStripeEvent(env, stripeReader(env), event)),
    )
  } catch (err) {
    console.error(
      `[billing] webhook ${event.type} ${event.id}: failed, answered 500 so Stripe retries:`,
      err,
    )
    return respond({ error: 'Not processed, retry later' }, { status: 500 })
  }
}

// ── Reconciliation (cron) ────────────────────────────────────────────
// Webhooks fail silently: Stripe keeps the money, we never learn a grant was
// missed (2026-07: the endpoints pointed at a dead host for 10 days), and a
// refund or dispute whose webhook failed for all of Stripe's three days of
// retries is never taken back. The sweep (stripe-sweep.ts) is the safety net
// for ANY delivery failure: it lists every event type the webhook handles
// from the last 30 days and applies each one billingEvents has never seen,
// through the webhook's own handler, applyStripeEvent.

/** Run the sweep. Never throws: a sweep that cannot run alerts instead, as
 *  one that cannot finish does. */
export async function reconcileBilling(env: Env): Promise<void> {
  if (!isStripeConfigured(env)) {
    console.log('[billing] reconcile: Stripe not configured — skipped')
    return
  }
  const get = stripeReader(env)
  const alert = async (subject: string, lines: string[]): Promise<void> => {
    await sendBillingAlert(
      { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
      env.BILLING_ALERT_EMAIL ?? '',
      subject,
      lines,
    )
  }
  try {
    await sweepStripeEvents({
      get,
      apply: (event) => applyStripeEvent(env, get, event),
      alert,
      nowSec: Math.floor(Date.now() / 1000),
    })
  } catch (err) {
    console.error('[billing] reconcile: the sweep stopped:', err)
    await alert('Sweep failed: it stopped before the end', [
      'The reconciliation sweep stopped on an error before it finished, so a',
      'purchase, refund or dispute the webhook missed may not be applied yet.',
      'It runs again in six hours. The worker logs say what stopped it.',
    ])
  }
}

/**
 * The code the app offers with one click — the header pill and the claim card
 * — or `{ promo: null }` when no featured code is open. Public, because the
 * pill shows before anyone signs in; it says the code, its credits and its
 * end, never the cap or how many have claimed it. Cached for a minute, so a
 * code switched off in the table leaves the app within one.
 */
async function handleFeaturedPromo(
  env: Env,
  respond: Respond,
): Promise<Response> {
  const row = await env.DB.prepare(
    // idx_promoCodes_featured allows one featured row; LIMIT says so here too.
    'SELECT code, credits, maxRedemptions, redemptionCount, startsAt, expiresAt, active FROM promoCodes WHERE featured = 1 LIMIT 1',
  ).first<FeaturedPromoRow>()
  return respond(
    { promo: featuredPromoView(row, new Date()) },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  )
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
  if (route === 'promo/redeem' && method === 'POST') {
    return handlePromoRedeem(request, env, respond)
  }
  if (route === 'promo/featured' && method === 'GET') {
    return handleFeaturedPromo(env, respond)
  }
  if (route === 'review-access' && method === 'POST') {
    return handleReviewAccess(request, env, respond)
  }
  if (route === 'checkout' && method === 'POST') {
    return handleCheckout(request, env, respond)
  }
  if (route === 'portal' && method === 'GET') {
    return handlePortal(request, env, respond)
  }
  if (route === 'webhook' && method === 'POST') {
    return handleWebhook(request, env, respond)
  }
  if (route === 'revenuecat' && method === 'POST') {
    return handleRevenueCatWebhook(request, env, respond)
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
  if (route === 'withdrawals') {
    const answer = await handleWithdrawals(request, env, respond)
    if (answer !== null) return answer
  }
  return respond({ error: 'Not found' }, { status: 404 })
}
