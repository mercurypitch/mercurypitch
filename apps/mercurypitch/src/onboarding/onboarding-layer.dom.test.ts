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
import { performBack, shellBackHost } from '../shell/shell-navigation'
import { onboardingDue, resetOnboarding, resetOnboardingFlagForTests, } from './onboarding-flag'
import { installNativeOnboarding, LEAVE_MS, leaveOnboarding, onboardingExit, onboardingMounted, } from './onboarding-layer'

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
  setActiveTab(TAB_HOME)
})

afterEach(() => {
  dispose?.()
  dispose = null
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
