// @vitest-environment node
//
// ── The 14-day withdrawal for a credit pack, end to end ──
//
// A pack's checkout asks for the withdrawal checkbox in the words of
// WITHDRAWAL_MODE, and the paid session keeps what the buyer ticked, with
// the purchase mail that confirms it (checkout-consent.ts). Settings ›
// Credits lists each pack that can still be cancelled under the terms its
// own checkout recorded, and a statement there refunds the unused paid
// credits' share of the price (or, with no consent on record, the whole
// price) through Stripe, takes what is left of the pack and its bonus off
// the balance, and acknowledges it by mail (withdrawal.ts,
// withdrawal-finish.ts, withdrawal-rules.ts). The refund's own
// charge.refunded then takes nothing a second time (stripe-payments.ts), and
// the 6-hourly cron finishes whatever a request left undone.
//
// Real SQLite with every migration applied, through the worker's own fetch
// and scheduled handlers. Stripe and Resend are stubbed at fetch: nothing
// leaves the process, and the stub records what would have been sent.

import { createHmac } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import { UNSENT_PURCHASE_MAILS_SQL } from '../src/checkout-consent'
import worker from '../src/index'
import { CHECKOUT_CHECKBOX, WITHDRAWAL_TEXT_VERSION, } from '../src/withdrawal-wording'
import type { SqliteD1Statement } from './sqlite-d1'
import { applyMigrations, interleaved, SqliteD1Database } from './sqlite-d1'

const WEBHOOK_SECRET = 'whsec_withdrawal_integration'
const PASSWORD = 'Singer123!pass'
const STRIPE = 'https://api.stripe.com/v1'
const RESEND = 'https://api.resend.com/emails'
const ACK_SUBJECT = "We've received your cancellation"

/** What each pack costs, in cents, as the Checkout Session reports it. */
const PRICES: Record<string, number> = {
  'pack-starter': 500,
  'pack-plus': 2000,
}

let sqlite: DatabaseSync
let perksSqlite: DatabaseSync
let env: Env

interface Sent {
  url: string
  method: string
  body: string
  headers: Record<string, string>
}
/** Every request the worker made to the outside world, which got a stub. */
let sent: Sent[]
/** How Stripe answers a refund: made; refused; busy with the same key;
 *  made, with the answer lost on the way back; or down, making nothing. */
let stripeRefunds: 'ok' | 'refused' | 'busy' | 'lost' | 'down'
/** The status a refund Stripe makes starts in. */
let newRefundStatus: string
/** Stripe has forgotten its idempotency keys, as it does after 24 hours. */
let stripeForgetsKeys: boolean
/** Stripe's list of refunds answers 503. */
let refundListDown: boolean
/** Refunds on one page of Stripe's list. */
let refundPageSize: number
/** The refunds Stripe made, newest first, as Stripe lists them. */
let refundsMade: Array<Record<string, unknown>>
/** What Stripe says each PaymentIntent received. */
let paymentIntents: Map<string, { amount_received: number; currency: string }>
/** Which mails Resend refuses: true answers 500, which says nothing of
 *  whether it will take the mail later; a number answers that status, a
 *  422 being a refusal for good. */
let resendRefuses: (mail: { subject: string }) => boolean | number

function makeRefund(
  form: URLSearchParams,
  key: string | undefined,
): Record<string, unknown> {
  const refund = {
    id: `re_${refundsMade.length + 1}`,
    object: 'refund',
    status: newRefundStatus,
    amount: Number(form.get('amount')),
    payment_intent: form.get('payment_intent'),
    metadata: { withdrawalId: form.get('metadata[withdrawalId]') },
    key,
  }
  refundsMade.unshift(refund)
  return refund
}

function refundAnswer(body: string, key: string | undefined): Response {
  if (stripeRefunds === 'refused') {
    return Response.json(
      { error: { message: 'Charge ch_test has been charged back.' } },
      { status: 400 },
    )
  }
  if (stripeRefunds === 'busy') {
    return Response.json(
      { error: { type: 'idempotency_error', message: 'In progress.' } },
      { status: 409 },
    )
  }
  if (stripeRefunds === 'down') {
    return Response.json(
      { error: { message: 'Something went wrong on our end.' } },
      { status: 503 },
    )
  }
  const earlier = stripeForgetsKeys
    ? undefined
    : refundsMade.find((refund) => refund.key === key)
  if (earlier !== undefined) return Response.json(earlier)
  const refund = makeRefund(new URLSearchParams(body), key)
  if (stripeRefunds === 'lost') {
    throw new TypeError('fetch failed: the connection was reset')
  }
  return Response.json(refund)
}

/** GET /v1/refunds?payment_intent=…, a page at a time. */
function refundList(url: URL): Response {
  if (refundListDown) {
    return Response.json({ error: { message: 'Down.' } }, { status: 503 })
  }
  const paymentIntent = url.searchParams.get('payment_intent')
  const all = refundsMade.filter(
    (refund) => refund.payment_intent === paymentIntent,
  )
  const after = url.searchParams.get('starting_after')
  const start =
    after === null ? 0 : all.findIndex((refund) => refund.id === after) + 1
  const size = Math.min(
    Number(url.searchParams.get('limit') ?? 10),
    refundPageSize,
  )
  return Response.json({
    object: 'list',
    data: all.slice(start, start + size),
    has_more: start + size < all.length,
  })
}

function stripeGetAnswer(url: string): Response | null {
  if (url.startsWith(`${STRIPE}/refunds?`)) return refundList(new URL(url))
  if (url.startsWith(`${STRIPE}/refunds/`)) {
    const id = decodeURIComponent(url.slice(`${STRIPE}/refunds/`.length))
    const refund = refundsMade.find((made) => made.id === id)
    return refund === undefined
      ? Response.json({ error: { message: 'No such refund' } }, { status: 404 })
      : Response.json(refund)
  }
  if (url.startsWith(`${STRIPE}/payment_intents/`)) {
    const id = decodeURIComponent(
      url.slice(`${STRIPE}/payment_intents/`.length),
    )
    const intent = paymentIntents.get(id)
    return intent === undefined
      ? Response.json(
          { error: { message: `No such payment_intent: '${id}'` } },
          { status: 404 },
        )
      : Response.json({ id, object: 'payment_intent', ...intent })
  }
  // The cron's reconciliation asks for recent events: none here.
  if (url.startsWith(`${STRIPE}/events?`)) {
    return Response.json({ object: 'list', data: [], has_more: false })
  }
  return null
}

/** A refusal as Resend words one. */
function resendError(status: number): Response {
  const named: Record<number, [string, string]> = {
    403: ['invalid_api_key', 'API key is invalid'],
    422: ['validation_error', 'Invalid `to` field.'],
    429: ['rate_limit_exceeded', 'Too many requests.'],
  }
  const [name, message] = named[status] ?? [
    'internal_server_error',
    'An unexpected error occurred.',
  ]
  return Response.json({ statusCode: status, name, message }, { status })
}

function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const method = init?.method ?? 'GET'
      const body =
        typeof init?.body === 'string'
          ? init.body
          : init?.body instanceof URLSearchParams
            ? init.body.toString()
            : ''
      const headers = Object.fromEntries(new Headers(init?.headers).entries())
      sent.push({ url, method, body, headers })
      if (url === `${STRIPE}/customers`) {
        return Response.json({ id: 'cus_withdrawal' })
      }
      if (url === `${STRIPE}/checkout/sessions`) {
        return Response.json({ id: 'cs_withdrawal', url: 'https://pay.test' })
      }
      if (method === 'GET') {
        const answer = stripeGetAnswer(url)
        if (answer !== null) return answer
      }
      if (url === `${STRIPE}/refunds` && method === 'POST') {
        return refundAnswer(body, headers['idempotency-key'])
      }
      if (url === RESEND) {
        const refusal = resendRefuses(JSON.parse(body) as { subject: string })
        if (refusal === false) return Response.json({ id: 'stubbed' })
        return resendError(refusal === true ? 500 : refusal)
      }
      throw new Error(`unexpected fetch in a test: ${url}`)
    }),
  )
}

interface Mail {
  to: string[]
  bcc?: string[]
  subject: string
  text: string
  html: string
}

function mails(): Mail[] {
  return sent
    .filter((request) => request.url === RESEND)
    .map((request) => JSON.parse(request.body) as Mail)
}

/** Billing alerts to the owner, by subject. */
function alerts(): Mail[] {
  return mails().filter((mail) =>
    mail.subject.startsWith('[MercuryPitch billing]'),
  )
}

function acknowledgements(): Mail[] {
  return mails().filter((mail) => mail.subject === ACK_SUBJECT)
}

function refundRequests(): Sent[] {
  return sent.filter(
    (request) =>
      request.url === `${STRIPE}/refunds` && request.method === 'POST',
  )
}

async function call(
  path: string,
  init: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {}
  if (init.token !== undefined) headers.Authorization = `Bearer ${init.token}`
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await worker.fetch(
    new Request(`https://api.test${path}`, {
      method: init.body === undefined ? 'GET' : 'POST',
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    }),
    env,
    {} as ExecutionContext,
  )
  const text = await response.text()
  return {
    status: response.status,
    body: text === '' ? {} : (JSON.parse(text) as Record<string, unknown>),
  }
}

interface Buyer {
  userId: string
  token: string
  email: string
}

async function buyer(email: string): Promise<Buyer> {
  const res = await call('/api/auth/register', {
    body: { email, password: PASSWORD },
  })
  expect(res.status).toBe(200)
  const { userId, token } = res.body as { userId: string; token: string }
  return { userId, token, email }
}

/** The parameters of the last Checkout Session the worker asked Stripe for. */
function lastCheckout(): URLSearchParams {
  const request = sent
    .filter((r) => r.url === `${STRIPE}/checkout/sessions`)
    .at(-1)
  if (request === undefined) throw new Error('no checkout session was asked')
  return new URLSearchParams(request.body)
}

async function checkout(who: Buyer, planId: string): Promise<URLSearchParams> {
  const res = await call('/api/billing/checkout', {
    token: who.token,
    body: { planId },
  })
  expect(res.status).toBe(200)
  return lastCheckout()
}

interface StripeEvent {
  id: string
  type: string
  created?: number
  data: { object: Record<string, unknown> }
}

/** Deliver an event to the webhook, signed as Stripe signs it. */
async function deliver(event: StripeEvent): Promise<number> {
  const payload = JSON.stringify(event)
  const timestamp = Math.floor(Date.now() / 1000)
  const digest = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  const response = await worker.fetch(
    new Request('https://api.test/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': `t=${timestamp},v1=${digest}`,
      },
      body: payload,
    }),
    env,
    {} as ExecutionContext,
  )
  return response.status
}

/** The event Stripe sends once the session `params` made is paid. */
function paidEvent(
  id: string,
  params: URLSearchParams,
  paymentIntent: string,
  ticked: boolean,
): StripeEvent {
  const metadata: Record<string, string> = {}
  for (const [key, value] of params) {
    const field = /^metadata\[(.+)\]$/.exec(key)?.[1]
    if (field !== undefined) metadata[field] = value
  }
  return {
    id,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_${id}`,
        object: 'checkout.session',
        mode: 'payment',
        payment_status: 'paid',
        payment_intent: paymentIntent,
        amount_total: PRICES[metadata.planId ?? ''] ?? 0,
        currency: 'eur',
        consent: ticked ? { terms_of_service: 'accepted' } : null,
        metadata,
      },
    },
  }
}

/** Buy a pack through checkout and the webhook; its purchase id. */
async function buy(
  who: Buyer,
  planId: string,
  paymentIntent: string,
  ticked = true,
): Promise<string> {
  const params = await checkout(who, planId)
  const eventId = `evt_${paymentIntent}`
  expect(await deliver(paidEvent(eventId, params, paymentIntent, ticked))).toBe(
    200,
  )
  const row = sqlite
    .prepare('SELECT id FROM creditLedger WHERE idempotencyKey = ?')
    .get(`evt:${eventId}`) as { id: string }
  return row.id
}

function insertRow(
  userId: string,
  delta: number,
  reason: string,
  jobRef: string | null,
  key: string,
  paymentIntentId: string | null = null,
): void {
  sqlite
    .prepare(
      `INSERT INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey, paymentIntentId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      new Date().toISOString(),
      userId,
      delta,
      reason,
      jobRef,
      key,
      paymentIntentId,
    )
}

/** Separations paid with credits, as the debit route writes them. */
function spend(userId: string, credits: number, jobRef: string): void {
  insertRow(userId, -credits, 'uvr-job', jobRef, `uvr:${jobRef}`)
}

/** Free credits, the way a promo code lands them. */
function freeCredits(userId: string, credits: number): void {
  insertRow(userId, credits, 'promo', 'promo-launch', `promo:${userId}`)
}

/** The launch offer's bonus beside the pack paid by `paymentIntent`. */
function launchBonus(userId: string, paymentIntent: string): void {
  insertRow(
    userId,
    30,
    'offer-bonus',
    'launch-finisher',
    `offer:launch-finisher:${userId}`,
    paymentIntent,
  )
}

function balance(userId: string): number {
  const row = sqlite
    .prepare(
      'SELECT COALESCE(SUM(delta), 0) AS total FROM creditLedger WHERE userId = ?',
    )
    .get(userId) as { total: number }
  return row.total
}

function takes(userId: string): Array<Record<string, unknown>> {
  return sqlite
    .prepare(
      `SELECT delta, reason, jobRef, idempotencyKey FROM creditLedger
        WHERE userId = ? AND delta < 0 AND reason <> 'uvr-job' ORDER BY rowid`,
    )
    .all(userId)
}

/** What refunds and disputes took back from the account, all told. */
function takenBack(userId: string): number {
  const row = sqlite
    .prepare(
      `SELECT COALESCE(SUM(delta), 0) AS total FROM creditLedger
        WHERE userId = ? AND reason IN ('purchase-refund', 'purchase-dispute')`,
    )
    .get(userId) as { total: number }
  return 0 - row.total
}

function statementOf(purchaseId: string): Record<string, unknown> | undefined {
  return sqlite
    .prepare('SELECT * FROM withdrawals WHERE purchaseId = ?')
    .get(purchaseId) as Record<string, unknown> | undefined
}

function consentOf(sessionId: string): Record<string, unknown> | undefined {
  return sqlite
    .prepare('SELECT * FROM checkoutConsents WHERE sessionId = ?')
    .get(sessionId) as Record<string, unknown> | undefined
}

async function listFor(who: Buyer) {
  return call('/api/billing/withdrawals', { token: who.token })
}

