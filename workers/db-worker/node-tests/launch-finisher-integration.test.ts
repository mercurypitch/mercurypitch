// @vitest-environment node
//
// ── The launch offer: use all five, and the next pack comes with 30 more ──
//
// An account that uses all of its launch credits within 14 days of claiming
// them earns 30 extra credits on its next pack (launch-finisher.ts,
// offer-rules.ts; owner decisions D1, D3, D4, D9). This file walks it end to
// end: the claim on a confirmed email, separations paid through the debit
// route (and one failed job refunded through the refund route), GET /me,
// the Checkout Session's parameters, and the webhook's bonus row beside the
// pack, once, with its line in the purchase mail. Then the edges: a window
// that closes short, a claim from before the offer started, a refund of the
// pack, the 6-hourly sweep, and an address that had the bonus on an account
// since deleted.
//
// Real SQLite with every migration applied, through the worker's own fetch.
// Stripe and Resend are stubbed at fetch: nothing leaves the process.

import { createHash, createHmac } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import { reconcileBilling } from '../src/billing'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'
import { chargeReads } from './stripe-charge-stub'

const WEBHOOK_SECRET = 'whsec_launch_finisher_integration'
const SERVICE_KEY = 'launch-finisher-service-key'
const PASSWORD = 'Singer123!pass'
const PROMO_ID = 'promo-launch-test'
const OPENS = '2026-10-15'

let sqlite: DatabaseSync
let perksSqlite: DatabaseSync
let env: Env

interface Sent {
  url: string
  body: string
}
let sent: Sent[]
let eventPages: Array<Record<string, unknown>>
/** The charges Stripe reports now, by id (stripe-charge-stub.ts). */
const charges = new Map<string, Record<string, unknown>>()

function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const body =
        typeof init?.body === 'string'
          ? init.body
          : init?.body instanceof URLSearchParams
            ? init.body.toString()
            : ''
      sent.push({ url, body })
      if (url === 'https://api.stripe.com/v1/customers') {
        return Response.json({ id: 'cus_finisher' })
      }
      if (url === 'https://api.stripe.com/v1/checkout/sessions') {
        return Response.json({ id: 'cs_finisher', url: 'https://pay.test/cs' })
      }
      if (url.startsWith('https://api.stripe.com/v1/events')) {
        return Response.json(
          eventPages.shift() ?? { data: [], has_more: false },
        )
      }
      // A refund is applied from the charge as Stripe reports it now.
      const charge = chargeReads(charges, url)
      if (charge !== null) return charge
      if (url === 'https://api.resend.com/emails') {
        return Response.json({ id: 'stubbed' })
      }
      throw new Error(`unexpected fetch in a test: ${url}`)
    }),
  )
}

/** The parameters of the last Checkout Session the worker asked Stripe for. */
function lastCheckout(): URLSearchParams {
  const request = sent
    .filter((r) => r.url === 'https://api.stripe.com/v1/checkout/sessions')
    .at(-1)
  if (request === undefined)
    throw new Error('no checkout session was asked for')
  return new URLSearchParams(request.body)
}

/** Purchase mails the worker would have sent: their text. */
function purchaseMails(): string[] {
  return sent
    .filter((r) => r.url === 'https://api.resend.com/emails')
    .map((r) => JSON.parse(r.body) as { subject: string; text: string })
    .filter((mail) => mail.subject.includes(' ready'))
    .map((mail) => mail.text)
}

interface Call {
  method?: string
  token?: string
  body?: unknown
  headers?: Record<string, string>
}

