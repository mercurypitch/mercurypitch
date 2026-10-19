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
// Its own end lands on the Warm-up's path (onboarding-landing.ts); Not now
// leaves for the Sing room under it. Under the path the Sing room waits on:
// arriving there it would open its mic on a remembered grant, under a
// screen that wants the mic to itself. Back from the path lets it in.
//
// Keep's "Find your range first" (S7b §3.2), which the shell registers with
// Keep for as long as the shell lives (account-offer.ts
// registerRangeFinder): a build without the onboarding has no range, and
// its Keep offers none. What it runs depends on what is under Keep:
//
//   - the onboarding, on its beat 7: the onboarding's own range, in the
//     layer that is up (`registerLayerRange`), and the onboarding brings
//     Keep back after it;
//   - anything else: the range and the reveal on their own, in this same
//     layer (`openRangeFinder`), then Keep again, however the layer leaves.
//     That is not the onboarding, so the flag is left as it is.

import { createEffect, createRoot, createSignal, on, onCleanup, untrack, } from 'solid-js'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { trackNativeOnboarding } from '@/features/onboarding/funnel'
import { TAB_SINGING } from '@/features/tabs/constants'
import { holdRoomArrival } from '@/stores/native-shell-store'
import { welcomeSeen } from '../alley/alley-welcome'
import { currentTab, onboardingShown, pushed, setOnboardingShown, } from '../shell/run-shell-store'
import { openKeep, openKeepFromReveal, registerRangeFinder, } from '../shell/settings/account-offer'
import { registerOnboardingBack } from '../shell/shell-navigation'
import { markOnboardingDone, onboardingDue, settleOnboarding, } from './onboarding-flag'
import { landOnWarmUp } from './onboarding-landing'

/** The layer's fade out, ms (the shell's --mp-in). */
export const LEAVE_MS = 280
/** The same under reduced motion: the shell's crossfade. */
export const LEAVE_REDUCED_MS = 120

export type OnboardingExit = 'not-now' | 'finished'

/** What the layer opened for: the onboarding, or the range on its own. */
export type OnboardingEntry = 'onboarding' | 'range'

const [mounted, setMounted] = createSignal(false)
const [entry, setEntry] = createSignal<OnboardingEntry>('onboarding')

/** Whether the layer is in the document: from its opening to the end of its fade. */
export const onboardingMounted = mounted

/** What the layer is up for; read by the layer as it mounts. */
export const onboardingEntry = entry

/** The Sing room's arrival, held while the onboarding is up. */
let releaseArrival: (() => void) | null = null
let unmount: ReturnType<typeof setTimeout> | null = null
let lastExit: OnboardingExit | null = null
/** What runs once the range on its own has left: Keep, again. */
let afterRange: ((exit: OnboardingExit) => void) | null = null
/** The onboarding's own range, while its layer is up to run it. */
let layerRange: (() => void) | null = null
/** Lets the Sing room in under the landing's path, at once. */
let letInNow: (() => void) | null = null

function leaveMs(): number {
  return prefersReducedMotion() ? LEAVE_REDUCED_MS : LEAVE_MS
}

/** Up, for `next`. The entry is set before the lazy layer mounts and reads it. */
function show(next: OnboardingEntry): void {
  if (unmount !== null) {
    // Still fading from the last time: a fresh layer, not the faded one.
    clearTimeout(unmount)
    unmount = null
    setMounted(false)
  }
  setEntry(next)
  releaseArrival ??= holdRoomArrival()
  setMounted(true)
  setOnboardingShown(true)
}

/** Put the onboarding up, over the tab. Nothing when it is up already. */
export function openOnboarding(): void {
  if (untrack(onboardingShown)) return
  afterRange = null
  show('onboarding')
}

/**
 * The range and the reveal on their own (Keep's "Find your range first"),
 * then `then` once the layer leaves, whichever way it leaves, told which.
 * Nothing when the layer is up already.
 */
export function openRangeFinder(then: (exit: OnboardingExit) => void): void {
  if (untrack(onboardingShown)) return
  afterRange = then
  show('range')
}

/**
 * The onboarding's layer registers its own range here while it is up, so
 * Keep over its beat 7 runs that one, inside Keep's tap (the mic opens in
 * it). Registration returns its own unregister.
 */
export function registerLayerRange(run: () => void): () => void {
  layerRange = run
  return () => {
    if (layerRange === run) layerRange = null
  }
}

/** After the reveal's Continue the card flies in; any other way, it is there. */
function keepAgain(exit: OnboardingExit): void {
  if (exit === 'finished') openKeepFromReveal()
  else openKeep()
}

/**
 * Keep's "Find your range first": the onboarding's own range when the
 * onboarding is up under Keep, else the range on its own, then Keep again.
 */
function findRangeFromKeep(): void {
  if (untrack(onboardingShown)) {
    layerRange?.()
    return
  }
  openRangeFinder(keepAgain)
}

/**
 * The Sing room under the landing's path arrives once nothing is pushed
 * over it any more: Back from the path, from any stop it went on to.
 */
function letInOnceUncovered(release: () => void): void {
  createRoot((dispose) => {
    const letIn = (): void => {
      if (letInNow === letIn) letInNow = null
      dispose()
      release()
    }
    letInNow = letIn
    createEffect(
      on(
        pushed,
        (top) => {
          if (top === null) letIn()
        },
        { defer: true },
      ),
    )
  })
}

/**
 * The layer leaves: the onboarding done for good (the range on its own
 * leaves the flag be), the Sing room let in (after the landing's path, on
 * the onboarding's own end), the rail back, and the layer gone once it has
 * faded. True when it was up.
 */
export function leaveOnboarding(exit: OnboardingExit): boolean {
  if (!untrack(onboardingShown)) return false
  lastExit = exit
  const landing = untrack(entry) === 'onboarding' && exit === 'finished'
  if (untrack(entry) === 'onboarding') {
    markOnboardingDone()
    trackNativeOnboarding(
      exit === 'not-now'
        ? 'native_onboarding_not_now'
        : 'native_onboarding_done',
    )
    // Pushed while the layer is still up: it fades off the path.
    if (landing) landOnWarmUp()
  }
  setOnboardingShown(false)
  const release = releaseArrival
  releaseArrival = null
  if (release !== null && landing && untrack(pushed) !== null) {
    letInOnceUncovered(release)
  } else {
    release?.()
  }
  unmount = setTimeout(() => {
    unmount = null
    setMounted(false)
  }, leaveMs())
  const then = afterRange
  afterRange = null
  then?.(exit)
  return true
}

/** How the onboarding last left, for its tests and its walk. */
export function onboardingExit(): OnboardingExit | null {
  return lastExit
}

/**
 * The shell's half, for as long as the shell lives: the flag settled, the
 * layer opened when the Sing tab comes up while it is due (or the app
 * starts on it), Back, and the range Keep links to.
 */
export function installNativeOnboarding(): void {
  // A new install, counted once: the flag settles only on the first mount.
  if (settleOnboarding(welcomeSeen()) === 'due') {
    trackNativeOnboarding('native_onboarding_install')
  }
  onCleanup(registerOnboardingBack(() => leaveOnboarding('not-now')))
  onCleanup(registerRangeFinder(findRangeFromKeep))
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
    letInNow?.()
    afterRange = null
    layerRange = null
    setOnboardingShown(false)
    setMounted(false)
    setEntry('onboarding')
  })
}