async function withdraw(
  who: Buyer,
  purchaseId: string,
  overrides: Record<string, unknown> = {},
) {
  return call('/api/billing/withdrawals', {
    token: who.token,
    body: { purchaseId, name: 'Sam Singer', email: who.email, ...overrides },
  })
}

function at(iso: string): void {
  vi.setSystemTime(new Date(iso))
}

/** The 6-hourly cron, as Cloudflare runs it. */
async function cron(): Promise<void> {
  await worker.scheduled({} as ScheduledController, env, {} as ExecutionContext)
}

/** The purchase id of the pack the event `eventId` granted. */
function purchaseOf(eventId: string): string {
  const row = sqlite
    .prepare('SELECT id FROM creditLedger WHERE idempotencyKey = ?')
    .get(`evt:${eventId}`) as { id: string }
  return row.id
}

function purchaseMails(): Mail[] {
  return mails().filter((mail) => /^Your .* ready$/.test(mail.subject))
}

function subjects(list: Mail[]): string[] {
  return list.map((mail) => mail.subject)
}

/** The next `times` statements matching `sql` fail when run, as D1 does
 *  when it is unavailable. */
function failNext(sql: RegExp, times = 1): void {
  const db = env.DB as unknown as SqliteD1Database
  const prepare = db.prepare.bind(db)
  let left = times
  const failing = (statement: SqliteD1Statement): SqliteD1Statement => {
    const bind = statement.bind.bind(statement)
    statement.bind = (...values: Parameters<SqliteD1Statement['bind']>) =>
      failing(bind(...values))
    statement.run = () =>
      Promise.reject(new Error('D1_ERROR: unavailable, injected by the test'))
    return statement
  }
  db.prepare = (text: string) => {
    const statement = prepare(text)
    if (left <= 0 || !sql.test(text)) return statement
    left -= 1
    return failing(statement)
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  at('2026-10-20T10:00:00.000Z')
  sent = []
  stripeRefunds = 'ok'
  newRefundStatus = 'succeeded'
  stripeForgetsKeys = false
  refundListDown = false
  refundPageSize = 100
  refundsMade = []
  paymentIntents = new Map()
  resendRefuses = () => false
  stubFetch()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  perksSqlite = new DatabaseSync(':memory:')
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    PERKS_DB: new SqliteD1Database(perksSqlite) as unknown as D1Database,
    JWT_SECRET: 'withdrawal-integration-jwt',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY: 'withdrawal-integration-admin',
    STRIPE_SECRET_KEY: 'sk_test_withdrawal_integration',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    RESEND_API_KEY: 're_test_withdrawal_integration',
    BILLING_ALERT_EMAIL: 'billing-alerts@example.test',
    // Made up: the owner sets the real ones.
    TRADER_NAME: 'Sample Trader',
    TRADER_ADDRESS: '1 Sample Street, 00000 Sampletown',
    TRADER_EMAIL: 'sales@example.test',
    TRADER_VAT_ID: 'XX000000000',
  }
  const now = new Date().toISOString()
  const plan = sqlite.prepare(
    `INSERT OR REPLACE INTO pricingPlans
       (id, createdAt, updatedAt, kind, label, description, unit, amount, currency, credits, stripePriceId, badge, sortOrder, active)
     VALUES (?, ?, ?, ?, ?, '', ?, ?, 'eur', ?, ?, NULL, 1, 1)`,
  )
  plan.run(
    'pack-starter',
    now,
    now,
    'pack',
    'Starter',
    'pack',
    500,
    30,
    'price_starter',
  )
  plan.run(
    'pack-plus',
    now,
    now,
    'pack',
    'Plus',
    'pack',
    2000,
    140,
    'price_plus',
  )
  plan.run(
    'donate-voice',
    now,
    now,
    'donation',
    'Voice',
    'once',
    500,
    0,
    'price_voice',
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  sqlite.close()
  perksSqlite.close()
})

describe('the checkout asks for the consent', () => {
  it('asks a pack buyer to tick the refund_unused box, by default', async () => {
    const sam = await buyer('sam@example.test')

    const params = await checkout(sam, 'pack-plus')

    expect(params.get('consent_collection[terms_of_service]')).toBe('required')
    expect(
      params.get('custom_text[terms_of_service_acceptance][message]'),
    ).toBe(CHECKOUT_CHECKBOX.refund_unused)
    expect(params.get('custom_text[submit][message]')).toBe(
      'Your credits are added as soon as you pay.',
    )
    expect(params.get('metadata[withdrawalMode]')).toBe('refund_unused')
    expect(params.get('metadata[withdrawalText]')).toBe(WITHDRAWAL_TEXT_VERSION)
  })

  it('asks for the waiver when WITHDRAWAL_MODE says so', async () => {
    env.WITHDRAWAL_MODE = 'waiver'
    const sam = await buyer('sam@example.test')

    const params = await checkout(sam, 'pack-starter')

    expect(
      params.get('custom_text[terms_of_service_acceptance][message]'),
    ).toBe(CHECKOUT_CHECKBOX.waiver)
    expect(params.get('metadata[withdrawalMode]')).toBe('waiver')
  })

  it('never asks a donor', async () => {
    const sam = await buyer('sam@example.test')

    const params = await checkout(sam, 'donate-voice')

    expect(params.has('consent_collection[terms_of_service]')).toBe(false)
    expect(
      params.has('custom_text[terms_of_service_acceptance][message]'),
    ).toBe(false)
    expect(params.has('custom_text[submit][message]')).toBe(false)
    expect(params.has('metadata[withdrawalMode]')).toBe(false)
  })

  it('tells the app the mode with the prices', async () => {
    const byDefault = await call('/api/billing/pricing')
    expect(byDefault.body.withdrawal).toEqual({
      mode: 'refund_unused',
      days: 14,
    })

    env.WITHDRAWAL_MODE = 'waiver'
    const waiver = await call('/api/billing/pricing')
    expect(waiver.body.withdrawal).toEqual({ mode: 'waiver', days: 14 })
  })
})

describe('a paid pack keeps the consent and its confirmation', () => {
  it('records the box, the wording, the price and the mail', async () => {
    const sam = await buyer('sam@example.test')

    await buy(sam, 'pack-plus', 'pi_plus')

    expect(consentOf('cs_evt_pi_plus')).toEqual({
      sessionId: 'cs_evt_pi_plus',
      userId: sam.userId,
      eventId: 'evt_pi_plus',
      paymentIntentId: 'pi_plus',
      mode: 'refund_unused',
      textVersion: WITHDRAWAL_TEXT_VERSION,
      termsOfService: 'accepted',
      acceptedAt: '2026-10-20T10:00:00.000Z',
      amountMinor: 2000,
      currency: 'eur',
      createdAt: '2026-10-20T10:00:00.000Z',
      mailStatus: 'sent',
      mailAt: '2026-10-20T10:00:00.000Z',
      mailAttempts: 1,
      mailError: null,
      mailWarnedAt: null,
    })
    const [mail] = mails().filter(
      (m) => m.subject === 'Your 140 credits are ready',
    )
    expect(mail?.to).toEqual(['sam@example.test'])
    expect(mail?.text).toContain('Your right to cancel')
    expect(mail?.text).toContain(
      'You can still cancel this purchase until 3 November 2026',
    )
    expect(mail?.text).toContain(
      'Sold by Sample Trader, 1 Sample Street, 00000 Sampletown. Email sales@example.test. VAT ID XX000000000.',
    )
    expect(alerts()).toEqual([])
  })

  it('grants a pack that arrives without the box, and alerts the owner', async () => {
    const sam = await buyer('sam@example.test')

    await buy(sam, 'pack-starter', 'pi_old_session', false)

    expect(balance(sam.userId)).toBe(30)
    expect(consentOf('cs_evt_pi_old_session')).toMatchObject({
      termsOfService: null,
      acceptedAt: null,
    })
    expect(alerts().map((mail) => mail.subject)).toEqual([
      '[MercuryPitch billing] Paid pack without the withdrawal consent',
    ])
  })

  it('records a purchase mail that did not go, and alerts the owner', async () => {
    resendRefuses = (mail) => mail.subject.endsWith(' ready')
    const sam = await buyer('sam@example.test')

    await buy(sam, 'pack-starter', 'pi_starter')

    expect(balance(sam.userId)).toBe(30)
    expect(consentOf('cs_evt_pi_starter')?.mailStatus).toBe('failed')
    const [alert] = alerts()
    expect(alert?.subject).toBe(
      '[MercuryPitch billing] Purchase confirmation not sent',
    )
    expect(alert?.text).toContain('PaymentIntent: pi_starter')
  })

  it('confirms the waiver, with no deadline, under waiver', async () => {
    env.WITHDRAWAL_MODE = 'waiver'
    const sam = await buyer('sam@example.test')

    await buy(sam, 'pack-starter', 'pi_starter')

    expect(consentOf('cs_evt_pi_starter')?.mode).toBe('waiver')
    const [mail] = mails().filter((m) => m.subject.endsWith(' ready'))
    expect(mail?.text).toContain(
      "confirmed that you lose your right to cancel once they're added.",
    )
    expect(mail?.text).not.toContain('Withdraw from contract here')
  })
})

describe('Settings › Credits lists what can still be cancelled', () => {
  it('lists a pack with its unused credits, its refund and its last day', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    spend(sam.userId, 14, 'job-1')

    const res = await listFor(sam)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      mode: 'refund_unused',
      email: 'sam@example.test',
      packs: [
        {
          purchaseId: plus,
          packLabel: 'Plus',
          purchasedAt: '2026-10-20T10:00:00.000Z',
          deadline: '2026-11-03',
          basis: 'unused',
          paidCredits: 140,
          unusedCredits: 126,
          bonusCredits: 0,
          refund: { amountMinor: 1800, currency: 'eur' },
        },
      ],
      statements: [],
    })
  })

  it('keeps listing a pack three weekdays past its 14th day, with its last open day', async () => {
    const sam = await buyer('sam@example.test')
    await buy(sam, 'pack-starter', 'pi_starter')

    // The 14th day is Tuesday 3 November: shown until it has ended
    // somewhere, at 10:00 UTC.
    at('2026-11-03T09:59:59.000Z')
    expect((await listFor(sam)).body.packs).toEqual([
      expect.objectContaining({ deadline: '2026-11-03' }),
    ])
    // Then the last open day, Friday 6 November: never a date gone by.
    at('2026-11-04T12:00:00.000Z')
    expect((await listFor(sam)).body.packs).toEqual([
      expect.objectContaining({ deadline: '2026-11-06' }),
    ])
    // 6 November has not ended at UTC-12 until noon UTC on the 7th.
    at('2026-11-07T11:59:59.000Z')
    expect((await listFor(sam)).body.packs).toHaveLength(1)
    at('2026-11-07T12:00:00.000Z')
    expect((await listFor(sam)).body.packs).toEqual([])
  })

  it('closes with the 14th day under WITHDRAWAL_GRACE_WEEKDAYS 0', async () => {
    env.WITHDRAWAL_GRACE_WEEKDAYS = '0'
    const sam = await buyer('sam@example.test')
    await buy(sam, 'pack-starter', 'pi_starter')

    at('2026-11-04T11:59:59.000Z')
    expect((await listFor(sam)).body.packs).toHaveLength(1)
    at('2026-11-04T12:00:00.000Z')
    expect((await listFor(sam)).body.packs).toEqual([])
  })

  it('stops listing a pack whose credits are all used', async () => {
    const sam = await buyer('sam@example.test')
    await buy(sam, 'pack-starter', 'pi_starter')
    spend(sam.userId, 30, 'job-1')

    expect((await listFor(sam)).body.packs).toEqual([])
  })

  it('keeps listing a pack sold under refund_unused once the mode turns to waiver', async () => {
    const sam = await buyer('sam@example.test')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')
    env.WITHDRAWAL_MODE = 'waiver'

    const res = await listFor(sam)

    expect(res.body).toMatchObject({
      mode: 'waiver',
      email: 'sam@example.test',
    })
    expect(res.body.packs).toEqual([
      expect.objectContaining({
        purchaseId: starter,
        basis: 'unused',
        unusedCredits: 30,
      }),
    ])
  })

  it('lists nothing sold under the waiver, whatever the mode is now', async () => {
    env.WITHDRAWAL_MODE = 'waiver'
    const sam = await buyer('sam@example.test')
    await buy(sam, 'pack-starter', 'pi_starter')
    env.WITHDRAWAL_MODE = 'refund_unused'

    expect((await listFor(sam)).body.packs).toEqual([])
  })

  it('answers only a signed-in buyer', async () => {
    expect((await call('/api/billing/withdrawals')).status).toBe(401)
  })
})

