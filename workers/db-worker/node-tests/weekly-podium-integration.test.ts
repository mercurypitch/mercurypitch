// @vitest-environment node
//
// ── Who may be named on a Legend podium, and who wins what ───────────
//
// A closed challenge's podium is a published record: a name beside a score,
// kept indefinitely, visible to anyone. Three rules hold it together and all
// three are load-bearing enough to be pinned here rather than left to review.
//
//  1. **Consent is required to be named.** Counts are over everyone who sang,
//     because "17 sang this" is a participation figure and hiding people would
//     make it a lie. The named list is over the singers who opted in.
//
//  2. **The name freezes, the permission does not.** The snapshot records the
//     display name as it stood when the window shut, so renaming an account
//     after winning cannot rewrite history. `userId` rides along so a later
//     opt-out can redact the entry on the way out — the rank and the score
//     survive, only the identity goes.
//
//  3. **The badge is granted at close time**, server-side, because nobody
//     knows who won until the window shuts and the winner is by definition not
//     in the app at that moment.
//
// Against real SQLite with the real migrations: the eligibility rules are SQL,
// and a stub that agrees with the SQL would prove nothing about the SQL.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const ADMIN_KEY = 'weekly-podium-test-admin'
const PASSWORD = 'Podium-Test-Passw0rd!'
const NOW = '2026-08-31T12:00:00.000Z'
const CHALLENGE_ID = 'weekly-podium'
const OTHER_CHALLENGE_ID = 'weekly-podium-other'

let sqlite: DatabaseSync
let env: Env
let nextUser = 0

interface Seeded {
  id: string
  displayName: string
}

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

/**
 * A singer with a profile, a consent setting and a best score.
 *
 * Seeded directly rather than registered through the API: these tests are
 * about eligibility rules, and going through registration would make every
 * case depend on the auth stack as well.
 */
function seedSinger(
  displayName: string,
  opts: { optedIn?: boolean; suspended?: boolean } = {},
): Seeded {
  nextUser += 1
  const id = `00000000-0000-4000-8000-00000000${String(nextUser).padStart(4, '0')}`
  sqlite
    .prepare(
      `INSERT INTO users
         (id, createdAt, updatedAt, authProvider, email, emailVerified,
          lastLoginAt, tokenVersion, suspendedAt)
       VALUES (?, ?, ?, 'password', ?, 1, ?, 1, ?)`,
    )
    .run(
      id,
      NOW,
      NOW,
      `${displayName.toLowerCase().replaceAll(' ', '-')}@example.com`,
      NOW,
      opts.suspended === true ? NOW : null,
    )
  sqlite
    .prepare(
      `INSERT INTO userProfiles
         (id, createdAt, updatedAt, displayName, joinDate, currentStreak,
          longestStreak, leaderboardOptIn, leaderboardOptInAt)
       VALUES (?, ?, ?, ?, ?, 3, 3, ?, ?)`,
    )
    .run(
      id,
      NOW,
      NOW,
      displayName,
      NOW,
      opts.optedIn === false ? 0 : 1,
      opts.optedIn === false ? null : NOW,
    )
  return { id, displayName }
}

/** Withdraw one singer's score from one challenge, as the admin tool does. */
function retract(challengeId: string, userId: string, reason: string): void {
  sqlite
    .prepare(
      `INSERT INTO weeklyChallengeScoreRetractions
         (weeklyChallengeId, userId, retractedAt, reason)
       VALUES (?, ?, ?, ?)`,
    )
    .run(challengeId, userId, NOW, reason)
}

function seedChallenge(id = CHALLENGE_ID, slug = 'the-podium-one'): void {
  sqlite
    .prepare(
      `INSERT INTO weeklyChallenges
         (id, createdAt, updatedAt, slug, title, description, featType,
          difficulty, targetItems, targetScore, startsAt, endsAt, evergreen,
          status)
       VALUES (?, ?, ?, ?, 'The Podium One', 'Four weeks of it',
               'money-note', 'intermediate', '[]', 80, ?, ?, 0, 'active')`,
    )
    .run(
      id,
      NOW,
      NOW,
      slug,
      '2026-08-03T00:00:00.000Z',
      '2026-08-31T00:00:00.000Z',
    )
}

