// @vitest-environment node
//
// ── GET /api/promoCodes must not hand out the codes ──────────────────
//
// promoCodes is an 'admin' table: public reads, writes behind the X-Admin-Key.
// The public read served the `code` column, so every campaign in the table was
// one unauthenticated GET away. A code is the whole credential:
// POST /api/billing/promo/redeem asks a verified account for nothing else.
// PRODUCT_HUNT is advertised anyway. A partner or support code added later
// would not be.
//
// Masking the column is half of it. A filter is also a read: whether
// `?where[code]=<guess>` brings a row back says whether the guess exists. So a
// non-admin may neither filter nor sort on `code`, and nothing in the app
// looks a campaign up by its code. Real SQL, so a refusal is shown to be a
// refusal, not an empty result from a stubbed database.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const ADMIN_KEY = 'promo-read-test-admin'
/** A code nobody advertises: the case the mask exists for. */
const PRIVATE_CODE = 'PARTNER_QX7M2'
/** Seeded by migration 0045 under this id. */
const LAUNCH_ID = 'promo-ph-2026'

let sqlite: DatabaseSync
let env: Env

type Row = Record<string, unknown>

function get(
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, { headers }),
    env,
    {} as ExecutionContext,
  )
}

async function readRows(
  path: string,
  headers?: Record<string, string>,
): Promise<Row[]> {
  const response = await get(path, headers)
  expect(response.status).toBe(200)
  return (await response.json()) as Row[]
}

const byId = (rows: Row[], id: string): Row | undefined =>
  rows.find((row) => row.id === id)

/** Headers for a new account with a verified email: all redeeming asks for. */
async function verifiedAccount(): Promise<Record<string, string>> {
  const registered = await worker.fetch(
    new Request('https://api.test/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'browser@example.com',
        password: 'secret123',
        displayName: 'Browser',
      }),
    }),
    env,
    {} as ExecutionContext,
  )
  expect(registered.status).toBe(200)
  const { token, userId } = (await registered.json()) as {
    token: string
    userId: string
  }
  sqlite.prepare('UPDATE users SET emailVerified = 1 WHERE id = ?').run(userId)
  return { Authorization: `Bearer ${token}` }
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  applyMigrations(sqlite)
  sqlite
    .prepare(
      `INSERT INTO promoCodes
         (id, code, credits, maxRedemptions, redemptionCount, startsAt,
          expiresAt, active, createdAt, updatedAt)
       VALUES ('promo-partner', ?, 20, 50, 3, '2026-10-01T00:00:00.000Z',
               '2026-12-31T23:59:59.000Z', 1, '2026-09-28T00:00:00.000Z',
               '2026-09-28T00:00:00.000Z')`,
    )
    .run(PRIVATE_CODE)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'promo-read-integration-secret',
    // Registration passes the Turnstile gate only for a local origin with no
    // TURNSTILE_SECRET, which is what a developer running the worker has.
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
  } as unknown as Env
})

afterEach(() => {
  sqlite.close()
})

describe('GET /api/promoCodes — what a non-admin reads', () => {
  it('lists every campaign to an anonymous caller without its code', async () => {
    const rows = await readRows('/api/promoCodes')
    expect(rows.map((row) => row.id).sort()).toEqual([
      'promo-partner',
      LAUNCH_ID,
    ])
    for (const row of rows) expect(row).not.toHaveProperty('code')
  })

  it('never puts a code anywhere in the serialized body', async () => {
    // A substring check catches a leak through some other field, which a
    // property assertion on the top level would walk straight past.
    const body = await (await get('/api/promoCodes')).text()
    expect(body).not.toContain(PRIVATE_CODE)
    expect(body).not.toContain('PRODUCT_HUNT')
    expect(body).not.toContain('"code"')
  })

  it('withholds the code from a single-row read too', async () => {
    const response = await get('/api/promoCodes/promo-partner')
    expect(response.status).toBe(200)
    const row = (await response.json()) as Row
    expect(row.id).toBe('promo-partner')
    expect(row.credits).toBe(20)
    expect(row).not.toHaveProperty('code')
  })

  it('withholds it from a verified account, which is all redeeming needs', async () => {
    const headers = await verifiedAccount()
    const listed = await get('/api/promoCodes', headers)
    expect(listed.status).toBe(200)
    expect(await listed.text()).not.toContain(PRIVATE_CODE)
    const single = await get('/api/promoCodes/promo-partner', headers)
    expect(single.status).toBe(200)
    expect(await single.json()).not.toHaveProperty('code')
  })

  it('still gives the admin studio whole rows, list and single', async () => {
    const admin = { 'X-Admin-Key': ADMIN_KEY }
    const rows = await readRows('/api/promoCodes', admin)
    expect(byId(rows, 'promo-partner')?.code).toBe(PRIVATE_CODE)
    expect(byId(rows, LAUNCH_ID)?.code).toBe('PRODUCT_HUNT')

    const single = await get('/api/promoCodes/promo-partner', admin)
    expect(single.status).toBe(200)
    expect(((await single.json()) as Row).code).toBe(PRIVATE_CODE)
  })
})

describe('GET /api/promoCodes — filtering or sorting on the code', () => {
  it('refuses ?where[code]= for an anonymous caller', async () => {
    const response = await get('/api/promoCodes?where[code]=PRODUCT_HUNT')
    expect(response.status).toBe(400)
    // The refusal must not echo the guess back, or it answers the question
    // it was meant to refuse.
    expect(await response.text()).not.toContain('PRODUCT_HUNT')
  })

  it('refuses it for a verified account too', async () => {
    const response = await get(
      '/api/promoCodes?where[code]=PRODUCT_HUNT',
      await verifiedAccount(),
    )
    expect(response.status).toBe(400)
  })

  it('still lets the admin studio filter by code', async () => {
    const rows = await readRows('/api/promoCodes?where[code]=PRODUCT_HUNT', {
      'X-Admin-Key': ADMIN_KEY,
    })
    expect(rows.map((row) => row.id)).toEqual([LAUNCH_ID])
    expect(rows[0]!.code).toBe('PRODUCT_HUNT')
  })

  it('refuses to sort by code, which would rank the hidden values', async () => {
    // A sort ranks every code against one you already know, without a guess.
    const response = await get('/api/promoCodes?orderBy=code')
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain(PRIVATE_CODE)
  })
})
