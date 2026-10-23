// ============================================================
// The opening takeover: what it asks for, when it waits to ask, and when it has decided
// ============================================================
//
// The hook runs inside a mounted component over the real plan store; only the
// seams App fills (the account check, the settings pull, the two openers and
// the call that says it has decided) are doubles. Each `load` is a page load:
// fresh modules over whatever storage the last one left, because the store
// reads its record once as it loads. The clock is fake, so the three-second
// wait is advanced and not slept.
//
// Every double writes its name into one list, so a case reads the order things
// happened in: what opened, and that "decided" came after it.

import { cleanup, render } from '@solidjs/testing-library'
import { onMount } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAN_RECORD_KEY } from './plan-keys'
import { NO_LINES, NOW, SYNCED, TYPED } from './plan-sync.fixture'
import { SETTINGS_PULL_WAIT_MS } from './settings-pull-wait'
import type { OpeningTakeoverDeps } from './useOpeningTakeover'

/** A page load: the store, the hook, and the settings pull's own way in. */
async function load() {
  vi.resetModules()
  const store = await import('./plan-store')
  const { useOpeningTakeover } = await import('./useOpeningTakeover')
  const { applyPersistedValue } = await import('@/lib/storage')
  return { store, useOpeningTakeover, applyPersistedValue }
}

type Loaded = Awaited<ReturnType<typeof load>>
type Store = Loaded['store']

/** A returning visitor on the web, signed out, with nothing due; each case changes what it is about. */
function arrange(change: Partial<OpeningTakeoverDeps> = {}) {
  const calls: string[] = []
  const d: OpeningTakeoverDeps = {
    native: false,
    routeSuppressed: () => false,
    welcomeDue: () => false,
    whatsNewDue: () => false,
    upgraded: () => false,
    settingsPulled: async () => undefined,
    openPlan: () => {
      calls.push('open plan')
    },
    announceWhatsNew: () => {
      calls.push('announce')
    },
    onDecided: () => {
      calls.push('decided')
    },
    ...change,
  }
  return { d, calls }
}

/** A signed-in singer whose settings pull is still out: `pull.resolve` lands it. */
function pending(change: Partial<OpeningTakeoverDeps> = {}) {
  const pull = Promise.withResolvers<undefined>()
  return {
    pull,
    ...arrange({
      upgraded: () => true,
      settingsPulled: async () => pull.promise,
      ...change,
    }),
  }
}

function mount(use: Loaded['useOpeningTakeover'], d: OpeningTakeoverDeps) {
  return render(() => {
    use(d)
    return null
  })
}

/** Lets what is waiting on a promise or a timer of zero run. */
const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
}

const onFile = (store: Store): void => {
  store.savePlanAnswers(TYPED, NO_LINES, null, NOW)
}
const shown = (store: Store): void => {
  store.markPlanShown('layer', NOW)
}
const declined = (store: Store): void => {
  store.declinePlan(TYPED, NOW)
}
const automatedRun = (): void => {
  ;(window as unknown as Record<string, unknown>)['E2E_TEST_MODE'] = true
}
const nothing = (): void => undefined
const boom = (): never => {
  throw new Error('boom')
}

/** The plan this singer answered on their phone, as the account has it. */
const answeredElsewhere = {
  v: 1,
  status: 'answered',
  choices: TYPED,
  at: NOW.toISOString(),
  via: 'layer',
  syncedAt: SYNCED.toISOString(),
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (window as unknown as Record<string, unknown>)['E2E_TEST_MODE']
})

