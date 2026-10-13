// @vitest-environment node
//
// ── One Encore a week, however many ask for it ───────────────────────
//
// When nothing is active or queued, the first GET /api/weekly/active of a
// week re-runs a closed evergreen challenge as an Encore. The check ("is
// anything active?") and the insert were separate statements, and the first
// loads after a rollover arrive together: the second request landing between
// them got a 500 (both picked the same slug), or, with more than one
// evergreen to pick from, inserted a SECOND active challenge, so singers were
// split between two weeks' boards.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, justBefore, SqliteD1Database } from './sqlite-d1'

let sqlite: DatabaseSync
let d1: SqliteD1Database
let env: Env

interface ActiveResponse {
  status: number
  body: { challenge: { id: string; title: string; endsAt: string } | null }
}

const NOW = '2026-10-13T12:00:00.000Z'
const NEXT_WEEK = '2026-10-19T00:00:00.000Z'

async function active(): Promise<ActiveResponse> {
  const response = await worker.fetch(
    new Request('https://api.test/api/weekly/active'),
    env,
    {} as ExecutionContext,
  )
  return {
    status: response.status,
    body: (await response.json()) as ActiveResponse['body'],
  }
}

function seedClosedEvergreens(n: number): void {
  const insert = sqlite.prepare(
    `INSERT INTO weeklyChallenges (id, createdAt, updatedAt, slug, title,
       description, featType, difficulty, targetItems, startsAt, endsAt,
       evergreen, status, resultsJson)
     VALUES (?, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z', ?, ?,
       'd', 'sustain', 'beginner', '[]', '2025-01-06T00:00:00.000Z',
       '2025-01-13T00:00:00.000Z', 1, 'closed', NULL)`,
  )
  for (let i = 0; i < n; i++)
    insert.run(`ev-${i}`, `legend-${i}`, `Legend ${i}`)
}

function activeRows(): unknown[] {
  return sqlite
    .prepare("SELECT id FROM weeklyChallenges WHERE status = 'active'")
    .all()
}

function seedQueued(startsAt = NEXT_WEEK): void {
  sqlite
    .prepare(
      `INSERT INTO weeklyChallenges (id, createdAt, updatedAt, slug, title,
       description, featType, difficulty, targetItems, startsAt, endsAt, status)
     VALUES ('scheduled', ?, ?, 'scheduled', 'Scheduled challenge',
       'd', 'sustain', 'beginner', '[]', ?, '2026-10-26T00:00:00.000Z', 'queued')`,
    )
    .run(NOW, NOW, startsAt)
}

function latch(): { promise: Promise<void>; release: () => void } {
  let release = (): void => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  d1 = new SqliteD1Database(sqlite)
  env = {
    DB: d1 as unknown as D1Database,
    JWT_SECRET: 'weekly-encore-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
  }
})

afterEach(() => {
  vi.useRealTimers()
  sqlite.close()
})

describe('two first loads of a week with nothing active', () => {
  for (const evergreens of [1, 2]) {
    it(`agree on one Encore (${evergreens} to pick from)`, async () => {
      seedClosedEvergreens(evergreens)
      // Keep real SQL selection, replacing only its random numbers. With two
      // templates the first request chooses ev-0 and the second chooses ev-1.
      const randomValues = [0, 1, 1, 0]
      sqlite.function('random', () => randomValues.shift() ?? 0)
      let second: ActiveResponse | undefined
      justBefore(d1, /INSERT INTO weeklyChallenges/, async () => {
        second = await active()
      })
      const first = await active()

      expect([first.status, second?.status]).toEqual([200, 200])
      expect(first.body.challenge?.id).toBeDefined()
      expect(first.body.challenge?.id).toBe(second?.body.challenge?.id)
      expect(first.body).toEqual(second?.body)
      expect(first.body.challenge?.title).toBe(`Legend ${evergreens - 1}`)
      expect(activeRows()).toHaveLength(1)
    })
  }
})

