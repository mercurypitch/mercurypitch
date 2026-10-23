// ============================================================
// Plan sync — when the plan reaches the account, and what goes
// ============================================================
//
// The answers and the two typed lines go to the account only once there is a
// real one (a password, Google or Apple account, never the anonymous identity
// that a first write mints), only for a plan that was answered, and once: the
// record's synced date says so, and it syncs with the settings, so a second
// device that has pulled it sends nothing. A write that fails changes nothing
// and is tried again; a plan changed since it was sent goes again. What goes
// is the ids, the two lines and the date, a line only while the plan still
// picks its option. Whatever goes wrong, the sync resolves: callers do not look.
//
// The store is the real one and the writer is a spy, so what the account would
// have been given is read off the call. Each case builds fresh modules, because
// the store reads storage once, as it loads. Only Date is faked.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '@/lib/storage-port'
import { PLAN_RECORD_KEY, PLAN_TEXT_KEY } from './plan-keys'
import { readPlanTexts } from './plan-record'
import type * as PlanStore from './plan-store'
import type * as PlanSync from './plan-sync'
import { FUTURE, LATER, LINES, NO_LINES, NOW, OTHER, SENT, sentFor, SYNCED, tokenFor, TYPED, } from './plan-sync.fixture'
import { accepting, answered, fresh, pull } from './plan-sync.harness.fixture'
import { EMPTY_CHOICES } from './questions'

const mocks = vi.hoisted(() => ({
  submitPlanResponse: vi.fn(),
}))

vi.mock('@/db/services/survey-service', () => ({
  submitPlanResponse: mocks.submitPlanResponse,
}))

/** What a broken dependency does. */
const boom = (): never => {
  throw new Error('boom')
}

/** Holds the writer's next call until the returned promise is settled. */
function held(deps: ReturnType<typeof accepting>) {
  const arrival = Promise.withResolvers<undefined>()
  deps.submit.mockImplementationOnce(async () => arrival.promise)
  return arrival
}

/** The record as storage holds it, parsed. */
const stored = (): unknown =>
  JSON.parse(localStorage.getItem(PLAN_RECORD_KEY) ?? 'null')

