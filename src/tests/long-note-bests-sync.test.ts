// ============================================================
// Long note bests across devices — a pull keeps the better best per note
// ============================================================
//
// Review A of PR 973, m6: the bests table synced as a preference, last
// write wins, so a second device's table replaced this one's on a pull,
// and the next run below a lost best was cheered as "New best". A pull now
// merges the two tables note by note, and the account learns the result.

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
// A build with the Long note in it: a native test build.
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
import { longNoteBest, recordLongNoteBest, } from '@/features/long-note/long-note-best'
import { applyPersistedValue } from '@/lib/storage'

const KEY = 'pitchperfect_long_note_lantern_bests'

const best = (inBandSeconds: number, steadiness: number, at: number) => ({
  inBandSeconds,
  steadiness,
  at,
})

/** Wait out the un-awaited pushes the pull fires. */
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  localStorage.clear()
  state.userId = 'singer-a'
  state.rows = []
  state.updates = []
  state.creates = []
  // The device's own table, live in the bests signal as well.
  applyPersistedValue(KEY, '{}')
})

describe("pulling the Long note's bests from an account", () => {
  it('keeps the better best on each note, and the account learns it', async () => {
    // Arrange: this phone held A3 for 20 s; the account (another phone)
    // has 12 s on A3 and a C4 this phone never sang.
    applyPersistedValue(KEY, JSON.stringify({ 57: best(20, 80, 1) }))
    state.rows = [
      {
        id: 'r1',
        userId: 'u',
        key: KEY,
        value: JSON.stringify({ 57: best(12, 90, 2), 60: best(15, 70, 3) }),
      },
    ]

    // Act
    await pullCloudSettings()
    await settle()

    // Assert: both bests stand, here and on the account.
    expect(longNoteBest(57)).toEqual(best(20, 80, 1))
    expect(longNoteBest(60)).toEqual(best(15, 70, 3))
    const pushed = JSON.parse(state.updates.at(-1)?.value ?? '{}') as Record<
      string,
      unknown
    >
    expect(pushed).toEqual({ 57: best(20, 80, 1), 60: best(15, 70, 3) })
  })

  it('cheers no "New best" for a run below a best this phone already had', async () => {
    applyPersistedValue(KEY, JSON.stringify({ 57: best(20, 80, 1) }))
    state.rows = [
      {
        id: 'r1',
        userId: 'u',
        key: KEY,
        value: JSON.stringify({ 57: best(12, 90, 2) }),
      },
    ]
    await pullCloudSettings()
    await settle()

    expect(recordLongNoteBest(57, best(15, 99, 4)).improved).toBe(false)
    expect(longNoteBest(57)).toEqual(best(20, 80, 1))
  })

  it("takes the account's better best, and leaves the account alone", async () => {
    applyPersistedValue(KEY, JSON.stringify({ 57: best(8, 80, 1) }))
    const cloud = JSON.stringify({ 57: best(30, 85, 2) })
    state.rows = [{ id: 'r1', userId: 'u', key: KEY, value: cloud }]

    await pullCloudSettings()
    await settle()

    expect(longNoteBest(57)).toEqual(best(30, 85, 2))
    expect(state.updates).toEqual([])
  })

  it('gives way to the side that still reads when the other is damaged', async () => {
    applyPersistedValue(KEY, JSON.stringify({ 57: best(20, 80, 1) }))
    state.rows = [
      { id: 'r1', userId: 'u', key: KEY, value: '{"57":{"at":"x"}' },
    ]

    await pullCloudSettings()
    await settle()

    expect(longNoteBest(57)).toEqual(best(20, 80, 1))
    expect(JSON.parse(state.updates.at(-1)?.value ?? 'null')).toEqual({
      57: best(20, 80, 1),
    })
  })

  it("never folds another singer's bests into this account", async () => {
    // A shared phone: the last singer's account owns the device's copy.
    localStorage.setItem('mp_sync_owner', 'singer-b')
    applyPersistedValue(KEY, JSON.stringify({ 57: best(40, 95, 1) }))
    const cloud = JSON.stringify({ 57: best(9, 70, 2) })
    state.rows = [{ id: 'r1', userId: 'u', key: KEY, value: cloud }]

    await pullCloudSettings()
    await settle()

    expect(longNoteBest(57)).toEqual(best(9, 70, 2))
    expect(state.updates).toEqual([])
  })
})
