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
// - A create retried after its response was lost made a second row, and
//   paid the league award twice: the server minted a fresh id each attempt.
// - Settings and challenge progress are one row per key, but nothing said
//   so; a read-then-create race made two, and the account disagreed with
//   itself from then on.
// - `longestStreak` "only ever raises", but was written as an absolute value
//   computed from an earlier read, so a second device could lower it.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, justBefore, SqliteD1Database } from './sqlite-d1'

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

async function register(name: string): Promise<Account> {
  const response = await call('POST', '/api/auth/register', {
    email: `${name}@example.com`,
    password: 'secret123',
    displayName: name,
  })
  expect(response.status).toBe(200)
  return response.body as Account
}

function practice(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    melodyName: 'Scale',
    source: 'exercise',
    startedAt: NOW,
    endedAt: NOW,
    score: 80,
    accuracy: 80,
    notesHit: 8,
    notesTotal: 10,
    streak: 1,
    results: [],
    ...extra,
  }
}

function count(sql: string, ...params: string[]): number {
  return (sqlite.prepare(sql).get(...params) as { n: number }).n
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

describe('a create the client retries', () => {
  it('lands once, and is awarded once', async () => {
    const ada = await register('ada')
    const id = '6f1c2a8e-4b1d-4c7a-9e0f-2d3b4c5d6e7f'

    const first = await call(
      'POST',
      '/api/sessionRecords',
      practice({ id }),
      ada.token,
    )
    expect(first.status).toBe(201)
    expect(first.body.id).toBe(id)

    // The same body again: what the client sends after a lost response.
    const retry = await call(
      'POST',
      '/api/sessionRecords',
      practice({ id }),
      ada.token,
    )
    expect(retry.status).toBe(200)
    expect(retry.body.id).toBe(id)

    expect(
      count(
        'SELECT COUNT(*) AS n FROM sessionRecords WHERE userId = ?',
        ada.userId,
      ),
    ).toBe(1)
    expect(
      count(
        'SELECT COUNT(*) AS n FROM leaguePointEvents WHERE userId = ?',
        ada.userId,
      ),
    ).toBe(1)
  })

  it('cannot take or reveal a row somebody else created under that id', async () => {
    const id = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
    const mine = await call(
      'POST',
      '/api/sessionRecords',
      practice({ id, melodyName: 'Private tune' }),
      singer.token,
    )
    expect(mine.status).toBe(201)

    const stranger = await anonymous('00000000-0000-4000-8000-00000000c002')
    const theirs = await call(
      'POST',
      '/api/sessionRecords',
      practice({ id }),
      stranger.token,
    )
    expect(theirs.status).toBe(409)
    expect(JSON.stringify(theirs.body)).not.toContain('Private tune')
    expect(
      count(
        'SELECT COUNT(*) AS n FROM sessionRecords WHERE userId = ?',
        stranger.userId,
      ),
    ).toBe(0)
  })

  it('still mints the id when the client names none', async () => {
    const created = await call(
      'POST',
      '/api/sessionRecords',
      practice(),
      singer.token,
    )
    expect(created.status).toBe(201)
    expect(created.body.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('a row with a natural key', () => {
  it('keeps one setting per key, holding the latest value', async () => {
    const first = await call(
      'POST',
      '/api/userSettings',
      { key: 'pitchperfect_theme', value: '"dark"' },
      singer.token,
    )
    expect(first.status).toBe(201)
    // A second device that also read "no row yet".
    const second = await call(
      'POST',
      '/api/userSettings',
      { key: 'pitchperfect_theme', value: '"light"' },
      singer.token,
    )
    expect(second.status).toBe(200)
    expect(second.body.id).toBe(first.body.id)
    expect(
      sqlite
        .prepare('SELECT value FROM userSettings WHERE userId = ?')
        .all(singer.userId),
    ).toEqual([{ value: '"light"' }])
  })

  it('keeps one progress row per challenge', async () => {
    const progress = {
      challengeId: 'c1',
      progress: 100,
      currentScore: 95,
      bestScore: 95,
      status: 'completed',
      completed: true,
      completedAt: NOW,
      attempts: 3,
    }
    expect(
      (await call('POST', '/api/challengeProgress', progress, singer.token))
        .status,
    ).toBe(201)
    expect(
      (await call('POST', '/api/challengeProgress', progress, singer.token))
        .status,
    ).toBe(200)
    expect(
      count(
        'SELECT COUNT(*) AS n FROM challengeProgress WHERE userId = ?',
        singer.userId,
      ),
    ).toBe(1)
  })

  it('updates a song the library already lists instead of refusing it', async () => {
    const song = { fileHash: 'abc123', title: 'Old title', quality: 'lossless' }
    expect(
      (await call('POST', '/api/songManifests', song, singer.token)).status,
    ).toBe(201)
    // What a publish does when its read missed the row: create it again.
    const again = await call(
      'POST',
      '/api/songManifests',
      { ...song, title: 'New title' },
      singer.token,
    )
    expect(again.status).toBe(200)
    expect(again.body.title).toBe('New title')
  })

  it('is per user: two singers keep their own row for one key', async () => {
    const other = await anonymous('00000000-0000-4000-8000-00000000c003')
    for (const account of [singer, other]) {
      const response = await call(
        'POST',
        '/api/userSettings',
        { key: 'pitchperfect_theme', value: `"${account.userId}"` },
        account.token,
      )
      expect(response.status).toBe(201)
    }
    expect(
      count(
        'SELECT COUNT(*) AS n FROM userSettings WHERE "key" = \'pitchperfect_theme\'',
      ),
    ).toBe(2)
  })
})

describe('the longest streak', () => {
  it('is not lowered by a write that read the profile before a higher one landed', async () => {
    const path = `/api/userProfiles/${singer.userId}`
    expect(
      (await call('PATCH', path, { currentStreak: 5 }, singer.token)).status,
    ).toBe(200)

    // Device A reaches 10 between device B's read and B's write of 6.
    justBefore(d1, /UPDATE "userProfiles"/, () =>
      call('PATCH', path, { currentStreak: 10 }, singer.token),
    )
    expect(
      (await call('PATCH', path, { currentStreak: 6 }, singer.token)).status,
    ).toBe(200)

    expect(
      sqlite
        .prepare('SELECT longestStreak FROM userProfiles WHERE id = ?')
        .get(singer.userId),
    ).toEqual({ longestStreak: 10 })
  })
})
