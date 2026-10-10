// @vitest-environment node
//
// ── The month's free song, once per confirmed email address ──
//
// The native app gives a signed-in singer without the subscription one free
// song a UTC month (app-songs.ts). Its claim is a ledger row, and deleting an
// account deletes its ledger rows (USER_OWNED_TABLES in auth.ts). So a claim
// also records the confirmed address for its month (freeSongEmailClaims,
// migration 0053): a keyed code that names neither the address nor the
// account, which deleting an account leaves alone. An account whose address
// had the month's song on another account gets none that month.
// FREE_SONG_EMAIL_SECRET keys the code; unset, the Worker does what it did
// before, and says so once in the log.
//
// Real SQLite with every migration applied, through the worker's own fetch
// and its cron.

import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { SQLInputValue } from 'node:sqlite'
import { DatabaseSync } from 'node:sqlite'
import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, interleaved, SqliteD1Database } from './sqlite-d1'

const SECRET = 'free-song-email-integration-key-0123456789'
const SERVICE_KEY = 'free-song-email-service-key'
const IOS = 'capacitor://localhost'
const PASSWORD = 'Singer123!pass'
const EMAIL = 'singer@example.com'
const OCTOBER = Date.parse('2026-10-05T12:00:00.000Z')
const NOVEMBER = Date.parse('2026-11-02T12:00:00.000Z')

let sqlite: DatabaseSync
let perksSqlite: DatabaseSync
let env: Env
/** The worker the calls reach. One test swaps in a copy imported afresh, as
 *  a new isolate loads it. */
let api = worker
let warn: MockInstance<typeof console.warn>

interface Call {
  method?: string
  token?: string
  origin?: string
  body?: unknown
  headers?: Record<string, string>
}