async function call(
  path: string,
  init: Call = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { ...init.headers }
  if (init.token !== undefined) headers.Authorization = `Bearer ${init.token}`
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await worker.fetch(
    new Request(`https://api.test${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers,
      redirect: 'manual',
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

interface Singer {
  userId: string
  token: string
  email: string
}

/** A password account, confirmed by its link: it claims the launch code. */
async function confirmedSinger(email: string): Promise<Singer> {
  const registered = await call('/api/auth/register', {
    body: { email, password: PASSWORD },
  })
  expect(registered.status).toBe(200)
  const { userId, token } = registered.body as { userId: string; token: string }
  const link = `confirm-${userId}`
  sqlite
    .prepare(
      'INSERT INTO emailVerifications (tokenHash, userId, email, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      createHash('sha256').update(link).digest('base64url'),
      userId,
      email,
      new Date().toISOString(),
      new Date(Date.now() + 60_000).toISOString(),
    )
  const confirmed = await call(
    `/api/auth/verify-email?token=${encodeURIComponent(link)}`,
  )
  expect(confirmed.status).toBe(302)
  return { userId, token, email }
}

/** A separation paid for on the web, through the debit route. */
async function separate(singer: Singer, jobRef: string): Promise<void> {
  const res = await call('/api/billing/debit', {
    token: singer.token,
    body: { tier: 'gpu', jobRef },
  })
  expect(res.status).toBe(200)
  expect(res.body.debited).toBe(1)
}

/** A failed job's refund, as the main worker asks for it. */
async function refundJob(jobRef: string): Promise<void> {
  const res = await call('/api/billing/refund', {
    headers: { 'X-Service-Key': SERVICE_KEY },
    body: { jobRef },
  })
  expect(res.status).toBe(200)
}

interface Offer {
  state: string
  used: number
  goal: number
  deadline: string
  bonusCredits: number
}

async function offerOf(singer: Singer): Promise<Offer | null> {
  const me = await call('/api/billing/me', { token: singer.token })
  expect(me.status).toBe(200)
  return me.body.offer as Offer | null
}

async function balanceOf(singer: Singer): Promise<number> {
  const me = await call('/api/billing/me', { token: singer.token })
  return me.body.creditBalance as number
}

async function checkout(singer: Singer, planId = 'pack-starter') {
  const res = await call('/api/billing/checkout', {
    token: singer.token,
    body: { planId },
  })
  expect(res.status).toBe(200)
  return lastCheckout()
}

interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

/** The event Stripe sends when the Checkout Session `params` made is paid. */
function paidEvent(
  id: string,
  params: URLSearchParams,
  paymentIntent: string,
): StripeEvent {
  const metadata: Record<string, string> = {}
  for (const [key, value] of params) {
    const field = /^metadata\[(.+)\]$/.exec(key)?.[1]
    if (field !== undefined) metadata[field] = value
  }
  return {
    id,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_${id}`,
        object: 'checkout.session',
        mode: 'payment',
        payment_status: 'paid',
        payment_intent: paymentIntent,
        amount_total: 500,
        currency: 'eur',
        // What Stripe reports when the session asked for the checkbox.
        consent:
          params.get('consent_collection[terms_of_service]') === 'required'
            ? { terms_of_service: 'accepted' }
            : null,
        metadata,
      },
    },
  }
}

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

function bonusRows(userId: string) {
  return sqlite
    .prepare(
      "SELECT delta, jobRef, idempotencyKey, paymentIntentId FROM creditLedger WHERE userId = ? AND reason = 'offer-bonus'",
    )
    .all(userId)
}

function unlockOf(userId: string): string | null {
  const row = sqlite
    .prepare(
      "SELECT unlockedAt FROM offerUnlocks WHERE userId = ? AND campaign = 'launch-finisher'",
    )
    .get(userId) as { unlockedAt: string } | undefined
  return row?.unlockedAt ?? null
}

function at(iso: string): void {
  vi.setSystemTime(new Date(iso))
}

