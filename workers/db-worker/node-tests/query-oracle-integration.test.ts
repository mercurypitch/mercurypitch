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

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'query-oracle-integration-secret',
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

describe('probing a profile column the mask hides', () => {
  it('does not answer a consent question the response refused to', async () => {
    // THE REGRESSION. Pre-fix this returned the victim's row (they opted in)
    // and `[]` for the singer who did not — a consent bit, unauthenticated.
    expect(
      await idsOrStatus(
        `/api/userProfiles?where[id]=${VICTIM}&where[leaderboardOptIn]=1`,
      ),
    ).toBe(400)
    expect(
      await idsOrStatus(
        `/api/userProfiles?where[id]=${OTHER}&where[leaderboardOptIn]=1`,
      ),
    ).toBe(400)
  })

  it('does not let a streak be recovered one guess at a time', async () => {
    for (const streak of [3, 9, 40]) {
      expect(
        await idsOrStatus(
          `/api/userProfiles?where[id]=${VICTIM}&where[currentStreak]=${streak}`,
        ),
      ).toBe(400)
    }
    expect(
      await idsOrStatus(`/api/userProfiles?where[lastPracticeDate]=2026-08-08`),
    ).toBe(400)
  })

  it('closes the membership test against the friend-code space', async () => {
    // `/count` is the cleaner oracle — a number rather than a row — and it is
    // the one that bypassed the friend-redeem rate limit entirely.
    expect(
      await idsOrStatus(`/api/userProfiles?where[friendCode]=${FRIEND_CODE}`),
    ).toBe(400)

    const counted = await get(
      `/api/userProfiles/count?where[friendCode]=${FRIEND_CODE}`,
    )
    expect(counted.status).toBe(400)
  })

  it('refuses to sort by a hidden column, which is the same oracle', async () => {
    // Paginating a sort recovers the value without ever reading it: the top
    // row of `orderBy=currentStreak&orderDir=desc` names the longest streak in
    // the deployment. Only the filter half had been considered.
    expect(
      await idsOrStatus('/api/userProfiles?orderBy=currentStreak&limit=1'),
    ).toBe(400)
    expect(await idsOrStatus('/api/userProfiles?orderBy=friendCode')).toBe(400)
  })

  it('refuses rather than quietly dropping the filter', async () => {
    // Ignoring it would widen the result set and still look like the query
    // succeeded — the caller would act on rows it never asked for.
    const response = await get(`/api/userProfiles?where[currentStreak]=9`)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot filter on "currentStreak"',
    })
  })

  it('still keeps stripePriceId unprobeable', async () => {
    // The privateCols half, which was already closed — pinned here so the two
    // policies cannot drift apart.
    const response = await get(
      '/api/pricingPlans?where[stripePriceId]=price_live_x',
    )
    expect(response.status).toBe(400)
  })
})

describe('the reads that must keep working', () => {
  it('filters and sorts on public identity', async () => {
    expect(await idsOrStatus(`/api/userProfiles?where[id]=${VICTIM}`)).toEqual([
      VICTIM,
    ])
    expect(
      await idsOrStatus('/api/userProfiles?where[displayName]=Other Singer'),
    ).toEqual([OTHER])
    expect(
      await idsOrStatus('/api/userProfiles?orderBy=displayName&orderDir=desc'),
    ).toEqual([VICTIM, OTHER])
  })

  it('still masks what it returns', async () => {
    // The projection is the other half and must not have been traded away for
    // the filter rule.
    const response = await get(`/api/userProfiles?where[id]=${VICTIM}`)
    const [row] = (await response.json()) as Array<Record<string, unknown>>

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
