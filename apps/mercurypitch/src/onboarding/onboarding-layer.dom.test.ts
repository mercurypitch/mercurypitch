// ============================================================
// The onboarding layer: when it opens, what it holds, and how it leaves
// ============================================================
//
// Over the first Sing room of a new install, and never again. While it is
// up the Sing room waits and the rail steps aside; Back is its Not now,
// after any sheet over it.

import { createEffect, createRoot, on } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_HOME, TAB_SINGING } from '@/features/tabs/constants'
import { resetPathLandingForTests, takePathLanding, } from '@/features/warm-up/path-landing'
import { resetRoomArrivalHolds, roomArrivalHeld, } from '@/stores/native-shell-store'
import { resetRoomWordsHolds, roomWordsHeld } from '@/stores/room-words-store'
import { setActiveTab } from '@/stores/ui-store'
import { markWelcomeSeen, resetWelcome } from '../alley/alley-welcome'
import type * as Wiring from '../shell/premium-exercise-wiring'
import { moreOpen, onboardingShown, openMore, popScreen, pushed, pushScreen, railVisible, resetRunShell, } from '../shell/run-shell-store'
import { keepArrival, offerOpen, rangeFinder, resetAccountOffer, } from '../shell/settings/account-offer'
import { performBack, shellBackHost } from '../shell/shell-navigation'
import { onboardingDue, resetOnboarding, resetOnboardingFlagForTests, } from './onboarding-flag'
import { expectNoOnboarding, expectOnboarding, installNativeOnboarding, LEAVE_MS, leaveOnboarding, onboardingEntry, onboardingExit, onboardingMounted, openRangeFinder, registerLayerNotNow, registerLayerRange, } from './onboarding-layer'

/** The Rooms home's address: the alley. */
const ALLEY = '#/home'

// The landing's push, without the art its tap starts loading (the wiring's
// own test has that).
vi.mock('../shell/premium-exercise-wiring', async (importOriginal) => {
  const { pushScreen } = await import('../shell/run-shell-store')
  return {
    ...(await importOriginal<typeof Wiring>()),
    openPremiumExercise: () => pushScreen('warm-up'),
  }
})

// The onboarding's counts (S7b §7), heard on their way to the funnel.
const funnel = vi.hoisted(() => ({ sent: [] as string[] }))
vi.mock('@/features/onboarding/funnel', () => ({
  trackNativeOnboarding: (event: string) => funnel.sent.push(event),
}))

let dispose: (() => void) | null = null
/** Roots a test made, let go of after it. */
const cleanups: (() => void)[] = []

/** How often the shell was asked to load the layer's code. */
let preloads = 0

