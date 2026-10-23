// ============================================================
// The settings pull wait: three seconds for the account's settings, and no longer
// ============================================================
//
// awaitSettingsPull is the wait the opening takeover and the plan's sync share.
// It says whether the settings pull landed in time, and it is run here against
// fake timers, so the cap is advanced and not slept.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { awaitSettingsPull, SETTINGS_PULL_WAIT_MS } from './settings-pull-wait'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('awaitSettingsPull', () => {
  it('waits three seconds, and no longer', () => {
    expect(SETTINGS_PULL_WAIT_MS).toBe(3000)
  })

  it('says pulled when the pull lands in time', async () => {
    const pull = Promise.withResolvers<undefined>()
    const outcome = awaitSettingsPull(async () => pull.promise)

    pull.resolve(undefined)

    await expect(outcome).resolves.toBe('pulled')
  })

  it('says late when the pull has not landed by the cap, and not before', async () => {
    let outcome: string | undefined
    void awaitSettingsPull(async () => new Promise<void>(() => undefined)).then(
      (result) => {
        outcome = result
      },
    )

    await vi.advanceTimersByTimeAsync(SETTINGS_PULL_WAIT_MS - 1)
    expect(outcome).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(outcome).toBe('late')
  })

  it('waits the cap it is given', async () => {
    let outcome: string | undefined
    void awaitSettingsPull(
      async () => new Promise<void>(() => undefined),
      500,
    ).then((result) => {
      outcome = result
    })

    await vi.advanceTimersByTimeAsync(499)
    expect(outcome).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(outcome).toBe('late')
  })

  // A pull that ended without the account's settings (offline, signed out, a
  // newer pull took over) is not worth the three seconds: nothing is coming.
  it('says late at once when the pull ended without the account settings', async () => {
    const outcome = await awaitSettingsPull(async () =>
      Promise.reject(new Error('offline')),
    )

    expect(outcome).toBe('late')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('says late when asking for the pull throws, and never rejects', async () => {
    const outcome = await awaitSettingsPull(() => {
      throw new Error('boom')
    })

    expect(outcome).toBe('late')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves no timer behind once the pull has landed', async () => {
    const outcome = await awaitSettingsPull(async () => Promise.resolve())

    expect(outcome).toBe('pulled')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not change its answer when the pull lands after the cap', async () => {
    const pull = Promise.withResolvers<undefined>()
    const outcome = awaitSettingsPull(async () => pull.promise)

    await vi.advanceTimersByTimeAsync(SETTINGS_PULL_WAIT_MS)
    pull.resolve(undefined)

    await expect(outcome).resolves.toBe('late')
  })
})
