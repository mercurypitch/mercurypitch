// ============================================================
// The Ear rooms' bests across devices: a pull keeps the better best
// ============================================================
//
// Home note's, First note's, Leap's and Harmony's bests sync as Echo's do
// (echo-bests-sync.test.ts): a pull merges the device's table and the
// account's level by level, and the account learns the result. A phone
// that kept its bests before they synced (the old `mp_` key) brings them
// along, and the account learns those too.

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
// A build with the Ear rooms in it: a native test build.
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

import { MERGE_DEFAULTS, MERGE_ON_PULL } from '@/db/services/settings-progress'
import { initSettingsSync, pullCloudSettings, } from '@/db/services/settings-service'
import { EAR_ROOM_BESTS, HOME_NOTE_BESTS_KEY, LEAP_BESTS_KEY, } from '@/lib/ear-room-bests'
import { applyPersistedValue } from '@/lib/storage'
import { homeNoteBest, recordHomeNoteBest, resetHomeNoteStoreForTests, } from '@/stores/home-note-store'
import { leapBest, resetLeapStoreForTests } from '@/stores/leap-store'

const home = (found: number, seconds: number, at: number) => ({
  found,
  rounds: 6,
  seconds,
  at,
})
const leap = (landed: number, seconds: number, at: number) => ({
  landed,
  rounds: 8,
  seconds,
  at,
})

/** Wait out the un-awaited pushes the pull fires. */
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  localStorage.clear()
  resetHomeNoteStoreForTests()
  resetLeapStoreForTests()
  state.userId = 'singer-a'
  state.rows = []
  state.updates = []
  state.creates = []
  applyPersistedValue(HOME_NOTE_BESTS_KEY, '{}')
  applyPersistedValue(LEAP_BESTS_KEY, '{}')
})

describe("pulling the Ear rooms' bests from an account", () => {
  it('names every Ear room in the pull, merged rather than overwritten', () => {
    for (const { key, merge } of EAR_ROOM_BESTS) {
      expect(MERGE_ON_PULL[key]).toBe(merge)
      expect(MERGE_DEFAULTS[key]).toBe('{}')
    }
  })

  it('keeps the better best at each level, and the account learns it', async () => {
    // This phone found 5 of 6 at Singer; the account (another phone) has 4
    // there, and a Learning run this phone never sang.
    applyPersistedValue(
      HOME_NOTE_BESTS_KEY,
      JSON.stringify({ singer: home(5, 2, 1) }),
    )
    state.rows = [
      {
        id: 'r1',
        userId: 'u',
        key: HOME_NOTE_BESTS_KEY,
        value: JSON.stringify({
          singer: home(4, 1, 2),
          learning: home(6, 1.5, 3),
        }),
      },
    ]

    await pullCloudSettings()
    await settle()

    expect(homeNoteBest('singer')).toEqual(home(5, 2, 1))
    expect(homeNoteBest('learning')).toEqual(home(6, 1.5, 3))
    const pushed = JSON.parse(state.updates.at(-1)?.value ?? '{}') as Record<
      string,
      unknown
    >
    expect(pushed).toEqual({
      singer: home(5, 2, 1),
      learning: home(6, 1.5, 3),
    })
  })

  it('cheers no "New best" for a run below a best the account already had', async () => {
    const cloud = JSON.stringify({ singer: home(6, 1, 2) })
    state.rows = [
      { id: 'r1', userId: 'u', key: HOME_NOTE_BESTS_KEY, value: cloud },
    ]
    await pullCloudSettings()
    await settle()

    expect(recordHomeNoteBest('singer', home(5, 0.5, 4)).improved).toBe(false)
    expect(homeNoteBest('singer')).toEqual(home(6, 1, 2))
  })

  // Last: it installs the app's write-through, which stays for the file.
  it("brings a phone's bests from before the sync, and the account learns them", async () => {
    // The app's write-through: a write reaches the account once its
    // debounce (PUSH_DEBOUNCE_MS, 1.5 s) has passed.
    initSettingsSync()
    // The account has a Leap best at Learning; this phone kept a better
    // one at Singer under the old key, before the bests synced.
    state.rows = [
      {
        id: 'r1',
        userId: 'u',
        key: LEAP_BESTS_KEY,
        value: JSON.stringify({ learning: leap(5, 1.4, 2) }),
      },
    ]
    localStorage.setItem(
      'mp_leap_bests',
      JSON.stringify({ singer: leap(7, 1.1, 1) }),
    )

    await pullCloudSettings()
    await settle()
    // The room's first read adopts the old table into the synced one.
    expect(leapBest('singer')).toEqual(leap(7, 1.1, 1))
    expect(leapBest('learning')).toEqual(leap(5, 1.4, 2))
    await new Promise((resolve) => setTimeout(resolve, 1700))
    await settle()

    expect(localStorage.getItem('mp_leap_bests')).toBeNull()
    const pushed = JSON.parse(state.updates.at(-1)?.value ?? '{}') as Record<
      string,
      unknown
    >
    expect(pushed).toEqual({
      singer: leap(7, 1.1, 1),
      learning: leap(5, 1.4, 2),
    })
  })
})
