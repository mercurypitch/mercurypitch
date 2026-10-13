// @vitest-environment node
//
// ── A column is named exactly, or not at all ─────────────────────────
//
// SQLite resolves identifiers without regard to case: `"UserId"` in an INSERT
// writes `userId`, and `where[Code]` filters on `code`. Every per-column rule
// in the generic CRUD handlers matched the exact spelling instead — the
// `delete body.userId` that makes ownership immutable, the `serverCols` strip,
// `validateWrite`, the streak high-water clamp and the private-column guard on
// reads — so a key that differed only in case walked past all of them.
//
// What that bought, from any signed-in caller including an anonymous one:
// rows written into another user's account, scores the validator exists to
// refuse, a self-chosen league rung and friend code, a streak below zero, and
// an unauthenticated yes/no on any promo code (the query oracle BUGS.md lists
// as fixed). Each case below is one of those, against real SQL.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const NOW = '2026-10-13T12:00:00.000Z'
const ADMIN_KEY = 'column-names-test-admin'

let sqlite: DatabaseSync
let env: Env

interface Account {
  userId: string
  token: string
}

function call(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  raw?: string,
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (body !== undefined || raw !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token !== undefined) headers.Authorization = `Bearer ${token}`
  return worker.fetch(
    new Request(`https://api.test${path}`, {
      method,
      headers,
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    }),
    env,
    {} as ExecutionContext,
  )
}

async function anonymous(deviceId: string): Promise<Account> {
  const response = await call('POST', '/api/auth/anonymous', {
    deviceId,
    deviceSecret: `device-secret-${deviceId.replace(/-/g, '')}`,
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Account
}

function practice(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    melodyName: 'Scale',
    startedAt: NOW,
    endedAt: NOW,
    score: 50,
    accuracy: 50,
    notesHit: 5,
    notesTotal: 10,
    streak: 1,
    results: [],
    ...extra,
  }
}

function rowsOwnedBy(userId: string): unknown[] {
  return sqlite
    .prepare('SELECT id FROM sessionRecords WHERE userId = ?')
    .all(userId)
}

let attacker: Account
let victim: Account

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'column-names-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
  }
  attacker = await anonymous('00000000-0000-4000-8000-00000000a001')
  victim = await anonymous('00000000-0000-4000-8000-00000000a002')
})

afterEach(() => {
  sqlite.close()
})