function seedScore(
  userId: string,
  score: number,
  challengeId = CHALLENGE_ID,
): void {
  sqlite
    .prepare(
      `INSERT INTO sessionRecords
         (id, createdAt, updatedAt, userId, melodyName, startedAt, endedAt,
          score, accuracy, notesHit, notesTotal, streak, weeklyChallengeId,
          results, source)
       VALUES (?, ?, ?, ?, 'Legend: The Podium One', ?, ?, ?, ?, 9, 10, 4, ?,
               '{}', 'weekly')`,
    )
    .run(
      `score-${userId}-${score}-${challengeId}`,
      NOW,
      NOW,
      userId,
      NOW,
      NOW,
      score,
      score,
      challengeId,
    )
}

/**
 * Migration 0042 ships the three podium rows to every database, so a test
 * that models one WITHOUT them (a dev database whose migration failed, or
 * whose rows were deleted by hand) has to remove them first.
 */
function unseedPodiumBadges(): void {
  sqlite.prepare(`DELETE FROM badgeDefinitions WHERE category = 'legend'`).run()
}

/**
 * The three podium badges under the test's own ids. The migration's rows are
 * replaced rather than kept beside them: the grant looks a badge up by name,
 * and two rows per name would make `badgeHolders('badge-first')` a coin toss.
 */
function seedPodiumBadges(): void {
  unseedPodiumBadges()
  const rows: Array<[string, string, string]> = [
    ['badge-first', 'First Voice', 'gold'],
    ['badge-second', 'Second Voice', 'silver'],
    ['badge-third', 'Third Voice', 'bronze'],
  ]
  for (const [id, name, tier] of rows) {
    sqlite
      .prepare(
        `INSERT INTO badgeDefinitions
           (id, createdAt, updatedAt, name, description, icon, tier, category,
            unlockCondition, sortOrder)
         VALUES (?, ?, ?, ?, 'Placed on a Legend board', ?, ?, 'legend', 'Place', 1)`,
      )
      .run(id, NOW, NOW, name, name.toLowerCase().replaceAll(' ', ''), tier)
  }
}