describe('what it opens, and when it says it has decided', () => {
  // The surface is open before "decided" is said, so App's pause on the tour
  // offer never drops between the two. Every way out says it, so the offer is
  // never held back by a pick that opens nothing.
  it.each<
    [string, (store: Store) => void, Partial<OpeningTakeoverDeps>, string[]]
  >([
    [
      'the plan, for a visitor it was never put in front of',
      nothing,
      {},
      ['open plan', 'decided'],
    ],
    [
      "What's New, once the plan is on file",
      onFile,
      { whatsNewDue: () => true },
      ['announce', 'decided'],
    ],
    ['nothing, with the plan on file and nothing due', onFile, {}, ['decided']],
    [
      'nothing beside First Light',
      nothing,
      { welcomeDue: () => true, whatsNewDue: () => true },
      ['decided'],
    ],
    [
      'nothing on a link somebody was sent',
      nothing,
      { routeSuppressed: () => true, whatsNewDue: () => true },
      ['decided'],
    ],
    [
      'nothing in the native build',
      nothing,
      { native: true, whatsNewDue: () => true },
      ['decided'],
    ],
    [
      'nothing in an automated run, which seeds the welcome flag and so is every spec an existing user',
      automatedRun,
      { whatsNewDue: () => true },
      ['decided'],
    ],
  ])('picks %s', async (_, prepare, change, expected) => {
    const { store, useOpeningTakeover } = await load()
    prepare(store)
    const { d, calls } = arrange(change)

    mount(useOpeningTakeover, d)

    expect(calls).toEqual(expected)
  })

  // Whatever the record says, it is a record: the plan was put in front of this
  // person, and a takeover is for someone it never was.
  it.each<[string, (store: Store) => void]>([
    ['shown', shown],
    ['answered', onFile],
    ['declined', declined],
  ])('is not asked the plan with a %s record on file', async (_, prepare) => {
    const { store, useOpeningTakeover } = await load()
    prepare(store)
    const { d, calls } = arrange()

    mount(useOpeningTakeover, d)

    expect(calls).toEqual(['decided'])
  })

  // A takeover that throws costs the visit its takeover and nothing else: it
  // says so once, still says it has decided (a failure must not hold the tour
  // offer back), and leaves no unhandled rejection to fail the run.
  it.each<[string, (store: Store) => void, Partial<OpeningTakeoverDeps>]>([
    ['the plan fails to open', nothing, { openPlan: boom }],
    [
      "What's New fails to open",
      onFile,
      { whatsNewDue: () => true, announceWhatsNew: boom },
    ],
  ])('says so once, and decides, when %s', async (_, prepare, change) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { store, useOpeningTakeover } = await load()
    prepare(store)
    const { d, calls } = arrange(change)

    mount(useOpeningTakeover, d)
    await settle()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['decided'])
  })

  // Nobody is owed a wait: a visitor with no account has no pull, and the
  // native build has no takeover to hold.
  it.each<{
    given: string
    change: Partial<OpeningTakeoverDeps>
    calls: string[]
  }>([
    {
      given: 'a visitor with no account',
      change: {},
      calls: ['open plan', 'decided'],
    },
    {
      given: 'the native build, whoever is signed in',
      change: { native: true, upgraded: () => true, whatsNewDue: () => true },
      calls: ['decided'],
    },
  ])('does not wait for the settings pull given $given', async (row) => {
    const { useOpeningTakeover } = await load()
    const settingsPulled = vi.fn(async () => undefined)
    const { d, calls } = arrange({ ...row.change, settingsPulled })

    mount(useOpeningTakeover, d)
    await vi.advanceTimersByTimeAsync(5000)

    expect(settingsPulled).not.toHaveBeenCalled()
    expect(calls).toEqual(row.calls)
  })
})

// The router rewrites the address in its first dispatch (it erases a checkout
// return's hash, and keeps #/plan only while the layer is up), and First Light
// is spent when somebody finishes or skips it, which can be inside the wait. So
// what the visit came for is read once, at the start, and a first run that was
// due at the start is that visit's takeover whatever happens after.
describe('what the visit was at the start', () => {
  // The answer flips while the pull is out: a visit asked once keeps the one it
  // began with, and one asked again when the pull lands would take the other.
  it.each<['routeSuppressed' | 'welcomeDue', boolean]>([
    ['routeSuppressed', true],
    ['routeSuppressed', false],
    ['welcomeDue', true],
    ['welcomeDue', false],
  ])('reads %s once, at the start (began %s)', async (asked, began) => {
    const { useOpeningTakeover } = await load()
    let now = began
    const question = vi.fn(() => now)
    const { pull, d, calls } = pending({ [asked]: question })

    mount(useOpeningTakeover, d)
    now = !began
    pull.resolve(undefined)
    await settle()

    expect(question).toHaveBeenCalledTimes(1)
    // Suppressed or First Light's: nothing opens. Otherwise the plan does.
    expect(calls).toEqual(began ? ['decided'] : ['open plan', 'decided'])
  })
})