function call(path: string, init: Call = {}): Promise<Response> {
  const headers: Record<string, string> = { ...init.headers }
  if (init.token !== undefined) headers.Authorization = `Bearer ${init.token}`
  if (init.origin !== undefined) headers.Origin = init.origin
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  return api.fetch(
    new Request(`https://api.test${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    }),
    env,
    {} as ExecutionContext,
  )
}

interface Singer {
  userId: string
  token: string
}

/** A new account for `email`, its email not confirmed yet. */
async function register(email: string): Promise<Singer> {
  const response = await call('/api/auth/register', {
    body: { email, password: PASSWORD },
  })
  expect(response.status).toBe(200)
  const { userId, token } = (await response.json()) as Singer
  return { userId, token }
}

/** What opening the confirm link does to the account (auth.ts). */
function confirm(singer: Singer): void {
  sqlite
    .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
    .run(singer.userId)
}

async function signUp(email: string): Promise<Singer> {
  const singer = await register(email)
  confirm(singer)
  return singer
}

async function deleteAccount(singer: Singer): Promise<void> {
  const response = await call('/api/auth/me', {
    method: 'DELETE',
    token: singer.token,
  })
  expect(response.status).toBe(200)
}

/** The songs the app sees. */
async function appSongs(singer: Singer): Promise<Record<string, unknown>> {
  const response = await call('/api/billing/me', {
    token: singer.token,
    origin: IOS,
  })
  expect(response.status).toBe(200)
  return ((await response.json()) as { songs: Record<string, unknown> }).songs
}

function debit(singer: Singer, jobRef: string): Promise<Response> {
  return call('/api/billing/debit', {
    token: singer.token,
    origin: IOS,
    body: { tier: 'gpu', model: 'roformer', jobRef },
  })
}

async function refund(jobRef: string): Promise<void> {
  const response = await call('/api/billing/refund', {
    body: { jobRef },
    headers: { 'X-Service-Key': SERVICE_KEY },
  })
  expect(response.status).toBe(200)
}

async function runTheCron(): Promise<void> {
  await api.scheduled({} as ScheduledController, env, {} as ExecutionContext)
}

/** The jobs the account's free-song claims paid for, in order. */
function claimsOf(singer: Singer): string[] {
  return (
    sqlite
      .prepare(
        "SELECT jobRef FROM creditLedger WHERE userId = ? AND reason = 'free-song' ORDER BY rowid",
      )
      .all(singer.userId) as Array<{ jobRef: string }>
  ).map((row) => row.jobRef)
}

/** The addresses' records, as stored. */
function records(): Array<Record<string, SQLInputValue>> {
  return sqlite
    .prepare('SELECT * FROM freeSongEmailClaims ORDER BY month, emailHash')
    .all()
}

/** The GPU tier at one credit a song, as dev prices it. */
function priceTheGpu(): void {
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT OR REPLACE INTO pricingPlans
         (id, createdAt, updatedAt, kind, label, description, unit, amount, currency, credits, stripePriceId, badge, sortOrder, active)
       VALUES ('tier-runpod-gpu', ?, ?, 'tier', 'Cloud GPU', '', 'song', NULL, 'eur', 1, NULL, NULL, 2, 1)`,
    )
    .run(now, now)
}

/** Another write lands between the next read and the write after it. */
function raceTheNextWrite(write: () => void): void {
  const db = env.DB as unknown as SqliteD1Database
  const batch = db.batch.bind(db)
  let raced = false
  db.batch = async (statements) => {
    if (!raced) {
      raced = true
      write()
    }
    return batch(statements)
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCTOBER)
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  // Deleting an account with a confirmed email purges its shared perk
  // grants first, so the shared perks database has to be there.
  perksSqlite = new DatabaseSync(':memory:')
  perksSqlite.exec(
    readFileSync(
      new URL('../migrations-perks/0001_perkGrants.sql', import.meta.url),
      'utf8',
    ),
  )
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    PERKS_DB: new SqliteD1Database(perksSqlite) as unknown as D1Database,
    JWT_SECRET: 'free-song-email-integration-jwt',
    // A local development origin, which registering without Turnstile
    // needs, and the app's own.
    ALLOWED_ORIGINS: `http://localhost,${IOS}`,
    BILLING_SERVICE_KEY: SERVICE_KEY,
    FREE_SONG_EMAIL_SECRET: SECRET,
  }
  api = worker
  priceTheGpu()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  sqlite.close()
  perksSqlite.close()
})

describe('the month’s free song of a deleted account', () => {
  it('is not had again by a new account for its email, however it is typed', async () => {
    const first = await signUp(EMAIL)
    expect((await debit(first, 'rp_gpu_first')).status).toBe(200)
    await deleteAccount(first)

    const again = await register('  Singer@EXAMPLE.com ')
    expect(await appSongs(again)).toMatchObject({ left: 0, free: 0 })
    confirm(again)

    expect(await appSongs(again)).toMatchObject({ left: 0, free: 0 })
    expect((await debit(again, 'rp_gpu_again')).status).toBe(402)
    expect(claimsOf(again)).toEqual([])
  })

  it('is there again the next month', async () => {
    const first = await signUp(EMAIL)
    await debit(first, 'rp_gpu_october')
    await deleteAccount(first)
    const again = await signUp(EMAIL)
    expect(await appSongs(again)).toMatchObject({ free: 0 })

    vi.setSystemTime(NOVEMBER)

    expect(await appSongs(again)).toMatchObject({ left: 1, free: 1 })
    expect((await debit(again, 'rp_gpu_november')).status).toBe(200)
    expect(claimsOf(again)).toEqual(['rp_gpu_november'])
  })

  it('leaves the free song of a different email alone', async () => {
    const first = await signUp(EMAIL)
    await debit(first, 'rp_gpu_first')
    await deleteAccount(first)

    const other = await signUp('another.singer@example.com')

    expect(await appSongs(other)).toMatchObject({ left: 1, free: 1 })
    expect((await debit(other, 'rp_gpu_other')).status).toBe(200)
    expect(claimsOf(other)).toEqual(['rp_gpu_other'])
  })

  it('is not taken by a claim that read the address before its record landed', async () => {
    const first = await signUp(EMAIL)
    await debit(first, 'rp_gpu_first')
    await deleteAccount(first)
    const again = await signUp(EMAIL)
    const [record] = records()
    sqlite.prepare('DELETE FROM freeSongEmailClaims').run()
    // The record comes back between the debit's read and its write, as
    // another account's claim on the address would.
    raceTheNextWrite(() => {
      sqlite
        .prepare(
          'INSERT INTO freeSongEmailClaims (month, emailHash) VALUES (?, ?)',
        )
        .run(record.month, record.emailHash)
    })

    const response = await debit(again, 'rp_gpu_raced')

    expect(response.status).toBe(402)
    expect(claimsOf(again)).toEqual([])
  })
})

