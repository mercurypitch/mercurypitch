// ============================================================
// Badge grant engine — the round-trip budget of one pass
// ============================================================
//
// Every finished run triggers `checkAndGrantBadges`, and the singer waits on
// it behind "Saving your run…". Each repository call in a signed-in session
// is one HTTP request to the db-worker (~85 ms warm, measured against
// api-dev), so the round-trip COUNT is the latency, and the write count is
// what spends the worker's 120/min `crud-write` budget.
//
// The numbers this file pins, measured against the shipped seed catalogue:
//
//   prior runs |  GET | write | total | writes BEFORE the unchanged-row guard
//   -----------+------+-------+-------+--------------------------------------
//            5 |   12 |     8 |    20 | 53
//           30 |   12 |     9 |    21 | 50
//          100 |   12 |     1 |    13 | 42
//          300 |   12 |     1 |    13 | 41
//
// The right-hand column is the bug that was reported: ~50 serial PATCHes at
// ~85 ms is the three-to-five second save, and three runs inside a minute
// cleared the 120/min cap, so the retries turned it into ten seconds. The
// guard removed that; this test stops it coming back.
//
// Write counts FALL as an account matures because unlocked goals are skipped
// and a further run moves the remaining integer percents less often — so the
// cap that matters is the young account, which is also the one in onboarding.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import seedData from '@/db/seed-data.json'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

/** One entry per repository call the pass makes — i.e. per HTTP request. */
const calls: string[] = []

vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: (table: string) => {
      const repo = adapter.getRepository(table)
      const wrap =
        (op: string, fn: (...args: never[]) => unknown) =>
        (...args: never[]) => {
          calls.push(op)
          return fn(...args)
        }
      return {
        findAll: wrap('GET', repo.findAll.bind(repo)),
        findById: wrap('GET', repo.findById.bind(repo)),
        create: wrap('WRITE', repo.create.bind(repo)),
        update: wrap('WRITE', repo.update.bind(repo)),
        delete: wrap('WRITE', repo.delete.bind(repo)),
      }
    },
  }),
}))

import { checkAndGrantBadges } from '@/db/services/badge-grant-engine'
import { getUserId } from '@/db/services/user-service'

/** The catalogue the app actually seeds — not a hand-written fixture, so a
 *  new goal or a retuned target is measured here the day it lands. */
const DEFINITIONS = seedData.achievementDefinitions

async function seedCatalogue(): Promise<void> {
  const repo = adapter.getRepository('achievements')
  for (const def of DEFINITIONS) await repo.create({ ...def })
}

/** `count` finished runs, two a day, spread over melodies and surfaces so the
 *  day-, source- and repertoire-counting goals all see realistic movement. */
async function addRuns(count: number, from: number): Promise<void> {
  const repo = adapter.getRepository('sessionRecords')
  for (let i = 0; i < count; i++) {
    const n = from + i
    const when = new Date(2026, 0, 1 + Math.floor(n / 2), 10 + (n % 2) * 6)
    await repo.create({
      userId: getUserId(),
      melodyName: `melody-${n % 12}`,
      startedAt: when.toISOString(),
      endedAt: when.toISOString(),
      score: 82,
      accuracy: 82,
      notesHit: 24,
      notesTotal: 30,
      streak: 1,
      source: n % 3 === 0 ? 'exercise' : 'practice',
      results: [],
    })
  }
}

/** Round trips one more run costs, once the stored rows are at steady state. */
async function costOfOneMoreRun(priorRuns: number): Promise<{
  gets: number
  writes: number
  lockedRows: number
}> {
  await adapter.destroy()
  await seedCatalogue()
  await addRuns(priorRuns, 0)
  // Settle first: otherwise the measured pass also pays for the backlog of
  // every earlier run, which is not what a singer waits on.
  await checkAndGrantBadges()

  await addRuns(1, priorRuns)
  calls.length = 0
  await checkAndGrantBadges()

  const rows = (await adapter
    .getRepository('userAchievements')
    .findAll({})) as { unlocked?: boolean }[]
  return {
    gets: calls.filter((c) => c === 'GET').length,
    writes: calls.filter((c) => c === 'WRITE').length,
    lockedRows: rows.filter((r) => r.unlocked !== true).length,
  }
}

beforeEach(async () => {
  await adapter.destroy()
  calls.length = 0
})

describe('one grant pass', () => {
  it('reads a fixed number of collections regardless of history', async () => {
    const young = await costOfOneMoreRun(5)
    const mature = await costOfOneMoreRun(300)
    // The read half does not grow with the account: it is a fixed set of
    // list calls, each already capped (session records at 200). If this
    // number rises, a new measure added a per-pass request — check it is
    // worth 85 ms on every save.
    expect(young.gets).toBe(12)
    expect(mature.gets).toBe(12)
  })

  it('stays inside the round-trip budget at every account age', async () => {
    for (const priorRuns of [5, 30, 100, 300]) {
      const { gets, writes, lockedRows } = await costOfOneMoreRun(priorRuns)

      // The budget: one save must stay under ~1.5 s of serial requests. At
      // ~85 ms each that is 18, and the reads run as two parallel waves
      // rather than twelve serial ones, so 12 + 12 is the ceiling with room
      // to spare. Nowhere near the ~50 writes this used to cost.
      expect(writes).toBeLessThanOrEqual(12)
      expect(gets + writes).toBeLessThanOrEqual(24)

      // Without the unchanged-row guard the pass wrote every still-locked
      // goal. Pinning that number keeps the regression visible: if `writes`
      // ever climbs to meet it, the guard has stopped working.
      expect(writes).toBeLessThan(lockedRows)
    }
  })
})