describe('a withdrawal', () => {
  it('refunds the unused share, takes those credits and acknowledges it', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    spend(sam.userId, 14, 'job-1')
    at('2026-10-22T14:32:09.000Z')

    const res = await withdraw(sam, plus, {
      email: 'sam.receipts@example.test',
    })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      received: true,
      duplicate: false,
      statement: {
        purchaseId: plus,
        packLabel: 'Plus',
        submittedAt: '2026-10-22T14:32:09.000Z',
        email: 'sam.receipts@example.test',
        unusedCredits: 126,
        bonusCredits: 0,
        refundMinor: 1800,
        currency: 'eur',
        refundStatus: 'refunded',
      },
    })
    // Stripe: a partial refund of the PaymentIntent, keyed on the statement.
    const [request] = refundRequests()
    const form = new URLSearchParams(request?.body)
    const statementId = statementOf(plus)?.id as string
    expect(form.get('payment_intent')).toBe('pi_plus')
    expect(form.get('amount')).toBe('1800')
    expect(form.get('reason')).toBe('requested_by_customer')
    expect(form.get('metadata[withdrawalId]')).toBe(statementId)
    expect(request?.headers['idempotency-key']).toBe(
      `withdrawal-${statementId}`,
    )
    // The ledger: the unused paid credits, once, named by the payment.
    expect(takes(sam.userId)).toEqual([
      {
        delta: -126,
        reason: 'withdrawal',
        jobRef: 'pi_plus',
        idempotencyKey: `withdrawal:${plus}`,
      },
    ])
    expect(balance(sam.userId)).toBe(0)
    expect(statementOf(plus)).toMatchObject({
      userId: sam.userId,
      name: 'Sam Singer',
      refundStatus: 'refunded',
      stripeRefundId: 're_1',
      refundError: null,
      refundedAt: '2026-10-22T14:32:09.000Z',
      mailStatus: 'sent',
    })
    // The acknowledgement goes where the statement said.
    const [ack] = acknowledgements()
    expect(ack?.to).toEqual(['sam.receipts@example.test'])
    expect(ack?.text).toContain(
      'Statement: I withdraw from my contract for this purchase.',
    )
    expect(ack?.text).toContain('Submitted: 22 October 2026 at 14:32 UTC')
    expect(ack?.text).toContain("We've refunded €18.00")
    expect(alerts().map((mail) => mail.subject)).toEqual([
      '[MercuryPitch billing] Withdrawal: refunded €18.00',
    ])
  })

  it('removes the launch bonus with the pack, counting the pack as spent first', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    launchBonus(sam.userId, 'pi_plus')
    spend(sam.userId, 20, 'job-1')

    const res = await withdraw(sam, plus)

    expect(res.body.statement).toMatchObject({
      unusedCredits: 120,
      bonusCredits: 30,
      refundMinor: 1714,
    })
    expect(takes(sam.userId)).toEqual([
      expect.objectContaining({ delta: -120, reason: 'withdrawal' }),
      expect.objectContaining({
        delta: -30,
        reason: 'withdrawal-bonus',
        jobRef: 'pi_plus',
        idempotencyKey: `withdrawal-bonus:${plus}`,
      }),
    ])
    expect(balance(sam.userId)).toBe(0)
    expect(acknowledgements()[0]?.text).toContain(
      'The 120 unused credits from this purchase have left your balance, and so have the 30 bonus credits that came with it.',
    )
  })

  it('never refunds free credits, and leaves them on the balance', async () => {
    const sam = await buyer('sam@example.test')
    freeCredits(sam.userId, 5)
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    spend(sam.userId, 3, 'job-1')

    const res = await withdraw(sam, plus)

    expect(res.body.statement).toMatchObject({
      unusedCredits: 140,
      refundMinor: 2000,
    })
    expect(balance(sam.userId)).toBe(2)
  })

  it('takes two packs bought inside the 14 days one at a time', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')
    spend(sam.userId, 14, 'job-1')

    const before = (await listFor(sam)).body.packs as Array<
      Record<string, unknown>
    >
    expect(before.map((pack) => [pack.purchaseId, pack.unusedCredits])).toEqual(
      [
        [plus, 126],
        [starter, 30],
      ],
    )

    expect((await withdraw(sam, starter)).body.statement).toMatchObject({
      unusedCredits: 30,
      refundMinor: 500,
    })
    const after = await listFor(sam)
    expect(
      (after.body.packs as Array<Record<string, unknown>>).map(
        (pack) => pack.purchaseId,
      ),
    ).toEqual([plus])
    expect(after.body.statements).toEqual([
      expect.objectContaining({
        purchaseId: starter,
        refundStatus: 'refunded',
      }),
    ])

    expect((await withdraw(sam, plus)).body.statement).toMatchObject({
      unusedCredits: 126,
      refundMinor: 1800,
    })
    expect(balance(sam.userId)).toBe(0)
    expect(refundRequests()).toHaveLength(2)
  })

  it('answers a second statement with the first, and refunds once', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')

    const first = await withdraw(sam, plus)
    const again = await withdraw(sam, plus, { name: 'Someone Else' })

    expect(again.status).toBe(200)
    expect(again.body).toMatchObject({ received: true, duplicate: true })
    expect(again.body.statement).toEqual(first.body.statement)
    expect(refundRequests()).toHaveLength(1)
    expect(takes(sam.userId)).toHaveLength(1)
    expect(acknowledgements()).toHaveLength(1)
    expect(alerts()).toHaveLength(1)
    expect(statementOf(plus)?.name).toBe('Sam Singer')
  })

  it('writes one statement when two arrive at once', async () => {
    env.DB = interleaved(new SqliteD1Database(sqlite))
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')

    const both = await Promise.all([withdraw(sam, plus), withdraw(sam, plus)])

    expect(both.map((res) => res.status)).toEqual([200, 200])
    expect(both.map((res) => res.body.duplicate).sort()).toEqual([false, true])
    expect(refundsMade).toHaveLength(1)
    expect(takes(sam.userId)).toHaveLength(1)
    expect(balance(sam.userId)).toBe(0)
    expect(acknowledgements()).toHaveLength(1)
  })

  it('counts again when credits are spent while it is being written', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    const db = env.DB as unknown as {
      batch: (statements: unknown[]) => Promise<unknown>
    }
    const batch = db.batch.bind(db)
    let batches = 0
    db.batch = async (statements) => {
      batches += 1
      if (batches === 1) spend(sam.userId, 40, 'job-meanwhile')
      return batch(statements)
    }

    const res = await withdraw(sam, plus)

    // The first write found the ledger moved and wrote nothing.
    expect(batches).toBe(2)
    expect(res.body.statement).toMatchObject({
      unusedCredits: 100,
      refundMinor: 1428,
    })
    expect(balance(sam.userId)).toBe(0)
  })

  it('keeps the statement when Stripe refuses the refund, and asks the owner to refund by hand', async () => {
    stripeRefunds = 'refused'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    spend(sam.userId, 14, 'job-1')

    const res = await withdraw(sam, plus)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      received: true,
      statement: { refundStatus: 'failed', refundMinor: 1800 },
    })
    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'failed',
      refundError: 'Charge ch_test has been charged back.',
      mailStatus: 'sent',
    })
    expect(balance(sam.userId)).toBe(0)
    expect(acknowledgements()[0]?.text).toContain(
      "We'll refund €18.00 to the card or account you paid with within 14 days.",
    )
    const [alert] = alerts()
    expect(alert?.subject).toBe(
      '[MercuryPitch billing] Withdrawal: refund FAILED, refund €18.00 by hand',
    )
    expect(alert?.text).toContain(
      'Why not: Charge ch_test has been charged back.',
    )

    // Pressing again never asks Stripe a second time: the owner refunds it.
    stripeRefunds = 'ok'
    await withdraw(sam, plus)
    expect(refundRequests()).toHaveLength(1)
    expect(statementOf(plus)?.refundStatus).toBe('failed')
  })

  it('finishes a refund that an earlier request left pending, once', async () => {
    stripeRefunds = 'busy'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')

    const first = await withdraw(sam, plus)
    expect(first.body.statement).toMatchObject({ refundStatus: 'pending' })
    expect(statementOf(plus)?.refundStatus).toBe('pending')

    stripeRefunds = 'ok'
    const again = await withdraw(sam, plus)

    expect(again.body).toMatchObject({
      duplicate: true,
      statement: { refundStatus: 'refunded' },
    })
    expect(refundsMade).toHaveLength(1)
    expect(acknowledgements()).toHaveLength(1)
  })

  it('refunds by hand a pack with no PaymentIntent on record', async () => {
    const sam = await buyer('sam@example.test')
    insertRow(sam.userId, 30, 'purchase', 'pack-starter', 'evt:evt_before_0058')
    const purchase = purchaseOf('evt_before_0058')

    const res = await withdraw(sam, purchase)

    // No consent and no price on record: the whole price, by hand.
    expect(res.body.statement).toMatchObject({
      refundStatus: 'manual',
      refundMinor: null,
      basis: 'full',
    })
    expect(statementOf(purchase)).toMatchObject({
      refundError: 'The price paid is not on record',
      priceSource: 'none',
      refundBasis: 'full',
    })
    expect(refundRequests()).toEqual([])
    expect(takes(sam.userId)).toEqual([
      expect.objectContaining({ delta: -30, jobRef: purchase }),
    ])
    expect(subjects(alerts())).toEqual([
      '[MercuryPitch billing] Withdrawal: refund by hand, the price paid is not on record',
    ])
  })
})

describe('a withdrawal is refused', () => {
  it("for another account's purchase", async () => {
    const sam = await buyer('sam@example.test')
    const alex = await buyer('alex@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')

    expect((await withdraw(alex, plus)).status).toBe(404)
    await withdraw(sam, plus)
    expect((await withdraw(alex, plus)).status).toBe(404)
    expect(refundRequests()).toHaveLength(1)
  })

  it('once the 14 days and the three weekdays after them have ended', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    at('2026-11-07T12:00:00.000Z')

    const res = await withdraw(sam, plus)

    expect(res).toEqual({
      status: 409,
      body: { error: 'The 14 days to cancel this purchase have ended.' },
    })
    expect(statementOf(plus)).toBeUndefined()
    expect(balance(sam.userId)).toBe(140)
  })

  it('once every credit of the pack is used', async () => {
    const sam = await buyer('sam@example.test')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')
    spend(sam.userId, 30, 'job-1')

    const res = await withdraw(sam, starter)

    expect(res.status).toBe(409)
    expect(statementOf(starter)).toBeUndefined()
  })

  it('for a pack already refunded in full in the Stripe dashboard', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await deliver({
      id: 'evt_dashboard_refund',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_plus',
          object: 'charge',
          payment_intent: 'pi_plus',
          amount: 2000,
          amount_refunded: 2000,
          refunded: true,
        },
      },
    })

    expect((await listFor(sam)).body.packs).toEqual([])
    expect(await withdraw(sam, plus)).toEqual({
      status: 409,
      body: { error: 'This purchase has been cancelled or refunded already.' },
    })
  })

  it('for a pack whose payment was disputed', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    spend(sam.userId, 100, 'job-1')
    await deliver({
      id: 'evt_dispute',
      type: 'charge.dispute.created',
      data: {
        object: {
          id: 'dp_plus',
          object: 'dispute',
          payment_intent: 'pi_plus',
          amount: 2000,
        },
      },
    })

    expect((await listFor(sam)).body.packs).toEqual([])
    expect(await withdraw(sam, plus)).toEqual({
      status: 409,
      body: { error: 'This purchase has been cancelled or refunded already.' },
    })
  })

  it('for a pack sold under the waiver', async () => {
    env.WITHDRAWAL_MODE = 'waiver'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    env.WITHDRAWAL_MODE = 'refund_unused'

    expect(await withdraw(sam, plus)).toEqual({
      status: 409,
      body: {
        error: 'You gave up the right to cancel this purchase at checkout.',
      },
    })
    expect(statementOf(plus)).toBeUndefined()
  })

  it('without a name or an email for the confirmation', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')

    expect((await withdraw(sam, plus, { name: '  ' })).status).toBe(400)
    expect((await withdraw(sam, plus, { email: 'not-an-email' })).status).toBe(
      400,
    )
    expect(statementOf(plus)).toBeUndefined()
  })
})

describe('the refund the withdrawal asks for comes back as charge.refunded', () => {
  function refundEvent(id: string, refunded: number): StripeEvent {
    return {
      id,
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_plus',
          object: 'charge',
          payment_intent: 'pi_plus',
          amount: 2000,
          amount_refunded: refunded,
          refunded: refunded >= 2000,
        },
      },
    }
  }

  it('takes no credits a second time', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await buy(sam, 'pack-starter', 'pi_starter')
    spend(sam.userId, 14, 'job-1')
    await withdraw(sam, plus)
    // 126 of the Plus pack's credits went back; the Starter pack's 30 stay.
    expect(balance(sam.userId)).toBe(30)

    expect(await deliver(refundEvent('evt_withdrawal_refund', 1800))).toBe(200)

    expect(takenBack(sam.userId)).toBe(0)
    expect(balance(sam.userId)).toBe(30)
  })

  it('takes no credits for a hand refund of a withdrawal Stripe refused', async () => {
    stripeRefunds = 'refused'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await buy(sam, 'pack-starter', 'pi_starter')
    await withdraw(sam, plus)
    expect(balance(sam.userId)).toBe(30)

    // The owner refunds the €20.00 in the dashboard.
    await deliver(refundEvent('evt_hand_refund', 2000))

    expect(takenBack(sam.userId)).toBe(0)
    expect(balance(sam.userId)).toBe(30)
  })
})

describe('a pack keeps the terms its own checkout recorded', () => {
  it('takes a statement for a pack sold under refund_unused after the mode turns to waiver, and finishes an earlier one', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')
    stripeRefunds = 'busy'
    await withdraw(sam, starter)
    expect(statementOf(starter)?.refundStatus).toBe('pending')
    env.WITHDRAWAL_MODE = 'waiver'
    stripeRefunds = 'ok'

    const res = await withdraw(sam, plus)
    const again = await withdraw(sam, starter)

    expect(res.status).toBe(200)
    expect(statementOf(plus)).toMatchObject({ refundStatus: 'refunded' })
    expect(again.body).toMatchObject({
      duplicate: true,
      statement: { refundStatus: 'refunded', refundMinor: 500 },
    })
    expect(balance(sam.userId)).toBe(0)
  })
})

