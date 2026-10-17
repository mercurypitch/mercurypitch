// @vitest-environment node
//
// ── A filter is a read, and so is a sort ─────────────────────────────
//
// `maskPublicRow` projects a profile down to public identity: id, name,
// avatar, bio, join date. Everything else — friendCode, leaderboardOptIn,
// league placement, streaks, last practice date — is deliberately withheld
// from an unauthenticated read, and `userProfiles` IS unauthenticated
// (access 'owner', public reads).
//
// The mask runs on the OUTPUT. `where[...]` ran before it, on any column at
// all, so whether a row came back answered exactly the question the mask had
// refused, one bit at a time; `/count` gave the same answer as a number, and
// `orderBy` gave it with a binary search attached.
//
// The privateCols half was already closed. This is the publicCols half, and it
// runs against real SQL so a filter that is supposed to be rejected cannot be
// rejected merely because a stubbed database returned nothing.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { TABLES } from '../src/tables'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const NOW = '2026-08-09T12:00:00.000Z'
const ADMIN_KEY = 'query-oracle-test-admin'
const VICTIM = '00000000-0000-4000-8000-0000000000f1'
const OTHER = '00000000-0000-4000-8000-0000000000f2'
const FRIEND_CODE = 'K7QM2X4B'

let sqlite: DatabaseSync
let env: Env

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

