// ============================================================
// Settings on a shared device — an unsent run never undoes another device
// ============================================================
//
// Singer A practised on this device, then singer B signs in. B's account has
// an Ascent row but no Long note row yet. B's first Long note row then
// appears, made either by a run here or by B's phone, while this device holds
// a run it could not send. The next pull has to merge that run with B's row.
// An earlier version of #999 uploaded the device's stale table over it
// instead, and the best B set on the other device was gone from both sides.
//
// The same pulls must not put A's bests into B's account, and A's copy has to
// be A's again when A signs back in.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { id: string; userId: string; key: string; value: string }
const state = vi.hoisted(() => ({
  userId: 'device',
  deviceId: 'device',
  provider: null as string | null,
  valid: false,
  version: 0,
  token: null as string | null,
  rows: [] as Row[],
  failRead: false,
  failWrite: false,
}))
vi.mock('@/lib/defaults', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  API_BASE_URL: 'https://api.test',
}))
vi.mock('@/lib/native-build', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  PREMIUM_EXERCISES: true,
}))
vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => state.valid,
  hasUpgradedAccount: () => state.valid && state.provider === 'password',
  storedTokenProvider: () => state.provider,
  isRegisteredProvider: (provider: string | null | undefined) =>
    provider != null && provider !== 'anonymous',
  currentAccountId: () => (state.token === null ? null : state.userId),
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => state.userId,
  getDeviceId: () => state.deviceId,
  authVersion: () => state.version,
  getAuthToken: () => state.token,
}))
// The account answers each singer with their own rows only, as the worker
// does. Offline, a read that may not fail quietly throws; others come back
// empty, which is what the adapters do.
vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      findAll: async (options?: {
        where?: { key?: string }
        throwOnError?: boolean
      }) => {
        if (state.failRead) {
          if (options?.throwOnError === true) throw new Error('offline read')
          return []
        }
        return state.rows
          .filter(
            (row) =>
              row.userId === state.userId &&
              (options?.where?.key === undefined ||
                row.key === options.where.key),
          )
          .map((row) => ({ ...row }))
      },
      update: async (id: string, patch: { value: string }) => {
        if (state.failWrite) throw new Error('offline write')
        const row = state.rows.find(
          (candidate) =>
            candidate.id === id && candidate.userId === state.userId,
        )
        if (row === undefined) throw new Error('foreign row')
        row.value = patch.value
      },
      create: async (input: { key: string; value: string }) => {
        if (state.failWrite) throw new Error('offline write')
        const row = {
          ...input,
          userId: state.userId,
          id: `row-${state.rows.length}`,
        }
        state.rows.push(row)
        return row
      },
    }),
  }),
}))

const PATH = 'mp_path_progress'
const BESTS = 'pitchperfect_long_note_lantern_bests'
const best = (seconds: number) => ({
  inBandSeconds: seconds,
  steadiness: 90,
  at: 1,
})
const climb = (days: string[]) => ({
  pathId: 'ascent',
  startedAt: '2026-08-01T00:00:00.000Z',
  currentWeek: 1,
  weekDays: { 1: days },
  completedWeeks: [],
})

/** The device as A left it, and B's account before B's first Long note row. */
function deviceUsedByA(): void {
  localStorage.setItem(PATH, JSON.stringify(climb(['a-day'])))
  localStorage.setItem(BESTS, JSON.stringify({ 60: best(3) }))
  localStorage.setItem('mp_sync_owner', 'a')
  state.rows.push({
    id: 'b-ascent',
    userId: 'b',
    key: PATH,
    value: JSON.stringify(climb(['b-day'])),
  })
}

function signIn(owner: string): void {
  state.userId = owner
  state.version += 1
  state.token = `${owner}:${state.version}`
  state.provider = 'password'
  state.valid = true
}

function cloudBests(owner: string): unknown {
  const row = state.rows.find((r) => r.userId === owner && r.key === BESTS)
  return row === undefined ? undefined : JSON.parse(row.value)
}

const OFFLINE = ['writes', 'reads and writes'] as const

function goOffline(failing: (typeof OFFLINE)[number]): void {
  state.failWrite = true
  state.failRead = failing === 'reads and writes'
}

function goOnline(): void {
  state.failWrite = false
  state.failRead = false
}

const settle = async () => {
  await vi.advanceTimersByTimeAsync(0)
}
/** Past the push debounce, so a run's write-through has been attempted. */
const flush = async () => {
  await vi.advanceTimersByTimeAsync(1500)
  await settle()
}

let dispose: (() => void) | undefined

/** Boots signed out, as the device stood when B picked it up. */
async function boot() {
  const sync = await import('./settings-service')
  const notes = await import('@/features/long-note/long-note-best')
  createRoot((cleanup) => {
    dispose = cleanup
    sync.initSettingsSync()
  })
  await settle()
  signIn('b')
  await sync.pullCloudSettings()
  await settle()
  return { ...sync, ...notes }
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  localStorage.clear()
  Object.assign(state, {
    userId: 'device',
    deviceId: 'device',
    provider: null,
    valid: false,
    version: 0,
    token: null,
    rows: [],
    failRead: false,
    failWrite: false,
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(async () => {
  dispose?.()
  dispose = undefined
  await settle()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('B on a device A used before', () => {
  it.each(OFFLINE)(
    'keeps the best B set on another device when a run here went unsent (offline %s)',
    async (offline) => {
      deviceUsedByA()
      const app = await boot()
      app.recordLongNoteBest(62, best(5))
      await flush()
      const row = state.rows.find((r) => r.userId === 'b' && r.key === BESTS)!
      row.value = JSON.stringify({ 62: best(5), 67: best(9) })
      goOffline(offline)
      app.recordLongNoteBest(72, best(4))
      await flush()
      goOnline()

      await app.pullCloudSettings()
      await settle()

      expect(cloudBests('b')).toEqual({ 62: best(5), 67: best(9), 72: best(4) })
      expect(app.longNoteBest(67)).toEqual(best(9))
      expect(app.longNoteBest(72)).toEqual(best(4))
    },
  )

  it.each(OFFLINE)(
    "keeps the Long note row B's phone created while a run here went unsent (offline %s)",
    async (offline) => {
      deviceUsedByA()
      const app = await boot()
      goOffline(offline)
      app.recordLongNoteBest(62, best(5))
      await flush()
      state.rows.push({
        id: 'b-phone-bests',
        userId: 'b',
        key: BESTS,
        value: JSON.stringify({ 67: best(9) }),
      })
      goOnline()

      await app.pullCloudSettings()
      await settle()

      expect(cloudBests('b')).toEqual({ 62: best(5), 67: best(9) })
      expect(app.longNoteBest(67)).toEqual(best(9))
      expect(app.longNoteBest(62)).toEqual(best(5))
    },
  )

  it("keeps A's bests out of B's account and gives them back to A", async () => {
    deviceUsedByA()
    const app = await boot()
    app.recordLongNoteBest(62, best(5))
    await flush()

    signIn('a')
    await app.pullCloudSettings()
    await settle()

    expect(cloudBests('b')).toEqual({ 62: best(5) })
    expect(app.longNoteBest(60)).toEqual(best(3))
    expect(app.longNoteBest(62)).toBeNull()
    expect(cloudBests('a')).toEqual({ 60: best(3) })
  })
})