describe('a queued challenge becomes due while an Encore request is pending', () => {
  for (const winner of ['encore', 'queued'] as const) {
    it(`returns one active winner when ${winner} writes first`, async () => {
      seedClosedEvergreens(1)
      seedQueued()
      vi.setSystemTime(new Date(Date.parse(NEXT_WEEK) - 1))
      const encoreReady = latch()
      const writeEncore = latch()
      justBefore(d1, /INSERT INTO weeklyChallenges/, async () => {
        encoreReady.release()
        await writeEncore.promise
      })
      const encore = active()
      await encoreReady.promise

      // The second request starts after the scheduled window opens. Both
      // requests have read no active row before either activation commits.
      vi.setSystemTime(new Date(NEXT_WEEK))
      const queuedReady = latch()
      const writeQueued = latch()
      justBefore(
        d1,
        /UPDATE weeklyChallenges SET status = 'active'/,
        async () => {
          queuedReady.release()
          await writeQueued.promise
        },
      )
      const queued = active()
      await queuedReady.promise
      let first: ActiveResponse
      let second: ActiveResponse
      try {
        if (winner === 'encore') {
          writeEncore.release()
          first = await encore
          writeQueued.release()
          second = await queued
        } else {
          writeQueued.release()
          first = await queued
          writeEncore.release()
          second = await encore
        }
      } finally {
        writeEncore.release()
        writeQueued.release()
      }

      expect([first.status, second.status]).toEqual([200, 200])
      expect(first.body.challenge?.title).toBe(
        winner === 'encore' ? 'Legend 0' : 'Scheduled challenge',
      )
      expect(second.body).toEqual(first.body)
      expect(activeRows()).toEqual([{ id: first.body.challenge?.id }])
      expect(
        sqlite
          .prepare("SELECT status FROM weeklyChallenges WHERE id = 'scheduled'")
          .get(),
      ).toEqual({ status: winner === 'encore' ? 'queued' : 'active' })
    })
  }

  it.each(['closed', 'rescheduled'] as const)(
    'does not activate a queued challenge %s after its eligibility read',
    async (change) => {
      seedClosedEvergreens(1)
      seedQueued(NOW)
      justBefore(
        d1,
        /UPDATE weeklyChallenges SET status = 'active'/,
        async () => {
          sqlite
            .prepare(
              change === 'closed'
                ? "UPDATE weeklyChallenges SET status = 'closed' WHERE id = 'scheduled'"
                : "UPDATE weeklyChallenges SET startsAt = ? WHERE id = 'scheduled'",
            )
            .run(...(change === 'closed' ? [] : [NEXT_WEEK]))
        },
      )

      const response = await active()

      expect(response.status).toBe(200)
      expect(response.body.challenge?.title).toBe('Legend 0')
      expect(activeRows()).toEqual([{ id: response.body.challenge?.id }])
      expect(
        sqlite
          .prepare("SELECT status FROM weeklyChallenges WHERE id = 'scheduled'")
          .get(),
      ).toEqual({ status: change === 'closed' ? 'closed' : 'queued' })
    },
  )
})

