// ============================================================
// Settings ownership — real practice callers across accounts and delayed sync
// ============================================================
//
// Longer than the 600-line cap in docs/agent/TESTING.md: every case shares
// one harness (the account store, the identity and the timers), and a split
// would copy it into each file. The shared-device merge cases from the #999
// review live next to it in settings-shared-device.test.ts.
import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { id: string; userId: string; key: string; value: string }
const state = vi.hoisted(() => ({
  userId: 'a',
  deviceId: 'device',
  provider: 'password' as string | null,
  valid: true,
  version: 0,
  token: 'a:0' as string | null,
  rows: [] as Row[],
  writes: [] as Row[],
  failRead: false,
  failWrite: false,
  beforeDb: undefined as (() => Promise<void>) | undefined,
  beforeRead: undefined as
    | ((key: string | undefined) => Promise<void>)
    | undefined,
  beforeWrite: undefined as (() => Promise<void>) | undefined,
}))
vi.mock('@/lib/defaults', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  API_BASE_URL: 'https://api.test',
}))
vi.mock('@/lib/native-build', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  PREMIUM_EXERCISES: true,
}))
vi.mock('@/db/services/user-activity-service', () => ({
  recordActivity: vi.fn(),
}))
vi.mock('@/db/services/auth-service', () => ({
  hasValidToken: () => state.valid,
  storedTokenProvider: () => state.provider,
  isRegisteredProvider: (provider: string | null) =>
    provider !== null && provider !== 'anonymous',
  currentAccountId: () => (state.provider === 'password' ? state.userId : null),
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => state.userId,
  getDeviceId: () => state.deviceId,
  authVersion: () => state.version,
  getAuthToken: () => state.token,
}))
vi.mock('@/db', () => ({
  getDb: async () => {
    await state.beforeDb?.()
    return {
      getRepository: () => ({
        findAll: async (options?: {
          where?: { key?: string }
          throwOnError?: boolean
        }) => {
          const owner = state.userId
          if (state.failRead) {
            expect(options?.throwOnError).toBe(true)
            throw new Error('offline read')
          }
          const rows = state.rows
            .filter(
              (row) =>
                row.userId === owner &&
                (options?.where?.key === undefined ||
                  row.key === options.where.key),
            )
            .map((row) => ({ ...row }))
          await state.beforeRead?.(options?.where?.key)
          return rows
        },
        update: async (id: string, patch: { value: string }) => {
          const owner = state.userId
          const row = state.rows.find(
            (candidate) => candidate.id === id && candidate.userId === owner,
          )
          if (row === undefined) throw new Error('foreign row')
          await state.beforeWrite?.()
          if (state.failWrite) throw new Error('offline write')
          row.value = patch.value
          state.writes.push({ ...row })
        },
        create: async (input: { key: string; value: string }) => {
          const row = {
            ...input,
            userId: state.userId,
            id: `row-${state.rows.length}`,
          }
          await state.beforeWrite?.()
          if (state.failWrite) throw new Error('offline write')
          state.rows.push(row)
          state.writes.push({ ...row })
          return row
        },
      }),
    }
  },
}))

const PATH = 'mp_path_progress'
const BESTS = 'pitchperfect_long_note_lantern_bests'
const shelf = (key: string) => `mp_sync_progress:${key}`
const climb = (days: string[]) => ({
  pathId: 'ascent-foundations',
  startedAt: '2026-08-01T00:00:00.000Z',
  currentWeek: 1,
  weekDays: { 1: days },
  completedWeeks: [],
})
const best = (seconds: number) => ({
  inBandSeconds: seconds,
  steadiness: 90,
  at: 1,
})
const seed = (owner: string, key: string, value: unknown) => {
  state.rows.push({
    id: `${owner}-${key}`,
    userId: owner,
    key,
    value: JSON.stringify(value),
  })
}
const cloud = (owner: string, key = PATH): unknown => {
  const row = state.rows.find(
    (candidate) => candidate.userId === owner && candidate.key === key,
  )
  return row === undefined ? undefined : JSON.parse(row.value)
}
const days = (value: unknown): string[] =>
  (value as ReturnType<typeof climb>).weekDays[1]
const localDays = () => days(JSON.parse(localStorage.getItem(PATH)!))

function identity(owner: string, valid = true): void {
  state.userId = owner
  state.version += 1
  state.token = `${owner}:${state.version}`
  state.provider = 'password'
  state.valid = valid
}

