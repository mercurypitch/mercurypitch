// ── Billing: DB-driven pricing + Stripe checkout/portal/webhook ──────
//
// Routes (handled by handleBilling):
//   GET  /api/billing/pricing   — public; tiers + packs from pricingPlans
//   GET  /api/billing/me        — auth; credit balance + entitlements
//   POST /api/billing/checkout  — auth; { planId } → Stripe Checkout url
//   GET  /api/billing/portal    — auth; Stripe Customer Portal url
//   POST /api/billing/webhook   — Stripe; signature-verified, idempotent
//
// Design (see docs/plans/premium.md):
//  • Prices live in the DB (pricingPlans), never in the repo. `amount` NULL
//    renders as "Soon" and is not purchasable.
//  • Stripe-hosted UI only; the webhook is the sole writer of credits/
//    entitlements. Credits are an append-only ledger; balance = SUM(delta).
//  • Inert until configured: with STRIPE_SECRET_KEY unset, checkout/portal
//    return 501 and pricing still renders (as "Soon").
//
// Pure helpers (pricing mapping, balance, webhook signature) live in
// billing-core.ts so they're unit-testable without the worker runtime.

import type { Env } from './auth'
import { getAuth } from './auth'
import type { PricingRow } from './billing-core'
import { creditBalance, mapPricingPlans, verifyStripeSignature, } from './billing-core'

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
  return respond(
    { ...pricing, stripeConfigured: isStripeConfigured(env) },
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
  const { results: entitlements } = await env.DB.prepare(
    'SELECT feature, source, expiresAt FROM entitlements WHERE userId = ?',
  )
    .bind(auth.userId)
    .all<{ feature: string; source: string | null; expiresAt: string | null }>()

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
      { error: 'Upgrade your account to buy credits' },
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
  if (plan.amount == null || (plan.stripePriceId ?? '') === '') {
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
    success_url: `${origin}/#/billing/success`,
    cancel_url: `${origin}/#/pricing`,
    client_reference_id: auth.userId,
    'metadata[userId]': auth.userId,
    'metadata[planId]': plan.id,
    'metadata[credits]': String(plan.credits ?? 0),
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

/** Grant credits for a completed checkout, idempotent on the event id. */
async function grantCheckoutCredits(
  env: Env,
  eventId: string,
  session: Record<string, unknown>,
): Promise<void> {
  const metadata =
    (session.metadata as Record<string, unknown> | undefined) ?? {}
  const userId = typeof metadata.userId === 'string' ? metadata.userId : ''
  const credits = Number(metadata.credits ?? 0)
  if (userId === '' || !Number.isFinite(credits) || credits <= 0) return

  // idempotencyKey ties the grant to the event, so a redelivered webhook
  // (or a retry) can never double-credit — the UNIQUE constraint drops it.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
     VALUES (?, ?, ?, ?, 'purchase', ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      userId,
      credits,
      typeof metadata.planId === 'string' ? metadata.planId : null,
      `evt:${eventId}`,
    )
    .run()
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

  // Idempotency: record the event id first; a second delivery is a no-op.
  const recorded = await env.DB.prepare(
    'INSERT OR IGNORE INTO billingEvents (id, createdAt, type) VALUES (?, ?, ?)',
  )
    .bind(event.id, new Date().toISOString(), event.type ?? null)
    .run()
  if (recorded.meta.changes === 0) {
    return respond({ received: true, duplicate: true })
  }

  if (event.type === 'checkout.session.completed') {
    await grantCheckoutCredits(env, event.id, event.data?.object ?? {})
  }
  // Other event types are acknowledged (200) without action for now.
  return respond({ received: true })
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
  return respond({ error: 'Not found' }, { status: 404 })
}