describe('the account’s own free song', () => {
  it('still comes back when the separation it paid for failed', async () => {
    const singer = await signUp(EMAIL)
    await debit(singer, 'rp_gpu_failed')
    await refund('rp_gpu_failed')

    expect(await appSongs(singer)).toMatchObject({ left: 1, free: 1 })
    expect((await debit(singer, 'rp_gpu_again')).status).toBe(200)
    expect(claimsOf(singer)).toEqual(['rp_gpu_failed', 'rp_gpu_again'])
    expect(records()).toHaveLength(1)
  })

  it('is still one a month', async () => {
    const singer = await signUp(EMAIL)
    const first = await debit(singer, 'rp_gpu_one')
    expect(await first.json()).toMatchObject({ freeSong: true })

    const second = await debit(singer, 'rp_gpu_two')

    expect(second.status).toBe(402)
    expect(claimsOf(singer)).toEqual(['rp_gpu_one'])
  })

  it('is still paid for once by a retried debit', async () => {
    const singer = await signUp(EMAIL)
    expect((await debit(singer, 'rp_gpu_one')).status).toBe(200)

    const retried = await debit(singer, 'rp_gpu_one')

    expect(retried.status).toBe(200)
    expect(await retried.json()).toMatchObject({ debited: 1, duplicate: true })
    expect(claimsOf(singer)).toEqual(['rp_gpu_one'])
    expect(records()).toHaveLength(1)
  })

  it('is taken, and recorded, once when two separations race for it', async () => {
    const singer = await signUp(EMAIL)
    env = { ...env, DB: interleaved(new SqliteD1Database(sqlite)) }

    const statuses = (
      await Promise.all([
        debit(singer, 'rp_gpu_race-a'),
        debit(singer, 'rp_gpu_race-b'),
      ])
    ).map((response) => response.status)

    expect(statuses.sort()).toEqual([200, 402])
    expect(claimsOf(singer)).toHaveLength(1)
    expect(records()).toHaveLength(1)
  })
})

