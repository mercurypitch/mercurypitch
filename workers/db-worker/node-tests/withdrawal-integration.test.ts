// @vitest-environment node
//
// ── The 14-day withdrawal for a credit pack, end to end ──
//
// A pack's checkout asks for the withdrawal checkbox in the words of
// WITHDRAWAL_MODE, and the paid session keeps what the buyer ticked, with
// the purchase mail that confirms it (checkout-consent.ts). Under
// refund_unused, Settings › Credits lists each pack bought in the last 14
// days that still holds unused paid credits, and a statement there refunds
// their share of the price through Stripe, takes them and the pack's unused
// bonus off the balance, and acknowledges it by mail (withdrawal.ts,
// withdrawal-rules.ts). The refund's own charge.refunded then takes nothing
// a second time (stripe-payments.ts).
//
// Real SQLite with every migration applied, through the worker's own fetch.
// Stripe and Resend are stubbed at fetch: nothing leaves the process, and the
// stub records what would have been sent.

import { createHmac } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { CHECKOUT_CHECKBOX, WITHDRAWAL_TEXT_VERSION, } from '../src/withdrawal-wording'
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
/** How Stripe answers a refund: made, refused, or busy with the same key. */
let stripeRefunds: 'ok' | 'refused' | 'busy'
/** The refunds Stripe made, one per idempotency key, as Stripe keeps them. */
let refundsMade: Array<Record<string, unknown>>
/** Which mails Resend refuses. */
let resendRefuses: (mail: { subject: string }) => boolean

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
  const earlier = refundsMade.find((refund) => refund.key === key)
  if (earlier !== undefined) return Response.json(earlier)
  const form = new URLSearchParams(body)
  const refund = {
    id: `re_${refundsMade.length + 1}`,
    object: 'refund',
    status: 'succeeded',
    amount: Number(form.get('amount')),
    payment_intent: form.get('payment_intent'),
    metadata: { withdrawalId: form.get('metadata[withdrawalId]') },
    key,
  }
  refundsMade.push(refund)
  return Response.json(refund)
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
      if (url.startsWith(`${STRIPE}/refunds?`)) {
        const paymentIntent = new URL(url).searchParams.get('payment_intent')
        return Response.json({
          data: refundsMade.filter(
            (refund) => refund.payment_intent === paymentIntent,
          ),
          has_more: false,
        })
      }
      if (url === `${STRIPE}/refunds` && method === 'POST') {
        return refundAnswer(body, headers['idempotency-key'])
      }
      if (url === RESEND) {
        const mail = JSON.parse(body) as { subject: string }
        return resendRefuses(mail)
          ? Response.json({ message: 'refused' }, { status: 500 })
          : Response.json({ id: 'stubbed' })
      }
      throw new Error(`unexpected fetch in a test: ${url}`)
    }),
  )
}

interface Mail {
  to: string[]
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  at('2026-10-20T10:00:00.000Z')
  sent = []
  stripeRefunds = 'ok'
  refundsMade = []
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
          paidCredits: 140,
          unusedCredits: 126,
          bonusCredits: 0,
          refund: { amountMinor: 1800, currency: 'eur' },
        },
      ],
      statements: [],
    })
  })

  it('stops listing a pack once its 14 days have ended everywhere', async () => {
    const sam = await buyer('sam@example.test')
    await buy(sam, 'pack-starter', 'pi_starter')

    // 3 November has not ended at UTC-12 until noon UTC on 4 November.
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

  it('lists nothing under waiver', async () => {
    const sam = await buyer('sam@example.test')
    await buy(sam, 'pack-starter', 'pi_starter')
    env.WITHDRAWAL_MODE = 'waiver'

    expect((await listFor(sam)).body).toEqual({
      mode: 'waiver',
      email: null,
      packs: [],
      statements: [],
    })
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
    const purchase = (
      sqlite
        .prepare("SELECT id FROM creditLedger WHERE reason = 'purchase'")
        .get() as { id: string }
    ).id

    const res = await withdraw(sam, purchase)

    expect(res.body.statement).toMatchObject({
      refundStatus: 'manual',
      refundMinor: 500,
    })
    expect(refundRequests()).toEqual([])
    expect(takes(sam.userId)).toEqual([
      expect.objectContaining({ delta: -30, jobRef: purchase }),
    ])
    expect(alerts()[0]?.subject).toBe(
      '[MercuryPitch billing] Withdrawal: refund €5.00 by hand',
    )
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

  it('once the 14 days have ended', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    at('2026-11-04T12:00:00.000Z')

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

  it('for a pack already refunded in the Stripe dashboard', async () => {
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
          amount_refunded: 1000,
          refunded: false,
        },
      },
    })

    expect((await listFor(sam)).body.packs).toEqual([])
    expect((await withdraw(sam, plus)).status).toBe(409)
  })

  it('under waiver', async () => {
    const sam = await buyer('sam@example.test')
    const plus = await buy(sam, 'pack-plus', 'pi_plus')
    env.WITHDRAWAL_MODE = 'waiver'

    expect((await withdraw(sam, plus)).status).toBe(403)
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