describe('a pack with no consent on record', () => {
  it('can be cancelled with every credit used, for the whole price, and its refund takes nothing more back', async () => {
    const sam = await buyer('sam@example.test')
    // Bought through a session opened before the checkbox: no box ticked.
    const starter = await buy(sam, 'pack-starter', 'pi_starter', false)
    await buy(sam, 'pack-plus', 'pi_plus')
    // The Starter pack, the older, is used up.
    spend(sam.userId, 30, 'job-1')

    const listed = await listFor(sam)
    const res = await withdraw(sam, starter)

    expect(listed.body.packs).toEqual([
      expect.objectContaining({
        purchaseId: starter,
        basis: 'full',
        unusedCredits: 0,
        refund: { amountMinor: 500, currency: 'eur' },
      }),
      expect.objectContaining({ basis: 'unused', unusedCredits: 140 }),
    ])
    expect(res.status).toBe(200)
    expect(res.body.statement).toMatchObject({
      basis: 'full',
      refundMinor: 500,
      refundStatus: 'refunded',
    })
    expect(new URLSearchParams(refundRequests()[0]?.body).get('amount')).toBe(
      '500',
    )
    // Only what was left of the pack goes, which is nothing: the Plus
    // pack's credits stay.
    expect(balance(sam.userId)).toBe(140)
    expect(acknowledgements()[0]?.text).toContain(
      "You'd used every credit from this purchase, so your balance stays as it is.",
    )

    // The whole price comes back as charge.refunded.
    await deliver({
      id: 'evt_starter_refund',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_starter',
          object: 'charge',
          payment_intent: 'pi_starter',
          amount: 500,
          amount_refunded: 500,
          refunded: true,
        },
      },
    })
    expect(takenBack(sam.userId)).toBe(0)
    expect(balance(sam.userId)).toBe(140)
  })

  it('is confirmed by a purchase mail that claims no consent', async () => {
    const sam = await buyer('sam@example.test')

    await buy(sam, 'pack-starter', 'pi_old_session', false)

    const [mail] = purchaseMails()
    expect(mail?.text).toContain(
      'You can cancel this purchase until 3 November 2026 and get back what you paid.',
    )
    expect(mail?.text).not.toContain('straight away')
  })

  it('is refunded from what its PaymentIntent received, never the catalogue price', async () => {
    const sam = await buyer('sam@example.test')
    // From before the consent record: €20.00 in the catalogue, €10.00 paid.
    insertRow(
      sam.userId,
      140,
      'purchase',
      'pack-plus',
      'evt:evt_legacy',
      'pi_legacy',
    )
    paymentIntents.set('pi_legacy', { amount_received: 1000, currency: 'eur' })
    spend(sam.userId, 100, 'job-1')
    const purchase = purchaseOf('evt_legacy')

    const listed = await listFor(sam)
    const res = await withdraw(sam, purchase)

    // The list asks Stripe nothing: no price on record, none shown.
    expect(listed.body.packs).toEqual([
      expect.objectContaining({
        basis: 'full',
        unusedCredits: 40,
        refund: null,
      }),
    ])
    expect(res.body.statement).toMatchObject({
      basis: 'full',
      refundMinor: 1000,
      refundStatus: 'refunded',
    })
    expect(statementOf(purchase)).toMatchObject({
      amountMinor: 1000,
      priceSource: 'stripe',
    })
    expect(new URLSearchParams(refundRequests()[0]?.body).get('amount')).toBe(
      '1000',
    )
    expect(balance(sam.userId)).toBe(0)
  })

  it('is refunded by hand when no price is on record anywhere', async () => {
    const sam = await buyer('sam@example.test')
    // From before the consent record, its plan gone from the catalogue,
    // and its PaymentIntent unknown to Stripe.
    insertRow(
      sam.userId,
      140,
      'purchase',
      'pack-retired',
      'evt:evt_retired',
      'pi_retired',
    )
    const purchase = purchaseOf('evt_retired')

    const res = await withdraw(sam, purchase)

    expect(res.status).toBe(200)
    expect(res.body.statement).toMatchObject({
      refundStatus: 'manual',
      refundMinor: null,
    })
    expect(statementOf(purchase)).toMatchObject({
      refundStatus: 'manual',
      refundError: 'The price paid is not on record',
      priceSource: 'none',
    })
    expect(refundRequests()).toEqual([])
    expect(balance(sam.userId)).toBe(0)
    expect(subjects(alerts())).toEqual([
      '[MercuryPitch billing] Withdrawal: refund by hand, the price paid is not on record',
    ])
    expect(acknowledgements()[0]?.text).toContain(
      "We'll refund what you paid to the card or account you paid with within 14 days.",
    )
  })
})

describe('a pack that cost nothing', () => {
  it('has nothing to refund', async () => {
    const sam = await buyer('sam@example.test')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')
    sqlite
      .prepare(
        'UPDATE checkoutConsents SET amountMinor = 0 WHERE sessionId = ?',
      )
      .run('cs_evt_pi_starter')

    const res = await withdraw(sam, starter)

    expect(res.body.statement).toMatchObject({
      refundStatus: 'none',
      refundMinor: 0,
    })
    expect(refundRequests()).toEqual([])
    expect(subjects(alerts())).toEqual([
      '[MercuryPitch billing] Withdrawal: nothing to refund',
    ])
  })
})

describe('a launch bonus that lands late', () => {
  /** The paid event of a pack bought with the launch offer's bonus. */
  async function offerEvent(who: Buyer): Promise<StripeEvent> {
    const params = await checkout(who, 'pack-plus')
    params.set('metadata[offer]', 'launch-finisher')
    params.set('metadata[bonusCredits]', '30')
    return paidEvent('evt_pi_plus', params, 'pi_plus', true)
  }

  it('is not added after the pack was withdrawn', async () => {
    const sam = await buyer('sam@example.test')
    const event = await offerEvent(sam)
    // The first delivery wrote the pack's credits and stopped before the
    // bonus; the buyer withdrew before Stripe delivered it again.
    insertRow(
      sam.userId,
      140,
      'purchase',
      'pack-plus',
      'evt:evt_pi_plus',
      'pi_plus',
    )
    paymentIntents.set('pi_plus', { amount_received: 2000, currency: 'eur' })
    await withdraw(sam, purchaseOf('evt_pi_plus'))
    expect(balance(sam.userId)).toBe(0)

    expect(await deliver(event)).toBe(200)

    expect(balance(sam.userId)).toBe(0)
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creditLedger WHERE reason = 'offer-bonus'",
        )
        .get(),
    ).toEqual({ n: 0 })
  })

  it('is not added after the payment was refunded', async () => {
    const sam = await buyer('sam@example.test')
    const event = await offerEvent(sam)
    insertRow(
      sam.userId,
      140,
      'purchase',
      'pack-plus',
      'evt:evt_pi_plus',
      'pi_plus',
    )
    await deliver({
      id: 'evt_dashboard_refund',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_plus',
          object: 'charge',
          payment_intent: 'pi_plus',
          amount: 2000,
          amount_refunded: 2000,
          refunded: true,
        },
      },
    })
    expect(balance(sam.userId)).toBe(0)

    expect(await deliver(event)).toBe(200)

    expect(balance(sam.userId)).toBe(0)
  })

  it('is still added when it arrives late to a pack nobody touched', async () => {
    const sam = await buyer('sam@example.test')
    const event = await offerEvent(sam)
    insertRow(
      sam.userId,
      140,
      'purchase',
      'pack-plus',
      'evt:evt_pi_plus',
      'pi_plus',
    )

    expect(await deliver(event)).toBe(200)

    expect(balance(sam.userId)).toBe(170)
  })
})

describe('a delivery cut off after the credits landed', () => {
  it('leaves the consent and the purchase mail to the next delivery', async () => {
    const sam = await buyer('sam@example.test')
    const params = await checkout(sam, 'pack-plus')
    const event = paidEvent('evt_pi_plus', params, 'pi_plus', true)
    // The first delivery wrote the credits and died before the rest.
    insertRow(
      sam.userId,
      140,
      'purchase',
      'pack-plus',
      'evt:evt_pi_plus',
      'pi_plus',
    )

    expect(await deliver(event)).toBe(200)

    expect(balance(sam.userId)).toBe(140)
    expect(consentOf('cs_evt_pi_plus')).toMatchObject({
      termsOfService: 'accepted',
      mode: 'refund_unused',
      amountMinor: 2000,
      mailStatus: 'sent',
    })
    expect(subjects(purchaseMails())).toEqual(['Your 140 credits are ready'])

    // One more delivery sends nothing more.
    expect(await deliver(event)).toBe(200)
    expect(purchaseMails()).toHaveLength(1)
    expect(alerts()).toEqual([])
  })
})

describe('the cron finishes what a request left undone', () => {
  it('records a refund whose answer was lost, found by its metadata, never made twice', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    // Stripe makes the refund; its answer never comes back.
    stripeRefunds = 'lost'

    const res = await withdraw(sam, plus)

    expect(res.status).toBe(200)
    expect(res.body.statement).toMatchObject({ refundStatus: 'pending' })
    expect(refundsMade).toHaveLength(1)
    expect(subjects(alerts())).toEqual([
      '[MercuryPitch billing] Withdrawal: refund of €20.00 still open',
    ])
    expect(acknowledgements()).toHaveLength(1)

    // A day and more later Stripe has forgotten the idempotency key.
    stripeRefunds = 'ok'
    stripeForgetsKeys = true
    at('2026-10-21T12:00:00.000Z')
    await cron()

    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'refunded',
      stripeRefundId: 're_1',
      stripeRefundStatus: 'succeeded',
    })
    expect(refundsMade).toHaveLength(1)
    expect(refundRequests()).toHaveLength(1)
    expect(subjects(alerts()).at(-1)).toBe(
      '[MercuryPitch billing] Withdrawal: refunded €20.00',
    )
    expect(acknowledgements()).toHaveLength(1)
  })

  it('makes a refund a request never got from Stripe, once the request has had 10 minutes', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    stripeRefunds = 'down'
    await withdraw(sam, plus)
    expect(statementOf(plus)?.refundStatus).toBe('pending')
    stripeRefunds = 'ok'

    at('2026-10-20T10:05:00.000Z')
    await cron()
    expect(statementOf(plus)?.refundStatus).toBe('pending')

    at('2026-10-20T10:11:00.000Z')
    await cron()
    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'refunded',
      stripeRefundId: 're_1',
    })
    expect(refundsMade).toHaveLength(1)
  })

  it('never asks again for a refund Stripe refused', async () => {
    stripeRefunds = 'refused'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await withdraw(sam, plus)
    stripeRefunds = 'ok'

    at('2026-10-21T10:00:00.000Z')
    await cron()

    expect(refundRequests()).toHaveLength(1)
    expect(statementOf(plus)?.refundStatus).toBe('failed')
    expect(alerts()).toHaveLength(1)
  })

  it('sends an acknowledgement that did not go again, and tells the owner once when it has still not gone after 3 days', async () => {
    resendRefuses = (mail) => mail.subject === ACK_SUBJECT
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await withdraw(sam, plus)
    expect(statementOf(plus)).toMatchObject({
      mailStatus: 'failed',
      mailError:
        'Resend answered 500 internal_server_error: An unexpected error occurred.',
    })
    expect(subjects(alerts())).toEqual([
      '[MercuryPitch billing] Withdrawal: refunded €20.00',
    ])
    expect(alerts()[0]?.text).toContain(
      'The sweep sends it again every 6 hours until Resend takes it',
    )

    at('2026-10-20T10:11:00.000Z')
    await cron()
    // Tried again; failing again is no news.
    expect(acknowledgements()).toHaveLength(2)
    expect(statementOf(plus)?.mailStatus).toBe('failed')
    expect(alerts()).toHaveLength(1)

    at('2026-10-23T10:01:00.000Z')
    await cron()
    expect(statementOf(plus)?.mailStatus).toBe('failed')
    expect(acknowledgements()).toHaveLength(3)
    expect(subjects(alerts())).toEqual([
      '[MercuryPitch billing] Withdrawal: refunded €20.00',
      '[MercuryPitch billing] Withdrawal: acknowledgement still not sent after 3 days',
    ])
    expect(alerts()[1]?.text).toContain('Send it to: sam@example.test')

    // Still sent again at every sweep; the owner heard once.
    at('2026-10-23T16:01:00.000Z')
    await cron()
    expect(acknowledgements()).toHaveLength(4)
    expect(alerts()).toHaveLength(2)
  })

  it('sends a purchase mail that did not go again, and tells the owner once when it has still not gone after 3 days', async () => {
    resendRefuses = (mail) => /^Your .* ready$/.test(mail.subject)
    const sam = await buyer('sam@example.test')
    await buy(sam, 'pack-starter', 'pi_starter')
    expect(consentOf('cs_evt_pi_starter')?.mailStatus).toBe('failed')

    at('2026-10-20T10:11:00.000Z')
    await cron()
    expect(purchaseMails()).toHaveLength(2)
    expect(subjects(alerts())).toEqual([
      '[MercuryPitch billing] Purchase confirmation not sent',
    ])
    expect(alerts()[0]?.text).toContain(
      'The sweep sends it again every 6 hours until Resend takes it',
    )

    at('2026-10-23T10:01:00.000Z')
    await cron()
    expect(consentOf('cs_evt_pi_starter')?.mailStatus).toBe('failed')
    expect(purchaseMails()).toHaveLength(3)
    expect(subjects(alerts())).toEqual([
      '[MercuryPitch billing] Purchase confirmation not sent',
      '[MercuryPitch billing] Purchase confirmation still not sent after 3 days',
    ])

    at('2026-10-23T16:01:00.000Z')
    await cron()
    expect(purchaseMails()).toHaveLength(4)
    expect(alerts()).toHaveLength(2)
  })

  it('sends a purchase mail that did not go once Resend takes it, with no alert', async () => {
    resendRefuses = (mail) => /^Your .* ready$/.test(mail.subject)
    const sam = await buyer('sam@example.test')
    await buy(sam, 'pack-starter', 'pi_starter')
    resendRefuses = () => false

    at('2026-10-20T16:17:00.000Z')
    await cron()

    expect(consentOf('cs_evt_pi_starter')?.mailStatus).toBe('sent')
    expect(purchaseMails()).toHaveLength(2)
    expect(alerts()).toHaveLength(1)
  })

  it('finds the purchase mails still to send or give up by their index, never by reading every purchase', () => {
    const plan = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${UNSENT_PURCHASE_MAILS_SQL}`)
      .all('2026-10-20T16:07:00.000Z', '2026-10-20T16:07:00.000Z', 10)
      .map((step) => String(step.detail))

    // Only the unsent ones are read, then put in order of their last try.
    expect(plan).toEqual([
      'SEARCH checkoutConsents USING INDEX idx_checkoutConsents_open (createdAt<?)',
      'USE TEMP B-TREE FOR ORDER BY',
    ])
  })
})

describe('a refund Stripe has not finished', () => {
  it('is followed until Stripe fails it, then goes to the owner to refund by hand', async () => {
    newRefundStatus = 'pending'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await withdraw(sam, plus)
    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'refunded',
      stripeRefundStatus: 'pending',
    })

    // Still pending at Stripe: nothing to say.
    at('2026-10-20T16:17:00.000Z')
    await cron()
    expect(alerts()).toHaveLength(1)

    const [refund] = refundsMade
    if (refund === undefined) throw new Error('no refund was made')
    refund.status = 'failed'
    refund.failure_reason = 'expired_or_canceled_card'
    at('2026-10-20T22:17:00.000Z')
    await cron()

    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'failed',
      stripeRefundStatus: 'failed',
      refundError:
        'Stripe did not complete the refund: expired_or_canceled_card',
    })
    expect(subjects(alerts()).at(-1)).toBe(
      '[MercuryPitch billing] Withdrawal: refund FAILED, refund €20.00 by hand',
    )
    // A failed refund is never asked for again, nor followed.
    at('2026-10-21T04:17:00.000Z')
    await cron()
    expect(alerts()).toHaveLength(2)
    expect(refundRequests()).toHaveLength(1)
  })

  it('stops being followed once Stripe completes it, with no alert', async () => {
    newRefundStatus = 'requires_action'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await withdraw(sam, plus)
    const [refund] = refundsMade
    if (refund === undefined) throw new Error('no refund was made')
    refund.status = 'succeeded'

    at('2026-10-20T16:17:00.000Z')
    await cron()

    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'refunded',
      stripeRefundStatus: 'succeeded',
    })
    expect(alerts()).toHaveLength(1)
  })
})

describe('a refund recorded nowhere', () => {
  it('still sends the acknowledgement and the alert when the refund cannot be recorded', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    // Stripe takes the refund; recording its answer fails.
    failNext(/SET refundStatus = \?, stripeRefundId = \?/)

    const res = await withdraw(sam, plus)

    expect(res.status).toBe(200)
    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'pending',
      mailStatus: 'sent',
    })
    expect(acknowledgements()).toHaveLength(1)
    expect(subjects(alerts())).toEqual([
      '[MercuryPitch billing] Withdrawal: refund of €20.00 still open',
    ])

    at('2026-10-20T10:11:00.000Z')
    await cron()
    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'refunded',
      stripeRefundId: 're_1',
    })
    expect(refundRequests()).toHaveLength(1)
  })

  it('is never made twice when the lookup fails after Stripe forgot the key, and is found on a later page', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    failNext(/SET refundStatus = \?, stripeRefundId = \?/)
    await withdraw(sam, plus)
    expect(statementOf(plus)?.refundStatus).toBe('pending')

    // Two days on: the key is forgotten, and the refund list is down.
    at('2026-10-22T10:00:00.000Z')
    stripeForgetsKeys = true
    refundListDown = true
    await withdraw(sam, plus)
    expect(refundRequests()).toHaveLength(1)
    expect(statementOf(plus)?.refundStatus).toBe('pending')

    // The list is back, one refund a page, with a newer refund on the
    // PaymentIntent ahead of ours.
    refundListDown = false
    refundPageSize = 1
    refundsMade.unshift({
      id: 're_dashboard',
      object: 'refund',
      status: 'succeeded',
      amount: 100,
      payment_intent: 'pi_plus',
      metadata: {},
    })
    const again = await withdraw(sam, plus)

    expect(again.body.statement).toMatchObject({ refundStatus: 'refunded' })
    expect(statementOf(plus)?.stripeRefundId).toBe('re_1')
    expect(refundRequests()).toHaveLength(1)
  })
})

// ── What the third review found ─────────────────────────────────────

function billingEventSeen(id: string): boolean {
  return (
    sqlite.prepare('SELECT id FROM billingEvents WHERE id = ?').get(id) !==
    undefined
  )
}

/** The mails Resend was asked to send to `address` whose subject matches. */
function mailsTo(address: string, subject: RegExp): Mail[] {
  return mails().filter(
    (mail) => mail.to[0] === address && subject.test(mail.subject),
  )
}

const PURCHASE_SUBJECT = /^Your .* ready$/

/** A charge.refunded for `paymentIntent`, with `refunded` of `amount` gone
 *  back so far. */
function chargeRefunded(
  id: string,
  paymentIntent: string,
  amount: number,
  refunded: number,
): StripeEvent {
  return {
    id,
    type: 'charge.refunded',
    data: {
      object: {
        id: `ch_${paymentIntent}`,
        object: 'charge',
        payment_intent: paymentIntent,
        amount,
        amount_refunded: refunded,
        refunded: refunded >= amount,
      },
    },
  }
}

async function deleteAccount(
  who: Buyer,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await worker.fetch(
    new Request('https://api.test/api/auth/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${who.token}` },
    }),
    env,
    {} as ExecutionContext,
  )
  const text = await response.text()
  return {
    status: response.status,
    body: text === '' ? {} : (JSON.parse(text) as Record<string, unknown>),
  }
}