beforeEach(() => {
  localStorage.clear()
  mocks.submitPlanResponse.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SYNCED)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('who the plan is sent for', () => {
  it('sends nothing without a real account', async () => {
    const { store, sync, deps } = await answered(false)

    const result = await sync.syncPlanToAccount(deps)

    expect(result).toBe('skipped')
    expect(deps.submit).not.toHaveBeenCalled()
    expect(store.planRecord()?.syncedAt).toBeUndefined()
  })

  // The token is made inside the case, after the clock is set: a table built
  // here would be dated by the real clock, and "run out" would still be valid.
  it.each<[string, (() => string) | null, 'synced' | 'skipped']>([
    ['nobody signed in', null, 'skipped'],
    [
      'an anonymous identity, which holds a valid token',
      () => tokenFor('anonymous'),
      'skipped',
    ],
    [
      'a real account whose token has run out',
      () => tokenFor('password', -3600),
      'skipped',
    ],
    ['a password account', () => tokenFor('password'), 'synced'],
    ['a google account', () => tokenFor('google'), 'synced'],
    ['an apple account', () => tokenFor('apple'), 'synced'],
  ])('asks the real account check: %s', async (_, make, expected) => {
    if (make !== null) localStorage.setItem(AUTH_TOKEN_KEY, make())
    const { sync, deps } = await answered()

    const result = await sync.syncPlanToAccount({ submit: deps.submit })

    expect(result).toBe(expected)
    expect(deps.submit).toHaveBeenCalledTimes(expected === 'synced' ? 1 : 0)
  })

  it('writes through the survey service when no writer is given', async () => {
    const { sync } = await answered()
    mocks.submitPlanResponse.mockResolvedValue(undefined)

    const result = await sync.syncPlanToAccount({ upgraded: () => true })

    expect(result).toBe('synced')
    expect(mocks.submitPlanResponse).toHaveBeenCalledWith(SENT)
  })
})

describe('which plan is sent', () => {
  it.each<[string, (store: typeof PlanStore) => void]>([
    ['no record', () => undefined],
    [
      'a plan that was only shown',
      (store) => store.markPlanShown('layer', NOW),
    ],
    // Nothing marks a plan that was turned down (markPlanSynced leaves it
    // alone), so it would go again at every sign-in and every load.
    ['a plan that was turned down', (store) => store.declinePlan(OTHER, NOW)],
  ])('sends nothing for %s', async (_, put) => {
    const { store, sync } = await fresh()
    put(store)
    const deps = accepting()

    const result = await sync.syncPlanToAccount(deps)

    expect(result).toBe('skipped')
    expect(deps.submit).not.toHaveBeenCalled()
  })

  it("sends nothing for a record it cannot read, and leaves a newer client's record alone", async () => {
    localStorage.setItem(PLAN_RECORD_KEY, FUTURE)
    const { sync } = await fresh()
    const deps = accepting()

    const result = await sync.syncPlanToAccount(deps)

    expect(result).toBe('skipped')
    expect(deps.submit).not.toHaveBeenCalled()
    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(FUTURE)
  })

  it('sends the typed lines once per account', async () => {
    const { store, sync, deps } = await answered()

    const first = await sync.syncPlanToAccount(deps)
    const second = await sync.syncPlanToAccount(deps)

    expect(first).toBe('synced')
    expect(second).toBe('skipped')
    expect(deps.submit).toHaveBeenCalledTimes(1)
    expect(deps.submit).toHaveBeenCalledWith(SENT)
    expect(store.planRecord()?.syncedAt).toBe(SYNCED.toISOString())
    expect(stored()).toMatchObject({ syncedAt: SYNCED.toISOString() })
  })

  it('does not send a plan the account already has', async () => {
    const { store, sync, deps } = await answered()
    // Another device sent it and marked it; the settings pull brings the mark.
    await pull({ ...store.planRecord(), syncedAt: SYNCED.toISOString() })

    const result = await sync.syncPlanToAccount(deps)

    expect(result).toBe('skipped')
    expect(deps.submit).not.toHaveBeenCalled()
  })

  it('tries again after a failed write', async () => {
    const { store, sync, deps } = await answered()
    deps.submit.mockRejectedValueOnce(new Error('offline'))

    const first = await sync.syncPlanToAccount(deps)

    expect(first).toBe('failed')
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[plan-sync]'),
      expect.objectContaining({ message: 'offline' }),
    )
    expect(store.planRecord()?.syncedAt).toBeUndefined()
    expect(JSON.parse(localStorage.getItem(PLAN_TEXT_KEY) ?? '{}')).toEqual(
      LINES,
    )

    const second = await sync.syncPlanToAccount(deps)

    expect(second).toBe('synced')
    expect(deps.submit).toHaveBeenCalledTimes(2)
    expect(deps.submit).toHaveBeenNthCalledWith(1, SENT)
    expect(deps.submit).toHaveBeenNthCalledWith(2, SENT)
    expect(store.planRecord()?.syncedAt).toBe(SYNCED.toISOString())
  })

  it('sends a changed plan again', async () => {
    const { store, sync, deps } = await answered()
    await sync.syncPlanToAccount(deps)

    store.savePlanAnswers(OTHER, NO_LINES, null, LATER)
    const result = await sync.syncPlanToAccount(deps)

    expect(result).toBe('synced')
    expect(deps.submit).toHaveBeenCalledTimes(2)
    expect(deps.submit).toHaveBeenLastCalledWith(
      sentFor(OTHER, NO_LINES, LATER),
    )
    expect(store.planRecord()?.syncedAt).toBe(SYNCED.toISOString())
  })
})

describe('what is sent', () => {
  it('sends the ids, the two lines and the date, and nothing else about the plan', async () => {
    const { store, sync } = await fresh()
    store.markPlanShown('first-light', NOW)
    store.savePlanAnswers(
      TYPED,
      LINES,
      { room: 'exercises', detail: 'Long Note' },
      LATER,
    )
    const deps = accepting()

    await sync.syncPlanToAccount(deps)

    // No `via`, no voiceprint and no synced date go with it.
    expect(deps.submit).toHaveBeenCalledWith(sentFor(TYPED, LINES, LATER))
    expect(Object.keys(deps.submit.mock.calls[0][0]).sort()).toEqual([
      'at',
      'choices',
      'kind',
      'status',
      'texts',
      'v',
    ])
  })

  it('has a field for every answer and every line the plan holds, so a new one is decided on', async () => {
    const { sync, deps } = await answered()

    await sync.syncPlanToAccount(deps)

    const { choices, texts } = deps.submit.mock.calls[0][0]
    expect(Object.keys(choices).sort()).toEqual(
      Object.keys(EMPTY_CHOICES).sort(),
    )
    expect(Object.keys(texts).sort()).toEqual(
      Object.keys(readPlanTexts()).sort(),
    )
  })

  // Changed here, the store blanks the lines as it saves. Changed on another
  // device, the record comes by the settings pull and this device's lines stay
  // as they were: only the record says which options are picked.
  it.each<[string, (store: typeof PlanStore) => Promise<void> | void]>([
    [
      'the answers were changed here',
      (store) => store.savePlanAnswers(OTHER, LINES, null, LATER),
    ],
    [
      'the answers were changed on another device',
      (store) => pull({ ...store.planRecord(), choices: OTHER }),
    ],
  ])(
    'never sends a line whose option is no longer picked: %s',
    async (_, change) => {
      const { store, sync, deps } = await answered()
      await change(store)

      await sync.syncPlanToAccount(deps)

      expect(deps.submit).toHaveBeenCalledTimes(1)
      expect(deps.submit.mock.calls[0][0].texts).toEqual(NO_LINES)
      expect(JSON.stringify(deps.submit.mock.calls)).not.toContain('neighbours')
      expect(JSON.stringify(deps.submit.mock.calls)).not.toContain('Duolingo')
    },
  )
})

