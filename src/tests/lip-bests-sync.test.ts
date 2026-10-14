// ============================================================
// Lip roll bests across devices: a pull keeps the better best per level
// ============================================================
//
// Lip roll's bests table syncs as a preference, like Echo's. Last write
// wins would let a second phone's table replace this one's on a pull, and
// the next run below a lost best would be cheered as "New best". A pull
// merges the two tables level by level instead (mergeLipBestsOnPull), and
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
// A build with Lip roll in it: a native test build.
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  PREMIUM_EXERCISES: true,
}))
vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => true,
  hasUpgradedAccount: () => true,
  storedTokenProvider: () => 'password',
  isRegisteredProvider: () => true,
  currentAccountId: () => state.userId,
}))
vi.mock('@/db/services/user-service', () => ({
  authVersion: () => 0,
  getUserId: () => state.userId,
  getAuthToken: () => state.userId,
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
import { LIP_BESTS_KEY } from '@/lib/glide/lip-bests'
import { applyPersistedValue } from '@/lib/storage'
import { lipBest, recordLipBest, resetLipStoreForTests, } from '@/stores/lip-roll-store'

const best = (lit: number, jumps: number, at: number) => ({
  lit,
  arches: 3,
  jumps,
  at,
})

/** Wait out the un-awaited pushes the pull fires. */
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  localStorage.clear()
  resetLipStoreForTests()
  state.userId = 'singer-a'
  state.rows = []
  state.updates = []
  state.creates = []
  applyPersistedValue(LIP_BESTS_KEY, '{}')
})

describe("pulling Lip roll's bests from an account", () => {
  it('keeps the better best at each level, and the account learns it', async () => {
    // Arrange: this phone lit 84% at Singer; the account (another phone)
    // has 70% there and a Learning run this phone never sang.
    applyPersistedValue(
      LIP_BESTS_KEY,
      JSON.stringify({ singer: best(84, 1, 1) }),
    )
    state.rows = [
      {
        id: 'r1',
        userId: 'u',
        key: LIP_BESTS_KEY,
        value: JSON.stringify({
          singer: best(70, 0, 2),
          learning: best(91, 0, 3),
        }),
      },
    ]

    // Act
    await pullCloudSettings()
    await settle()

    // Assert: both bests stand, here and on the account.
    expect(lipBest('singer')).toEqual(best(84, 1, 1))
    expect(lipBest('learning')).toEqual(best(91, 0, 3))
    const pushed = JSON.parse(state.updates.at(-1)?.value ?? '{}') as Record<
      string,
      unknown
    >
    expect(pushed).toEqual({ singer: best(84, 1, 1), learning: best(91, 0, 3) })
  })

  it('cheers no "New best" for a run below a best this phone already had', async () => {
    applyPersistedValue(
      LIP_BESTS_KEY,
      JSON.stringify({ singer: best(84, 1, 1) }),
    )
    state.rows = [
      {
        id: 'r1',
        userId: 'u',
        key: LIP_BESTS_KEY,
        value: JSON.stringify({ singer: best(60, 0, 2) }),
      },
    ]
    await pullCloudSettings()
    await settle()

    expect(recordLipBest('singer', best(80, 0, 4)).improved).toBe(false)
    expect(lipBest('singer')).toEqual(best(84, 1, 1))
  })

  it("takes the account's better best, and leaves the account alone", async () => {
    applyPersistedValue(
      LIP_BESTS_KEY,
      JSON.stringify({ professional: best(40, 3, 1) }),
    )
    const cloud = JSON.stringify({ professional: best(77, 1, 2) })
    state.rows = [{ id: 'r1', userId: 'u', key: LIP_BESTS_KEY, value: cloud }]

    await pullCloudSettings()
    await settle()

    expect(lipBest('professional')).toEqual(best(77, 1, 2))
    expect(state.updates).toEqual([])
  })
})