describe('the record of an address’s free song', () => {
  it('names neither the address nor the account, and is keyed', async () => {
    const singer = await signUp(EMAIL)
    await debit(singer, 'rp_gpu_record')

    const columns = sqlite
      .prepare("SELECT name FROM pragma_table_info('freeSongEmailClaims')")
      .all()
      .map((column) => column.name)
    const [record] = records()
    const stored = JSON.stringify(records())

    expect(columns).toEqual(['month', 'emailHash'])
    expect(record.month).toBe('2026-10')
    expect(stored).not.toContain('singer')
    expect(stored).not.toContain(singer.userId)
    // Not a plain digest of the address, which anyone can take of a guess.
    for (const encoding of ['hex', 'base64url'] as const) {
      expect(record.emailHash).not.toBe(
        createHash('sha256').update(EMAIL).digest(encoding),
      )
    }
  })

  it('keeps the form its stored records were written in', async () => {
    const singer = await signUp(EMAIL)
    await debit(singer, 'rp_gpu_form')

    // HMAC-SHA256 keyed with the secret, of the month and the address, in
    // hex. Another form finds none of the month's records, as rotating the
    // secret does, and every address has the month's song again.
    expect(records()).toEqual([
      {
        month: '2026-10',
        emailHash: createHmac('sha256', SECRET)
          .update(`free-song:2026-10:${EMAIL}`)
          .digest('hex'),
      },
    ])
  })

  it('is not written by a claim whose debit did not land', async () => {
    const singer = await signUp(EMAIL)
    // A web purchase lands between the claim's read and its write, so the
    // debit is not written and is read again. A record written anyway would
    // read as another account's claim on the address, and the retry would
    // find no free song left.
    raceTheNextWrite(() => {
      sqlite
        .prepare(
          `INSERT INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
           VALUES ('raced-purchase', ?, ?, 10, 'purchase', 'cs_raced', 'raced-purchase')`,
        )
        .run(new Date().toISOString(), singer.userId)
    })

    const response = await debit(singer, 'rp_gpu_retried')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ freeSong: true })
    expect(claimsOf(singer)).toEqual(['rp_gpu_retried'])
    expect(records()).toHaveLength(1)
  })

  it('outlives the account it was claimed on', async () => {
    const singer = await signUp(EMAIL)
    await debit(singer, 'rp_gpu_kept')
    const before = records()

    await deleteAccount(singer)

    expect(claimsOf(singer)).toEqual([])
    expect(before).toHaveLength(1)
    expect(records()).toEqual(before)
  })

  it('is kept through its month, and swept after it', async () => {
    const singer = await signUp(EMAIL)
    await debit(singer, 'rp_gpu_october')

    vi.setSystemTime(Date.parse('2026-10-31T23:00:00.000Z'))
    await runTheCron()
    expect(records()).toHaveLength(1)

    vi.setSystemTime(NOVEMBER)
    await runTheCron()
    expect(records()).toEqual([])
  })

  it('is swept even when the billing check before it fails', async () => {
    const singer = await signUp(EMAIL)
    await debit(singer, 'rp_gpu_october')
    // Stripe configured, and out of reach: the billing sweep cannot list
    // its events, and says so.
    env = { ...env, STRIPE_SECRET_KEY: 'sk_test_unreachable' }
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('fetch failed'),
    )
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    vi.setSystemTime(NOVEMBER)
    await runTheCron()

    expect(records()).toEqual([])
    expect(error).toHaveBeenCalledWith(
      '[billing] sweep: incomplete, Stripe could not be reached for the events list (TypeError: fetch failed)',
    )
  })
})

describe('without FREE_SONG_EMAIL_SECRET', () => {
  it('goes by the account alone, as before, and says so once', async () => {
    env = { ...env, FREE_SONG_EMAIL_SECRET: undefined }
    // The warning is once per isolate: a copy of the worker imported afresh
    // starts where a new isolate does, whatever ran before this test.
    vi.resetModules()
    api = (await import('../src/index')).default
    const first = await signUp(EMAIL)
    expect((await debit(first, 'rp_gpu_first')).status).toBe(200)
    await deleteAccount(first)

    const again = await signUp(EMAIL)

    expect(await appSongs(again)).toMatchObject({ left: 1, free: 1 })
    expect((await debit(again, 'rp_gpu_again')).status).toBe(200)
    expect(records()).toEqual([])
    const unkeyed = warn.mock.calls.filter(([message]) =>
      String(message).includes('FREE_SONG_EMAIL_SECRET'),
    )
    expect(unkeyed).toHaveLength(1)
  })
})

describe('the off switch', () => {
  it('still turns the free song off, and records nothing', async () => {
    env = { ...env, FREE_MONTHLY_SONG: 'off' }
    const singer = await signUp(EMAIL)

    expect(await appSongs(singer)).toMatchObject({ left: 0, free: 0 })
    expect((await debit(singer, 'rp_gpu_off')).status).toBe(402)
    expect(claimsOf(singer)).toEqual([])
    expect(records()).toEqual([])
  })
})