function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
const settle = async () => {
  await vi.advanceTimersByTimeAsync(0)
}
const flush = async () => {
  await vi.advanceTimersByTimeAsync(1500)
  await settle()
}
let dispose: (() => void) | undefined

async function boot() {
  const sync = await import('./settings-service')
  const path = await import('@/features/path/path-progress')
  const notes = await import('@/features/long-note/long-note-best')
  createRoot((cleanup) => {
    dispose = cleanup
    sync.initSettingsSync()
  })
  await settle()
  return { ...sync, ...path, ...notes }
}
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  localStorage.clear()
  Object.assign(state, {
    userId: 'a',
    deviceId: 'device',
    provider: 'password',
    valid: true,
    version: 0,
    token: 'a:0',
    rows: [],
    writes: [],
    failRead: false,
    failWrite: false,
    beforeDb: undefined,
    beforeRead: undefined,
    beforeWrite: undefined,
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

describe('progress belongs to the practicing account', () => {
  it('preserves A, starts B empty, and retains B cloud-only plus offline Ascent days', async () => {
    localStorage.setItem(PATH, JSON.stringify(climb(['a-day'])))
    localStorage.setItem('mp_sync_owner', 'a')
    const app = await boot()
    identity('b')
    await app.pullCloudSettings()
    expect(app.pathProgress()).toBeNull()
    app.startAscent()
    app.recordPathPracticeDay('b-day')
    await flush()
    expect(days(cloud('b'))).toEqual(['endowed', 'b-day'])
    state.rows.find((row) => row.userId === 'b' && row.key === PATH)!.value =
      JSON.stringify(climb(['b-day', 'endowed', 'b-cloud']))
    state.failWrite = true
    app.recordPathPracticeDay('b-offline')
    await flush()
    state.failWrite = false
    state.writes = []
    await app.pullCloudSettings()
    await settle()
    expect(localDays()).toEqual(['b-cloud', 'b-day', 'b-offline', 'endowed'])
    expect(days(cloud('b'))).toEqual(localDays())
    expect(state.writes).toHaveLength(1)
    await app.pullCloudSettings()
    await settle()
    expect(days(cloud('b'))).toEqual(localDays())
    identity('a')
    await app.pullCloudSettings()
    expect(app.pathProgress()?.weekDays[1]).toEqual(['a-day'])
  })

  it('preserves mixed legacy owners and B Long-note cloud records after an offline best', async () => {
    localStorage.setItem(PATH, JSON.stringify(climb(['a-day'])))
    localStorage.setItem(BESTS, JSON.stringify({ 60: best(10) }))
    localStorage.setItem('mp_sync_owner', 'a')
    localStorage.setItem(`mp_sync_owner:${PATH}`, 'b')
    identity('b')
    const app = await boot()
    expect(app.pathProgress()?.weekDays[1]).toEqual(['a-day'])
    expect(app.longNoteBest(60)).toBeNull()
    app.recordLongNoteBest(64, best(20))
    await flush()
    state.rows.find((row) => row.userId === 'b' && row.key === BESTS)!.value =
      JSON.stringify({ 64: best(20), 67: best(30) })
    state.failWrite = true
    app.recordLongNoteBest(69, best(40))
    await flush()
    state.failWrite = false
    await app.pullCloudSettings()
    await settle()
    expect(cloud('b', BESTS)).toEqual({
      64: best(20),
      67: best(30),
      69: best(40),
    })
    identity('a')
    await app.pullCloudSettings()
    expect(app.pathProgress()).toBeNull()
    expect(app.longNoteBest(60)).toEqual(best(10))
    expect(app.longNoteBest(64)).toBeNull()
  })

  it('retains A pending through B writes and restores it after an offline account switch', async () => {
    const app = await boot()
    app.startAscent()
    state.failRead = true
    app.recordPathPracticeDay('a-offline')
    await flush()
    identity('b')
    await app.pullCloudSettings()
    app.startAscent()
    app.recordPathPracticeDay('b-offline')
    await flush()
    expect(
      JSON.parse(localStorage.getItem('mp_sync_pending:a')!).values[PATH],
    ).toBeDefined()
    identity('a')
    await app.pullCloudSettings()
    expect(app.pathProgress()?.weekDays[1]).toContain('a-offline')
    expect(app.pathProgress()?.weekDays[1]).not.toContain('b-offline')
    state.failRead = false
    await app.pullCloudSettings()
    await settle()
    expect(days(cloud('a'))).toContain('a-offline')
    identity('b')
    await app.pullCloudSettings()
    await settle()
    expect(days(cloud('b'))).toContain('b-offline')
    expect(days(cloud('b'))).not.toContain('a-offline')
  })

  it('migrates B-owned pending progress despite a stale legacy A owner stamp', async () => {
    const pending = JSON.stringify(climb(['b-offline']))
    localStorage.setItem(PATH, pending)
    localStorage.setItem('mp_sync_owner', 'a')
    localStorage.setItem(
      'mp_sync_pending',
      JSON.stringify({ owner: 'b', values: { [PATH]: pending } }),
    )
    seed('b', PATH, climb(['b-cloud']))
    identity('b')
    const app = await boot()
    expect(app.pathProgress()?.weekDays[1]).toEqual(['b-cloud', 'b-offline'])
    expect(days(cloud('b'))).toEqual(['b-cloud', 'b-offline'])
    expect(localStorage.getItem('mp_sync_pending')).toBeNull()
  })

  it('adopts anonymous practice once and distinguishes signout when account equals device ID', async () => {
    state.userId = state.deviceId
    state.provider = 'anonymous'
    const app = await boot()
    app.startAscent()
    app.recordPathPracticeDay('guest-day')
    identity(state.deviceId)
    await app.pullCloudSettings()
    expect(app.pathProgress()?.weekDays[1]).toContain('guest-day')
    state.provider = null
    state.valid = false
    state.token = null
    await app.pullCloudSettings()
    expect(app.pathProgress()).toBeNull()
    identity('b')
    await app.pullCloudSettings()
    expect(app.pathProgress()).toBeNull()
    await settle()
    expect(cloud('b')).toBeUndefined()
    identity(state.deviceId)
    await app.pullCloudSettings()
    expect(app.pathProgress()?.weekDays[1]).toContain('guest-day')
  })

  it('does not adopt a registered pending ledger when booting signed out on that same device ID', async () => {
    const raw = JSON.stringify(climb(['a-day']))
    localStorage.setItem(PATH, raw)
    localStorage.setItem('mp_sync_owner', 'device')
    localStorage.setItem(
      'mp_sync_pending',
      JSON.stringify({ owner: 'device', values: { [PATH]: raw } }),
    )
    state.userId = 'device'
    state.provider = null
    state.token = null
    state.valid = false
    const app = await boot()
    expect(app.pathProgress()).toBeNull()
    identity('b')
    await app.pullCloudSettings()
    await settle()
    expect(app.pathProgress()).toBeNull()
    expect(cloud('b')).toBeUndefined()
    identity('device')
    await app.pullCloudSettings()
    await settle()
    expect(app.pathProgress()?.weekDays[1]).toEqual(['a-day'])
  })

  it('retains an expired registered account copy through offline practice and sign-in elsewhere', async () => {
    localStorage.setItem(PATH, JSON.stringify(climb(['a-day'])))
    localStorage.setItem('mp_sync_owner', 'a')
    state.valid = false
    const app = await boot()
    app.recordPathPracticeDay('a-expired')
    identity('b')
    await app.pullCloudSettings()
    expect(app.pathProgress()).toBeNull()
    expect(cloud('b')).toBeUndefined()
    identity('a')
    await app.pullCloudSettings()
    await settle()
    expect(days(cloud('a'))).toEqual(['a-day', 'a-expired'])
  })
})

describe('uploads wait for the current account and reconcile unseen cloud progress', () => {
  it('merges a practice upload with cloud progress while the initial pull is still delayed', async () => {
    seed('a', PATH, climb(['cloud-day']))
    const gate = deferred()
    state.beforeRead = async (key) => {
      if (key === undefined) await gate.promise
    }
    const app = await boot()
    app.startAscent()
    app.recordPathPracticeDay('local-day')
    await flush()
    expect(days(cloud('a'))).toEqual(['cloud-day', 'endowed', 'local-day'])
    gate.release()
    await settle()
    expect(app.pathProgress()?.weekDays[1]).toEqual(days(cloud('a')))
  })

  it.each(['beforeDb', 'beforeRead'] as const)(
    'drops an A push delayed at %s after B signs in',
    async (boundary) => {
      const app = await boot()
      const gate = deferred()
      state[boundary] = async () => {
        await gate.promise
      }
      app.startAscent()
      await flush()
      identity('b')
      state[boundary] = undefined
      await app.pullCloudSettings()
      gate.release()
      await settle()
      expect(state.writes).toEqual([])
      expect(app.pathProgress()).toBeNull()
      expect(cloud('b')).toBeUndefined()
    },
  )

  it.each(['version', 'token'] as const)(
    'drops an old same-account pull after only its %s changes',
    async (field) => {
      const app = await boot()
      seed('a', PATH, climb(['stale-cloud']))
      const gate = deferred()
      state.beforeRead = async () => {
        await gate.promise
      }
      const pulling = app.pullCloudSettings()
      await settle()
      if (field === 'version') state.version += 1
      else state.token = 'a:replacement'
      gate.release()
      await pulling
      expect(app.pathProgress()).toBeNull()
      expect(state.writes).toEqual([])
    },
  )

  it('does not let an old write completion clear an equal new-generation pending value', async () => {
    const app = await boot()
    const gate = deferred()
    state.beforeWrite = async () => {
      await gate.promise
    }
    app.startAscent()
    await flush()
    state.version += 1
    state.token = 'a:replacement'
    const pendingBefore = localStorage.getItem('mp_sync_pending')
    gate.release()
    await settle()
    expect(localStorage.getItem('mp_sync_pending')).toBe(pendingBefore)
    state.beforeWrite = undefined
    await app.pullCloudSettings()
    await settle()
    expect(localStorage.getItem('mp_sync_pending')).toBeNull()
  })

  it('allows B uploads while an old A request remains unresolved', async () => {
    const app = await boot()
    const gate = deferred()
    state.beforeWrite = async () => {
      if (state.userId === 'a') await gate.promise
    }
    app.startAscent()
    await flush()
    identity('b')
    await app.pullCloudSettings()
    app.startAscent()
    app.recordPathPracticeDay('b-day')
    await flush()
    expect(days(cloud('b'))).toContain('b-day')
    expect(cloud('a')).toBeUndefined()
    gate.release()
    await settle()
    expect(days(cloud('a'))).not.toContain('b-day')
  })

  it('preserves an explicit Ascent reset while a pull races its debounce', async () => {
    seed('a', PATH, climb(['old-day']))
    const app = await boot()
    app.resetAscent()
    await app.pullCloudSettings()
    await flush()
    expect(app.pathProgress()).toBeNull()
    expect(cloud('a')).toBeNull()
  })

  it('does not turn a failed strict upload read into a create', async () => {
    const app = await boot()
    state.failRead = true
    app.startAscent()
    await flush()
    expect(state.writes).toEqual([])
    expect(localStorage.getItem('mp_sync_pending')).toContain(PATH)
  })
})

describe('other tabs and local storage failures', () => {
  it('refuses stale A absolute progress when shared credentials become B before the storage event', async () => {
    localStorage.setItem(PATH, JSON.stringify(climb(['a-day'])))
    localStorage.setItem('mp_sync_owner', 'a')
    const app = await boot()
    identity('b')
    app.recordPathPracticeDay('wrong-account-day')
    expect(app.pathProgress()).toBeNull()
    app.startAscent()
    app.recordPathPracticeDay('b-day')
    await flush()
    expect(days(cloud('b'))).toEqual(['endowed', 'b-day'])
    identity('a')
    await app.pullCloudSettings()
    expect(app.pathProgress()?.weekDays[1]).toEqual(['a-day'])
  })

  it('reconciles the live store on a token storage event before the next practice action', async () => {
    const app = await boot()
    app.startAscent()
    identity('b')
    const { AUTH_TOKEN_KEY } = await import('@/lib/storage-port')
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_TOKEN_KEY }))
    expect(app.pathProgress()).toBeNull()
    await settle()
  })

  it('retains a same-account other-tab update plus the real absolute Ascent action', async () => {
    localStorage.setItem(PATH, JSON.stringify(climb(['a-day'])))
    const app = await boot()
    const copies = JSON.parse(localStorage.getItem(shelf(PATH))!)
    copies.values['account:a'] = JSON.stringify(climb(['a-day', 'other-tab']))
    localStorage.setItem(shelf(PATH), JSON.stringify(copies))
    app.recordPathPracticeDay('this-tab')
    expect(app.pathProgress()?.weekDays[1]).toEqual([
      'a-day',
      'other-tab',
      'this-tab',
    ])
    await flush()
    expect(days(cloud('a'))).toEqual(['a-day', 'other-tab', 'this-tab'])
  })

  it('retains same-account other-tab bests before evaluating the real functional setter', async () => {
    const app = await boot()
    const copies = JSON.parse(localStorage.getItem(shelf(BESTS))!)
    copies.values['account:a'] = JSON.stringify({ 60: best(30) })
    localStorage.setItem(shelf(BESTS), JSON.stringify(copies))
    app.recordLongNoteBest(64, best(40))
    expect(app.longNoteBest(60)).toEqual(best(30))
    expect(app.longNoteBest(64)).toEqual(best(40))
    await flush()
    expect(cloud('a', BESTS)).toEqual({ 60: best(30), 64: best(40) })
  })

  it('keeps oversized local practice durable without uploading it', async () => {
    const app = await boot()
    const { createPersistedSignal } = await import('@/lib/storage')
    const [read, write] = createPersistedSignal(
      PATH,
      null as ReturnType<typeof climb> | null,
    )
    const huge = climb(Array.from({ length: 2000 }, (_, i) => `day-${i}`))
    expect(JSON.stringify(huge).length).toBeGreaterThan(8192)
    write(huge)
    await app.pullCloudSettings()
    await flush()
    expect(read()).toEqual(huge)
    expect(state.writes).toEqual([])
    identity('b')
    await app.pullCloudSettings()
    identity('a')
    await app.pullCloudSettings()
    expect(read()).toEqual(huge)
  })

  it('fails closed on a transition snapshot failure, preserving the foreign copy', async () => {
    localStorage.setItem(PATH, JSON.stringify(climb(['a-day'])))
    const app = await boot()
    const original = localStorage.setItem.bind(localStorage)
    const spy = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key, value) => {
        if (key === shelf(PATH)) throw new Error('quota')
        original(key, value)
      })
    identity('b')
    app.recordPathPracticeDay('wrong-account-day')
    await app.pullCloudSettings()
    expect(app.pathProgress()).toBeNull()
    expect(localStorage.getItem(PATH)).toContain('a-day')
    expect(cloud('b')).toBeUndefined()
    spy.mockRestore()
    await app.pullCloudSettings()
    expect(app.pathProgress()).toBeNull()
    identity('a')
    await app.pullCloudSettings()
    expect(app.pathProgress()?.weekDays[1]).toEqual(['a-day'])
  })

  it('retains an accepted new local practice in memory when its larger snapshot fails', async () => {
    localStorage.setItem(PATH, JSON.stringify(climb(['a-day'])))
    const app = await boot()
    const original = localStorage.setItem.bind(localStorage)
    const spy = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key, value) => {
        if (key === shelf(PATH) && value.includes('new-day'))
          throw new Error('quota')
        original(key, value)
      })
    app.recordPathPracticeDay('new-day')
    await app.pullCloudSettings()
    expect(app.pathProgress()?.weekDays[1]).toEqual(['a-day', 'new-day'])
    expect(days(cloud('a'))).toEqual(['a-day'])
    spy.mockRestore()
    await app.pullCloudSettings()
    await settle()
    expect(days(cloud('a'))).toEqual(['a-day', 'new-day'])
    identity('b')
    await app.pullCloudSettings()
    expect(app.pathProgress()).toBeNull()
    identity('a')
    await app.pullCloudSettings()
    expect(app.pathProgress()?.weekDays[1]).toEqual(['a-day', 'new-day'])
  })
})

