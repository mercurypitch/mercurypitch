// ============================================================
// The days warmed up across devices: a pull keeps the days from both
// ============================================================
//
// The Warm-up's days follow the account (N5): a second phone shows "Warmed
// up today" and the week's dots for a day sung on the first. Last write
// wins would let one phone's list replace the other's on a pull, and a day
// someone warmed up would vanish from the week. A pull merges the two
// lists as a union instead (mergeWarmUpDaysOnPull), and the account learns
// the result.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
// A build with the Warm-up in it: a native test build.
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
import { resetWarmUpForTests, warmedUpToday, warmUpDays, warmUpWeek, } from '@/features/warm-up/warm-up-store'
import { applyPersistedValue } from '@/lib/storage'
import { WARM_UP_DAYS_KEY } from '@/lib/warm-up-days'

/** Wait out the un-awaited pushes the pull fires. */
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  // Wednesday 21 Oct 2026.
  vi.setSystemTime(new Date(2026, 9, 21, 9, 0))
  localStorage.clear()
  resetWarmUpForTests()
  state.userId = 'singer-a'
  state.rows = []
  state.updates = []
  state.creates = []
  applyPersistedValue(WARM_UP_DAYS_KEY, '[]')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('pulling the days warmed up from an account', () => {
  it('keeps the days from both devices, and the account learns them', async () => {
    // Arrange: this phone warmed up on Monday; the account (the tablet)
    // has Tuesday and an older day this phone never saw.
    expect(warmUpDays()).toEqual([])
    applyPersistedValue(WARM_UP_DAYS_KEY, JSON.stringify(['2026-10-19']))
    state.rows = [
      {
        id: 'r1',
        userId: 'u',
        key: WARM_UP_DAYS_KEY,
        value: JSON.stringify(['2026-10-01', '2026-10-20']),
      },
    ]

    // Act
    await pullCloudSettings()
    await settle()

    // Assert: every day stands, here and on the account.
    const union = ['2026-10-01', '2026-10-19', '2026-10-20']
    expect(warmUpDays()).toEqual(union)
    expect(JSON.parse(state.updates.at(-1)?.value ?? '[]')).toEqual(union)
    // This week's dots: Monday and Tuesday filled, Wednesday (today) ringed.
    expect(
      warmUpWeek()?.map((dot) => (dot.warmed ? 'x' : dot.today ? 'o' : '.')),
    ).toEqual(['x', 'x', 'o', '.', '.', '.', '.'])
  })

  it("says Warmed up today for the other device's run, and leaves the account alone", async () => {
    expect(warmedUpToday()).toBe(false)
    const cloud = JSON.stringify(['2026-10-21'])
    state.rows = [
      { id: 'r1', userId: 'u', key: WARM_UP_DAYS_KEY, value: cloud },
    ]

    await pullCloudSettings()
    await settle()

    expect(warmedUpToday()).toBe(true)
    expect(state.updates).toEqual([])
  })
})