describe('the caller', () => {
  // The read of the record comes after the pull's await, and that place is
  // what keeps it out of the caller's effect: read ahead of the await, the
  // effect would track the record and run again for every answer.
  it('reads the record after the pull, so a caller asking for a sync does not come to depend on it', async () => {
    const { store, sync, deps } = await answered()
    const { createEffect, createRoot } = await import('solid-js')
    let runs = 0
    let sent: Promise<unknown> = Promise.resolve()
    const dispose = createRoot((dispose) => {
      createEffect(() => {
        runs += 1
        sent = sync.syncPlanToAccount(deps)
      })
      return dispose
    })
    await sent

    // The first sync marked the record and the person then answers again:
    // an effect that depended on the record would have run again for each.
    store.savePlanAnswers(OTHER, NO_LINES, null, LATER)

    expect(runs).toBe(1)
    dispose()
  })

  // The plan's own screens call the sync and read nothing back. Whatever goes
  // wrong, it resolves, so there is nothing to catch and nothing unhandled.
  it.each<[string, Partial<PlanSync.PlanSyncDeps>]>([
    ['the account check throws', { upgraded: boom }],
    ['the writer throws before it returns a promise', { submit: boom }],
  ])('resolves failed, and marks nothing, when %s', async (_, broken) => {
    const { store, sync, deps } = await answered()

    const result = await sync.syncPlanToAccount({ ...deps, ...broken })

    expect(result).toBe('failed')
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[plan-sync]'),
      expect.any(Error),
    )
    expect(store.planRecord()?.syncedAt).toBeUndefined()
  })
})

describe('a send that is on its way', () => {
  it('marks the plan it sent, and not one answered while it was on the way', async () => {
    const { store, sync, deps } = await answered()
    // The person answers again while the first plan is on its way.
    deps.submit.mockImplementationOnce(async () => {
      store.savePlanAnswers(OTHER, NO_LINES, null, LATER)
    })

    // The first plan did arrive, and the second has not been sent.
    expect(await sync.syncPlanToAccount(deps)).toBe('synced')
    expect(store.planRecord()?.at).toBe(LATER.toISOString())
    expect(store.planRecord()?.syncedAt).toBeUndefined()

    expect(await sync.syncPlanToAccount(deps)).toBe('synced')
    expect(deps.submit).toHaveBeenCalledTimes(2)
    expect(deps.submit).toHaveBeenLastCalledWith(
      expect.objectContaining({ choices: OTHER, at: LATER.toISOString() }),
    )
    expect(store.planRecord()?.syncedAt).toBe(SYNCED.toISOString())
  })

  it('does not send the same plan twice when asked again before the first arrives', async () => {
    const { sync, deps } = await answered()
    const arrival = held(deps)

    // Two sign-in changes, a moment apart, ask for the same plan.
    const first = sync.syncPlanToAccount(deps)
    const second = sync.syncPlanToAccount(deps)
    arrival.resolve(undefined)

    expect(await Promise.all([first, second])).toEqual(['synced', 'synced'])
    expect(deps.submit).toHaveBeenCalledTimes(1)
  })

  it('sends again after a failed send is over, not before', async () => {
    const { sync, deps } = await answered()
    const arrival = held(deps)

    const first = sync.syncPlanToAccount(deps)
    arrival.reject(new Error('offline'))

    expect(await first).toBe('failed')
    expect(await sync.syncPlanToAccount(deps)).toBe('synced')
    expect(deps.submit).toHaveBeenCalledTimes(2)
  })
})