/**
 * Resend's idempotency, as its docs describe it: within 24 hours, a key sent
 * again with the same body gets the first answer and sends nothing, and with
 * another body is refused, 409 invalid_idempotent_request. Returns the status
 * each keyed mail got.
 */
function resendKeepsKeys(): Array<{ subject: string; status: number }> {
  const inner = globalThis.fetch
  const keys = new Map<string, { body: string; at: number }>()
  const outcomes: Array<{ subject: string; status: number }> = []
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const key =
        url === RESEND
          ? new Headers(init?.headers).get('idempotency-key')
          : null
      if (key === null) return inner(input, init)
      const body = String(init?.body)
      const { subject } = JSON.parse(body) as { subject: string }
      const seen = keys.get(key)
      if (seen !== undefined && Date.now() - seen.at < 86_400_000) {
        const same = seen.body === body
        outcomes.push({ subject, status: same ? 200 : 409 })
        return same
          ? Response.json({ id: 'replayed' })
          : Response.json(
              {
                statusCode: 409,
                name: 'invalid_idempotent_request',
                message:
                  'Same idempotency key used with a different request payload.',
              },
              { status: 409 },
            )
      }
      const answer = await inner(input, init)
      if (answer.ok) keys.set(key, { body, at: Date.now() })
      outcomes.push({ subject, status: answer.status })
      return answer
    },
  )
  return outcomes
}

/** Refuse the mails to addresses `refuse` names. */
function refuseMailsTo(refuse: (to: string, subject: string) => boolean): void {
  resendRefuses = (mail) =>
    refuse((mail as unknown as Mail).to[0] ?? '', mail.subject)
}

describe('a consent record that cannot be written', () => {
  it('answers 500, so Stripe delivers the event again, and the redelivery writes the row and the mail', async () => {
    const sam = await buyer('sam@example.test')
    const params = await checkout(sam, 'pack-plus')
    const event = paidEvent('evt_pi_plus', params, 'pi_plus', true)
    failNext(/INSERT OR IGNORE INTO checkoutConsents/)

    expect(await deliver(event)).toBe(500)

    expect(balance(sam.userId)).toBe(140)
    expect(billingEventSeen('evt_pi_plus')).toBe(false)
    expect(consentOf('cs_evt_pi_plus')).toBeUndefined()
    expect(purchaseMails()).toEqual([])
    expect(subjects(alerts())).toEqual([
      '[MercuryPitch billing] Consent record not written',
    ])
    expect(alerts()[0]?.text).toContain('The webhook answered 500')

    expect(await deliver(event)).toBe(200)

    expect(balance(sam.userId)).toBe(140)
    expect(consentOf('cs_evt_pi_plus')).toMatchObject({
      termsOfService: 'accepted',
      mode: 'refund_unused',
      amountMinor: 2000,
      mailStatus: 'sent',
    })
    expect(subjects(purchaseMails())).toEqual(['Your 140 credits are ready'])
    spend(sam.userId, 140, 'job-all')
    expect((await listFor(sam)).body.packs).toEqual([])
    expect((await withdraw(sam, purchaseOf('evt_pi_plus'))).status).toBe(409)
  })
})

describe('the cron reaches every unfinished duty, least recently tried first', () => {
  const BASE = Date.parse('2026-10-20T10:00:00.000Z')
  const HOUR = 3_600_000

  /** `count` statements whose refunds Stripe keeps open, one buyer each,
   *  six minutes apart: sign-up takes five in five minutes. */
  async function openRefunds(count: number): Promise<string[]> {
    newRefundStatus = 'pending'
    const purchases: string[] = []
    for (let i = 0; i < count; i += 1) {
      at(new Date(BASE + i * 6 * 60_000).toISOString())
      const who = await buyer(`b${i}@example.test`)
      const purchase = await buy(who, 'pack-starter', `pi_b${i}`)
      await withdraw(who, purchase)
      purchases.push(purchase)
    }
    newRefundStatus = 'succeeded'
    return purchases
  }

  async function late(): Promise<{ who: Buyer; purchase: string }> {
    at(new Date(BASE + 66 * 60_000).toISOString())
    const who = await buyer('late@example.test')
    return { who, purchase: await buy(who, 'pack-starter', 'pi_late') }
  }

  /** The 6-hourly crons from run `from` to run `to`. */
  async function crons(from: number, to: number): Promise<void> {
    for (let run = from; run <= to; run += 1) {
      at(new Date(BASE + run * 6 * HOUR).toISOString())
      await cron()
    }
  }

  it('sends an acknowledgement again behind ten refunds Stripe keeps open', async () => {
    await openRefunds(10)
    const { who, purchase } = await late()
    resendRefuses = (mail) => mail.subject === ACK_SUBJECT
    await withdraw(who, purchase)
    resendRefuses = () => false
    expect(statementOf(purchase)).toMatchObject({ mailStatus: 'failed' })

    await crons(1, 1)

    expect(statementOf(purchase)).toMatchObject({ mailStatus: 'sent' })
    expect(mailsTo('late@example.test', /^We've received/)).toHaveLength(2)
  })

  it('makes a refund Stripe never got behind ten it keeps open', async () => {
    await openRefunds(10)
    const { who, purchase } = await late()
    stripeRefunds = 'down'
    await withdraw(who, purchase)
    stripeRefunds = 'ok'
    expect(statementOf(purchase)).toMatchObject({ refundStatus: 'pending' })

    await crons(1, 1)

    expect(statementOf(purchase)).toMatchObject({
      refundStatus: 'refunded',
      stripeRefundStatus: 'succeeded',
    })
    expect(
      refundsMade.filter((refund) => refund.payment_intent === 'pi_late'),
    ).toHaveLength(1)
  })

  it('tells the owner once of each refund still open five days after its statement', async () => {
    const purchases = await openRefunds(11)
    const escalations = () =>
      alerts().filter(
        (mail) =>
          mail.subject ===
          '[MercuryPitch billing] Withdrawal: refund of €5.00 still open after 5 days',
      )

    await crons(1, 19)
    expect(escalations()).toEqual([])

    await crons(20, 28)
    const named = escalations().map((mail) =>
      purchases.findIndex((purchase) => mail.text.includes(purchase)),
    )
    expect([...named].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
  })

  it('sends a purchase mail again behind ten that always fail, and keeps sending each of those', async () => {
    let lateRefusals = 1
    refuseMailsTo((to, subject) => {
      if (!PURCHASE_SUBJECT.test(subject)) return false
      if (to.startsWith('bad')) return true
      if (to !== 'late@example.test' || lateRefusals === 0) return false
      lateRefusals -= 1
      return true
    })
    for (let i = 0; i < 10; i += 1) {
      at(new Date(BASE + i * 6 * 60_000).toISOString())
      await buy(
        await buyer(`bad${i}@example.test`),
        'pack-starter',
        `pi_bad${i}`,
      )
    }
    await late()
    expect(consentOf('cs_evt_pi_late')).toMatchObject({ mailStatus: 'failed' })

    await crons(1, 2)
    expect(consentOf('cs_evt_pi_late')).toMatchObject({ mailStatus: 'sent' })
    expect(mailsTo('late@example.test', PURCHASE_SUBJECT)).toHaveLength(2)

    // Four days of sweeps: Resend never refuses them for good, so none is
    // given up, and the owner hears of each once, after 3 days.
    await crons(3, 16)
    for (let i = 0; i < 10; i += 1) {
      expect(
        mailsTo(`bad${i}@example.test`, PURCHASE_SUBJECT).length,
      ).toBeGreaterThanOrEqual(16)
      expect(consentOf(`cs_evt_pi_bad${i}`)).toMatchObject({
        mailStatus: 'failed',
        mailWarnedAt: expect.any(String),
      })
    }
    expect(
      subjects(alerts()).filter(
        (subject) =>
          subject ===
          '[MercuryPitch billing] Purchase confirmation still not sent after 3 days',
      ),
    ).toHaveLength(10)
    expect(subjects(alerts())).not.toContain(
      '[MercuryPitch billing] Purchase confirmation given up',
    )
  })
})

describe('a recorded consent stands only once the purchase mail confirmed it', () => {
  it('lets a waiver buyer whose confirmation never went cancel for the whole price', async () => {
    env.WITHDRAWAL_MODE = 'waiver'
    resendRefuses = (mail) => PURCHASE_SUBJECT.test(mail.subject)
    const sam = await buyer('sam@example.test')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')
    spend(sam.userId, 30, 'job-1')
    expect(consentOf('cs_evt_pi_starter')).toMatchObject({
      termsOfService: 'accepted',
      mode: 'waiver',
      mailStatus: 'failed',
    })

    expect((await listFor(sam)).body.packs).toEqual([
      expect.objectContaining({
        purchaseId: starter,
        basis: 'full',
        refund: { amountMinor: 500, currency: 'eur' },
      }),
    ])
    const res = await withdraw(sam, starter)
    expect(res.body.statement).toMatchObject({
      basis: 'full',
      refundMinor: 500,
      refundStatus: 'refunded',
    })
  })

  it('refunds a refund_unused buyer whose confirmation never went the whole price, used credits too', async () => {
    resendRefuses = (mail) => PURCHASE_SUBJECT.test(mail.subject)
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    spend(sam.userId, 100, 'job-1')

    const res = await withdraw(sam, plus)

    expect(res.body.statement).toMatchObject({
      basis: 'full',
      unusedCredits: 40,
      refundMinor: 2000,
      refundStatus: 'refunded',
    })
    expect(new URLSearchParams(refundRequests()[0]?.body).get('amount')).toBe(
      '2000',
    )
  })

  it('holds the buyer to the consent again once the mail goes', async () => {
    resendRefuses = (mail) => PURCHASE_SUBJECT.test(mail.subject)
    const sam = await buyer('sam@example.test')
    await buy(sam, 'pack-plus', 'pi_plus')
    spend(sam.userId, 100, 'job-1')
    expect((await listFor(sam)).body.packs).toEqual([
      expect.objectContaining({ basis: 'full' }),
    ])

    resendRefuses = () => false
    at('2026-10-20T16:17:00.000Z')
    await cron()

    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'sent' })
    expect((await listFor(sam)).body.packs).toEqual([
      expect.objectContaining({
        basis: 'unused',
        unusedCredits: 40,
        refund: { amountMinor: 571, currency: 'eur' },
      }),
    ])
    expect(purchaseMails().at(-1)?.text).toContain(
      "get back the price of the credits you haven't used",
    )
  })
})

describe('a price lookup Stripe does not answer', () => {
  it.each([
    [
      'a 503',
      () => Response.json({ error: { message: 'Busy.' } }, { status: 503 }),
      'Stripe answered the price lookup 503: Busy.',
    ],
    [
      'a 429',
      () =>
        Response.json({ error: { message: 'Slow down.' } }, { status: 429 }),
      'Stripe answered the price lookup 429: Slow down.',
    ],
    [
      'no answer at all',
      (): Response => {
        throw new TypeError('fetch failed: the connection was reset')
      },
      'Stripe did not answer the price lookup: TypeError: fetch failed: the connection was reset',
    ],
    // A key that is wrong or lacks a permission says nothing of the
    // payment: only a 404 does.
    [
      'a 401',
      () =>
        Response.json(
          { error: { message: 'Invalid API Key provided: rk_test_****' } },
          { status: 401 },
        ),
      'Stripe answered the price lookup 401: Invalid API Key provided: rk_test_****',
    ],
    [
      'a 403',
      () =>
        Response.json(
          { error: { message: 'The provided key does not have access.' } },
          { status: 403 },
        ),
      'Stripe answered the price lookup 403: The provided key does not have access.',
    ],
  ])(
    'keeps the price pending after %s, says why, and the cron refunds from it',
    async (_, answer, why) => {
      const sam = await buyer('sam@example.test')
      // Bought before checkouts kept the price.
      insertRow(
        sam.userId,
        140,
        'purchase',
        'pack-plus',
        'evt:evt_legacy',
        'pi_legacy',
      )
      paymentIntents.set('pi_legacy', {
        amount_received: 2000,
        currency: 'eur',
      })
      const inner = globalThis.fetch
      let failures = 1
      vi.stubGlobal(
        'fetch',
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = input instanceof Request ? input.url : String(input)
          if (url.startsWith(`${STRIPE}/payment_intents/`) && failures > 0) {
            failures -= 1
            return answer()
          }
          return inner(input, init)
        },
      )
      const purchase = purchaseOf('evt_legacy')

      const res = await withdraw(sam, purchase)

      expect(res.body.statement).toMatchObject({
        basis: 'full',
        refundMinor: null,
        refundStatus: 'pending',
      })
      expect(statementOf(purchase)).toMatchObject({
        priceSource: 'pending',
        refundError: why,
      })
      expect(refundRequests()).toEqual([])
      expect(subjects(alerts())).toEqual([
        '[MercuryPitch billing] Withdrawal: refund waits for the price paid',
      ])
      expect(alerts()[0]?.text).toContain(`Why not: ${why}`)

      at('2026-10-20T16:17:00.000Z')
      await cron()

      expect(statementOf(purchase)).toMatchObject({
        priceSource: 'stripe',
        amountMinor: 2000,
        refundMinor: 2000,
        refundStatus: 'refunded',
        refundError: null,
      })
      expect(new URLSearchParams(refundRequests()[0]?.body).get('amount')).toBe(
        '2000',
      )
    },
  )
})

