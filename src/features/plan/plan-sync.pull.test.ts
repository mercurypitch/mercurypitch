// ============================================================
// Plan sync waits for the settings pull before it reads the plan
// ============================================================
//
// "Once per person, not once per device" (spec 540) holds because the record
// syncs with the settings and carries the mark of the send. On a second device
// that is only so once the settings pull has applied the account's marked
// record: a sync that reads the device's own unmarked copy first sends the
// plan again. So the sync waits for the pull, as long as the takeover does and
// no longer (SETTINGS_PULL_WAIT_MS), then reads the record as it stands. Past
// the cap, or for a pull that ended without the account's settings, it reads
// at once, and the reader's rule (one row per person, the latest) covers the
// duplicate (submitPlanResponse says how).
//
// The plan-sync cases that came before (plan-sync.test.ts) are about what is
// sent and when it is marked; this file is the wait. They share one harness
// (plan-sync.harness.fixture.ts). The store is the real one, the writer and
// the pull are doubles, and the clock is fake so the cap is advanced and not
// slept.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_LINES, NOW, SENT, sentFor, SYNCED, TYPED, } from './plan-sync.fixture'
import { accepting, answered, fresh, pull } from './plan-sync.harness.fixture'
import { SETTINGS_PULL_WAIT_MS } from './settings-pull-wait'

const mocks = vi.hoisted(() => ({
  submitPlanResponse: vi.fn(),
  settingsPulled: vi.fn(),
}))

vi.mock('@/db/services/survey-service', () => ({
  submitPlanResponse: mocks.submitPlanResponse,
}))
vi.mock('@/db/services/settings-service', () => ({
  settingsPulled: mocks.settingsPulled,
}))

const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  localStorage.clear()
  mocks.submitPlanResponse.mockReset()
  mocks.settingsPulled.mockReset()
  mocks.settingsPulled.mockResolvedValue(undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.useFakeTimers()
  vi.setSystemTime(SYNCED)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('on a second device', () => {
  it('reads the record only after the settings pull has landed', async () => {
    const { store, sync, deps } = await answered()
    const landing = Promise.withResolvers<undefined>()

    const result = sync.syncPlanToAccount({
      ...deps,
      settingsPulled: async () => landing.promise,
    })
    await settle()
    expect(deps.submit).not.toHaveBeenCalled()

    // The account's copy was sent from the phone and marked: the pull brings the mark.
    await pull({ ...store.planRecord(), syncedAt: SYNCED.toISOString() })
    landing.resolve(undefined)

    await expect(result).resolves.toBe('skipped')
    expect(deps.submit).not.toHaveBeenCalled()
  })

  it('sends the plan once the pull has landed with nothing new', async () => {
    const { sync, deps } = await answered()
    const landing = Promise.withResolvers<undefined>()

    const result = sync.syncPlanToAccount({
      ...deps,
      settingsPulled: async () => landing.promise,
    })
    await settle()
    expect(deps.submit).not.toHaveBeenCalled()

    landing.resolve(undefined)

    await expect(result).resolves.toBe('synced')
    expect(deps.submit).toHaveBeenCalledTimes(1)
    expect(deps.submit).toHaveBeenCalledWith(SENT)
  })

  it('sends once when two syncs are asked while the pull is out', async () => {
    const { sync, deps } = await answered()
    const landing = Promise.withResolvers<undefined>()
    const settingsPulled = async () => landing.promise

    const first = sync.syncPlanToAccount({ ...deps, settingsPulled })
    const second = sync.syncPlanToAccount({ ...deps, settingsPulled })
    landing.resolve(undefined)

    await expect(Promise.all([first, second])).resolves.toEqual([
      'synced',
      'synced',
    ])
    expect(deps.submit).toHaveBeenCalledTimes(1)
  })

  // The device holds no plan of its own. The read after the wait is what
  // finds the one that arrived.
  it('sends a plan that arrives with the pull and has not been sent yet', async () => {
    const { sync } = await fresh()
    const deps = accepting()
    const landing = Promise.withResolvers<undefined>()

    const result = sync.syncPlanToAccount({
      ...deps,
      settingsPulled: async () => landing.promise,
    })
    await settle()
    await pull({
      v: 1,
      status: 'answered',
      choices: TYPED,
      at: NOW.toISOString(),
      via: 'layer',
    })
    landing.resolve(undefined)

    await expect(result).resolves.toBe('synced')
    expect(deps.submit).toHaveBeenCalledWith(sentFor(TYPED, NO_LINES, NOW))
  })
})

describe('when the pull is late, or brings nothing', () => {
  it('reads the record when the cap is reached, and not before', async () => {
    const { sync, deps } = await answered()

    const result = sync.syncPlanToAccount({
      ...deps,
      settingsPulled: async () => new Promise<undefined>(() => undefined),
    })
    await vi.advanceTimersByTimeAsync(SETTINGS_PULL_WAIT_MS - 1)
    expect(deps.submit).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    await expect(result).resolves.toBe('synced')
    expect(deps.submit).toHaveBeenCalledTimes(1)
  })

  it('does not wait out the cap for a pull that ended without the account settings', async () => {
    const { sync, deps } = await answered()

    const result = await sync.syncPlanToAccount({
      ...deps,
      settingsPulled: async () => Promise.reject(new Error('offline')),
    })

    expect(result).toBe('synced')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('never rejects, whatever the pull does', async () => {
    const { sync, deps } = await answered()

    const result = await sync.syncPlanToAccount({
      ...deps,
      settingsPulled: () => {
        throw new Error('boom')
      },
    })

    expect(result).toBe('synced')
  })
})

describe('for whoever there is nothing to wait for', () => {
  it('does not wait for a singer without a real account', async () => {
    const { sync, deps } = await answered(false)
    const settingsPulled = vi.fn(async () => undefined)

    const result = await sync.syncPlanToAccount({ ...deps, settingsPulled })

    expect(result).toBe('skipped')
    expect(settingsPulled).not.toHaveBeenCalled()
  })

  it("asks the settings service's own pull when none is given", async () => {
    const { sync, deps } = await answered()

    const result = await sync.syncPlanToAccount(deps)

    expect(result).toBe('synced')
    expect(mocks.settingsPulled).toHaveBeenCalledTimes(1)
  })
})