describe('a signed-in singer', () => {
  it.each<{ brings: string; record: object | null; calls: string[] }>([
    {
      brings: 'the plan answered on another device',
      record: answeredElsewhere,
      calls: ['decided'],
    },
    { brings: 'no plan', record: null, calls: ['open plan', 'decided'] },
  ])('waits for the settings pull, which brings $brings', async (row) => {
    const { useOpeningTakeover, applyPersistedValue } = await load()
    const { pull, d, calls } = pending()

    mount(useOpeningTakeover, d)
    await settle()
    // Not decided either: the tour offer keeps waiting with it.
    expect(calls).toEqual([])

    if (row.record !== null) {
      applyPersistedValue(PLAN_RECORD_KEY, JSON.stringify(row.record))
    }
    pull.resolve(undefined)
    await settle()

    expect(calls).toEqual(row.calls)
  })

  // Past the cap the plan stands aside, and What's New can have the visit.
  it.each<{ due: boolean; calls: string[] }>([
    { due: false, calls: ['decided'] },
    { due: true, calls: ['announce', 'decided'] },
  ])(
    "does not ask when the pull is late, with What's New due: $due",
    async (row) => {
      const { useOpeningTakeover } = await load()
      const { pull, d, calls } = pending({ whatsNewDue: () => row.due })

      mount(useOpeningTakeover, d)
      await vi.advanceTimersByTimeAsync(SETTINGS_PULL_WAIT_MS)
      expect(calls).toEqual(row.calls)

      // The takeover picks once: a pull that lands after the cap changes nothing.
      pull.resolve(undefined)
      await settle()
      expect(calls).toEqual(row.calls)
    },
  )

  // Offline, signed out in another tab or superseded by a newer pull, the
  // pull ends without the account's settings: the plan may well be there.
  it('does not ask when the pull ended without the account settings, and does not wait out the cap', async () => {
    const { useOpeningTakeover } = await load()
    const { d, calls } = arrange({
      upgraded: () => true,
      settingsPulled: async () => Promise.reject(new Error('offline')),
    })

    mount(useOpeningTakeover, d)
    await settle()

    expect(calls).toEqual(['decided'])
    expect(vi.getTimerCount()).toBe(0)
  })

  // The seen line syncs with the settings too, so the pull can tell a second
  // device that this release was read on the first.
  it("reads What's New after the pull, not before it", async () => {
    const { store, useOpeningTakeover } = await load()
    onFile(store)
    let due = true
    const { pull, d, calls } = pending({ whatsNewDue: () => due })

    mount(useOpeningTakeover, d)
    due = false
    pull.resolve(undefined)
    await settle()

    expect(calls).toEqual(['decided'])
  })

  it('decides when it is unmounted, and opens nothing after', async () => {
    const { useOpeningTakeover } = await load()
    const { pull, d, calls } = pending()

    const { unmount } = mount(useOpeningTakeover, d)
    unmount()
    expect(calls).toEqual(['decided'])
    pull.resolve(undefined)
    await vi.advanceTimersByTimeAsync(SETTINGS_PULL_WAIT_MS)

    expect(calls).not.toContain('open plan')
    expect(calls).not.toContain('announce')
  })
})

// useHashRouter's first dispatch runs in an onMount, and for every address
// but #/plan it closes the layer: one opened earlier in the same mount is
// closed before anyone has seen it. This proves the hook's part: it opens from
// an onMount of its own, never from its setup. That App mounts it after the
// router is a matter of the lazy chunk landing after the first render.
describe('when it opens', () => {
  it('opens from an onMount of its own, after one registered ahead of it', async () => {
    const { store, useOpeningTakeover } = await load()
    const order: string[] = []
    const { d } = arrange({
      openPlan: () => {
        order.push('takeover')
        store.openPlanLayer('existing')
      },
    })

    render(() => {
      // Stands in for useHashRouter: an onMount registered before the takeover.
      onMount(() => {
        order.push('router')
        store.closePlanLayer()
      })
      useOpeningTakeover(d)
      return null
    })

    expect(order).toEqual(['router', 'takeover'])
    expect(store.planLayerMode()).toBe('existing')
  })
})