describe('deleting the account while a withdrawal refund is open', () => {
  const HELD =
    'Your refund for a cancelled credit pack is still in progress. You can delete your account once it has gone through.'

  it('is refused until the refund has gone through, and the owner hears of it', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    stripeRefunds = 'down'
    await withdraw(sam, plus)
    expect(statementOf(plus)).toMatchObject({ refundStatus: 'pending' })

    expect(await deleteAccount(sam)).toEqual({
      status: 409,
      body: { error: HELD },
    })
    expect(statementOf(plus)).toBeDefined()
    expect(subjects(alerts()).at(-1)).toBe(
      '[MercuryPitch billing] Account deletion held: a withdrawal refund is open',
    )

    stripeRefunds = 'ok'
    at('2026-10-20T16:17:00.000Z')
    await cron()
    expect(statementOf(plus)).toMatchObject({ refundStatus: 'refunded' })

    expect((await deleteAccount(sam)).status).toBe(200)
    expect(statementOf(plus)).toBeUndefined()
  })

  it('is refused while Stripe has not finished the refund', async () => {
    newRefundStatus = 'pending'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await withdraw(sam, plus)
    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'refunded',
      stripeRefundStatus: 'pending',
    })

    expect(await deleteAccount(sam)).toEqual({
      status: 409,
      body: { error: HELD },
    })

    const [refund] = refundsMade
    if (refund === undefined) throw new Error('no refund was made')
    refund.status = 'succeeded'
    at('2026-10-20T16:17:00.000Z')
    await cron()

    expect((await deleteAccount(sam)).status).toBe(200)
  })
})

describe('a mail Resend took under its key already', () => {
  it('counts a purchase mail that went but was never recorded as sent', async () => {
    const outcomes = resendKeepsKeys()
    const sam = await buyer('sam@example.test')
    // The mail goes; recording that it went fails.
    failNext(
      /UPDATE checkoutConsents SET mailStatus = \?, mailAt = \?, mailError = \?/,
    )
    await buy(sam, 'pack-plus', 'pi_plus')
    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'sending' })
    // The next render differs: the balance it shows has moved.
    spend(sam.userId, 10, 'job-1')
    const purchaseSends = () =>
      outcomes.filter((outcome) => PURCHASE_SUBJECT.test(outcome.subject))

    at('2026-10-20T16:17:00.000Z')
    await cron()

    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'sent' })
    expect(purchaseSends().map((outcome) => outcome.status)).toEqual([200, 409])
    expect(subjects(alerts())).toEqual([])

    at('2026-10-21T16:17:00.000Z')
    await cron()
    expect(purchaseSends()).toHaveLength(2)
  })

  it('counts an acknowledgement that went but was never recorded as sent', async () => {
    const outcomes = resendKeepsKeys()
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    stripeRefunds = 'down'
    failNext(
      /UPDATE withdrawals SET mailStatus = \?, mailAt = \?, mailError = \?/,
    )
    await withdraw(sam, plus)
    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'pending',
      mailStatus: 'sending',
    })
    stripeRefunds = 'ok'

    // The refund goes through first, so the acknowledgement reads
    // differently the second time.
    at('2026-10-20T16:17:00.000Z')
    await cron()

    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'refunded',
      mailStatus: 'sent',
    })
    expect(
      outcomes
        .filter((outcome) => outcome.subject === ACK_SUBJECT)
        .map((outcome) => outcome.status),
    ).toEqual([200, 409])
  })
})

describe('the acknowledgement and who it goes to', () => {
  it.each([
    'Sam https://evil.example/restore',
    'Restore it at evil.example/restore',
    'www.evil.example',
    'Visit evil.com today',
    'sam@example.test',
  ])('refuses a name with a link or an address in it: %s', async (name) => {
    const sam = await buyer('sam@example.test')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')

    expect(await withdraw(sam, starter, { name })).toEqual({
      status: 400,
      body: {
        error: 'Enter just your name, without a link or an email address.',
      },
    })
    expect(statementOf(starter)).toBeUndefined()
  })

  it('takes a name with initials, a hyphen and an apostrophe', async () => {
    const sam = await buyer('sam@example.test')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')

    const res = await withdraw(sam, starter, { name: "J. R. O'Neill-Smith" })

    expect(res.status).toBe(200)
  })

  it('goes to the address the statement names, with a copy to the account', async () => {
    const sam = await buyer('sam@example.test')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')

    await withdraw(sam, starter, { email: 'sam.other@example.test' })

    const [ack] = acknowledgements()
    expect(ack?.to).toEqual(['sam.other@example.test'])
    expect(ack?.bcc).toEqual(['sam@example.test'])
  })

  it('sends no copy when the statement names the account address', async () => {
    const sam = await buyer('sam@example.test')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')

    await withdraw(sam, starter, { email: 'Sam@Example.test' })

    const [ack] = acknowledgements()
    expect(ack?.to).toEqual(['Sam@Example.test'])
    expect(ack?.bcc).toBeUndefined()
  })

  it('tells the app whether it went', async () => {
    const sam = await buyer('sam@example.test')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')
    resendRefuses = (mail) => mail.subject === ACK_SUBJECT

    const res = await withdraw(sam, starter)

    expect(res.body.statement).toMatchObject({ mailStatus: 'failed' })
    expect((await listFor(sam)).body.statements).toEqual([
      expect.objectContaining({ mailStatus: 'failed' }),
    ])

    resendRefuses = () => false
    at('2026-10-20T16:17:00.000Z')
    await cron()
    expect((await listFor(sam)).body.statements).toEqual([
      expect.objectContaining({ mailStatus: 'sent' }),
    ])
  })
})

describe('spending counts in the order it happened', () => {
  it('never revives a used-up pack when free credits land after it ran out', async () => {
    const sam = await buyer('sam@example.test')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')
    spend(sam.userId, 30, 'job-1')
    freeCredits(sam.userId, 30)

    expect((await listFor(sam)).body.packs).toEqual([])
    expect(await withdraw(sam, starter)).toEqual({
      status: 409,
      body: {
        error:
          "You've used every credit from this purchase, so it can no longer be cancelled.",
      },
    })
    expect(balance(sam.userId)).toBe(30)
  })

  it('spends the free credits that were there first before the pack', async () => {
    const sam = await buyer('sam@example.test')
    freeCredits(sam.userId, 30)
    const starter = await buy(sam, 'pack-starter', 'pi_starter')
    spend(sam.userId, 30, 'job-1')

    const res = await withdraw(sam, starter)

    expect(res.body.statement).toMatchObject({
      unusedCredits: 30,
      refundMinor: 500,
    })
    expect(balance(sam.userId)).toBe(0)
  })

  it("gives a failed separation's credits back to the pack it took them from", async () => {
    const sam = await buyer('sam@example.test')
    const starter = await buy(sam, 'pack-starter', 'pi_starter')
    spend(sam.userId, 30, 'job-1')
    freeCredits(sam.userId, 30)
    insertRow(sam.userId, 30, 'uvr-refund', 'job-1', 'uvr-refund:job-1')

    const res = await withdraw(sam, starter)

    expect(res.body.statement).toMatchObject({
      unusedCredits: 30,
      refundMinor: 500,
    })
    expect(balance(sam.userId)).toBe(30)
  })
})

describe('a partial refund in the Stripe dashboard', () => {
  it('leaves the rest of the pack cancellable, and the two refunds add up to what was not used', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    spend(sam.userId, 14, 'job-1')
    // A 10% goodwill refund takes 14 credits back.
    await deliver(chargeRefunded('evt_goodwill', 'pi_plus', 2000, 200))
    expect(balance(sam.userId)).toBe(112)

    expect((await listFor(sam)).body.packs).toEqual([
      expect.objectContaining({
        purchaseId: plus,
        basis: 'unused',
        unusedCredits: 112,
        refund: { amountMinor: 1600, currency: 'eur' },
      }),
    ])
    const res = await withdraw(sam, plus)

    expect(res.body.statement).toMatchObject({
      unusedCredits: 112,
      refundMinor: 1600,
      refundStatus: 'refunded',
    })
    expect(new URLSearchParams(refundRequests()[0]?.body).get('amount')).toBe(
      '1600',
    )
    expect(balance(sam.userId)).toBe(0)

    // Stripe reports both refunds together: 1800 of 2000, what was not used.
    await deliver(chargeRefunded('evt_both_refunds', 'pi_plus', 2000, 1800))
    expect(takenBack(sam.userId)).toBe(14)
    expect(balance(sam.userId)).toBe(0)
  })

  it('refunds the rest of the price of a pack with no consent on record', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus', false)
    await deliver(chargeRefunded('evt_goodwill', 'pi_plus', 2000, 200))

    const res = await withdraw(sam, plus)

    expect(res.body.statement).toMatchObject({
      basis: 'full',
      refundMinor: 1800,
      refundStatus: 'refunded',
    })
  })
})

// ── What the fourth review found ────────────────────────────────────

const START = Date.parse('2026-10-20T10:00:00.000Z')
const SIX_HOURS = 6 * 3_600_000

/** The 6-hourly crons from run `from` to run `to`, at 17 past. */
async function sweeps(from: number, to: number): Promise<void> {
  for (let run = from; run <= to; run += 1) {
    at(new Date(START + run * SIX_HOURS + 17 * 60_000).toISOString())
    await cron()
  }
}

/** Resend answering 500 to everything, alerts too, until `up()`; the
 *  subjects it took after. */
function outage(): { delivered: string[]; up: () => void } {
  const delivered: string[] = []
  let down = true
  resendRefuses = (mail) => {
    if (!down) delivered.push(mail.subject)
    return down
  }
  return {
    delivered,
    up: () => {
      down = false
    },
  }
}

/** Resend refusing what `refuse` says; the subjects it took. */
function resendTakes(refuse: (subject: string) => boolean | number): string[] {
  const taken: string[] = []
  resendRefuses = (mail) => {
    const refusal = refuse(mail.subject)
    if (refusal === false) taken.push(mail.subject)
    return refusal
  }
  return taken
}

const BILLING = '[MercuryPitch billing] '
const ACK_GIVEN_UP = `${BILLING}Withdrawal: acknowledgement NOT sent, send it by hand`
const ACK_STUCK = `${BILLING}Withdrawal: acknowledgement still not sent after 3 days`
const PURCHASE_GIVEN_UP = `${BILLING}Purchase confirmation given up`
const PURCHASE_STUCK = `${BILLING}Purchase confirmation still not sent after 3 days`
const isAlert = (subject: string): boolean => subject.startsWith(BILLING)