/** Use all five launch credits, one separation each. */
async function useAllFive(singer: Singer, prefix = 'song'): Promise<void> {
  for (let n = 1; n <= 5; n += 1) await separate(singer, `${prefix}-${n}`)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  at('2026-10-20T10:00:00.000Z')
  sent = []
  eventPages = []
  charges.clear()
  stubFetch()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  perksSqlite = new DatabaseSync(':memory:')
  perksSqlite.exec(
    'CREATE TABLE perkGrants (email TEXT, perkId TEXT, revokedAt TEXT)',
  )
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    PERKS_DB: new SqliteD1Database(perksSqlite) as unknown as D1Database,
    JWT_SECRET: 'launch-finisher-integration-jwt',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY: 'launch-finisher-integration-admin',
    FREE_SONG_EMAIL_SECRET: 'launch-finisher-integration-key-0123456789',
    BILLING_SERVICE_KEY: SERVICE_KEY,
    STRIPE_SECRET_KEY: 'sk_test_launch_finisher',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    RESEND_API_KEY: 're_test_launch_finisher',
    OFFER_START_AT: OPENS,
    OFFER_PROMO_ID: PROMO_ID,
  }
  const now = new Date().toISOString()
  // The test's own featured code, open until 2099, so the suite does not
  // start failing the day the real campaign closes.
  sqlite.exec("UPDATE promoCodes SET featured = 0 WHERE id = 'promo-2026-q4'")
  sqlite
    .prepare(
      `INSERT INTO promoCodes
         (id, code, credits, maxRedemptions, redemptionCount, startsAt, expiresAt, active, featured, createdAt, updatedAt)
       VALUES (?, 'LAUNCH_TEST', 5, NULL, 0, NULL, '2099-01-01T00:00:00.000Z', 1, 1, ?, ?)`,
    )
    .run(PROMO_ID, now, now)
  const plan = sqlite.prepare(
    `INSERT OR REPLACE INTO pricingPlans
       (id, createdAt, updatedAt, kind, label, description, unit, amount, currency, credits, stripePriceId, badge, sortOrder, active)
     VALUES (?, ?, ?, ?, ?, '', ?, ?, 'eur', ?, ?, NULL, 1, 1)`,
  )
  // The GPU tier at one credit a song, as dev prices it.
  plan.run(
    'tier-runpod-gpu',
    now,
    now,
    'tier',
    'Cloud GPU',
    'song',
    null,
    1,
    null,
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

describe('using all five launch credits', () => {
  it('counts from the claim, and unlocks the reward on the fifth', async () => {
    const singer = await confirmedSinger('finisher@example.com')

    expect(await offerOf(singer)).toEqual({
      state: 'counting',
      used: 0,
      goal: 5,
      deadline: '2026-11-03T23:59:59.999Z',
      bonusCredits: 30,
    })

    await separate(singer, 'song-1')
    await separate(singer, 'song-2')
    // A job that failed gives its credit back, and does not count.
    await separate(singer, 'song-failed')
    await refundJob('song-failed')
    expect(await offerOf(singer)).toMatchObject({ state: 'counting', used: 2 })
    expect(unlockOf(singer.userId)).toBeNull()

    at('2026-10-22T18:00:00.000Z')
    await separate(singer, 'song-3')
    await separate(singer, 'song-4')
    await separate(singer, 'song-5')

    expect(await offerOf(singer)).toMatchObject({ state: 'unlocked', used: 5 })
    expect(unlockOf(singer.userId)).toBe('2026-10-22T18:00:00.000Z')
    expect(await balanceOf(singer)).toBe(0)
  })

  it('offers the bonus at checkout only once it is unlocked, and only on a pack', async () => {
    const singer = await confirmedSinger('buyer@example.com')

    const before = await checkout(singer)
    expect(before.has('metadata[offer]')).toBe(false)
    expect(before.get('custom_text[submit][message]')).toBe(
      'Your credits are added as soon as you pay.',
    )

    await useAllFive(singer)
    const after = await checkout(singer)
    expect(after.get('metadata[offer]')).toBe('launch-finisher')
    expect(after.get('metadata[bonusCredits]')).toBe('30')
    // The withdrawal line every pack carries comes first (checkout-consent.ts).
    expect(after.get('custom_text[submit][message]')).toBe(
      'Your credits are added as soon as you pay. Your launch offer adds 30 extra credits to this pack.',
    )
    // The price is the pack's own: nothing is created in Stripe.
    expect(after.get('line_items[0][price]')).toBe('price_starter')
    expect(after.has('discounts[0][coupon]')).toBe(false)

    const donation = await checkout(singer, 'donate-voice')
    expect(donation.has('metadata[offer]')).toBe(false)
  })

  it('adds the bonus beside the pack once, and the mail says so', async () => {
    const singer = await confirmedSinger('bonus@example.com')
    await useAllFive(singer)
    const params = await checkout(singer)

    expect(await deliver(paidEvent('evt_pack', params, 'pi_pack'))).toBe(200)
    expect(await deliver(paidEvent('evt_pack', params, 'pi_pack'))).toBe(200)

    expect(await balanceOf(singer)).toBe(60)
    expect(bonusRows(singer.userId)).toEqual([
      {
        delta: 30,
        jobRef: 'launch-finisher',
        idempotencyKey: `offer:launch-finisher:${singer.userId}`,
        paymentIntentId: 'pi_pack',
      },
    ])
    const mails = purchaseMails()
    expect(mails).toHaveLength(1)
    expect(mails[0]).toContain('+30 credits')
    expect(mails[0]).toContain('Your launch offer added 30 extra credits.')
    expect(mails[0]).toContain('New balance: 60 credits')
    expect(await offerOf(singer)).toMatchObject({ state: 'used' })

    // A second pack, even one whose session still carried the offer, is a
    // pack: the bonus came once.
    await deliver(paidEvent('evt_second', params, 'pi_second'))
    expect(await balanceOf(singer)).toBe(90)
    expect(bonusRows(singer.userId)).toHaveLength(1)
    expect(purchaseMails()[1]).not.toContain('launch offer')
    expect((await checkout(singer)).has('metadata[offer]')).toBe(false)
  })

  it('takes the bonus back with the pack when the pack is refunded', async () => {
    const singer = await confirmedSinger('refund@example.com')
    await useAllFive(singer)
    await deliver(paidEvent('evt_pack', await checkout(singer), 'pi_pack'))
    expect(await balanceOf(singer)).toBe(60)

    const refunded = {
      id: 'ch_pack',
      object: 'charge',
      payment_intent: 'pi_pack',
      amount: 500,
      amount_refunded: 500,
      refunded: true,
      currency: 'eur',
      disputed: false,
    }
    charges.set('ch_pack', refunded)
    await deliver({
      id: 'evt_refund',
      type: 'charge.refunded',
      data: { object: refunded },
    })

    expect(await balanceOf(singer)).toBe(0)
  })

  it('grants a bonus the webhook missed from the sweep, once', async () => {
    const singer = await confirmedSinger('swept@example.com')
    await useAllFive(singer)
    const event = paidEvent('evt_missed', await checkout(singer), 'pi_missed')
    eventPages = [{ data: [event], has_more: false }]

    await reconcileBilling(env)
    await deliver(event)
    eventPages = [{ data: [event], has_more: false }]
    await reconcileBilling(env)

    expect(await balanceOf(singer)).toBe(60)
    expect(bonusRows(singer.userId)).toHaveLength(1)
  })
})

describe('the window', () => {
  it('closes short of five, and checkout adds nothing after it', async () => {
    const singer = await confirmedSinger('lapsed@example.com')
    for (let n = 1; n <= 4; n += 1) await separate(singer, `song-${n}`)

    at('2026-11-03T23:59:59.000Z')
    expect(await offerOf(singer)).toMatchObject({ state: 'counting', used: 4 })

    at('2026-11-04T00:00:00.000Z')
    // A pack bought now, its credits spent: past the window, it does not count.
    await deliver(paidEvent('evt_late', await checkout(singer), 'pi_late'))
    await separate(singer, 'song-late')
    expect(await offerOf(singer)).toMatchObject({ state: 'lapsed', used: 4 })
    expect((await checkout(singer)).has('metadata[offer]')).toBe(false)
  })

  it('keeps an earned reward long after the window, with no end of its own', async () => {
    const singer = await confirmedSinger('patient@example.com')
    await useAllFive(singer)
    expect(await offerOf(singer)).toMatchObject({ state: 'unlocked' })

    at('2026-11-15T10:00:00.000Z')
    expect(await offerOf(singer)).toMatchObject({ state: 'unlocked' })
    expect((await checkout(singer)).get('metadata[offer]')).toBe(
      'launch-finisher',
    )
  })

  it('gives an account that claimed before the offer started its days from the start', async () => {
    at('2026-10-05T09:00:00.000Z')
    const singer = await confirmedSinger('early@example.com')
    // Spent before the offer started: these do not count.
    await separate(singer, 'early-1')
    await separate(singer, 'early-2')

    // Before the first day there is no offer at all.
    expect(await offerOf(singer)).toBeNull()

    at('2026-10-16T09:00:00.000Z')
    expect(await offerOf(singer)).toEqual({
      state: 'counting',
      used: 0,
      goal: 5,
      deadline: '2026-10-29T23:59:59.999Z',
      bonusCredits: 30,
    })
  })
})

describe('who has no offer', () => {
  it('reports none while the offer is off', async () => {
    env.OFFER_START_AT = undefined
    const singer = await confirmedSinger('off@example.com')
    await useAllFive(singer)

    expect(await offerOf(singer)).toBeNull()
    expect((await checkout(singer)).has('metadata[offer]')).toBe(false)
  })

  it('reports none for an account that never claimed the code', async () => {
    sqlite.exec(`UPDATE promoCodes SET featured = 0 WHERE id = '${PROMO_ID}'`)
    const singer = await confirmedSinger('unclaimed@example.com')

    expect(await offerOf(singer)).toBeNull()
  })

  it('reports none for an address that had the bonus on a deleted account', async () => {
    const first = await confirmedSinger('again@example.com')
    await useAllFive(first)
    await deliver(paidEvent('evt_first', await checkout(first), 'pi_first'))
    const deleted = await call('/api/auth/me', {
      method: 'DELETE',
      token: first.token,
    })
    expect(deleted.status).toBe(200)
    expect(unlockOf(first.userId)).toBeNull()

    // As if the claim had been made before claims were recorded by address:
    // the new account can claim the code again, but not earn the bonus.
    sqlite.exec("DELETE FROM promoEmailClaims WHERE kind = 'claim'")
    const second = await confirmedSinger('again@example.com')
    await useAllFive(second)

    expect(await offerOf(second)).toBeNull()
    expect((await checkout(second)).has('metadata[offer]')).toBe(false)
  })
})

describe('the account is erased with its unlock', () => {
  it('lists offerUnlocks among what deleting an account removes', async () => {
    const singer = await confirmedSinger('erased@example.com')
    await useAllFive(singer)
    await offerOf(singer)
    expect(unlockOf(singer.userId)).not.toBeNull()

    await call('/api/auth/me', { method: 'DELETE', token: singer.token })

    expect(unlockOf(singer.userId)).toBeNull()
  })
})
