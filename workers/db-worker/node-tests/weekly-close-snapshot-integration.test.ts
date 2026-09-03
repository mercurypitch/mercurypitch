// @vitest-environment node
//
// ── Closing a challenge by hand has to freeze its board ──────────────
//
// `closeWeekly` is the only thing that writes `resultsJson`, and it was only
// ever reached from the lazy rotation in `handleWeeklyActive` — the path that
// runs when a window has been over for 48 hours. Every other way of closing a
// challenge went through the admin PATCH, which set `status = 'closed'` and
// nothing else, so the row reached `/api/weekly/archive` with `results: null`
// and no later request would fill it in.
//
// That mattered the moment the admin console started closing the outgoing
// challenge itself, which is what "Set live now" does — before that, nothing
// but a hand-written PATCH ever took that path.
//
// Against real SQLite with the real migrations, so the snapshot is computed by
// the SQL as written rather than by a stub that agrees with it.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const ADMIN_KEY = 'weekly-close-test-admin'
const NOW = '2026-08-31T12:00:00.000Z'
const CHALLENGE_ID = 'weekly-close-snapshot'
const ALTO = '00000000-0000-4000-8000-0000000003a1'
const TENOR = '00000000-0000-4000-8000-0000000003a2'

let sqlite: DatabaseSync
let env: Env

function seedUser(id: string, displayName: string): void {
  sqlite
    .prepare(
      `INSERT INTO users
         (id, createdAt, updatedAt, authProvider, email, emailVerified,
          lastLoginAt, tokenVersion)
       VALUES (?, ?, ?, 'password', ?, 1, ?, 1)`,
    )
    .run(id, NOW, NOW, `${displayName.toLowerCase()}@example.com`, NOW)
  sqlite
    .prepare(
      `INSERT INTO userProfiles
         (id, createdAt, updatedAt, displayName, joinDate, currentStreak,
          longestStreak, leaderboardOptIn, leaderboardOptInAt)
       VALUES (?, ?, ?, ?, ?, 3, 3, 1, ?)`,
    )
    .run(id, NOW, NOW, displayName, NOW, NOW)
}

/** A four-week challenge whose window has just run out. */
function seedChallenge(): void {
  sqlite
    .prepare(
      `INSERT INTO weeklyChallenges
         (id, createdAt, updatedAt, slug, title, description, featType,
          difficulty, targetItems, targetScore, startsAt, endsAt, evergreen,
          status)
       VALUES (?, ?, ?, 'the-long-one', 'The Long One', 'Four weeks of it',
               'money-note', 'intermediate', '[]', 80, ?, ?, 0, 'active')`,
    )
    .run(
      CHALLENGE_ID,
      NOW,
      NOW,
      '2026-08-03T00:00:00.000Z',
      '2026-08-31T00:00:00.000Z',
    )
}

function seedScore(id: string, userId: string, score: number): void {
  sqlite
    .prepare(
      `INSERT INTO sessionRecords
         (id, createdAt, updatedAt, userId, melodyName, startedAt, endedAt,
          score, accuracy, notesHit, notesTotal, streak, weeklyChallengeId,
          results, source)
       VALUES (?, ?, ?, ?, 'Legend: The Long One', ?, ?, ?, ?, 9, 10, 4, ?,
               '{}', 'weekly')`,
    )
    .run(id, NOW, NOW, userId, NOW, NOW, score, score, CHALLENGE_ID)
}

function patchChallenge(
  patch: Record<string, unknown>,
  headers: Record<string, string> = { 'X-Admin-Key': ADMIN_KEY },
): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test/api/weekly/${CHALLENGE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(patch),
    }),
    env,
    {} as ExecutionContext,
  )
}

interface Snapshot {
  version?: number
  top3: Array<{
    userId?: string
    displayName: string | null
    best: number
    rank?: number
    redacted?: boolean
  }>
  attemptedCount: number
  completedCount: number
  closedAt: string
}

function storedRow(): { status: string; resultsJson: string | null } {
  return sqlite
    .prepare(`SELECT status, resultsJson FROM weeklyChallenges WHERE id = ?`)
    .get(CHALLENGE_ID) as { status: string; resultsJson: string | null }
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'weekly-close-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
  } as unknown as Env
  seedUser(ALTO, 'Alto')
  seedUser(TENOR, 'Tenor')
  seedChallenge()
  seedScore('alto-best', ALTO, 94)
  seedScore('alto-earlier', ALTO, 71)
  seedScore('tenor-only', TENOR, 66)
})

afterEach(() => {
  sqlite.close()
})

describe('closing a weekly challenge through the admin PATCH', () => {
  it('freezes the board instead of archiving an empty result', async () => {
    const response = await patchChallenge({ status: 'closed' })
    expect(response.status).toBe(200)

    const row = storedRow()
    expect(row.status).toBe('closed')
    expect(row.resultsJson).not.toBeNull()

    const snapshot = JSON.parse(row.resultsJson as string) as Snapshot
    // Best-per-singer, so Alto's 71 never appears; 80 is the target, so only
    // Alto completed it. `userId` and `rank` are what a later opt-out and the
    // podium UI read — see the version-2 note on closeWeekly.
    expect(snapshot.version).toBe(2)
    expect(snapshot.top3).toEqual([
      { userId: ALTO, displayName: 'Alto', best: 94, rank: 1 },
      { userId: TENOR, displayName: 'Tenor', best: 66, rank: 2 },
    ])
    expect(snapshot.attemptedCount).toBe(2)
    expect(snapshot.completedCount).toBe(1)
    expect(Number.isFinite(Date.parse(snapshot.closedAt))).toBe(true)
  })

  it('serves the frozen board from the archive', async () => {
    await patchChallenge({ status: 'closed' })

    const response = await worker.fetch(
      new Request('https://api.test/api/weekly/archive'),
      env,
      {} as ExecutionContext,
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      archive: Array<{ id: string; results: Snapshot | null }>
    }
    const entry = body.archive.find((c) => c.id === CHALLENGE_ID)
    expect(entry).toBeDefined()
    expect(entry?.results?.attemptedCount).toBe(2)
  })

  it('does not recompute a board that was already frozen', async () => {
    await patchChallenge({ status: 'closed' })
    const first = storedRow().resultsJson

    // A score arriving after the close — a late sync, or a replay of the
    // archived melody that was mis-tagged. The board froze when the challenge
    // ended and must keep saying what was true then.
    seedScore('tenor-late', TENOR, 99)
    await patchChallenge({ status: 'closed' })

    expect(storedRow().resultsJson).toBe(first)
  })

  it('leaves an open challenge alone', async () => {
    const response = await patchChallenge({ title: 'The Longer One' })
    expect(response.status).toBe(200)

    const row = storedRow()
    expect(row.status).toBe('active')
    expect(row.resultsJson).toBeNull()
  })

  it('still refuses the write without the admin key', async () => {
    const response = await patchChallenge({ status: 'closed' }, {})
    expect(response.status).toBe(403)
    expect(storedRow().status).toBe('active')
  })
})