describe('a mail Resend gives no clear answer to', () => {
  it('keeps sending the acknowledgement through an outage, so the buyer gets it once Resend is back', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    const resend = outage()
    await withdraw(sam, plus)
    // A day and a half of 500s.
    await sweeps(1, 6)
    expect(statementOf(plus)).toMatchObject({ mailStatus: 'failed' })

    resend.up()
    await sweeps(7, 7)

    expect(statementOf(plus)).toMatchObject({ mailStatus: 'sent' })
    expect(resend.delivered).toContain(ACK_SUBJECT)
    expect(resend.delivered).not.toContain(ACK_GIVEN_UP)
  })

  it('keeps sending the purchase mail through an outage, and the consent stands once it goes', async () => {
    const sam = await buyer('sam@example.test')
    const resend = outage()
    await buy(sam, 'pack-plus', 'pi_plus')
    spend(sam.userId, 140, 'job-all')
    await sweeps(1, 6)
    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'failed' })
    expect((await listFor(sam)).body.packs).toEqual([
      expect.objectContaining({ basis: 'full' }),
    ])

    resend.up()
    await sweeps(7, 7)

    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'sent' })
    expect(resend.delivered.some((s) => PURCHASE_SUBJECT.test(s))).toBe(true)
    expect((await listFor(sam)).body.packs).toEqual([])
  })

  it('keeps sending the acknowledgement while Resend refuses our own key, and it goes once the key works', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    // 403 invalid_api_key: our key is wrong, alerts included.
    let keyBroken = true
    const taken = resendTakes(() => (keyBroken ? 403 : false))
    await withdraw(sam, plus)
    await sweeps(1, 4)
    expect(statementOf(plus)).toMatchObject({ mailStatus: 'failed' })
    expect(String(statementOf(plus)?.mailError)).toContain('403')

    keyBroken = false
    await sweeps(5, 5)

    expect(statementOf(plus)).toMatchObject({ mailStatus: 'sent' })
    expect(taken).toContain(ACK_SUBJECT)
    expect(taken).not.toContain(ACK_GIVEN_UP)
  })

  it('keeps sending the purchase mail while Resend refuses our own key, and it goes once the key works', async () => {
    const sam = await buyer('sam@example.test')
    let keyBroken = true
    const taken = resendTakes(() => (keyBroken ? 403 : false))
    await buy(sam, 'pack-plus', 'pi_plus')
    await sweeps(1, 4)
    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'failed' })

    keyBroken = false
    await sweeps(5, 5)

    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'sent' })
    expect(taken.filter((s) => PURCHASE_SUBJECT.test(s))).toHaveLength(1)
    expect(taken).not.toContain(PURCHASE_GIVEN_UP)
  })

  it('never counts an acknowledgement as sent while Resend holds its key from a refusal of our own', async () => {
    newRefundStatus = 'pending'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    // The case Resend's docs leave open, at its worst: a key kept from a
    // request it refused, so the same key with another body is 409
    // invalid_idempotent_request for 24 hours.
    const inner = globalThis.fetch
    const keys = new Map<string, { body: string; at: number; status: number }>()
    const ackStatuses: number[] = []
    let keyBroken = true
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input)
        if (url !== RESEND) return inner(input, init)
        const body = String(init?.body)
        const key = new Headers(init?.headers).get('idempotency-key')
        const kept = key === null ? undefined : keys.get(key)
        const live = kept !== undefined && Date.now() - kept.at < 86_400_000
        const fresh = keyBroken ? 403 : 200
        const status = live ? (kept.body === body ? kept.status : 409) : fresh
        if (key !== null && !live) {
          keys.set(key, { body, at: Date.now(), status })
        }
        const { subject } = JSON.parse(body) as { subject: string }
        if (subject === ACK_SUBJECT) ackStatuses.push(status)
        sent.push({ url, method: 'POST', body, headers: {} })
        if (status === 200) return Response.json({ id: 'stubbed' })
        return Response.json(
          status === 409
            ? {
                statusCode: 409,
                name: 'invalid_idempotent_request',
                message:
                  'Same idempotency key used with a different request payload.',
              }
            : {
                statusCode: 403,
                name: 'invalid_api_key',
                message: 'API key is invalid',
              },
          { status },
        )
      },
    )
    await withdraw(sam, plus)
    keyBroken = false
    // Stripe finishes the refund, so the acknowledgement now says so: a
    // body other than the one Resend kept.
    const [refund] = refundsMade
    if (refund === undefined) throw new Error('no refund was made')
    refund.status = 'succeeded'

    await sweeps(1, 3)
    expect(statementOf(plus)).toMatchObject({ mailStatus: 'failed' })

    // A day on, Resend has let the key go, and the acknowledgement goes.
    await sweeps(4, 4)
    expect(statementOf(plus)).toMatchObject({ mailStatus: 'sent' })
    expect(ackStatuses).toEqual([403, 409, 409, 409, 200])
    expect(acknowledgements().at(-1)?.text).toContain("We've refunded")
  })

  it('answers a repeated statement with the acknowledgement still being tried', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    resendRefuses = (mail) => mail.subject === ACK_SUBJECT
    await withdraw(sam, plus)
    await sweeps(1, 6)

    const again = await withdraw(sam, plus)

    expect(again.body.statement).toMatchObject({ mailStatus: 'failed' })
  })

  it('tells the owner once, 3 days on, that the acknowledgement still has not gone, and keeps trying', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    resendRefuses = (mail) => mail.subject === ACK_SUBJECT
    await withdraw(sam, plus)

    await sweeps(1, 11)
    expect(subjects(alerts())).not.toContain(ACK_STUCK)
    await sweeps(12, 20)

    expect(subjects(alerts()).filter((s) => s === ACK_STUCK)).toHaveLength(1)
    expect(alerts().find((a) => a.subject === ACK_STUCK)?.text).toContain(
      'every 6 hours',
    )
    expect(statementOf(plus)).toMatchObject({ mailStatus: 'failed' })
    expect(statementOf(plus)?.mailWarnedAt).toEqual(expect.any(String))
    const tries = acknowledgements().length
    await sweeps(21, 22)
    expect(acknowledgements()).toHaveLength(tries + 2)
    expect(subjects(alerts())).not.toContain(ACK_GIVEN_UP)
  })

  it('sends the 3-day warning at a later sweep when Resend refuses the warning itself', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    let warningRefused = true
    const taken = resendTakes((subject) =>
      subject === ACK_SUBJECT ? true : subject === ACK_STUCK && warningRefused,
    )
    await withdraw(sam, plus)

    await sweeps(1, 12)
    expect(statementOf(plus)?.mailWarnedAt).toBeNull()
    warningRefused = false
    await sweeps(13, 16)

    expect(taken.filter((s) => s === ACK_STUCK)).toHaveLength(1)
    expect(statementOf(plus)?.mailWarnedAt).toEqual(expect.any(String))
  })

  it('tells the owner once, 3 days on, that the purchase mail still has not gone', async () => {
    const sam = await buyer('sam@example.test')
    resendRefuses = (mail) => PURCHASE_SUBJECT.test(mail.subject)
    await buy(sam, 'pack-plus', 'pi_plus')

    await sweeps(1, 11)
    expect(subjects(alerts())).not.toContain(PURCHASE_STUCK)
    await sweeps(12, 20)

    expect(subjects(alerts()).filter((s) => s === PURCHASE_STUCK)).toHaveLength(
      1,
    )
    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'failed' })
    expect(consentOf('cs_evt_pi_plus')?.mailWarnedAt).toEqual(
      expect.any(String),
    )
    expect(subjects(alerts())).not.toContain(PURCHASE_GIVEN_UP)
  })

  it('stops sending a purchase mail once the withdrawal period is over, after the owner has heard', async () => {
    const sam = await buyer('sam@example.test')
    let alertsDown = false
    const taken = resendTakes((subject) =>
      PURCHASE_SUBJECT.test(subject) ? true : isAlert(subject) && alertsDown,
    )
    await buy(sam, 'pack-plus', 'pi_plus')

    // 14 days and more: still trying.
    await sweeps(1, 60)
    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'failed' })
    expect(taken).not.toContain(PURCHASE_GIVEN_UP)

    // The period is over while alerts do not go: nothing is recorded.
    alertsDown = true
    await sweeps(61, 80)
    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'failed' })

    alertsDown = false
    await sweeps(81, 81)
    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'gave-up' })
    expect(taken.filter((s) => s === PURCHASE_GIVEN_UP)).toHaveLength(1)
    const sends = purchaseMails().length
    await sweeps(82, 84)
    expect(purchaseMails()).toHaveLength(sends)
  })

  it('sends the 5-day escalation at a later sweep when Resend refuses it at the first', async () => {
    newRefundStatus = 'pending'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await withdraw(sam, plus)
    let refusing = false
    const taken = resendTakes(
      (subject) => subject.includes('still open after 5 days') && refusing,
    )
    await sweeps(1, 19)
    refusing = true
    await sweeps(20, 20)
    expect(statementOf(plus)?.refundEscalatedAt).toBeNull()

    refusing = false
    await sweeps(21, 24)

    expect(
      taken.filter((s) => s.includes('still open after 5 days')),
    ).toHaveLength(1)
    expect(statementOf(plus)?.refundEscalatedAt).toEqual(expect.any(String))
  })
})

describe('a mail Resend refuses for good', () => {
  it('gives the acknowledgement up at once, with one alert, and never sends it again', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    resendRefuses = (mail) => (mail.subject === ACK_SUBJECT ? 422 : false)

    const res = await withdraw(sam, plus)

    expect(res.body.statement).toMatchObject({ mailStatus: 'gave-up' })
    const givenUp = alerts().filter((a) => a.subject === ACK_GIVEN_UP)
    expect(givenUp).toHaveLength(1)
    expect(givenUp[0]?.text).toContain('422')
    expect(givenUp[0]?.text).toContain('Send it to: sam@example.test')
    await sweeps(1, 8)
    expect(acknowledgements()).toHaveLength(1)
    expect(alerts().filter((a) => a.subject === ACK_GIVEN_UP)).toHaveLength(1)
  })

  it('records the acknowledgement given up only once the owner alert about it goes', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    let alertsDown = true
    const taken = resendTakes((subject) =>
      subject === ACK_SUBJECT ? 422 : isAlert(subject) && alertsDown,
    )
    await withdraw(sam, plus)
    expect(statementOf(plus)).toMatchObject({ mailStatus: 'refused' })

    await sweeps(1, 4)
    expect(statementOf(plus)).toMatchObject({ mailStatus: 'refused' })
    expect(acknowledgements()).toHaveLength(1)

    alertsDown = false
    await sweeps(5, 8)

    expect(statementOf(plus)).toMatchObject({ mailStatus: 'gave-up' })
    expect(taken.filter((s) => s === ACK_GIVEN_UP)).toHaveLength(1)
    expect(acknowledgements()).toHaveLength(1)
  })

  it('gives the purchase mail up at once, with one alert, and never sends it again', async () => {
    const sam = await buyer('sam@example.test')
    resendRefuses = (mail) =>
      PURCHASE_SUBJECT.test(mail.subject) ? 422 : false

    await buy(sam, 'pack-plus', 'pi_plus')

    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'gave-up' })
    const givenUp = alerts().filter((a) => a.subject === PURCHASE_GIVEN_UP)
    expect(givenUp).toHaveLength(1)
    expect(givenUp[0]?.text).toContain('422')
    await sweeps(1, 8)
    expect(purchaseMails()).toHaveLength(1)
    expect(
      alerts().filter((a) => a.subject === PURCHASE_GIVEN_UP),
    ).toHaveLength(1)
  })

  it('records the purchase mail given up only once the owner alert about it goes', async () => {
    const sam = await buyer('sam@example.test')
    let alertsDown = true
    const taken = resendTakes((subject) =>
      PURCHASE_SUBJECT.test(subject) ? 422 : isAlert(subject) && alertsDown,
    )
    await buy(sam, 'pack-plus', 'pi_plus')
    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'refused' })

    await sweeps(1, 4)
    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'refused' })
    expect(purchaseMails()).toHaveLength(1)

    alertsDown = false
    await sweeps(5, 8)

    expect(consentOf('cs_evt_pi_plus')).toMatchObject({ mailStatus: 'gave-up' })
    expect(taken.filter((s) => s === PURCHASE_GIVEN_UP)).toHaveLength(1)
  })

  it('never counts a refused acknowledgement as sent when Resend answers a later send 409', async () => {
    // Resend keeps whatever it answered under a key, a refusal included,
    // and answers another body under it 409.
    const inner = globalThis.fetch
    const keys = new Map<string, { body: string; status: number }>()
    const ackStatuses: number[] = []
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input)
        const key =
          url === RESEND
            ? new Headers(init?.headers).get('idempotency-key')
            : null
        if (key === null) return inner(input, init)
        const body = String(init?.body)
        const mail = JSON.parse(body) as { subject: string; to: string[] }
        const seen = keys.get(key)
        const status =
          seen === undefined
            ? mail.to.some((to) => to.includes('..'))
              ? 422
              : 200
            : seen.body === body
              ? seen.status
              : 409
        if (seen === undefined) keys.set(key, { body, status })
        if (mail.subject === ACK_SUBJECT) ackStatuses.push(status)
        sent.push({ url, method: 'POST', body, headers: {} })
        if (status === 200) return Response.json({ id: 'stubbed' })
        return Response.json(
          status === 409
            ? {
                statusCode: 409,
                name: 'invalid_idempotent_request',
                message:
                  'Same idempotency key used with a different request payload.',
              }
            : {
                statusCode: 422,
                name: 'validation_error',
                message:
                  'Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.',
              },
          { status },
        )
      },
    )
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    stripeRefunds = 'down'
    // A typo the form's shape check lets through.
    await withdraw(sam, plus, { email: 'sam@example..test' })
    stripeRefunds = 'ok'
    at('2026-10-20T16:17:00.000Z')
    await cron()

    expect(ackStatuses).toEqual([422])
    expect(statementOf(plus)?.mailStatus).toBe('gave-up')
  })
})

describe('deleting an account a withdrawal still owes something', () => {
  const ACK_HELD =
    "The confirmation email for your cancelled credit pack hasn't gone out yet. You can delete your account once it has."

  it('waits while the acknowledgement has not gone, and goes ahead once it has', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    resendRefuses = (mail) => mail.subject === ACK_SUBJECT
    await withdraw(sam, plus)
    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'refunded',
      mailStatus: 'failed',
    })

    expect(await deleteAccount(sam)).toEqual({
      status: 409,
      body: { error: ACK_HELD },
    })
    expect(subjects(alerts()).at(-1)).toBe(
      `${BILLING}Account deletion held: a withdrawal acknowledgement has not gone`,
    )

    resendRefuses = () => false
    at('2026-10-20T16:17:00.000Z')
    await cron()
    expect(statementOf(plus)).toMatchObject({ mailStatus: 'sent' })
    expect((await deleteAccount(sam)).status).toBe(200)
  })

  it('is never carried out while a withdrawal written during it still owes its refund', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    stripeRefunds = 'down'
    const db = env.DB as unknown as SqliteD1Database
    const prepare = db.prepare.bind(db)
    let fired = false
    db.prepare = (text: string) => {
      const statement = prepare(text)
      if (fired || !/googleDriveTokens/.test(text)) return statement
      fired = true
      // The deletion has passed its check and is revoking the Drive grant
      // when the buyer's withdrawal lands.
      const bind = statement.bind.bind(statement)
      statement.bind = (...values: Parameters<SqliteD1Statement['bind']>) => {
        const bound = bind(...values)
        const first = bound.first.bind(bound)
        bound.first = (async (...args: unknown[]) => {
          await withdraw(sam, plus)
          return (first as (...a: unknown[]) => unknown)(...args)
        }) as typeof bound.first
        return bound
      }
      return statement
    }

    const deletion = await deleteAccount(sam)

    expect(fired).toBe(true)
    expect(deletion).toEqual({
      status: 409,
      body: {
        error:
          'Your refund for a cancelled credit pack is still in progress. You can delete your account once it has gone through.',
      },
    })
    expect(
      sqlite.prepare('SELECT id FROM users WHERE id = ?').get(sam.userId),
    ).toBeDefined()
    expect(statementOf(plus)).toMatchObject({ refundStatus: 'pending' })

    db.prepare = prepare
    stripeRefunds = 'ok'
    at('2026-10-20T16:17:00.000Z')
    await cron()
    expect(statementOf(plus)).toMatchObject({ refundStatus: 'refunded' })
    expect(refundsMade).toHaveLength(1)
  })
})

