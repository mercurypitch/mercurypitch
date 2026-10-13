// @vitest-environment node
//
// ── The generic CRUD contract that v1.0 freezes ──────────────────────
//
// Promises the API made and did not keep, each one silent:
//
// - A list without a limit stopped at 100 rows in no defined order. The
//   client's sync code reads "all my rows" that way, so a library past 100
//   songs re-created one it already had (the UNIQUE index refused, and the
//   whole publish stopped) and settings past row 100 never arrived.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const NOW = '2026-10-13T12:00:00.000Z'

let sqlite: DatabaseSync
let d1: SqliteD1Database
let env: Env

interface Account {
  userId: string
  token: string
}

async function call(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token !== undefined) headers.Authorization = `Bearer ${token}`
  const response = await worker.fetch(
    new Request(`https://api.test${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    {} as ExecutionContext,
  )
  const text = await response.text()
  return {
    status: response.status,
    body: text === '' ? null : JSON.parse(text),
  }
}

async function anonymous(deviceId: string): Promise<Account> {
  const response = await call('POST', '/api/auth/anonymous', {
    deviceId,
    deviceSecret: `device-secret-${deviceId.replace(/-/g, '')}`,
  })
  expect(response.status).toBe(200)
  return response.body as Account
}

let singer: Account

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  d1 = new SqliteD1Database(sqlite)
  env = {
    DB: d1 as unknown as D1Database,
    JWT_SECRET: 'api-contract-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
  }
  singer = await anonymous('00000000-0000-4000-8000-00000000c001')
})

afterEach(() => {
  sqlite.close()
})

describe('a list read', () => {
  function seedManifests(userId: string, n: number): void {
    const insert = sqlite.prepare(
      `INSERT INTO songManifests (id, createdAt, updatedAt, userId, fileHash, title)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (let i = 0; i < n; i++) {
      const hash = `hash-${String(i).padStart(4, '0')}`
      insert.run(`m-${hash}`, NOW, NOW, userId, hash, `Song ${i}`)
    }
  }

  it('gives a caller all of their own rows without a limit, up to the ceiling', async () => {
    seedManifests(singer.userId, 150)
    const response = await call(
      'GET',
      '/api/songManifests',
      undefined,
      singer.token,
    )
    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(150)
  })

  it('still answers one page of a public table without a limit', async () => {
    const insert = sqlite.prepare(
      `INSERT INTO featureFlags (id, createdAt, updatedAt, "key", value)
       VALUES (?, ?, ?, ?, 1)`,
    )
    for (let i = 0; i < 150; i++) insert.run(`flag-${i}`, NOW, NOW, `flag-${i}`)
    const response = await call('GET', '/api/featureFlags')
    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(100)
  })

  it('pages through rows that tie on the sort column without a repeat or a gap', async () => {
    // Every row has the same createdAt, so the sort column alone does not
    // order them: without a tiebreak a row can sit on two pages, or none.
    seedManifests(singer.userId, 95)
    const seen: string[] = []
    for (let offset = 0; offset < 95; offset += 10) {
      const page = await call(
        'GET',
        `/api/songManifests?orderBy=createdAt&limit=10&offset=${offset}`,
        undefined,
        singer.token,
      )
      seen.push(...(page.body as Array<{ id: string }>).map((r) => r.id))
    }
    expect(seen).toHaveLength(95)
    expect(new Set(seen).size).toBe(95)
  })
})