function close(id = CHALLENGE_ID): Promise<Response> {
  return workerRequest(`/api/weekly/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
    body: JSON.stringify({ status: 'closed' }),
  })
}

interface PodiumEntry {
  userId?: string
  displayName: string | null
  best: number
  rank?: number
  redacted?: boolean
}

interface Snapshot {
  version?: number
  top3: PodiumEntry[]
  attemptedCount: number
  completedCount: number
  closedAt: string
}

function snapshot(id = CHALLENGE_ID): Snapshot {
  const row = sqlite
    .prepare(`SELECT resultsJson FROM weeklyChallenges WHERE id = ?`)
    .get(id) as { resultsJson: string | null }
  expect(row.resultsJson).not.toBeNull()
  return JSON.parse(row.resultsJson as string) as Snapshot
}

async function archived(id = CHALLENGE_ID): Promise<Snapshot | null> {
  const response = await workerRequest('/api/weekly/archive')
  expect(response.status).toBe(200)
  const body = (await response.json()) as {
    archive: Array<{ id: string; results: Snapshot | null }>
  }
  return body.archive.find((c) => c.id === id)?.results ?? null
}

interface Board {
  top: Array<{ rank: number; displayName: string; best: number }>
  attemptedCount: number
  rankedCount: number
  completedCount: number
  you: {
    best: number
    rank: number
    percentile: number
    ranked: boolean
  } | null
}

function board(token?: string, id = CHALLENGE_ID): Promise<Board> {
  return workerRequest(
    `/api/weekly/board?id=${id}`,
    token === undefined
      ? undefined
      : { headers: { Authorization: `Bearer ${token}` } },
  ).then((r) => r.json() as Promise<Board>)
}

/** Register through the API, then set consent on the profile it created. */
async function registerSinger(
  email: string,
  displayName: string,
  optedIn: boolean,
): Promise<{ id: string; token: string }> {
  const response = await workerRequest('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    body: JSON.stringify({ email, password: PASSWORD, displayName }),
  })
  expect(response.status).toBe(200)
  const account = (await response.json()) as {
    token: string
    user: { id: string }
  }
  sqlite
    .prepare(
      `INSERT INTO userProfiles
         (id, createdAt, updatedAt, displayName, joinDate, currentStreak,
          longestStreak, leaderboardOptIn, leaderboardOptInAt)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         displayName = excluded.displayName,
         leaderboardOptIn = excluded.leaderboardOptIn`,
    )
    .run(
      account.user.id,
      NOW,
      NOW,
      displayName,
      NOW,
      optedIn ? 1 : 0,
      optedIn ? NOW : null,
    )
  return { id: account.user.id, token: account.token }
}

function badgeHolders(badgeId: string): string[] {
  return (
    sqlite
      .prepare(
        `SELECT userId FROM userBadges WHERE badgeId = ? ORDER BY userId`,
      )
      .all(badgeId) as Array<{ userId: string }>
  ).map((r) => r.userId)
}

beforeEach(() => {
  nextUser = 0
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'weekly-podium-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
  } as unknown as Env
  seedChallenge()
})

afterEach(() => {
  sqlite.close()
})

describe('consent decides who is named, not who is counted', () => {
  it('leaves a singer who never opted in off the podium but in the count', async () => {
    const shy = seedSinger('Shy Singer', { optedIn: false })
    const open = seedSinger('Open Singer')
    seedScore(shy.id, 99)
    seedScore(open.id, 84)

    await close()
    const results = snapshot()

    expect(results.top3.map((e) => e.displayName)).toEqual(['Open Singer'])
    // Both sang, and both cleared the 80 target. Hiding the shy singer from
    // the counts would misreport how many people took part.
    expect(results.attemptedCount).toBe(2)
    expect(results.completedCount).toBe(2)
  })

  it('closes the rank gap a non-consenting singer would leave', async () => {
    const shy = seedSinger('Shy Singer', { optedIn: false })
    const second = seedSinger('Loud Singer')
    const third = seedSinger('Louder Singer')
    seedScore(shy.id, 99)
    seedScore(second.id, 90)
    seedScore(third.id, 85)

    await close()
    // 1-2, not 2-3. A missing first place would say somebody was there and
    // outscored the person below — which is the fact consent was withheld for.
    expect(snapshot().top3.map((e) => e.rank)).toEqual([1, 2])
    expect(snapshot().top3.map((e) => e.displayName)).toEqual([
      'Loud Singer',
      'Louder Singer',
    ])
  })

  it('keeps only the first three places', async () => {
    const singers = ['A', 'B', 'C', 'D'].map((n) => seedSinger(`Singer ${n}`))
    singers.forEach((s, i) => seedScore(s.id, 95 - i))

    await close()
    expect(snapshot().top3).toHaveLength(3)
    expect(snapshot().attemptedCount).toBe(4)
  })

  it('drops a suspended singer from the podium and the count', async () => {
    const banned = seedSinger('Banned Singer', { suspended: true })
    const fine = seedSinger('Fine Singer')
    seedScore(banned.id, 99)
    seedScore(fine.id, 70)

    await close()
    expect(snapshot().top3.map((e) => e.displayName)).toEqual(['Fine Singer'])
    expect(snapshot().attemptedCount).toBe(1)
  })

  it('drops a singer whose score was retracted for this challenge', async () => {
    const withdrawn = seedSinger('Withdrawn Singer')
    const staying = seedSinger('Staying Singer')
    seedScore(withdrawn.id, 99)
    seedScore(staying.id, 70)
    retract(CHALLENGE_ID, withdrawn.id, 'Singer asked')

    await close()
    expect(snapshot().top3.map((e) => e.displayName)).toEqual([
      'Staying Singer',
    ])
    expect(snapshot().attemptedCount).toBe(1)
  })
})

describe('the podium badge', () => {
  it('goes to the first three and nobody else', async () => {
    seedPodiumBadges()
    const singers = ['A', 'B', 'C', 'D'].map((n) => seedSinger(`Singer ${n}`))
    singers.forEach((s, i) => seedScore(s.id, 95 - i))

    await close()

    expect(badgeHolders('badge-first')).toEqual([singers[0].id])
    expect(badgeHolders('badge-second')).toEqual([singers[1].id])
    expect(badgeHolders('badge-third')).toEqual([singers[2].id])
    expect(
      (
        sqlite
          .prepare(`SELECT COUNT(*) c FROM userBadges WHERE userId = ?`)
          .get(singers[3].id) as { c: number }
      ).c,
    ).toBe(0)
  })

  it('is granted with the winner nowhere near the app', async () => {
    // The whole reason this lives in the worker: the close happens on whichever
    // request first notices the window is over, which is somebody else's.
    seedPodiumBadges()
    const winner = seedSinger('Absent Winner')
    seedScore(winner.id, 91)

    await close()
    expect(badgeHolders('badge-first')).toEqual([winner.id])
  })

  it('does not hand the same singer a second copy for a second win', async () => {
    seedPodiumBadges()
    const repeat = seedSinger('Repeat Winner')
    seedScore(repeat.id, 91)
    seedChallenge(OTHER_CHALLENGE_ID, 'the-other-one')
    seedScore(repeat.id, 88, OTHER_CHALLENGE_ID)

    await close()
    await close(OTHER_CHALLENGE_ID)

    expect(badgeHolders('badge-first')).toEqual([repeat.id])
  })

  it('closes the challenge even when the badges were never seeded', async () => {
    // A database without the podium rows (migration 0042 carries them, so
    // this is a failed or hand-edited one). The close is the load-bearing
    // act — the next challenge cannot start until it lands — so a missing
    // definition must not be able to stop it. It must not pass in silence
    // either: the winner is owed a badge that `reaward` can pay later.
    unseedPodiumBadges()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const winner = seedSinger('Unbadged Winner')
      seedScore(winner.id, 91)
      const response = await close()
      expect(response.status).toBe(200)
      expect(snapshot().top3).toHaveLength(1)
      expect(
        (
          sqlite.prepare(`SELECT COUNT(*) c FROM userBadges`).get() as {
            c: number
          }
        ).c,
      ).toBe(0)
      expect(errors).toHaveBeenCalledTimes(1)
      expect(errors.mock.calls[0]?.[0]).toMatch(/"First Voice".*rank 1/)
    } finally {
      errors.mockRestore()
    }
  })

  it('grants the podium from the migration-seeded definitions alone', async () => {
    // No seed script ran: the rows migration 0042 wrote are the only ones.
    const winner = seedSinger('Migrated Winner')
    seedScore(winner.id, 91)
    await close()
    const held = sqlite
      .prepare(
        `SELECT d.name FROM userBadges ub JOIN badgeDefinitions d ON d.id = ub.badgeId WHERE ub.userId = ?`,
      )
      .all(winner.id) as Array<{ name: string }>
    expect(held.map((h) => h.name)).toEqual(['First Voice'])
  })

  it('skips a singer who is on the podium but not in the top three', async () => {
    // Only three badges exist, so a fourth place must resolve to no badge
    // rather than to `undefined` reaching the query.
    seedPodiumBadges()
    const singers = ['A', 'B', 'C'].map((n) => seedSinger(`Singer ${n}`))
    singers.forEach((s, i) => seedScore(s.id, 95 - i))

    await close()
    expect(
      (
        sqlite.prepare(`SELECT COUNT(*) c FROM userBadges`).get() as {
          c: number
        }
      ).c,
    ).toBe(3)
  })
})

describe('redaction on the way out', () => {
  it('shows the frozen name while consent stands', async () => {
    const singer = seedSinger('Still Willing')
    seedScore(singer.id, 91)
    await close()

    const results = await archived()
    expect(results?.top3[0].displayName).toBe('Still Willing')
    expect(results?.top3[0].redacted).toBeUndefined()
  })

  it('redacts the name but keeps the place when consent is withdrawn', async () => {
    const singer = seedSinger('Changed Their Mind')
    const other = seedSinger('Still Fine')
    seedScore(singer.id, 91)
    seedScore(other.id, 85)
    await close()

    sqlite
      .prepare(`UPDATE userProfiles SET leaderboardOptIn = 0 WHERE id = ?`)
      .run(singer.id)

    const results = await archived()
    expect(results?.top3[0]).toEqual({
      rank: 1,
      best: 91,
      displayName: null,
      redacted: true,
    })
    // The record is unchanged: they still came first with 91.
    expect(results?.top3[1].displayName).toBe('Still Fine')
    expect(results?.attemptedCount).toBe(2)
  })

  it('does not leak the id of a redacted singer', async () => {
    const singer = seedSinger('Gone Quiet')
    seedScore(singer.id, 91)
    await close()
    sqlite
      .prepare(`UPDATE userProfiles SET leaderboardOptIn = 0 WHERE id = ?`)
      .run(singer.id)

    const results = await archived()
    expect(results?.top3[0].userId).toBeUndefined()
    expect(JSON.stringify(results)).not.toContain(singer.id)
  })

  it('redacts a singer suspended after the close', async () => {
    const singer = seedSinger('Later Banned')
    seedScore(singer.id, 91)
    await close()
    sqlite
      .prepare(`UPDATE users SET suspendedAt = ? WHERE id = ?`)
      .run(NOW, singer.id)

    expect((await archived())?.top3[0].redacted).toBe(true)
  })

  it('redacts a singer who retracts this challenge, and only this one', async () => {
    const singer = seedSinger('Withdrew One Week')
    seedScore(singer.id, 91)
    seedChallenge(OTHER_CHALLENGE_ID, 'the-other-one')
    seedScore(singer.id, 88, OTHER_CHALLENGE_ID)
    await close()
    await close(OTHER_CHALLENGE_ID)

    retract(CHALLENGE_ID, singer.id, 'Just that week')

    expect((await archived(CHALLENGE_ID))?.top3[0].redacted).toBe(true)
    expect((await archived(OTHER_CHALLENGE_ID))?.top3[0].displayName).toBe(
      'Withdrew One Week',
    )
  })

  it('keeps the frozen name after the singer renames the account', async () => {
    const singer = seedSinger('Name At Close')
    seedScore(singer.id, 91)
    await close()

    sqlite
      .prepare(`UPDATE userProfiles SET displayName = ? WHERE id = ?`)
      .run('Something Else Entirely', singer.id)

    // The podium is a record of what happened, so it says who won at the time
    // — a rename cannot reach backwards and relabel a published result.
    expect((await archived())?.top3[0].displayName).toBe('Name At Close')
  })

  it('passes a version 1 row through exactly as stored', async () => {
    // Weeks closed before podiums carried ids. They are the only record of
    // those weeks, so they must survive a reader that expects the new shape.
    const legacy = {
      top3: [
        { displayName: 'Singer-8df2', best: 97 },
        { displayName: 'Singer-7822', best: 95 },
      ],
      attemptedCount: 17,
      completedCount: 6,
      closedAt: '2026-09-02T00:20:33.088Z',
    }
    sqlite
      .prepare(
        `UPDATE weeklyChallenges SET status = 'closed', resultsJson = ? WHERE id = ?`,
      )
      .run(JSON.stringify(legacy), CHALLENGE_ID)

    expect(await archived()).toEqual(legacy)
  })

  it('serves a challenge closed with nobody on the podium', async () => {
    await close()
    const results = await archived()
    expect(results?.top3).toEqual([])
    expect(results?.attemptedCount).toBe(0)
  })
})

describe('the live board tells an unranked singer the truth', () => {
  it('ranks a consenting singer among the singers who can be ranked', async () => {
    const rival = seedSinger('Rival')
    seedScore(rival.id, 95)
    const me = await registerSinger('ranked@example.com', 'Ranked Me', true)
    seedScore(me.id, 88)

    const result = await board(me.token)
    expect(result.you?.ranked).toBe(true)
    expect(result.you?.rank).toBe(2)
    expect(result.top.map((e) => e.displayName)).toEqual(['Rival', 'Ranked Me'])
  })

  it('gives an unconsenting singer their score and no place on the board', async () => {
    const rival = seedSinger('Rival')
    seedScore(rival.id, 95)
    const me = await registerSinger('unranked@example.com', 'Quiet Me', false)
    seedScore(me.id, 88)

    const result = await board(me.token)
    expect(result.you?.best).toBe(88)
    expect(result.you?.ranked).toBe(false)
    // Counted, but not listed.
    expect(result.attemptedCount).toBe(2)
    expect(result.top.map((e) => e.displayName)).toEqual(['Rival'])
  })

  it('names nobody on a board where nobody consented', async () => {
    const shy = seedSinger('Shy One', { optedIn: false })
    const alsoShy = seedSinger('Shy Two', { optedIn: false })
    seedScore(shy.id, 95)
    seedScore(alsoShy.id, 90)

    const result = await board()
    expect(result.top).toEqual([])
    expect(result.attemptedCount).toBe(2)
  })
})

describe('a board number always says which population it counted', () => {
  it('measures rank and percentile against the singers who can be ranked', async () => {
    // Four sang, two consented. Coming second of the two ranked singers is
    // "top 50%" — of two, not of four. Mixing the populations would print
    // "top 50% of 4", which is a rank over one field and a denominator over
    // another in the same sentence.
    seedScore(seedSinger('Shy One', { optedIn: false }).id, 99)
    seedScore(seedSinger('Shy Two', { optedIn: false }).id, 97)
    seedScore(seedSinger('Rival').id, 95)
    const me = await registerSinger('pop@example.com', 'Me', true)
    seedScore(me.id, 88)

    const result = await board(me.token)
    expect(result.attemptedCount).toBe(4)
    expect(result.rankedCount).toBe(2)
    expect(result.you?.rank).toBe(2)
    expect(result.you?.percentile).toBe(100)
  })

  it('gives an unranked singer no place rather than first place', async () => {
    // `better + 1` over a field of one is 1, and a consumer reading `rank`
    // without checking `ranked` would print "1st" for somebody on no list.
    seedScore(seedSinger('Rival').id, 95)
    const me = await registerSinger('noplace@example.com', 'Quiet', false)
    seedScore(me.id, 88)

    const result = await board(me.token)
    expect(result.you?.ranked).toBe(false)
    expect(result.you?.rank).toBe(0)
    expect(result.you?.percentile).toBe(0)
    expect(result.you?.best).toBe(88)
  })
})

describe('a singer with no display name of their own', () => {
  it('is never published as a blank entry', async () => {
    // `COALESCE` catches a NULL profile, not an empty stored name — a row
    // written with `displayName: ''` would reach the podium as nothing at all.
    const blank = seedSinger('Blank')
    sqlite
      .prepare(`UPDATE userProfiles SET displayName = '' WHERE id = ?`)
      .run(blank.id)
    seedScore(blank.id, 91)

    await close()
    const name = snapshot().top3[0].displayName
    expect(name).not.toBe('')
    expect(name).toBe(`Singer-${blank.id.slice(0, 6)}`)
  })

  it('is never published as a blank entry on the live board either', async () => {
    const blank = seedSinger('Blank')
    sqlite
      .prepare(`UPDATE userProfiles SET displayName = '' WHERE id = ?`)
      .run(blank.id)
    seedScore(blank.id, 91)

    expect((await board()).top[0].displayName).toBe(
      `Singer-${blank.id.slice(0, 6)}`,
    )
  })
})

// ── Awarding a podium that closed before there was one ───────────────
//
// Every challenge that closed before podium badges shipped has a snapshot and
// no winners' badges, and `closeWeekly` will never select it again — it is
// already closed. Without this the whole history is permanently unawarded.
//
// The interesting constraint is that a version 1 snapshot holds display names
// and no ids, so there is no singer in it to award. The recompute goes back to
// `sessionRecords`, which means today's consent rules decide — and the stored
// record must not be rewritten on the way past.

function reaward(id = CHALLENGE_ID, query = ''): Promise<Response> {
  return workerRequest(`/api/weekly/${id}/reaward${query}`, {
    method: 'POST',
    headers: { 'X-Admin-Key': ADMIN_KEY },
  })
}

interface Reaward {
  challenge: { id: string; title: string }
  dryRun: boolean
  attemptedCount: number
  rankedCount: number
  grants: Array<{
    rank: number
    userId: string
    displayName: string
    badge: string | null
    outcome: string
  }>
}

/** A challenge closed the way it was before badges existed. */
function closeAsVersionOne(
  podium: Array<{ displayName: string; best: number }>,
) {
  sqlite
    .prepare(
      `UPDATE weeklyChallenges SET status = 'closed', resultsJson = ? WHERE id = ?`,
    )
    .run(
      JSON.stringify({
        top3: podium,
        attemptedCount: podium.length,
        completedCount: 1,
        closedAt: '2026-09-02T09:11:06.833Z',
      }),
      CHALLENGE_ID,
    )
}

describe('re-awarding a challenge that closed before badges existed', () => {
  it('awards the podium a version 1 snapshot could not', async () => {
    seedPodiumBadges()
    const first = seedSinger('Brucey')
    const second = seedSinger('Maff')
    seedScore(first.id, 74)
    seedScore(second.id, 40)
    // No ids in the stored podium — the recompute is the only way back to a
    // singer who can hold a badge.
    closeAsVersionOne([
      { displayName: 'Brucey', best: 74 },
      { displayName: 'Maff', best: 40 },
    ])
    expect(badgeHolders('badge-first')).toEqual([])

    const response = await reaward()
    expect(response.status).toBe(200)
    const body = (await response.json()) as Reaward

    expect(body.grants.map((g) => [g.displayName, g.badge, g.outcome])).toEqual(
      [
        ['Brucey', 'First Voice', 'granted'],
        ['Maff', 'Second Voice', 'granted'],
      ],
    )
    expect(badgeHolders('badge-first')).toEqual([first.id])
    expect(badgeHolders('badge-second')).toEqual([second.id])
  })

  it('leaves the published record exactly as it was', async () => {
    seedPodiumBadges()
    const singer = seedSinger('Brucey')
    seedScore(singer.id, 74)
    closeAsVersionOne([{ displayName: 'Brucey', best: 74 }])
    const before = snapshot()

    await reaward()

    // Recomputing the stored podium would quietly drop anyone who has since
    // withdrawn — rewriting a published record rather than redacting it.
    expect(snapshot()).toEqual(before)
  })

  it('applies today consent, not the consent at close time', async () => {
    seedPodiumBadges()
    const withdrawn = seedSinger('Since Withdrew', { optedIn: false })
    const staying = seedSinger('Still In')
    seedScore(withdrawn.id, 99)
    seedScore(staying.id, 74)
    closeAsVersionOne([
      { displayName: 'Since Withdrew', best: 99 },
      { displayName: 'Still In', best: 74 },
    ])

    const body = (await (await reaward()).json()) as Reaward
    // The same answer they would get if the challenge closed now.
    expect(body.grants.map((g) => g.displayName)).toEqual(['Still In'])
    expect(badgeHolders('badge-first')).toEqual([staying.id])
  })

  it('says who would be awarded without awarding them', async () => {
    seedPodiumBadges()
    const singer = seedSinger('Brucey')
    seedScore(singer.id, 74)
    closeAsVersionOne([{ displayName: 'Brucey', best: 74 }])

    const body = (await (
      await reaward(CHALLENGE_ID, '?dryRun=1')
    ).json()) as Reaward
    expect(body.dryRun).toBe(true)
    expect(body.grants.map((g) => g.displayName)).toEqual(['Brucey'])
    // A write to somebody else's account, visible in their app — worth being
    // able to look before doing.
    expect(badgeHolders('badge-first')).toEqual([])
  })

  it('is safe to run twice', async () => {
    seedPodiumBadges()
    const singer = seedSinger('Brucey')
    seedScore(singer.id, 74)
    closeAsVersionOne([{ displayName: 'Brucey', best: 74 }])

    await reaward()
    const body = (await (await reaward()).json()) as Reaward
    expect(body.grants[0].outcome).toBe('already-held')
    expect(badgeHolders('badge-first')).toEqual([singer.id])
    expect(
      (
        sqlite.prepare(`SELECT COUNT(*) c FROM userBadges`).get() as {
          c: number
        }
      ).c,
    ).toBe(1)
  })

  it('reports an unseeded badge rather than pretending it awarded one', async () => {
    unseedPodiumBadges()
    const singer = seedSinger('Brucey')
    seedScore(singer.id, 74)
    closeAsVersionOne([{ displayName: 'Brucey', best: 74 }])

    const body = (await (await reaward()).json()) as Reaward
    expect(body.grants[0].outcome).toBe('no-definition')
    expect(
      (
        sqlite.prepare(`SELECT COUNT(*) c FROM userBadges`).get() as {
          c: number
        }
      ).c,
    ).toBe(0)
  })

  it('refuses a challenge that is still running', async () => {
    seedPodiumBadges()
    const singer = seedSinger('Brucey')
    seedScore(singer.id, 74)

    const response = await reaward()
    expect(response.status).toBe(400)
    expect(badgeHolders('badge-first')).toEqual([])
  })

  it('404s an unknown challenge, and refuses without the admin key', async () => {
    seedPodiumBadges()
    expect((await reaward('no-such-challenge')).status).toBe(404)

    const unauthorized = await workerRequest(
      `/api/weekly/${CHALLENGE_ID}/reaward`,
      { method: 'POST' },
    )
    expect(unauthorized.status).toBe(403)
  })
})