function seedProfile(
  id: string,
  displayName: string,
  extras: { optIn: number; streak: number; friendCode: string | null },
): void {
  sqlite
    .prepare(
      `INSERT INTO users (id, createdAt, updatedAt, authProvider, emailVerified, tokenVersion)
       VALUES (?, ?, ?, 'anonymous', 0, 1)`,
    )
    .run(id, NOW, NOW)
  sqlite
    .prepare(
      `INSERT INTO userProfiles
         (id, createdAt, updatedAt, displayName, joinDate, currentStreak,
          longestStreak, leaderboardOptIn, friendCode, lastPracticeDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      NOW,
      NOW,
      displayName,
      NOW,
      extras.streak,
      extras.streak,
      extras.optIn,
      extras.friendCode,
      '2026-08-08',
    )
}

/** The ids a query hands back, or the status when it refuses. */
async function idsOrStatus(path: string): Promise<string[] | number> {
  const response = await get(path)
  if (response.status !== 200) return response.status
  return ((await response.json()) as Array<{ id: string }>).map((r) => r.id)
}

/** Register a password account and hand back its session, for the signed-in
 *  cases. The seeded VICTIM and OTHER stay as the "someone else" to probe. */
async function signIn(
  email: string,
): Promise<{ token: string; userId: string }> {
  const registered = await worker.fetch(
    new Request('https://api.test/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'secret123',
        displayName: 'Singer',
      }),
    }),
    env,
    {} as ExecutionContext,
  )
  expect(registered.status).toBe(200)
  return (await registered.json()) as { token: string; userId: string }
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'query-oracle-integration-secret',
    // These harnesses register real accounts, and registration now passes
    // through the Turnstile gate. A local origin with no TURNSTILE_SECRET is
    // the one configuration the gate lets by, and it is what a developer
    // running the worker locally has — so it is what these simulate.
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
  }
  seedProfile(VICTIM, 'Victim Singer', {
    optIn: 1,
    streak: 9,
    friendCode: FRIEND_CODE,
  })
  seedProfile(OTHER, 'Other Singer', {
    optIn: 0,
    streak: 3,
    friendCode: null,
  })
})

afterEach(() => {
  sqlite.close()
})

describe('a profile is not a public directory', () => {
  // userProfiles is access 'owner': one profile is public BY ID, but the table
  // is not listable by an unauthenticated caller. A listful would be every
  // account's real name and photo — federated sign-up seeds both — so the
  // consent/streak/friend-code oracles are closed outright by refusing the
  // list, a stronger guarantee than rejecting one hidden column at a time.
  it('refuses an unauthenticated list, however it is filtered or sorted', async () => {
    expect(await idsOrStatus('/api/userProfiles')).toBe(401)
    expect(await idsOrStatus(`/api/userProfiles?where[id]=${VICTIM}`)).toBe(401)
    expect(
      await idsOrStatus(
        `/api/userProfiles?where[id]=${VICTIM}&where[leaderboardOptIn]=1`,
      ),
    ).toBe(401)
    expect(
      await idsOrStatus(`/api/userProfiles?where[friendCode]=${FRIEND_CODE}`),
    ).toBe(401)
    expect(
      await idsOrStatus('/api/userProfiles?orderBy=currentStreak&limit=1'),
    ).toBe(401)
  })

  it('refuses an unauthenticated count the same way', async () => {
    expect((await get('/api/userProfiles/count')).status).toBe(401)
    expect(
      (await get(`/api/userProfiles/count?where[friendCode]=${FRIEND_CODE}`))
        .status,
    ).toBe(401)
  })

  it('still keeps stripePriceId unprobeable on a table that IS public', async () => {
    // pricingPlans is public-read, so the column mask (privateCols) is still
    // the only thing between a caller and the live Stripe price id. The
    // hidden-column oracle guard stays in force for tables like it.
    const response = await get(
      '/api/pricingPlans?where[stripePriceId]=price_live_x',
    )
    expect(response.status).toBe(400)
  })
})

describe('the reads that must keep working', () => {
  it('serves a single profile by id to anyone, masked to public identity', async () => {
    // The community card: a profile is still fetchable by id without a token,
    // projected to public columns. This is the read that replaces listing.
    const response = await get(`/api/userProfiles/${VICTIM}`)
    expect(response.status).toBe(200)
    const row = (await response.json()) as Record<string, unknown>

    expect(Object.keys(row).sort()).toEqual([
      'avatarUrl',
      'bio',
      'createdAt',
      'displayName',
      'id',
      'joinDate',
      'updatedAt',
    ])
    expect(row.friendCode).toBeUndefined()
    expect(row.currentStreak).toBeUndefined()
  })

  it('still lets the studio list and sort the whole table', async () => {
    // Admins edit these rows, so the admin key keeps full list access.
    const response = await get(
      '/api/userProfiles?orderBy=displayName&orderDir=desc',
      { 'X-Admin-Key': ADMIN_KEY },
    )
    expect(response.status).toBe(200)
    const ids = ((await response.json()) as Array<{ id: string }>).map(
      (r) => r.id,
    )
    expect(ids).toEqual([VICTIM, OTHER])
  })

  it('lets a signed-in singer list only their own row', async () => {
    // Not admin, so the list is scoped to the caller's id — their own profile
    // comes back and no one else's, whatever limit they ask for.
    const registered = await worker.fetch(
      new Request('https://api.test/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'self@example.com',
          password: 'secret123',
          displayName: 'Self',
        }),
      }),
      env,
      {} as ExecutionContext,
    )
    const { token, userId } = (await registered.json()) as {
      token: string
      userId: string
    }
    const response = await get('/api/userProfiles?limit=1000', {
      Authorization: `Bearer ${token}`,
    })
    expect(response.status).toBe(200)
    const ids = ((await response.json()) as Array<{ id: string }>).map(
      (r) => r.id,
    )
    expect(ids).toEqual([userId])
    expect(ids).not.toContain(VICTIM)
  })

  it('cannot be widened back to another user with where[id]', async () => {
    // The forced own-id filter REPLACES whatever `where[id]` the caller sent,
    // so naming somebody else returns the caller's own row, never theirs —
    // and naming yourself is simply the same row again.
    const { token, userId } = await signIn('prober@example.com')
    const spoofed = await get(`/api/userProfiles?where[id]=${VICTIM}`, {
      Authorization: `Bearer ${token}`,
    })
    expect(spoofed.status).toBe(200)
    const spoofedIds = ((await spoofed.json()) as Array<{ id: string }>).map(
      (r) => r.id,
    )
    expect(spoofedIds).toEqual([userId])
    expect(spoofedIds).not.toContain(VICTIM)

    const own = await get(`/api/userProfiles?where[id]=${userId}`, {
      Authorization: `Bearer ${token}`,
    })
    expect(own.status).toBe(200)
    expect(
      ((await own.json()) as Array<{ id: string }>).map((r) => r.id),
    ).toEqual([userId])
  })

  it('counts only itself', async () => {
    // `/count` is the cleaner oracle — a number rather than a row — so it is
    // pinned the same way: the forced own-id filter wins, and the count
    // never says whether VICTIM exists.
    const { token } = await signIn('counter@example.com')
    const plain = await get('/api/userProfiles/count', {
      Authorization: `Bearer ${token}`,
    })
    expect(plain.status).toBe(200)
    await expect(plain.json()).resolves.toEqual({ count: 1 })

    const spoofed = await get(`/api/userProfiles/count?where[id]=${VICTIM}`, {
      Authorization: `Bearer ${token}`,
    })
    expect(spoofed.status).toBe(200)
    await expect(spoofed.json()).resolves.toEqual({ count: 1 })
  })

  it('a hidden column still cannot be filtered on by a signed-in caller', async () => {
    // hiddenReadColumn exempts only `access: 'user'`; an owner table keeps
    // the guard for a signed-in non-admin, so the mask cannot be turned into
    // a filter even over the caller's own row.
    const { token } = await signIn('streaker@example.com')
    const response = await get('/api/userProfiles?where[currentStreak]=9', {
      Authorization: `Bearer ${token}`,
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot filter on "currentStreak"',
    })
  })

  it('an admin key with a bad value is not an admin', async () => {
    // A wrong key must fall back to "anonymous" (refused), not to a public
    // read of the whole table.
    const response = await get('/api/userProfiles?limit=1000', {
      'X-Admin-Key': 'wrong',
    })
    expect(response.status).toBe(401)
  })

  it('lets an admin filter on anything, having nothing hidden to probe', async () => {
    const response = await get(
      `/api/userProfiles?where[friendCode]=${FRIEND_CODE}`,
      { 'X-Admin-Key': ADMIN_KEY },
    )
    expect(response.status).toBe(200)
    const rows = (await response.json()) as Array<Record<string, unknown>>
    expect(rows.map((r) => r.id)).toEqual([VICTIM])
    expect(rows[0].friendCode).toBe(FRIEND_CODE)
  })

  it('leaves a singer free to search their own private rows', async () => {
    // `access: 'user'` reads are pinned to the caller by scopeRead, so a
    // filter there can only ever reveal something about the caller — there is
    // nobody else in the result set to learn anything about.
    //
    // No user-scoped table declares publicCols today, so the exemption has no
    // effect on the shipped schema and cannot be observed through it. That is
    // precisely why it is worth having AND worth testing: the rule is about
    // the shape of a table definition, not about today's tables, and the day
    // one of them gains a publicCols list must not be the day singers lose
    // search over their own practice history. So the definition is given one
    // here, for the length of this test.
    const original = TABLES.sessionRecords.publicCols
    TABLES.sessionRecords.publicCols = ['id', 'userId']

    const registered = await worker.fetch(
      new Request('https://api.test/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'searcher@example.com',
          password: 'secret123',
          displayName: 'Searcher',
        }),
      }),
      env,
      {} as ExecutionContext,
    )
    const { token, userId } = (await registered.json()) as {
      token: string
      userId: string
    }
    sqlite
      .prepare(
        `INSERT INTO sessionRecords
           (id, createdAt, updatedAt, userId, melodyName, startedAt, endedAt,
            score, accuracy, notesHit, notesTotal, streak, results, source)
         VALUES ('own-run', ?, ?, ?, 'Legend', ?, ?, 91, 88, 9, 10, 2, '{}',
                 'exercise')`,
      )
      .run(NOW, NOW, userId, NOW, NOW)

    try {
      const response = await get('/api/sessionRecords?where[score]=91', {
        Authorization: `Bearer ${token}`,
      })
      expect(response.status).toBe(200)
      expect(
        ((await response.json()) as Array<{ id: string }>).map((r) => r.id),
      ).toEqual(['own-run'])
    } finally {
      TABLES.sessionRecords.publicCols = original
    }
  })
})
