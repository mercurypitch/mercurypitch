// ============================================================
// settingsPulled — did this page's first settings pull bring the account in?
// ============================================================
//
// The takeover and the plan's sync both hold a decision until the account's
// settings are in (a plan answered on another device arrives with them), so
// the pull says so: it resolves once the first pull to finish has applied the
// account's rows, at once when sync is off, and rejects when that pull ended
// without reading them (no sign-in, offline, a newer pull took over, a
// progress reset). The first pull decides: a later one changes nothing.
//
// The service is the real one, over the same fakes the other settings suites
// use (the identity, the clock and the account's rows). Each case is a page
// load, because the answer is module state.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { id: string; userId: string; key: string; value: string }
const state = vi.hoisted(() => ({
  api: 'https://api.test',
  userId: 'a',
  provider: 'password' as string | null,
  valid: true,
  version: 0,
  token: 'a:0' as string | null,
  rows: [] as Row[],
  failRead: false,
  beforeDb: undefined as (() => Promise<void>) | undefined,
  beforeRead: undefined as (() => Promise<void>) | undefined,
}))
vi.mock('@/lib/defaults', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  get API_BASE_URL() {
    return state.api
  },
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
  getDeviceId: () => 'device',
  authVersion: () => state.version,
  getAuthToken: () => state.token,
}))
vi.mock('@/db', () => ({
  getDb: async () => {
    await state.beforeDb?.()
    return {
      getRepository: () => ({
        findAll: async (options?: { throwOnError?: boolean }) => {
          if (state.failRead) {
            expect(options?.throwOnError).toBe(true)
            throw new Error('offline read')
          }
          const rows = state.rows
            .filter((row) => row.userId === state.userId)
            .map((row) => ({ ...row }))
          await state.beforeRead?.()
          return rows
        },
        update: async () => undefined,
        create: async () => undefined,
      }),
    }
  },
}))

/** A preference the account holds: synced, and not one a signal owns. */
const PREF = 'pitchperfect_pull_probe'

/** A page load: the service's own state starts empty. */
async function load() {
  vi.resetModules()
  return import('./settings-service')
}

/** Reads the outcome of a promise without waiting on it. */
function watch(promise: Promise<void>) {
  const seen: { outcome: 'pending' | 'resolved' | 'rejected' } = {
    outcome: 'pending',
  }
  promise.then(
    () => {
      seen.outcome = 'resolved'
    },
    () => {
      seen.outcome = 'rejected'
    },
  )
  return seen
}

const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  Object.assign(state, {
    api: 'https://api.test',
    userId: 'a',
    provider: 'password',
    valid: true,
    version: 0,
    token: 'a:0',
    rows: [],
    failRead: false,
    beforeDb: undefined,
    beforeRead: undefined,
  })
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('with no API configured', () => {
  it('resolves at once, with no pull to wait for', async () => {
    state.api = ''
    const { settingsPulled } = await load()

    const seen = watch(settingsPulled())
    await settle()

    expect(seen.outcome).toBe('resolved')
  })
})

describe('with an account to pull', () => {
  it("waits for the first pull, and resolves once the account's settings are applied", async () => {
    state.rows.push({
      id: 'r1',
      userId: 'a',
      key: PREF,
      value: 'from-the-phone',
    })
    const { settingsPulled, pullCloudSettings } = await load()

    const seen = watch(settingsPulled())
    await settle()
    expect(seen.outcome).toBe('pending')

    await pullCloudSettings()
    await settle()

    expect(seen.outcome).toBe('resolved')
    // Applied before the promise resolved, not after: that is the point.
    expect(localStorage.getItem(PREF)).toBe('from-the-phone')
  })

  it('answers the same to a caller that asks after the pull', async () => {
    const { settingsPulled, pullCloudSettings } = await load()
    await pullCloudSettings()

    const seen = watch(settingsPulled())
    await settle()

    expect(seen.outcome).toBe('resolved')
  })

  it('resolves for an account that holds no settings yet', async () => {
    const { settingsPulled, pullCloudSettings } = await load()

    const seen = watch(settingsPulled())
    await pullCloudSettings()
    await settle()

    expect(seen.outcome).toBe('resolved')
  })
})

describe('when the first pull ends without the account settings', () => {
  it('rejects with no usable sign-in', async () => {
    state.valid = false
    const { settingsPulled, pullCloudSettings } = await load()

    const seen = watch(settingsPulled())
    await pullCloudSettings()
    await settle()

    expect(seen.outcome).toBe('rejected')
  })

  it('rejects when the read fails', async () => {
    state.failRead = true
    const { settingsPulled, pullCloudSettings } = await load()

    const seen = watch(settingsPulled())
    await pullCloudSettings()
    await settle()

    expect(seen.outcome).toBe('rejected')
  })

  it('rejects when a newer pull took over', async () => {
    const { settingsPulled, pullCloudSettings } = await load()
    const second = Promise.withResolvers<undefined>()
    let reads = 0
    state.beforeRead = async () => {
      reads += 1
      // The second pull starts inside the first one's read, and is held there.
      if (reads === 1) void pullCloudSettings()
      if (reads === 2) await second.promise
    }

    const seen = watch(settingsPulled())
    await pullCloudSettings()
    await settle()
    const whileTheSecondIsHeld = seen.outcome
    second.resolve(undefined)
    await settle()

    expect(whileTheSecondIsHeld).toBe('rejected')
    expect(seen.outcome).toBe('rejected')
  })

  it('rejects when a newer pull took over before it read', async () => {
    const { settingsPulled, pullCloudSettings } = await load()
    let opened = 0
    state.beforeDb = async () => {
      opened += 1
      // The second pull starts while the first is still opening the database.
      if (opened === 1) void pullCloudSettings()
    }

    const seen = watch(settingsPulled())
    await pullCloudSettings()
    await settle()

    expect(seen.outcome).toBe('rejected')
  })

  // Nothing awaits it on a page that never asks, and an unhandled rejection
  // would fail the run: the file passing is the check.
  it('leaves no unhandled rejection on a page that never asks', async () => {
    state.failRead = true
    const { pullCloudSettings } = await load()

    await pullCloudSettings()
    await settle()

    expect(console.warn).toHaveBeenCalled()
  })
})

describe('the first pull decides', () => {
  it('stays resolved when a later pull fails', async () => {
    const { settingsPulled, pullCloudSettings } = await load()
    await pullCloudSettings()

    state.failRead = true
    await pullCloudSettings()
    await settle()
    const seen = watch(settingsPulled())
    await settle()

    expect(seen.outcome).toBe('resolved')
  })

  it('stays rejected when a later pull applies', async () => {
    state.valid = false
    const { settingsPulled, pullCloudSettings } = await load()
    await pullCloudSettings()

    state.valid = true
    await pullCloudSettings()
    await settle()
    const seen = watch(settingsPulled())
    await settle()

    expect(seen.outcome).toBe('rejected')
  })
})