describe('an acknowledgement sent before Stripe has finished the refund', () => {
  it.each(['requires_action', 'pending'])(
    'says the refund has started while it is %s',
    async (status) => {
      newRefundStatus = status
      const sam = await buyer('sam@example.test')
      const plus = await buy(sam, 'pack-plus', 'pi_plus')

      const res = await withdraw(sam, plus)

      expect(res.body.statement).toMatchObject({
        refundStatus: 'refunded',
        stripeRefundStatus: status,
      })
      const ack = acknowledgements()[0]
      expect(ack?.text).toContain(
        "We've started a refund of €20.00 to the card or account you paid with. Banks usually show it within 5 to 10 business days.",
      )
      expect(ack?.text).not.toContain("We've refunded")
    },
  )

  it('says the money went back once Stripe reports the refund succeeded', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')

    const res = await withdraw(sam, plus)

    expect(res.body.statement).toMatchObject({
      stripeRefundStatus: 'succeeded',
    })
    expect(acknowledgements()[0]?.text).toContain("We've refunded €20.00")
  })
})

describe('a refund that stays open', () => {
  it('tells the owner what Stripe answered a price lookup, and hands the refund over before day 14', async () => {
    const sam = await buyer('sam@example.test')
    insertRow(
      sam.userId,
      140,
      'purchase',
      'pack-plus',
      'evt:evt_legacy',
      'pi_legacy',
    )
    paymentIntents.set('pi_legacy', { amount_received: 2000, currency: 'eur' })
    const inner = globalThis.fetch
    let lookups = 0
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input)
        if (url.startsWith(`${STRIPE}/payment_intents/`)) {
          lookups += 1
          return Response.json(
            {
              error: {
                type: 'invalid_request_error',
                message:
                  'The provided key does not have the required permissions for this endpoint.',
              },
            },
            { status: 403 },
          )
        }
        return inner(input, init)
      },
    )
    const purchase = purchaseOf('evt_legacy')

    await withdraw(sam, purchase)

    expect(statementOf(purchase)).toMatchObject({
      refundStatus: 'pending',
      priceSource: 'pending',
    })
    expect(String(statementOf(purchase)?.refundError)).toMatch(/403/)
    expect(alerts()[0]?.text).toMatch(/403.*permissions/)

    // Day 10: still pending, and asked again every run.
    await sweeps(1, 40)
    expect(statementOf(purchase)).toMatchObject({ refundStatus: 'pending' })
    expect(statementOf(purchase)?.refundHandedOverAt).toBeNull()

    // Day 11: the owner is told to refund it by hand by 3 November, and the
    // sweep stops asking, so it can never go twice.
    await sweeps(41, 44)
    const handover = alerts().filter((a) =>
      a.subject.includes('by hand by 3 November 2026'),
    )
    expect(handover).toHaveLength(1)
    expect(handover[0]?.text).toMatch(/403/)
    expect(statementOf(purchase)).toMatchObject({ refundStatus: 'manual' })
    expect(statementOf(purchase)?.refundHandedOverAt).toEqual(
      expect.any(String),
    )
    const asked = lookups
    await sweeps(45, 52)
    expect(lookups).toBe(asked)
    expect(refundRequests()).toEqual([])
    expect(
      alerts().filter((a) => a.subject.includes('by hand by 3 November 2026')),
    ).toHaveLength(1)
  })

  it('hands it over at a later sweep when Resend refuses the day-11 alert', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    stripeRefunds = 'down'
    await withdraw(sam, plus)
    let refusing = false
    const taken = resendTakes(
      (subject) => subject.includes('by hand by') && refusing,
    )
    await sweeps(1, 43)
    refusing = true
    await sweeps(44, 44)
    expect(statementOf(plus)).toMatchObject({ refundStatus: 'pending' })
    expect(statementOf(plus)?.refundHandedOverAt).toBeNull()

    refusing = false
    await sweeps(45, 46)

    expect(taken.filter((s) => s.includes('by hand by'))).toHaveLength(1)
    expect(statementOf(plus)).toMatchObject({ refundStatus: 'manual' })
    expect(String(statementOf(plus)?.refundError)).toMatch(/503/)
  })

  it('keeps what Stripe answered a refund it did not take, for the owner', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    stripeRefunds = 'down'

    await withdraw(sam, plus)

    expect(statementOf(plus)).toMatchObject({ refundStatus: 'pending' })
    expect(String(statementOf(plus)?.refundError)).toContain(
      'Something went wrong on our end.',
    )
    expect(alerts()[0]?.text).toContain('Something went wrong on our end.')
  })

  it('tells the owner on day 11 that Stripe has still not finished it, once', async () => {
    newRefundStatus = 'pending'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await withdraw(sam, plus)

    await sweeps(1, 48)

    const due = alerts().filter((a) => a.subject.includes('3 November 2026'))
    expect(due).toHaveLength(1)
    expect(due[0]?.text).toContain('re_1')
    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'refunded',
      stripeRefundStatus: 'pending',
    })
    expect(statementOf(plus)?.refundHandedOverAt).toEqual(expect.any(String))
  })

  it('says at the day-11 hand-over only that the sweep stopped asking Stripe', async () => {
    const sam = await buyer('sam@example.test')
    insertRow(
      sam.userId,
      140,
      'purchase',
      'pack-plus',
      'evt:evt_legacy',
      'pi_legacy',
    )
    const inner = globalThis.fetch
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input)
        if (url.startsWith(`${STRIPE}/payment_intents/`)) {
          return Response.json(
            {
              error: {
                message:
                  'The provided key does not have the required permissions for this endpoint.',
              },
            },
            { status: 403 },
          )
        }
        return inner(input, init)
      },
    )
    const purchase = purchaseOf('evt_legacy')
    await withdraw(sam, purchase)

    await sweeps(1, 45)

    const handOver = alerts().find((a) =>
      a.subject.includes('by hand by 3 November 2026'),
    )
    expect(statementOf(purchase)).toMatchObject({
      refundStatus: 'manual',
      priceSource: 'pending',
    })
    expect(handOver?.text).toContain(
      'The sweep has stopped asking Stripe for it',
    )
    expect(handOver?.text).not.toContain('is asked again every 6 hours')
  })

  it('records the day-11 hand-over only for the refund its alert described', async () => {
    newRefundStatus = 'requires_action'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await withdraw(sam, plus)
    const id = String(statementOf(plus)?.id)
    await sweeps(1, 43)
    expect(statementOf(plus)?.refundHandedOverAt).toBeNull()

    // Day 11. While its alert is on the way, a request for the same pack
    // finds Stripe canceled the refund and records it failed, and Resend
    // does not take that request's alert.
    let raced = false
    resendRefuses = (mail) => {
      if (!raced && mail.subject.includes('not finished at Stripe, due by')) {
        raced = true
        sqlite
          .prepare(
            `UPDATE withdrawals
                SET refundStatus = 'failed', stripeRefundStatus = 'canceled',
                    refundError = 'Stripe did not complete the refund: canceled',
                    refundHandedOverAt = NULL
              WHERE id = ?`,
          )
          .run(id)
      }
      return false
    }
    await sweeps(44, 44)
    expect(raced).toBe(true)
    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'failed',
      stripeRefundStatus: 'canceled',
    })
    expect(statementOf(plus)?.refundHandedOverAt).toBeNull()

    // The next sweep tells the owner it failed, and only then hands it over.
    await sweeps(45, 45)
    expect(subjects(alerts())).toContain(
      `${BILLING}Withdrawal: refund FAILED, refund €20.00 by hand`,
    )
    expect(statementOf(plus)?.refundHandedOverAt).toEqual(expect.any(String))
  })
})

describe('a refund the owner has to make by hand', () => {
  const BY_HAND = `${BILLING}Withdrawal: refund FAILED, refund €20.00 by hand`

  it('tells the owner again of a refund Stripe refused, until Resend takes that alert', async () => {
    stripeRefunds = 'refused'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    let refusing = true
    const taken = resendTakes((subject) => isAlert(subject) && refusing)

    await withdraw(sam, plus)
    await sweeps(1, 2)

    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'failed',
      mailStatus: 'sent',
    })
    expect(statementOf(plus)?.refundHandedOverAt).toBeNull()
    expect(taken.filter((s) => s === BY_HAND)).toEqual([])

    refusing = false
    await sweeps(3, 6)

    expect(taken.filter((s) => s === BY_HAND)).toHaveLength(1)
    expect(statementOf(plus)?.refundHandedOverAt).toEqual(expect.any(String))
    expect(refundRequests()).toHaveLength(1)
  })

  it('tells the owner of a refund Stripe fails after the day-11 alert, until Resend takes that alert', async () => {
    newRefundStatus = 'pending'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await withdraw(sam, plus)
    await sweeps(1, 44)
    expect(statementOf(plus)?.refundHandedOverAt).toEqual(expect.any(String))

    const [refund] = refundsMade
    if (refund === undefined) throw new Error('no refund was made')
    refund.status = 'failed'
    refund.failure_reason = 'expired_or_canceled_card'
    let refusing = true
    const taken = resendTakes((subject) => isAlert(subject) && refusing)
    await sweeps(45, 46)
    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'failed',
      stripeRefundStatus: 'failed',
    })
    expect(statementOf(plus)?.refundHandedOverAt).toBeNull()

    refusing = false
    await sweeps(47, 48)

    expect(taken.filter((s) => s === BY_HAND)).toHaveLength(1)
    expect(statementOf(plus)?.refundHandedOverAt).toEqual(expect.any(String))
  })

  it('holds the account deletion until the owner has heard of it', async () => {
    stripeRefunds = 'refused'
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    resendRefuses = (mail) => isAlert(mail.subject)
    await withdraw(sam, plus)

    expect(await deleteAccount(sam)).toEqual({
      status: 409,
      body: {
        error:
          'Your refund for a cancelled credit pack is still in progress. You can delete your account once it has gone through.',
      },
    })
    expect(statementOf(plus)).toBeDefined()

    resendRefuses = () => false
    await sweeps(1, 1)
    expect(statementOf(plus)?.refundHandedOverAt).toEqual(expect.any(String))

    expect((await deleteAccount(sam)).status).toBe(200)
    expect(statementOf(plus)).toBeUndefined()
  })
})

describe('a name', () => {
  it.each(['J.Smith', 'Dr.Ana Horvat', 'St.John Smith', 'A.Kumar'])(
    'takes %s',
    async (name) => {
      const sam = await buyer('sam@example.test')
      const plus = await buy(sam, 'pack-plus', 'pi_plus')

      const res = await withdraw(sam, plus, { name })

      expect(res.status).toBe(200)
      expect(acknowledgements()[0]?.text).toContain(name)
    },
  )
})

describe('a refund that fails after Stripe said it succeeded', () => {
  type Failure = {
    withdrawalId: string
    refundId: string
    stripeStatus: string
    reason?: string | null
    paymentIntentId?: string | null
    amountMinor?: number | null
    currency?: string | null
  }
  /** What #970's refund webhook calls. */
  async function failed(failure: Failure): Promise<string> {
    const module = (await import('../src/withdrawal-refund-failed')) as {
      markWithdrawalRefundFailed: (
        env: Env,
        failure: Failure,
      ) => Promise<string>
    }
    return module.markWithdrawalRefundFailed(env, failure)
  }
  const FAILED_SUBJECT = `${BILLING}Withdrawal: refund FAILED after it went through, refund €20.00 by hand`

  it('goes to the owner to refund by hand, once per status, with no credits back', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await withdraw(sam, plus)
    const statement = statementOf(plus)
    expect(statement).toMatchObject({
      refundStatus: 'refunded',
      stripeRefundStatus: 'succeeded',
    })
    const credits = balance(sam.userId)
    const failure = {
      withdrawalId: String(statement?.id),
      refundId: 're_1',
      stripeStatus: 'failed',
      reason: 'expired_or_canceled_card',
    }

    expect(await failed(failure)).toBe('recorded')
    expect(await failed(failure)).toBe('already')

    expect(statementOf(plus)).toMatchObject({
      refundStatus: 'failed',
      stripeRefundStatus: 'failed',
    })
    expect(String(statementOf(plus)?.refundError)).toContain(
      'expired_or_canceled_card',
    )
    expect(subjects(alerts()).filter((s) => s === FAILED_SUBJECT)).toHaveLength(
      1,
    )
    // The alert says what it is now, not what it was.
    const told = alerts().find((a) => a.subject === FAILED_SUBJECT)?.text
    expect(told).toContain('Refund: €20.00 of €20.00, failed')
    expect(told).not.toContain(', refunded')
    expect(balance(sam.userId)).toBe(credits)

    // The owner has heard: no sweep tells again.
    expect(statementOf(plus)?.refundHandedOverAt).toEqual(expect.any(String))
    await sweeps(1, 2)
    expect(
      subjects(alerts()).filter((s) => s.includes('refund FAILED, refund')),
    ).toEqual([])
  })

  it('changes nothing until the owner alert about it goes', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    await withdraw(sam, plus)
    const id = String(statementOf(plus)?.id)
    resendRefuses = (mail) => isAlert(mail.subject)
    const failure = {
      withdrawalId: id,
      refundId: 're_1',
      stripeStatus: 'failed',
    }

    await expect(failed(failure)).rejects.toThrow()
    expect(statementOf(plus)).toMatchObject({ refundStatus: 'refunded' })

    resendRefuses = () => false
    expect(await failed(failure)).toBe('recorded')
    expect(statementOf(plus)).toMatchObject({ refundStatus: 'failed' })
  })

  it('tells the owner of a failed refund whose statement is gone', async () => {
    expect(
      await failed({
        withdrawalId: 'no-such-statement',
        refundId: 're_9',
        stripeStatus: 'failed',
        paymentIntentId: 'pi_gone',
        amountMinor: 500,
        currency: 'eur',
      }),
    ).toBe('not-found')
    expect(subjects(alerts())).toEqual([
      `${BILLING}Withdrawal: refund FAILED after it went through, statement gone, refund by hand`,
    ])
    expect(alerts()[0]?.text).toContain('pi_gone')
    expect(alerts()[0]?.text).toContain('€5.00')
  })
})