describe('a week the old race left with two active rows', () => {
  // Wednesday, past last week's end and its 48 h grace.
  const AFTER_GRACE = '2026-10-14T12:00:00.000Z'

  function seedTwoActiveFromLastWeek(): void {
    const insert = sqlite.prepare(
      `INSERT INTO weeklyChallenges (id, createdAt, updatedAt, slug, title,
         description, featType, difficulty, targetItems, startsAt, endsAt,
         evergreen, status, resultsJson)
       VALUES (?, ?, ?, ?, ?, 'd', 'sustain', 'beginner', '[]',
         '2026-10-05T00:00:00.000Z', '2026-10-12T00:00:00.000Z', 1, 'active', NULL)`,
    )
    insert.run('dup-a', NOW, NOW, 'legend-0-encore-20366', 'Legend 0')
    insert.run('dup-b', NOW, NOW, 'legend-1-encore-20366', 'Legend 1')
    vi.setSystemTime(new Date(AFTER_GRACE))
  }

  function statusOf(id: string): unknown {
    return sqlite
      .prepare('SELECT status FROM weeklyChallenges WHERE id = ?')
      .get(id)
  }

  it("serves this week's queued challenge on the first load, closing both", async () => {
    seedTwoActiveFromLastWeek()
    sqlite
      .prepare(
        `INSERT INTO weeklyChallenges (id, createdAt, updatedAt, slug, title,
           description, featType, difficulty, targetItems, startsAt, endsAt, status)
         VALUES ('this-week', ?, ?, 'this-week', 'This week', 'd', 'sustain',
           'beginner', '[]', '2026-10-12T00:00:00.000Z',
           '2026-10-19T00:00:00.000Z', 'queued')`,
      )
      .run(NOW, NOW)

    const response = await active()

    expect(response.body.challenge?.id).toBe('this-week')
    expect(activeRows()).toEqual([{ id: 'this-week' }])
    expect([statusOf('dup-a'), statusOf('dup-b')]).toEqual([
      { status: 'closed' },
      { status: 'closed' },
    ])
  })

  it("serves this week's Encore on the first load, closing both", async () => {
    seedTwoActiveFromLastWeek()
    seedClosedEvergreens(1)

    const response = await active()

    const challenge = response.body.challenge
    expect(Date.parse(challenge?.endsAt ?? '')).toBeGreaterThan(
      Date.parse(AFTER_GRACE),
    )
    expect(activeRows()).toEqual([{ id: challenge?.id }])
    expect([statusOf('dup-a'), statusOf('dup-b')]).toEqual([
      { status: 'closed' },
      { status: 'closed' },
    ])
  })
})

describe('Encore fallback boundaries', () => {
  it('returns no challenge when there is no closed evergreen', async () => {
    seedQueued()

    expect(await active()).toEqual({ status: 200, body: { challenge: null } })
    expect(activeRows()).toEqual([])
  })

  it('reuses an existing active challenge without inserting or changing it', async () => {
    seedQueued(NOW)
    sqlite.exec("UPDATE weeklyChallenges SET status = 'active'")
    seedClosedEvergreens(1)
    const before = sqlite
      .prepare('SELECT * FROM weeklyChallenges ORDER BY id')
      .all()

    const response = await active()

    expect(response.status).toBe(200)
    expect(response.body.challenge?.id).toBe('scheduled')
    expect(
      sqlite.prepare('SELECT * FROM weeklyChallenges ORDER BY id').all(),
    ).toEqual(before)
  })

  it('activates a due queued row before falling back to an evergreen', async () => {
    seedClosedEvergreens(1)
    seedQueued(NOW)

    const response = await active()

    expect(response.status).toBe(200)
    expect(response.body.challenge?.id).toBe('scheduled')
    expect(activeRows()).toEqual([{ id: 'scheduled' }])
    expect(
      sqlite.prepare('SELECT COUNT(*) AS count FROM weeklyChallenges').get(),
    ).toEqual({ count: 2 })
  })

  it('does not reopen or overwrite a closed row with the generated slug', async () => {
    seedClosedEvergreens(1)
    seedQueued()
    sqlite
      .prepare(
        "UPDATE weeklyChallenges SET slug = ?, status = 'closed' WHERE id = 'scheduled'",
      )
      .run(`legend-0-encore-${Math.floor(Date.parse(NOW) / 86_400_000)}`)
    const before = sqlite
      .prepare('SELECT * FROM weeklyChallenges ORDER BY id')
      .all()

    expect(await active()).toEqual({ status: 200, body: { challenge: null } })
    expect(
      sqlite.prepare('SELECT * FROM weeklyChallenges ORDER BY id').all(),
    ).toEqual(before)
  })
})
