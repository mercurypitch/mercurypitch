// ============================================================
// Grant flush, signed out — a retried batch writes each badge once
// ============================================================
//
// A flush that fails part-way puts its whole batch back on the queue, and the
// next window sends it again. The cloud endpoints are upserts, so that is
// safe there (src/tests/grant-flush.test.ts). This is the other branch: a
// signed-out or local-only session writes through the repository, where a
// second create is a second row, and a badge shows twice in the collection
// and counts twice toward every goal that counts badges.
//
// The store is the in-memory adapter, with one create that fails the way a
// Dexie transaction abort or a full quota does.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserBadge } from '@/db/entities'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'

const adapter = new InMemoryAdapter()
/** Badge ids whose next create throws, once each. */
const failNextCreate = new Set<string>()

vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: (table: string) => {
      const repo = adapter.getRepository(table)
      if (table !== 'userBadges') return repo
      return {
        findAll: repo.findAll.bind(repo),
        create: async (row: { badgeId: string }) => {
          if (failNextCreate.delete(row.badgeId)) {
            throw new Error('Transaction aborted')
          }
          return repo.create(row as never)
        },
      }
    },
  }),
}))

import { discardPendingGrants, flushGrants, pendingCount, queueBadge, } from './grant-flush'

const EARNED = '2026-11-03T10:00:00.000Z'

async function badgeIdsHeld(): Promise<string[]> {
  const rows = await adapter.getRepository<UserBadge>('userBadges').findAll()
  return rows.map((row) => row.badgeId).sort()
}

beforeEach(async () => {
  discardPendingGrants()
  failNextCreate.clear()
  const repo = adapter.getRepository('userBadges')
  for (const row of await repo.findAll()) await repo.delete(row.id)
})

afterEach(() => {
  discardPendingGrants()
})

describe('flushGrants without the cloud', () => {
  it('writes each badge once when a batch that failed part-way is sent again', async () => {
    queueBadge('first-note', EARNED)
    queueBadge('warm-week', EARNED)
    queueBadge('high-c', EARNED)
    failNextCreate.add('high-c')

    await flushGrants()
    // The failure put all three back, including the two that landed.
    expect(pendingCount()).toBe(3)
    await flushGrants()

    expect(await badgeIdsHeld()).toEqual(['first-note', 'high-c', 'warm-week'])
    expect(pendingCount()).toBe(0)
  })
})
