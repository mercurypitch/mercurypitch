// ============================================================
// The onboarding layer: when it opens, and what it holds while it is up
// ============================================================
//
// The first run is the alley (S4 decision 10, S7b beat 1). The onboarding
// opens over the Sing room the first time the Sing tab comes up on an
// install whose onboarding is due (onboarding-flag.ts): through the alley's
// Sing door, or the rail's Sing. While it is up:
//
//   - the Sing room under it waits (holdRoomArrival): no mic, no header, no
//     words, until the onboarding goes. Then it arrives as it would have,
//     live if the singer granted the mic here;
//   - the rail steps aside (run-shell-store.ts `onboardingShown`), and a
//     phone stays upright (portrait-lock.ts);
//   - Back is Not now (shell-navigation.ts `registerOnboardingBack`).
//
// It leaves once, by Not now or by its own last beat, and the flag records
// that at once: it never opens again on this install. The shell is back as
// it starts to fade (LEAVE_MS); the layer unmounts when the fade is over.

import { createEffect, createSignal, on, onCleanup, untrack } from 'solid-js'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { TAB_SINGING } from '@/features/tabs/constants'
import { holdRoomArrival } from '@/stores/native-shell-store'
import { welcomeSeen } from '../alley/alley-welcome'
import { currentTab, onboardingShown, setOnboardingShown, } from '../shell/run-shell-store'
import { registerOnboardingBack } from '../shell/shell-navigation'
import { markOnboardingDone, onboardingDue, settleOnboarding, } from './onboarding-flag'

/** The layer's fade out, ms (the shell's --mp-in). */
export const LEAVE_MS = 280
/** The same under reduced motion: the shell's crossfade. */
export const LEAVE_REDUCED_MS = 120

export type OnboardingExit = 'not-now' | 'finished'

const [mounted, setMounted] = createSignal(false)

/** Whether the layer is in the document: from its opening to the end of its fade. */
export const onboardingMounted = mounted

/** The Sing room's arrival, held while the onboarding is up. */
let releaseArrival: (() => void) | null = null
let unmount: ReturnType<typeof setTimeout> | null = null
let lastExit: OnboardingExit | null = null

function leaveMs(): number {
  return prefersReducedMotion() ? LEAVE_REDUCED_MS : LEAVE_MS
}

/** Put the onboarding up, over the tab. Nothing when it is up already. */
export function openOnboarding(): void {
  if (untrack(onboardingShown)) return
  if (unmount !== null) {
    clearTimeout(unmount)
    unmount = null
  }
  releaseArrival ??= holdRoomArrival()
  setMounted(true)
  setOnboardingShown(true)
}

/**
 * The onboarding leaves: done for good, the Sing room let in, the rail
 * back, and the layer gone once it has faded. True when it was up.
 */
export function leaveOnboarding(exit: OnboardingExit): boolean {
  if (!untrack(onboardingShown)) return false
  lastExit = exit
  markOnboardingDone()
  setOnboardingShown(false)
  releaseArrival?.()
  releaseArrival = null
  unmount = setTimeout(() => {
    unmount = null
    setMounted(false)
  }, leaveMs())
  return true
}

/** How the onboarding last left, for its tests and its walk. */
export function onboardingExit(): OnboardingExit | null {
  return lastExit
}

/**
 * The shell's half, for as long as the shell lives: the flag settled, the
 * layer opened when the Sing tab comes up while it is due (or the app
 * starts on it), and Back.
 */
export function installNativeOnboarding(): void {
  settleOnboarding(welcomeSeen())
  onCleanup(registerOnboardingBack(() => leaveOnboarding('not-now')))
  // On the tab's arrival, not on the flag's change: "Replay the
  // onboarding" sets it due from a screen that may sit over the Sing tab,
  // and the onboarding is for the next Sing door, not for that screen.
  createEffect(
    on(currentTab, (tab) => {
      if (tab === TAB_SINGING && untrack(onboardingDue)) openOnboarding()
    }),
  )
  onCleanup(() => {
    if (unmount !== null) clearTimeout(unmount)
    unmount = null
    releaseArrival?.()
    releaseArrival = null
    setOnboardingShown(false)
    setMounted(false)
  })
}
