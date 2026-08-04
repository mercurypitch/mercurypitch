// ============================================================
// Badge grant engine — the round-trip budget of one pass
// ============================================================
//
// Every finished run triggers `checkAndGrantBadges`, and the singer used to
// wait on it behind "Saving your run…". Each repository call in a signed-in
// session is one HTTP request to the db-worker (~85 ms warm, measured against
// api-dev), so the round-trip COUNT is the latency.
//
// Where this started, measured against the shipped seed catalogue:
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
// cleared the 120/min cap, so the retries turned it into ten seconds.
//
// Two things changed since. Writes left the save path entirely — the pass
// evaluates in memory and queues, and `flushGrants` writes a window later, so
// the numbers this file now pins are **zero writes per pass**. And the reads
// collapsed to one request when signed in to the cloud; what is measured here
// is the piecemeal fallback, which is the path a local (IndexedDB) session
// and an unreachable worker both take, and therefore the expensive one.

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
        count: wrap('GET', repo.count.bind(repo)),
        create: wrap('WRITE', repo.create.bind(repo)),
        update: wrap('WRITE', repo.update.bind(repo)),
        delete: wrap('WRITE', repo.delete.bind(repo)),
      }
    },
  }),
}))

import { checkAndGrantBadges } from '@/db/services/badge-grant-engine'
import { discardPendingGrants, flushGrants, pendingCount, } from '@/db/services/grant-flush'
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

interface PassCost {
  gets: number
  writes: number
  queued: number
  storedRows: number
  lockedRows: number
}

/** Round trips one more run costs, once the stored rows are at steady state. */
async function costOfOneMoreRun(priorRuns: number): Promise<PassCost> {
  await adapter.destroy()
  discardPendingGrants()
  await seedCatalogue()
  await addRuns(priorRuns, 0)
  // Settle first: otherwise the measured pass also pays for the backlog of
  // every earlier run, which is not what a singer waits on.
  await checkAndGrantBadges()
  await flushGrants()

  await addRuns(1, priorRuns)
  calls.length = 0
  await checkAndGrantBadges()
  const queued = pendingCount()

  const rows = (await adapter
    .getRepository('userAchievements')
    .findAll({})) as { unlocked?: boolean }[]
  return {
    gets: calls.filter((c) => c === 'GET').length,
    writes: calls.filter((c) => c === 'WRITE').length,
    queued,
    storedRows: rows.length,
    lockedRows: rows.filter((r) => r.unlocked !== true).length,
  }
}

beforeEach(async () => {
  await adapter.destroy()
  discardPendingGrants()
  calls.length = 0
})

describe('one grant pass', () => {
  it('reads a fixed number of collections regardless of history', async () => {
    const young = await costOfOneMoreRun(5)
    const mature = await costOfOneMoreRun(300)
    // The read half does not grow with the account: it is a fixed set of
    // list calls, each already capped (session records at 200). If this
    // number rises, a new measure added a per-pass request — check it is
    // worth 85 ms on every save. Signed in to the cloud this whole set is
    // one request; twelve is what the fallback path costs.
    expect(young.gets).toBe(12)
    expect(mature.gets).toBe(12)
  })

  it('writes nothing on the save path, at every account age', async () => {
    for (const priorRuns of [5, 30, 100, 300]) {
      const { gets, writes, storedRows, lockedRows } =
        await costOfOneMoreRun(priorRuns)

      // The whole point of the split: finishing a run no longer waits on a
      // single achievement write. If this is ever non-zero, persistence has
      // crept back onto the critical path.
      expect(writes).toBe(0)
      expect(gets + writes).toBeLessThanOrEqual(13)

      // A pass that quietly stopped evaluating would also write nothing, so
      // pin that it produced rows and that some goals are still ahead of the
      // singer — otherwise this test passes for the wrong reason.
      //
      // Not the whole catalogue: a goal sitting at 0% gets no row at all,
      // because "0%, locked" and "no row" say the same thing and only one of
      // them costs a write. And on a mature account most rows are unlocked,
      // so `lockedRows` falls as the history grows.
      expect(storedRows).toBeGreaterThan(DEFINITIONS.length / 4)
      expect(lockedRows).toBeGreaterThan(0)
    }
  })

  it('queues only the rows whose numbers moved', async () => {
    for (const priorRuns of [5, 30, 100, 300]) {
      const { queued, lockedRows } = await costOfOneMoreRun(priorRuns)

      // Before the unchanged-row guard every still-locked goal was written
      // on every pass — 47 of 63 on a real account. Pinning that number
      // keeps the regression visible: if `queued` ever climbs to meet
      // `lockedRows`, the guard has stopped working.
      expect(queued).toBeLessThanOrEqual(12)
      expect(queued).toBeLessThan(lockedRows)
    }
  })

  it('writes nothing at all when it can see nothing at all', async () => {
    // The dangerous pass: everything under `loadGrantContext` answers a
    // failure with `[]`, so a pass that fires while the API is unreachable
    // evaluates against an empty history and concludes the singer has done
    // nothing. It must not turn that into 59 rows of "0%, locked" — a minute
    // later the flush lands on a healthy API and those rows are what it
    // writes over goals they earned weeks ago.
    await seedCatalogue()
    calls.length = 0

    await checkAndGrantBadges()

    expect(pendingCount()).toBe(0)
  })

  it('coalesces a burst of runs into one flush', async () => {
    await seedCatalogue()
    await addRuns(5, 0)
    await checkAndGrantBadges()
    await flushGrants()

    // Three runs inside one window — the case that used to clear the 120/min
    // write cap and collect 429s.
    calls.length = 0
    for (let i = 0; i < 3; i++) {
      await addRuns(1, 5 + i)
      await checkAndGrantBadges()
    }
    expect(calls.filter((c) => c === 'WRITE')).toHaveLength(0)

    const queuedBeforeFlush = pendingCount()
    await flushGrants()
    const writes = calls.filter((c) => c === 'WRITE').length

    // One flush, and it writes each changed row once — not once per run.
    // (The cloud path collapses these into a single bulk request; the local
    // path below is per-row, which is where the coalescing shows up.)
    expect(writes).toBeGreaterThan(0)
    expect(writes).toBeLessThanOrEqual(queuedBeforeFlush)
    expect(pendingCount()).toBe(0)
  })
})