describe('a write that names a column in another case', () => {
  it('cannot create a row in somebody else’s account', async () => {
    const response = await call(
      'POST',
      '/api/sessionRecords',
      practice({ USERID: victim.userId }),
      attacker.token,
    )
    expect(response.status).toBe(400)
    expect(rowsOwnedBy(victim.userId)).toEqual([])
  })

  it('cannot move the caller’s own row into somebody else’s account', async () => {
    const created = await call(
      'POST',
      '/api/sessionRecords',
      practice(),
      attacker.token,
    )
    expect(created.status).toBe(201)
    const { id } = (await created.json()) as { id: string }

    const moved = await call(
      'PATCH',
      `/api/sessionRecords/${id}`,
      { UserId: victim.userId },
      attacker.token,
    )
    expect(moved.status).toBe(400)
    expect(rowsOwnedBy(victim.userId)).toEqual([])
    expect(rowsOwnedBy(attacker.userId)).toHaveLength(1)
  })

  it('cannot carry a score the validator refuses', async () => {
    const forged = await call(
      'POST',
      '/api/sessionRecords',
      practice({ Score: 5000 }),
      attacker.token,
    )
    expect(forged.status).toBe(400)
    expect(
      sqlite.prepare('SELECT COUNT(*) AS n FROM sessionRecords').get(),
    ).toEqual({ n: 0 })
  })

  it('cannot set a server-owned or bounded profile column', async () => {
    const response = await call(
      'PATCH',
      `/api/userProfiles/${attacker.userId}`,
      {
        CurrentLeagueId: 'l7',
        FriendCode: 'VANITY01',
        CurrentStreak: 999999,
        LONGESTSTREAK: -3,
      },
      attacker.token,
    )
    expect(response.status).toBe(400)
    expect(
      sqlite
        .prepare(
          `SELECT currentLeagueId, friendCode, currentStreak, longestStreak
             FROM userProfiles WHERE id = ?`,
        )
        .get(attacker.userId),
    ).toEqual({
      currentLeagueId: 'l1',
      friendCode: null,
      currentStreak: 0,
      longestStreak: 0,
    })
  })

  it('still accepts every column spelled the way the schema spells it', async () => {
    const created = await call(
      'POST',
      '/api/sessionRecords',
      practice({ source: 'exercise', durationMs: 60000 }),
      attacker.token,
    )
    expect(created.status).toBe(201)
    const { id } = (await created.json()) as { id: string }
    const patched = await call(
      'PATCH',
      `/api/sessionRecords/${id}`,
      { melodyName: 'Renamed', score: 60 },
      attacker.token,
    )
    expect(patched.status).toBe(200)
    expect(await patched.json()).toMatchObject({
      melodyName: 'Renamed',
      score: 60,
      userId: attacker.userId,
    })
  })

  it('answers a body that is not an object with 400, not 500', async () => {
    for (const raw of ['null', '"text"', '5', '[]']) {
      const response = await call(
        'POST',
        '/api/userSettings',
        undefined,
        attacker.token,
        raw,
      )
      expect(response.status).toBe(400)
    }
  })

  it.each(['userid', 'UserId', 'userID', 'USERID'])(
    'rejects %s alone and beside the canonical ownership column',
    async (column) => {
      const created = await call(
        'POST',
        '/api/sessionRecords',
        practice(),
        attacker.token,
      )
      expect(created.status).toBe(201)
      const { id } = (await created.json()) as { id: string }
      for (const body of [
        { [column]: victim.userId },
        { userId: attacker.userId, [column]: victim.userId },
      ]) {
        expect(
          (
            await call(
              'POST',
              '/api/sessionRecords',
              practice(body),
              attacker.token,
            )
          ).status,
        ).toBe(400)
        expect(
          (
            await call(
              'PATCH',
              `/api/sessionRecords/${id}`,
              body,
              attacker.token,
            )
          ).status,
        ).toBe(400)
      }
      expect(rowsOwnedBy(victim.userId)).toEqual([])
      expect(rowsOwnedBy(attacker.userId)).toHaveLength(1)
    },
  )

  it.each(['CurrentLeagueId', 'FRIENDCODE', 'currentstreak', 'longestStreakX'])(
    'rejects the individual invalid profile column %s',
    async (column) => {
      const response = await call(
        'PATCH',
        `/api/userProfiles/${attacker.userId}`,
        { [column]: 999 },
        attacker.token,
      )
      expect(response.status).toBe(400)
      expect(
        sqlite
          .prepare(
            'SELECT currentLeagueId, friendCode, currentStreak, longestStreak FROM userProfiles WHERE id = ?',
          )
          .get(attacker.userId),
      ).toEqual({
        currentLeagueId: 'l1',
        friendCode: null,
        currentStreak: 0,
        longestStreak: 0,
      })
    },
  )

  it('rejects non-object PATCH bodies without changing the profile', async () => {
    for (const raw of ['null', '[]', 'false', '5', '"text"']) {
      expect(
        (
          await call(
            'PATCH',
            `/api/userProfiles/${attacker.userId}`,
            undefined,
            attacker.token,
            raw,
          )
        ).status,
      ).toBe(400)
    }
    expect(
      sqlite
        .prepare('SELECT longestStreak FROM userProfiles WHERE id = ?')
        .get(attacker.userId),
    ).toEqual({ longestStreak: 0 })
  })

  it('refreshes a warmed schema cache after an additive migration', async () => {
    const created = await call(
      'POST',
      '/api/sessionRecords',
      practice(),
      attacker.token,
    )
    expect(created.status).toBe(201)
    const { id } = (await created.json()) as { id: string }
    sqlite.exec('ALTER TABLE sessionRecords ADD COLUMN boundaryProbe TEXT')
    const updated = await call(
      'PATCH',
      `/api/sessionRecords/${id}`,
      { boundaryProbe: 'migrated' },
      attacker.token,
    )
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      id,
      boundaryProbe: 'migrated',
    })
    const read = await call(
      'GET',
      '/api/sessionRecords?where[boundaryProbe]=migrated',
      undefined,
      attacker.token,
    )
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject([{ id, boundaryProbe: 'migrated' }])
  })
})

describe('a read that names a column in another case', () => {
  beforeEach(() => {
    sqlite
      .prepare(
        `INSERT INTO promoCodes (id, createdAt, updatedAt, code, credits,
           maxRedemptions, redemptionCount, active)
         VALUES ('promo-secret', ?, ?, 'SECRETVIP2026', 5, 100, 0, 1)`,
      )
      .run(NOW, NOW)
  })

  it('does not confirm a promo-code guess through a filter', async () => {
    for (const path of [
      '/api/promoCodes?where[Code]=SECRETVIP2026',
      '/api/promoCodes?where[Code]=WRONG',
      '/api/promoCodes/count?where[CODE]=SECRETVIP2026',
    ]) {
      const response = await call('GET', path)
      expect(response.status).toBe(400)
      expect(await response.text()).not.toContain('promo-secret')
    }
  })

  it('does not sort by the hidden code either', async () => {
    const response = await call('GET', '/api/promoCodes?orderBy=CODE')
    expect(response.status).toBe(400)
  })

  it('answers a filter on a column that does not exist with 400, not 500', async () => {
    const response = await call('GET', '/api/badgeDefinitions?where[nope]=1')
    expect(response.status).toBe(400)
  })

  it('still filters on a readable column spelled exactly', async () => {
    const created = await call(
      'POST',
      '/api/sessionRecords',
      practice(),
      attacker.token,
    )
    expect(created.status).toBe(201)
    const { id } = (await created.json()) as { id: string }
    const response = await call(
      'GET',
      '/api/sessionRecords?where[melodyName]=Scale&orderBy=createdAt',
      undefined,
      attacker.token,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject([{ id, melodyName: 'Scale' }])
  })

  it.each(['code', 'Code', 'CODE', 'cOdE'])(
    'refuses hidden promo column %s in list, count and sorting',
    async (column) => {
      for (const query of [
        `where[${column}]=SECRETVIP2026`,
        `orderBy=${column}`,
      ]) {
        for (const suffix of ['', '/count']) {
          const response = await call(
            'GET',
            `/api/promoCodes${suffix}?${query}`,
          )
          expect(response.status).toBe(400)
          expect(await response.text()).not.toContain('promo-secret')
        }
      }
    },
  )
})