describe('durable Ascent reset intent', () => {
  const resetIntent = () =>
    JSON.parse(localStorage.getItem(shelf(PATH))!).resets['account:a'] as {
      id: string
      pending: boolean
    }

  it.each([
    { account: 'a', restart: true },
    { account: 'device', restart: true },
    { account: 'device', restart: false },
  ])(
    'replaces anonymous cloud progress without erasing registered $account (restart: $restart)',
    async ({ account, restart }) => {
      state.userId = state.deviceId
      state.provider = 'anonymous'
      state.token = 'anonymous:0'
      seed(state.deviceId, PATH, climb(['old-guest-day']))
      const app = await boot()
      app.resetAscent()
      app.startAscent()
      app.recordPathPracticeDay('guest-day')
      await flush()
      expect(days(cloud(state.deviceId))).toEqual(['endowed', 'guest-day'])
      expect(
        JSON.parse(localStorage.getItem(shelf(PATH))!).resets.guest.pending,
      ).toBe(false)

      app.resetAscent()
      if (restart) {
        app.startAscent()
        app.recordPathPracticeDay('guest-restart')
      }
      expect(
        JSON.parse(localStorage.getItem(shelf(PATH))!).resets.guest.pending,
      ).toBe(true)
      const existing = state.rows.find(
        (row) => row.userId === account && row.key === PATH,
      )
      if (existing !== undefined)
        existing.value = JSON.stringify(climb(['registered-day']))
      else seed(account, PATH, climb(['registered-day']))
      identity(account)
      await app.pullCloudSettings()
      await settle()
      const expected = restart
        ? ['endowed', 'guest-restart', 'registered-day']
        : ['registered-day']
      expect(days(cloud(account))).toEqual(expected)
      expect(app.pathProgress()?.weekDays[1]).toEqual(expected)
      expect(JSON.parse(localStorage.getItem(shelf(PATH))!).resets).toEqual({})
    },
  )

  it.each([false, true])(
    'preserves new guest practice when recovering a legacy registered reset after signed-out boot (guest reset: %s)',
    async (resetGuest) => {
      state.userId = state.deviceId
      state.provider = null
      state.token = null
      state.valid = false
      localStorage.setItem(PATH, JSON.stringify(climb(['old-day'])))
      localStorage.setItem('mp_sync_owner', state.deviceId)
      localStorage.setItem(
        'mp_sync_pending',
        JSON.stringify({ owner: state.deviceId, values: { [PATH]: 'null' } }),
      )
      seed(state.deviceId, PATH, climb(['old-cloud-day']))
      const app = await boot()
      if (resetGuest) app.resetAscent()
      app.startAscent()
      app.recordPathPracticeDay('new-guest-day')
      identity(state.deviceId)
      await app.pullCloudSettings()
      await settle()
      expect(app.pathProgress()?.weekDays[1]).toEqual([
        'endowed',
        'new-guest-day',
      ])
      expect(days(cloud(state.deviceId))).toEqual(['endowed', 'new-guest-day'])
    },
  )

  it('recovers an explicitly anonymous legacy pending reset into the guest slot', async () => {
    state.userId = state.deviceId
    state.provider = 'anonymous'
    state.token = 'anonymous:0'
    localStorage.setItem(PATH, JSON.stringify(climb(['old-guest-day'])))
    localStorage.setItem('mp_sync_owner', state.deviceId)
    localStorage.setItem(
      'mp_sync_pending',
      JSON.stringify({ owner: state.deviceId, values: { [PATH]: 'null' } }),
    )
    seed(state.deviceId, PATH, climb(['old-cloud-day']))
    const app = await boot()
    expect(app.pathProgress()).toBeNull()
    expect(cloud(state.deviceId)).toBeNull()
    expect(
      JSON.parse(localStorage.getItem(shelf(PATH))!).resets.guest.pending,
    ).toBe(false)
  })

  it.each(['expired', 'failed-ledger'])(
    'keeps registered pending provenance when an anonymous reset cannot write its ledger (%s)',
    async (failure) => {
      state.userId = state.deviceId
      state.provider = 'anonymous'
      state.token = 'anonymous:0'
      state.valid = failure !== 'expired'
      state.failRead = true
      localStorage.setItem(
        'mp_sync_pending',
        JSON.stringify({
          owner: state.deviceId,
          values: { [PATH]: 'null' },
          scopes: { [PATH]: 'account' },
        }),
      )
      seed(state.deviceId, PATH, climb(['old-cloud-day']))
      const app = await boot()
      const original = localStorage.setItem.bind(localStorage)
      const spy = vi
        .spyOn(localStorage, 'setItem')
        .mockImplementation((key, value) => {
          if (failure === 'failed-ledger' && key === 'mp_sync_pending')
            throw new Error('quota')
          original(key, value)
        })
      app.resetAscent()
      app.startAscent()
      app.recordPathPracticeDay('new-guest-day')
      expect(
        JSON.parse(localStorage.getItem('mp_sync_pending')!).scopes[PATH],
      ).toBe('account')
      spy.mockRestore()
      state.failRead = false
      identity(state.deviceId)
      await app.pullCloudSettings()
      await settle()
      expect(days(cloud(state.deviceId))).toEqual(['endowed', 'new-guest-day'])
    },
  )

  it('preserves guest pending provenance through an owner archive before same-device upgrade', async () => {
    state.userId = state.deviceId
    state.provider = 'anonymous'
    state.token = 'anonymous:0'
    const app = await boot()
    app.resetAscent()
    identity('b')
    await app.pullCloudSettings()
    app.startAscent()
    expect(
      JSON.parse(localStorage.getItem(`mp_sync_pending:${state.deviceId}`)!)
        .scopes[PATH],
    ).toBe('guest')
    seed(state.deviceId, PATH, climb(['registered-day']))
    identity(state.deviceId)
    await app.pullCloudSettings()
    await settle()
    expect(app.pathProgress()?.weekDays[1]).toEqual(['registered-day'])
    expect(days(cloud(state.deviceId))).toEqual(['registered-day'])
  })

  it('recovers a legacy flat owner archive before applying the account cloud', async () => {
    localStorage.setItem(
      'mp_sync_pending',
      JSON.stringify({
        owner: 'b',
        values: { [PATH]: JSON.stringify(climb(['b-day'])) },
      }),
    )
    localStorage.setItem(
      'mp_sync_pending:a',
      JSON.stringify({ [PATH]: 'null' }),
    )
    seed('a', PATH, climb(['old-cloud-day']))
    const app = await boot()
    expect(app.pathProgress()).toBeNull()
    expect(cloud('a')).toBeNull()
  })

  it('replaces old cloud days after immediate reset and restart, then resumes ordinary merges', async () => {
    seed('a', PATH, climb(['old-day']))
    const app = await boot()
    app.resetAscent()
    app.startAscent()
    app.recordPathPracticeDay('new-day')
    await flush()
    expect(app.pathProgress()?.weekDays[1]).toEqual(['endowed', 'new-day'])
    expect(days(cloud('a'))).toEqual(['endowed', 'new-day'])
    expect(resetIntent().pending).toBe(false)
    state.rows.find((row) => row.userId === 'a' && row.key === PATH)!.value =
      JSON.stringify(climb(['cloud-after-reset']))
    app.recordPathPracticeDay('local-after-reset')
    await flush()
    expect(days(cloud('a'))).toEqual([
      'cloud-after-reset',
      'endowed',
      'local-after-reset',
      'new-day',
    ])
  })

  it('retains reset and restart intent across account switches and a module reload', async () => {
    seed('a', PATH, climb(['old-day']))
    let app = await boot()
    app.resetAscent()
    app.startAscent()
    identity('b')
    await app.pullCloudSettings()
    app.startAscent()
    app.recordPathPracticeDay('b-day')
    await flush()
    identity('a')
    dispose?.()
    dispose = undefined
    vi.resetModules()
    app = await boot()
    expect(app.pathProgress()?.weekDays[1]).toEqual(['endowed'])
    expect(days(cloud('a'))).toEqual(['endowed'])
    expect(days(cloud('b'))).toEqual(['endowed', 'b-day'])
  })

  it('uploads an expired-account reset even when no pending ledger was recorded', async () => {
    seed('a', PATH, climb(['old-day']))
    const app = await boot()
    state.valid = false
    app.resetAscent()
    app.startAscent()
    expect(localStorage.getItem('mp_sync_pending')).toBeNull()
    state.valid = true
    await app.pullCloudSettings()
    await settle()
    expect(days(cloud('a'))).toEqual(['endowed'])
  })

  it('does not let a pre-reset write completion acknowledge a newer reset', async () => {
    seed('a', PATH, climb(['old-day']))
    const app = await boot()
    const gate = deferred()
    state.beforeWrite = async () => {
      await gate.promise
    }
    app.recordPathPracticeDay('pre-reset-day')
    await flush()
    app.resetAscent()
    app.startAscent()
    gate.release()
    await settle()
    expect(resetIntent().pending).toBe(true)
    expect(localStorage.getItem('mp_sync_pending')).toContain('endowed')
    state.beforeWrite = undefined
    await flush()
    expect(days(cloud('a'))).toEqual(['endowed'])
  })

  it('acknowledges the reset without clearing a restart recorded during its request', async () => {
    seed('a', PATH, climb(['old-day']))
    const app = await boot()
    const gate = deferred()
    state.beforeWrite = async () => {
      await gate.promise
    }
    app.resetAscent()
    await flush()
    app.startAscent()
    app.recordPathPracticeDay('new-day')
    gate.release()
    await settle()
    expect(cloud('a')).toBeNull()
    expect(resetIntent().pending).toBe(false)
    expect(localStorage.getItem('mp_sync_pending')).toContain('new-day')
    state.beforeWrite = undefined
    await flush()
    expect(days(cloud('a'))).toEqual(['endowed', 'new-day'])
  })

  it('does not let an earlier reset acknowledgement clear a later equal null reset', async () => {
    seed('a', PATH, climb(['old-day']))
    const app = await boot()
    const gate = deferred()
    state.beforeWrite = async () => {
      await gate.promise
    }
    app.resetAscent()
    const first = resetIntent().id
    await flush()
    app.resetAscent()
    expect(resetIntent().id).not.toBe(first)
    gate.release()
    await settle()
    expect(resetIntent().pending).toBe(true)
    expect(localStorage.getItem('mp_sync_pending')).toContain('null')
    state.beforeWrite = undefined
    await flush()
    expect(resetIntent().pending).toBe(false)
    expect(localStorage.getItem('mp_sync_pending')).toBeNull()
  })

  it.each([false, true])(
    'ignores a stale pull response after reset acknowledgement (pull started with reset: %s)',
    async (alreadyReset) => {
      seed('a', PATH, climb(['old-day']))
      const app = await boot()
      if (alreadyReset) {
        app.resetAscent()
        app.startAscent()
      }
      const gate = deferred()
      state.beforeRead = async (key) => {
        if (key === undefined) await gate.promise
      }
      const pulling = app.pullCloudSettings()
      await settle()
      if (!alreadyReset) {
        app.resetAscent()
        app.startAscent()
      }
      await flush()
      expect(resetIntent().pending).toBe(false)
      gate.release()
      await pulling
      await settle()
      expect(app.pathProgress()?.weekDays[1]).toEqual(['endowed'])
      expect(days(cloud('a'))).toEqual(['endowed'])
    },
  )

  it('does not merge stale same-account actions across a reset made in another tab', async () => {
    seed('a', PATH, climb(['old-day']))
    const app = await boot()
    const copies = JSON.parse(localStorage.getItem(shelf(PATH))!)
    copies.values['account:a'] = JSON.stringify(climb(['new-climb']))
    copies.resets = { 'account:a': { id: 'other-tab-reset', pending: false } }
    localStorage.setItem(shelf(PATH), JSON.stringify(copies))
    app.recordPathPracticeDay('stale-action')
    expect(app.pathProgress()?.weekDays[1]).toEqual(['new-climb'])
    app.recordPathPracticeDay('current-action')
    expect(app.pathProgress()?.weekDays[1]).toEqual([
      'new-climb',
      'current-action',
    ])
  })

  it('keeps an accepted reset in memory when its snapshot fails, then uploads it on recovery', async () => {
    seed('a', PATH, climb(['old-day']))
    const app = await boot()
    const original = localStorage.setItem.bind(localStorage)
    const spy = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key, value) => {
        if (key === shelf(PATH) && value.includes('resets'))
          throw new Error('quota')
        original(key, value)
      })
    app.resetAscent()
    await app.pullCloudSettings()
    expect(app.pathProgress()).toBeNull()
    expect(days(cloud('a'))).toEqual(['old-day'])
    spy.mockRestore()
    await app.pullCloudSettings()
    await settle()
    expect(cloud('a')).toBeNull()
    expect(resetIntent().pending).toBe(false)
  })

  it.each([
    { stamped: true, pending: 'null' },
    { stamped: false, pending: 'null' },
    { stamped: true, pending: JSON.stringify(climb(['pending-day'])) },
    { stamped: false, pending: JSON.stringify(climb(['pending-day'])) },
  ])(
    'restores legacy pending $pending after signed-out boot (stamp: $stamped)',
    async ({ stamped, pending }) => {
      state.userId = state.deviceId
      state.provider = null
      state.token = null
      state.valid = false
      localStorage.setItem(PATH, JSON.stringify(climb(['old-day'])))
      if (stamped) localStorage.setItem('mp_sync_owner', state.deviceId)
      localStorage.setItem(
        'mp_sync_pending',
        JSON.stringify({ owner: state.deviceId, values: { [PATH]: pending } }),
      )
      seed(state.deviceId, PATH, climb(['old-cloud-day']))
      const app = await boot()
      if (stamped) expect(app.pathProgress()).toBeNull()
      identity(state.deviceId)
      await app.pullCloudSettings()
      await settle()
      const expected =
        pending === 'null'
          ? null
          : climb(['old-cloud-day', 'old-day', 'pending-day'])
      expect(app.pathProgress()).toEqual(expected)
      expect(cloud(state.deviceId)).toEqual(expected)
    },
  )

  it.each([true, false])(
    'migrates an explicit pending reset instead of the old raw climb (legacy stamp: %s)',
    async (stamped) => {
      localStorage.setItem(PATH, JSON.stringify(climb(['old-raw-day'])))
      if (stamped) localStorage.setItem('mp_sync_owner', 'a')
      localStorage.setItem(
        'mp_sync_pending',
        JSON.stringify({ owner: 'a', values: { [PATH]: 'null' } }),
      )
      seed('a', PATH, climb(['old-cloud-day']))
      const app = await boot()
      expect(app.pathProgress()).toBeNull()
      expect(cloud('a')).toBeNull()
      expect(resetIntent().pending).toBe(false)
    },
  )
})