/** The shell's half, as NativeShell runs it. */
function install(): void {
  createRoot((done) => {
    dispose = done
    installNativeOnboarding(() => {
      preloads += 1
    })
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  resetOnboardingFlagForTests()
  resetWelcome()
  resetRunShell()
  resetRoomArrivalHolds()
  resetRoomWordsHolds()
  preloads = 0
  resetAccountOffer()
  setActiveTab(TAB_HOME)
  window.location.hash = ''
  funnel.sent = []
  resetPathLandingForTests()
})

afterEach(() => {
  for (const stop of cleanups.splice(0)) stop()
  dispose?.()
  dispose = null
  resetAccountOffer()
  vi.useRealTimers()
  localStorage.clear()
  resetOnboardingFlagForTests()
})

describe('the onboarding layer', () => {
  it('opens over the first Sing room of a new install, and holds it', () => {
    install()
    expect(onboardingDue()).toBe(true)
    expect(onboardingShown()).toBe(false)

    setActiveTab(TAB_SINGING)
    expect(onboardingShown()).toBe(true)
    expect(onboardingMounted()).toBe(true)
    // The room under it waits, and the rail steps aside.
    expect(roomArrivalHeld()).toBe(true)
    expect(railVisible()).toBe(false)
  })

  it('leaves once by Not now: done for good, for the alley, the rail back, then gone', () => {
    install()
    setActiveTab(TAB_SINGING)
    expect(leaveOnboarding('not-now')).toBe(true)
    expect(onboardingExit()).toBe('not-now')
    expect(onboardingDue()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(window.location.hash).toBe(ALLEY)
    // The router follows the address a task later: the Sing room under the
    // layer is never let in on the way.
    expect(roomArrivalHeld()).toBe(true)
    setActiveTab(TAB_HOME)
    expect(roomArrivalHeld()).toBe(false)
    expect(railVisible()).toBe(true)
    // Still drawn while it fades.
    expect(onboardingMounted()).toBe(true)
    vi.advanceTimersByTime(LEAVE_MS)
    expect(onboardingMounted()).toBe(false)
    expect(leaveOnboarding('finished')).toBe(false)

    // Never again on this install.
    setActiveTab(TAB_HOME)
    setActiveTab(TAB_SINGING)
    expect(onboardingShown()).toBe(false)
  })

  it("holds the room's words from the Sing door, loads the layer, and lets both go as one", () => {
    install()
    // The door picked: the code on its way, the room's words kept off.
    expectOnboarding()
    expect(preloads).toBe(1)
    expect(roomWordsHeld()).toBe(true)
    expect(roomArrivalHeld()).toBe(false)

    // The door opens into the room: the layer takes the hold over.
    setActiveTab(TAB_SINGING)
    expect(roomWordsHeld()).toBe(true)
    expect(roomArrivalHeld()).toBe(true)
    // A door gone back now changes nothing: the layer holds them.
    expectNoOnboarding()
    expect(roomWordsHeld()).toBe(true)

    // Not now: the words come back with the room's arrival, on the alley.
    leaveOnboarding('not-now')
    expect(roomWordsHeld()).toBe(true)
    setActiveTab(TAB_HOME)
    expect(roomWordsHeld()).toBe(false)
    expect(roomArrivalHeld()).toBe(false)
  })

  it("holds the words from the rail's Sing too, and lets them go under the path", () => {
    install()
    setActiveTab(TAB_SINGING)
    expect(roomWordsHeld()).toBe(true)

    leaveOnboarding('finished')
    // Under the path the room waits, words and all; Back lets it in.
    expect(pushed()).toBe('warm-up')
    expect(roomWordsHeld()).toBe(true)
    popScreen()
    expect(roomWordsHeld()).toBe(false)
  })

  it('lets the words go when the Sing door goes back into the alley', () => {
    install()
    expectOnboarding()
    expectOnboarding()
    expect(roomWordsHeld()).toBe(true)
    expectNoOnboarding()
    expect(roomWordsHeld()).toBe(false)
  })

  it('holds nothing and loads nothing once the onboarding is done', () => {
    markWelcomeSeen()
    install()
    expectOnboarding()
    expect(preloads).toBe(0)
    expect(roomWordsHeld()).toBe(false)
  })

  it('stays away from an install that has opened a door already', () => {
    markWelcomeSeen()
    install()
    expect(onboardingDue()).toBe(false)
    setActiveTab(TAB_SINGING)
    expect(onboardingShown()).toBe(false)
  })

  it('opens when the app starts on the Sing tab', () => {
    setActiveTab(TAB_SINGING)
    install()
    expect(onboardingShown()).toBe(true)
  })

  it('takes Back as Not now, after a sheet over it', () => {
    install()
    setActiveTab(TAB_SINGING)
    openMore()
    expect(performBack(shellBackHost())).toBe('sheet')
    expect(moreOpen()).toBe(false)
    expect(onboardingShown()).toBe(true)

    expect(performBack(shellBackHost())).toBe('onboarding')
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
    expect(onboardingDue()).toBe(false)
  })

  it('waits for the next Sing door after a replay, not the screen it came from', () => {
    install()
    setActiveTab(TAB_SINGING)
    leaveOnboarding('not-now')
    vi.advanceTimersByTime(LEAVE_MS)

    // "Replay the onboarding", from a screen over the Sing tab.
    resetOnboarding()
    expect(onboardingShown()).toBe(false)
    setActiveTab(TAB_HOME)
    setActiveTab(TAB_SINGING)
    expect(onboardingShown()).toBe(true)
  })

  it('lets go of everything with the shell', () => {
    install()
    setActiveTab(TAB_SINGING)
    dispose?.()
    dispose = null
    expect(onboardingShown()).toBe(false)
    expect(onboardingMounted()).toBe(false)
    expect(roomArrivalHeld()).toBe(false)
  })

  it('lets the Sing room go with the shell on the way to the alley', () => {
    install()
    setActiveTab(TAB_SINGING)
    leaveOnboarding('not-now')
    expect(roomArrivalHeld()).toBe(true)

    dispose?.()
    dispose = null

    expect(roomArrivalHeld()).toBe(false)
  })

  it("hands Back to the layer's own Not now while it has one", () => {
    install()
    setActiveTab(TAB_SINGING)
    const notNow = vi.fn()
    const unregister = registerLayerNotNow(notNow)

    expect(performBack(shellBackHost())).toBe('onboarding')
    unregister()

    // The layer decides how it leaves: the Cloud offer may come first.
    expect(notNow).toHaveBeenCalledTimes(1)
    expect(onboardingShown()).toBe(true)
    expect(performBack(shellBackHost())).toBe('onboarding')
    expect(onboardingShown()).toBe(false)
  })
})

describe('the landing (S7b beat 10)', () => {
  it("ends on the Warm-up's path: pushed over the Sing room while the layer is still up, its open the landing", () => {
    install()
    setActiveTab(TAB_SINGING)
    let underTheLayer: boolean | null = null
    createRoot((done) => {
      cleanups.push(done)
      // The path's push, seen as it happens: the layer still over it.
      createEffect(
        on(
          pushed,
          (top) => {
            if (top === 'warm-up') underTheLayer = onboardingShown()
          },
          { defer: true },
        ),
      )
    })

    leaveOnboarding('finished')

    expect(pushed()).toBe('warm-up')
    expect(underTheLayer).toBe(true)
    // The Sing room waits under the path: arriving there, it would open its
    // mic on a remembered grant. Back from the path lets it in.
    expect(roomArrivalHeld()).toBe(true)
    expect(railVisible()).toBe(false)
    popScreen()
    expect(roomArrivalHeld()).toBe(false)
    expect(railVisible()).toBe(true)
    expect(takePathLanding()).toBe(true)
    expect(funnel.sent).toEqual([
      'native_onboarding_install',
      'native_onboarding_done',
      'native_onboarding_path_view',
    ])
  })

  it('waits to let the Sing room in until the path and the rooms over it are gone', () => {
    install()
    setActiveTab(TAB_SINGING)
    leaveOnboarding('finished')

    // A stop's room over the path, and back to the path: still waiting.
    pushScreen('lip-roll')
    popScreen()
    expect(roomArrivalHeld()).toBe(true)
    popScreen()
    expect(roomArrivalHeld()).toBe(false)
  })

  it('lets the Sing room go with the shell, the path still up', () => {
    install()
    setActiveTab(TAB_SINGING)
    leaveOnboarding('finished')

    dispose?.()
    dispose = null

    expect(roomArrivalHeld()).toBe(false)
  })

  it('lands Not now in the alley, with nothing pushed (owner, 20 Oct)', () => {
    install()
    setActiveTab(TAB_SINGING)

    leaveOnboarding('not-now')

    expect(pushed()).toBeNull()
    expect(takePathLanding()).toBe(false)
    expect(window.location.hash).toBe(ALLEY)
  })

  it('pushes nothing for the range on its own, which goes back to Keep', () => {
    install()
    setActiveTab(TAB_HOME)
    openRangeFinder(() => undefined)

    leaveOnboarding('finished')

    expect(pushed()).toBeNull()
    expect(takePathLanding()).toBe(false)
  })
})

describe('counted (S7b §7)', () => {
  it('counts a new install once, as its flag first settles, and the end', () => {
    install()
    dispose?.()
    install()
    setActiveTab(TAB_SINGING)
    leaveOnboarding('finished')

    expect(funnel.sent).toEqual([
      'native_onboarding_install',
      'native_onboarding_done',
      'native_onboarding_path_view',
    ])
  })

  it('counts a Not now as its own way out', () => {
    install()
    setActiveTab(TAB_SINGING)
    performBack(shellBackHost())

    expect(funnel.sent).toEqual([
      'native_onboarding_install',
      'native_onboarding_not_now',
    ])
  })

  it('counts no install for one that has opened a door already', () => {
    markWelcomeSeen()
    install()

    expect(funnel.sent).toEqual([])
  })
})

describe('the range on its own, from Keep', () => {
  /** Keep's "Find your range first", as the sheet runs it. */
  function findRangeFirst(): void {
    const run = rangeFinder()
    if (run === null) throw new Error('no range finder registered')
    run()
  }

  it('is registered with Keep while the shell lives, and goes with it', () => {
    install()
    expect(rangeFinder()).not.toBeNull()

    dispose?.()
    dispose = null

    expect(rangeFinder()).toBeNull()
  })

  it('comes up over any tab, leaves the onboarding due, and opens Keep again, its card flying in from the reveal', () => {
    install()
    findRangeFirst()
    expect(onboardingShown()).toBe(true)
    expect(onboardingEntry()).toBe('range')
    expect(railVisible()).toBe(false)
    expect(offerOpen()).toBe(false)

    leaveOnboarding('finished')

    expect(offerOpen()).toBe(true)
    expect(keepArrival()).toBe('reveal')
    expect(onboardingDue()).toBe(true)
    expect(railVisible()).toBe(true)
  })

  it('opens Keep again when it leaves by Back, with no reveal to fly from', () => {
    install()
    findRangeFirst()

    expect(performBack(shellBackHost())).toBe('onboarding')

    expect(offerOpen()).toBe(true)
    expect(keepArrival()).toBe('plain')
    expect(onboardingDue()).toBe(true)
  })

  it("runs the onboarding's own range when Keep is over the onboarding (beat 7)", () => {
    install()
    setActiveTab(TAB_SINGING)
    const run = vi.fn()
    const unregister = registerLayerRange(run)

    findRangeFirst()
    unregister()
    findRangeFirst()

    expect(run).toHaveBeenCalledTimes(1)
    expect(onboardingEntry()).toBe('onboarding')
    expect(onboardingShown()).toBe(true)
  })

  it('does not come up over the onboarding, nor open Keep when that leaves', () => {
    install()
    setActiveTab(TAB_SINGING)
    findRangeFirst()
    expect(onboardingEntry()).toBe('onboarding')

    leaveOnboarding('not-now')

    expect(offerOpen()).toBe(false)
    expect(onboardingDue()).toBe(false)
  })

  it('takes over a layer still fading from the onboarding', () => {
    install()
    setActiveTab(TAB_SINGING)
    leaveOnboarding('finished')
    expect(onboardingMounted()).toBe(true)

    findRangeFirst()
    vi.advanceTimersByTime(LEAVE_MS)

    expect(onboardingEntry()).toBe('range')
    expect(onboardingShown()).toBe(true)
    expect(onboardingMounted()).toBe(true)
  })
})
