// ============================================================
// Badge grant engine — how many writes a pass costs
// ============================================================
//
// The engine's correctness is covered by achievement-set.test.ts. This file
// covers its COST: a pass used to PATCH every still-locked achievement, one
// serial request each, which is what made "Saving your run…" take three to
// five seconds and what tripped the worker's 120/min crud-write cap.
//
// A pass now queues rather than writes, so each case here flushes explicitly
// before counting. What is being pinned is unchanged — that an unmoved
// number costs nothing — it just costs nothing a window later.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

/** Every `update` the pass issues, as `table` names. */
const updates: string[] = []
const creates: string[] = []

vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: (table: string) => {
      const repo = adapter.getRepository(table)
      return {
        ...repo,
        findAll: repo.findAll.bind(repo),
        findById: repo.findById.bind(repo),
        create: async (data: Record<string, unknown>) => {
          creates.push(table)
          return repo.create(data)
        },
        update: async (id: string, data: Record<string, unknown>) => {
          updates.push(table)
          return repo.update(id, data)
        },
      }
    },
  }),
}))

import type { UserAchievement } from '@/db/entities'
import { checkAndGrantBadges } from '@/db/services/badge-grant-engine'
import { discardPendingGrants, flushGrants } from '@/db/services/grant-flush'
import { getUserId } from '@/db/services/user-service'

/** Three goals nothing in an empty account has moved yet. */
const LOCKED = ['Ten Days In', 'Regular', 'Thousand Notes'] as const

beforeEach(async () => {
  await adapter.destroy()
  discardPendingGrants()
  updates.length = 0
  creates.length = 0
})

async function seedLockedAchievements(): Promise<void> {
  const defs = adapter.getRepository('achievements')
  const mine = adapter.getRepository('userAchievements')
  for (const name of LOCKED) {
    const def = (await defs.create({
      name,
      description: name,
      category: 'building',
      required: 1000,
      points: 10,
      icon: 'x',
    })) as { id: string }
    // Progress the engine would compute for an account with no records:
    // 0 of 1000, still locked.
    await mine.create({
      userId: getUserId(),
      achievementId: def.id,
      progress: 0,
      unlocked: false,
    })
  }
}

describe('checkAndGrantBadges write cost', () => {
  it('writes nothing when no measure has moved', async () => {
    await seedLockedAchievements()
    updates.length = 0
    creates.length = 0

    await checkAndGrantBadges()
    await flushGrants()

    expect(updates.filter((t) => t === 'userAchievements')).toEqual([])
  })

  it('writes only the rows whose progress actually changed', async () => {
    await seedLockedAchievements()
    // One run with 600 notes moves 'Thousand Notes' to 60%. The two
    // day-count goals do move — one distinct day — but 1 of 1000 rounds
    // back to the 0% already stored, which is the case worth pinning: the
    // guard compares the STORED percent, so a measure that crept without
    // changing the number still costs nothing.
    const when = new Date().toISOString()
    await adapter.getRepository('sessionRecords').create({
      userId: getUserId(),
      melodyName: 'm',
      startedAt: when,
      endedAt: when,
      score: 50,
      accuracy: 50,
      notesHit: 600,
      notesTotal: 600,
      streak: 0,
      source: 'exercise',
      results: [],
    })
    updates.length = 0
    creates.length = 0

    await checkAndGrantBadges()
    await flushGrants()

    const rows = await adapter
      .getRepository<UserAchievement>('userAchievements')
      .findAll({})
    expect(rows.map((r) => r.progress).sort((a, b) => a - b)).toEqual([
      0, 0, 60,
    ])
    // Three goals, one moved. The point of the guard: the other two cost
    // nothing rather than a request each.
    expect(updates.filter((t) => t === 'userAchievements')).toHaveLength(1)
  })
})
