// ============================================================
// The onboarding layer: when it opens, what it holds, and how it leaves
// ============================================================
//
// Over the first Sing room of a new install, and never again. While it is
// up the Sing room waits and the rail steps aside; Back is its Not now,
// after any sheet over it.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_HOME, TAB_SINGING } from '@/features/tabs/constants'
import { resetRoomArrivalHolds, roomArrivalHeld, } from '@/stores/native-shell-store'
import { setActiveTab } from '@/stores/ui-store'
import { markWelcomeSeen, resetWelcome } from '../alley/alley-welcome'
import { moreOpen, onboardingShown, openMore, railVisible, resetRunShell, } from '../shell/run-shell-store'
import { keepArrival, offerOpen, rangeFinder, resetAccountOffer, } from '../shell/settings/account-offer'
import { performBack, shellBackHost } from '../shell/shell-navigation'
import { onboardingDue, resetOnboarding, resetOnboardingFlagForTests, } from './onboarding-flag'
import { installNativeOnboarding, LEAVE_MS, leaveOnboarding, onboardingEntry, onboardingExit, onboardingMounted, registerLayerRange, } from './onboarding-layer'

// The onboarding's counts (S7b §7), heard on their way to the funnel.
const funnel = vi.hoisted(() => ({ sent: [] as string[] }))
vi.mock('@/features/onboarding/funnel', () => ({
  trackNativeOnboarding: (event: string) => funnel.sent.push(event),
}))

let dispose: (() => void) | null = null

/** The shell's half, as NativeShell runs it. */
function install(): void {
  createRoot((done) => {
    dispose = done
    installNativeOnboarding()
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  resetOnboardingFlagForTests()
  resetWelcome()
  resetRunShell()
  resetRoomArrivalHolds()
  resetAccountOffer()
  setActiveTab(TAB_HOME)
  funnel.sent = []
})

afterEach(() => {
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

  it('leaves once: done for good, the room let in, the rail back, then gone', () => {
    install()
    setActiveTab(TAB_SINGING)
    expect(leaveOnboarding('finished')).toBe(true)
    expect(onboardingExit()).toBe('finished')
    expect(onboardingDue()).toBe(false)
    expect(onboardingShown()).toBe(false)
    expect(roomArrivalHeld()).toBe(false)
    expect(railVisible()).toBe(true)
    // Still drawn while it fades.
    expect(onboardingMounted()).toBe(true)
    vi.advanceTimersByTime(LEAVE_MS)
    expect(onboardingMounted()).toBe(false)
    expect(leaveOnboarding('not-now')).toBe(false)

    // Never again on this install.
    setActiveTab(TAB_HOME)
    setActiveTab(TAB_SINGING)
    expect(onboardingShown()).toBe(false)
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
