// ============================================================
// Echo bests across devices: a pull keeps the better best per level
// ============================================================
//
// Echo's bests table syncs as a preference, like Long note's. Last write
// wins would let a second phone's table replace this one's on a pull, and
// the next run below a lost best would be cheered as "New best". A pull
// merges the two tables level by level instead (mergeEchoBestsOnPull), and
// the account learns the result.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  userId: 'singer-a',
  rows: [] as Array<{ id: string; userId: string; key: string; value: string }>,
  updates: [] as Array<{ id: string; value: string }>,
  creates: [] as Array<{ key: string; value: string }>,
}))

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  API_BASE_URL: 'https://api.test',
}))
// A build with Echo in it: a native test build.
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  PREMIUM_EXERCISES: true,
}))
vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => true,
  hasUpgradedAccount: () => true,
}))
vi.mock('@/db/services/user-service', () => ({
  authVersion: () => 0,
  getUserId: () => state.userId,
  getDeviceId: () => 'device-1',
}))
vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      findAll: async (opts?: { where?: { key?: string } }) =>
        state.rows.filter(
          (r) => opts?.where?.key === undefined || r.key === opts.where.key,
        ),
      update: async (id: string, patch: { value: string }) => {
        state.updates.push({ id, value: patch.value })
        const row = state.rows.find((r) => r.id === id)
        if (row !== undefined) row.value = patch.value
      },
      create: async (row: { key: string; value: string }) => {
        state.creates.push({ key: row.key, value: row.value })
        const created = { ...row, userId: '', id: `srv-${state.rows.length}` }
        state.rows.push(created)
        return created
      },
    }),
  }),
}))

import { pullCloudSettings } from '@/db/services/settings-service'
import { ECHO_BESTS_KEY } from '@/lib/sequence/echo-bests'
import { applyPersistedValue } from '@/lib/storage'
import { echoBest, recordEchoBest, resetEchoStoreForTests, } from '@/stores/echo-store'

const best = (landed: number, notes: number, accuracy: number, at: number) => ({
  landed,
  notes,
  accuracy,
  at,
})

/** Wait out the un-awaited pushes the pull fires. */
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  localStorage.clear()
  resetEchoStoreForTests()
  state.userId = 'singer-a'
  state.rows = []
  state.updates = []
  state.creates = []
  applyPersistedValue(ECHO_BESTS_KEY, '{}')
})

describe("pulling Echo's bests from an account", () => {
  it('keeps the better best at each level, and the account learns it', async () => {
    // Arrange: this phone landed 18 of 20 at Singer; the account (another
    // phone) has 15 of 20 there and a Learning run this phone never sang.
    applyPersistedValue(
      ECHO_BESTS_KEY,
      JSON.stringify({ singer: best(18, 20, 80, 1) }),
    )
    state.rows = [
      {
        id: 'r1',
        userId: 'u',
        key: ECHO_BESTS_KEY,
        value: JSON.stringify({
          singer: best(15, 20, 90, 2),
          learning: best(14, 15, 70, 3),
        }),
      },
    ]

    // Act
    await pullCloudSettings()
    await settle()

    // Assert: both bests stand, here and on the account.
    expect(echoBest('singer')).toEqual(best(18, 20, 80, 1))
    expect(echoBest('learning')).toEqual(best(14, 15, 70, 3))
    const pushed = JSON.parse(state.updates.at(-1)?.value ?? '{}') as Record<
      string,
      unknown
    >
    expect(pushed).toEqual({
      singer: best(18, 20, 80, 1),
      learning: best(14, 15, 70, 3),
    })
  })

  it('cheers no "New best" for a run below a best this phone already had', async () => {
    applyPersistedValue(
      ECHO_BESTS_KEY,
      JSON.stringify({ singer: best(18, 20, 80, 1) }),
    )
    state.rows = [
      {
        id: 'r1',
        userId: 'u',
        key: ECHO_BESTS_KEY,
        value: JSON.stringify({ singer: best(12, 20, 95, 2) }),
      },
    ]
    await pullCloudSettings()
    await settle()

    expect(recordEchoBest('singer', best(16, 20, 99, 4)).improved).toBe(false)
    expect(echoBest('singer')).toEqual(best(18, 20, 80, 1))
  })

  it("takes the account's better best, and leaves the account alone", async () => {
    applyPersistedValue(
      ECHO_BESTS_KEY,
      JSON.stringify({ professional: best(9, 25, 60, 1) }),
    )
    const cloud = JSON.stringify({ professional: best(21, 25, 85, 2) })
    state.rows = [{ id: 'r1', userId: 'u', key: ECHO_BESTS_KEY, value: cloud }]

    await pullCloudSettings()
    await settle()

    expect(echoBest('professional')).toEqual(best(21, 25, 85, 2))
    expect(state.updates).toEqual([])
  })

  it("never folds another singer's bests into this account", async () => {
    // A shared phone: the last singer's account owns the device's copy.
    localStorage.setItem('mp_sync_owner', 'singer-b')
    applyPersistedValue(
      ECHO_BESTS_KEY,
      JSON.stringify({ singer: best(20, 20, 95, 1) }),
    )
    const cloud = JSON.stringify({ singer: best(9, 20, 70, 2) })
    state.rows = [{ id: 'r1', userId: 'u', key: ECHO_BESTS_KEY, value: cloud }]

    await pullCloudSettings()
    await settle()

    expect(echoBest('singer')).toEqual(best(9, 20, 70, 2))
    expect(state.updates).toEqual([])
  })
})
