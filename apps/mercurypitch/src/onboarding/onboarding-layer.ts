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
//     words (holdRoomWords), until the onboarding goes. Then it arrives as
//     it would have, live if the singer granted the mic here. Its words are
//     held from the alley's Sing door already (`expectOnboarding`), which
//     also loads the layer's code: the door's clone covers the screen as
//     the room mounts, and the room's resting screen showed in full for the
//     frames before a lazy layer had loaded and faded in over it. The layer
//     is opaque from its first frame, and only its content fades in;
//   - the rail steps aside (run-shell-store.ts `onboardingShown`), and a
//     phone stays upright (portrait-lock.ts);
//   - Back is Not now (shell-navigation.ts `registerOnboardingBack`): the
//     layer's own (`registerLayerNotNow`), which may open the Cloud offer
//     before it leaves.
//
// It leaves once, by Not now or by its own last beat, and the flag records
// that at once: it never opens again on this install. Not now is recorded
// as it is said (`markNotNow`), though the layer stays up under the Cloud
// offer it may open (owner, 20 Oct 2026), and once said it is how the
// layer leaves. The shell is back as it starts to fade (LEAVE_MS); the
// layer unmounts when the fade is over. Its own end lands on the Warm-up's
// path, and Not now on the alley (onboarding-landing.ts). So does Continue
// without the mic (`without-mic`), counted as an end: the path's one button
// is Start warm-up, which needs the mic the singer just went on without,
// and the alley asks for nothing. Under the path
// the Sing room waits on: arriving there it would open its mic on a
// remembered grant, under a screen that wants the mic to itself. Back from
// the path lets it in. On the way to the alley it waits until the tab has
// changed, a task after the address does, and then there is no Sing room.
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
import { holdRoomWords } from '@/stores/room-words-store'
import { welcomeSeen } from '../alley/alley-welcome'
import { currentTab, onboardingShown, pushed, setOnboardingShown, } from '../shell/run-shell-store'
import { openKeep, openKeepFromReveal, registerRangeFinder, } from '../shell/settings/account-offer'
import { registerOnboardingBack } from '../shell/shell-navigation'
import { markOnboardingDone, onboardingDue, settleOnboarding, } from './onboarding-flag'
import { landInAlley, landOnWarmUp } from './onboarding-landing'

/** The layer's fade out, ms (the shell's --mp-in). */
export const LEAVE_MS = 280
/** The same under reduced motion: the shell's crossfade. */
export const LEAVE_REDUCED_MS = 120

/**
 * How the layer left: Not now, its own end, or its end without the mic
 * after a refusal, which lands where Not now does.
 */
export type OnboardingExit = 'not-now' | 'finished' | 'without-mic'

/** What the layer opened for: the onboarding, or the range on its own. */
export type OnboardingEntry = 'onboarding' | 'range'

const [mounted, setMounted] = createSignal(false)
const [entry, setEntry] = createSignal<OnboardingEntry>('onboarding')

/** Whether the layer is in the document: from its opening to the end of its fade. */
export const onboardingMounted = mounted

/** What the layer is up for; read by the layer as it mounts. */
export const onboardingEntry = entry

/** The Sing room's arrival and its words, held while the onboarding is up. */
let releaseArrival: (() => void) | null = null
/** The room's words, held from a Sing door picked while the onboarding is due. */
let releaseWords: (() => void) | null = null
/** Loads the layer's code before it is needed (the shell's lazy chunk). */
let preloadLayer: (() => void) | null = null
let unmount: ReturnType<typeof setTimeout> | null = null
let lastExit: OnboardingExit | null = null
/** What runs once the range on its own has left: Keep, again. */
let afterRange: ((exit: OnboardingExit) => void) | null = null
/** The onboarding's own range, while its layer is up to run it. */
let layerRange: (() => void) | null = null
/** Lets the Sing room in, waiting under the path or for the alley, at once. */
let letInNow: (() => void) | null = null
/** The onboarding's own Not now, while its layer is up. */
let layerNotNow: (() => void) | null = null
/** Not now has been said on this layer: it leaves as Not now. */
let notNowSaid = false
/** The finish counted for this layer (countFinished). */
let finishCounted = false

function leaveMs(): number {
  return prefersReducedMotion() ? LEAVE_REDUCED_MS : LEAVE_MS
}

/**
 * The room under the layer held: its arrival, and its words, taking over
 * the hold a Sing door already has on them. Let go as one.
 */
function holdRoom(): () => void {
  const arrival = holdRoomArrival()
  const words = releaseWords ?? holdRoomWords()
  releaseWords = null
  return () => {
    arrival()
    words()
  }
}

/**
 * A Sing door picked in the alley while the onboarding is due, so it opens
 * over the room that door leads to: the layer's code loads now, ready by
 * the time the door has opened, and the room's words are held from now, so
 * nothing of its resting screen shows as the door opens into it.
 */
export function expectOnboarding(): void {
  if (!untrack(onboardingDue) || untrack(onboardingShown)) return
  preloadLayer?.()
  releaseWords ??= holdRoomWords()
}

/** That door went back, or another was picked: the room's words go free. */
export function expectNoOnboarding(): void {
  const release = releaseWords
  releaseWords = null
  release?.()
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
  notNowSaid = false
  finishCounted = false
  releaseArrival ??= holdRoom()
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

/**
 * The layer registers its own Not now here while it is up, so Back is the
 * same Not now as its button: the Cloud offer when it is due, then the
 * alley. Registration returns its own unregister.
 */
export function registerLayerNotNow(run: () => void): () => void {
  layerNotNow = run
  return () => {
    if (layerNotNow === run) layerNotNow = null
  }
}

/** Back while the layer is up: its own Not now, else leave as Not now. */
function backAsNotNow(): boolean {
  if (!untrack(onboardingShown)) return false
  if (layerNotNow === null) return leaveOnboarding('not-now')
  layerNotNow()
  return true
}

/**
 * Not now, said on the onboarding: done for good, and counted, at once and
 * once. The layer may stay up a moment longer, under the Cloud offer Not
 * now opens when it is due, so an app closed on that offer never opens
 * the onboarding again. The range on its own leaves the flag be.
 */
export function markNotNow(): void {
  if (!untrack(onboardingShown) || untrack(entry) !== 'onboarding') return
  if (notNowSaid) return
  notNowSaid = true
  markOnboardingDone()
  trackNativeOnboarding('native_onboarding_not_now')
}

/**
 * The line's Continue: the onboarding done for good at once, as Not now is,
 * so an app closed on the Cloud offer that may follow, or while its asks are
 * out, never opens the onboarding again.
 */
export function markFinished(): void {
  if (!untrack(onboardingShown) || untrack(entry) !== 'onboarding') return
  markOnboardingDone()
}

/**
 * A finished onboarding counted, once a layer: as the Cloud offer opens over
 * the line (an app closed on the offer never comes back to count it), else
 * as the layer leaves. Not now is counted on its own (markNotNow).
 */
export function countFinished(): void {
  if (!untrack(onboardingShown) || untrack(entry) !== 'onboarding') return
  if (finishCounted) return
  finishCounted = true
  trackNativeOnboarding('native_onboarding_done')
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
 * The Sing room's arrival, let go once `free` holds: under the landing's
 * path, once nothing is pushed over it any more (Back from the path, from
 * any stop it went on to); on the way to the alley, once the tab has left
 * it, which unmounts it.
 */
function letInOnce(free: () => boolean, release: () => void): void {
  createRoot((dispose) => {
    const letIn = (): void => {
      if (letInNow === letIn) letInNow = null
      dispose()
      release()
    }
    letInNow = letIn
    createEffect(
      on(
        free,
        (yes) => {
          if (yes) letIn()
        },
        { defer: true },
      ),
    )
  })
}

/**
 * The layer leaves: the onboarding done for good (the range on its own
 * leaves the flag be), the onboarding's landing (the Warm-up's path on its
 * own end, the alley on Not now and without the mic), the Sing room let in
 * once nothing covers it or it has gone, the rail back, and the layer gone
 * once it has faded. Not now, once said, is how it leaves, whatever
 * `asked` says. True when it was up.
 */
export function leaveOnboarding(asked: OnboardingExit): boolean {
  if (!untrack(onboardingShown)) return false
  const exit: OnboardingExit = notNowSaid ? 'not-now' : asked
  lastExit = exit
  const onboarding = untrack(entry) === 'onboarding'
  const landing = onboarding && exit === 'finished'
  const toAlley = onboarding && exit !== 'finished'
  if (onboarding && exit === 'not-now') markNotNow()
  else if (onboarding) {
    markOnboardingDone()
    countFinished()
  }
  // Pushed while the layer is still up: it fades off the path.
  if (landing) landOnWarmUp()
  // The address now; the tab a task later, as the layer starts to fade.
  if (toAlley) landInAlley()
  setOnboardingShown(false)
  const release = releaseArrival
  releaseArrival = null
  if (release !== null && landing && untrack(pushed) !== null) {
    letInOnce(() => pushed() === null, release)
  } else if (
    release !== null &&
    toAlley &&
    untrack(currentTab) === TAB_SINGING
  ) {
    letInOnce(() => currentTab() !== TAB_SINGING, release)
  } else {
    release?.()
  }
  unmount = setTimeout(() => {
    unmount = null
    setMounted(false)
    // A tab that has not changed by the fade's end never will: the Sing
    // room arrives, as it did before the alley.
    if (toAlley) letInNow?.()
  }, leaveMs())
  const then = afterRange
  afterRange = null
  then?.(exit)
  return true
}

/**
 * The layer would not load or draw: never leave the singer behind an empty
 * dialog, with the rail hidden and the Sing room held under it. Done for good,
 * since a layer that failed once would fail again on every Sing door, and out
 * to the alley, as Not now goes, without counting a Not now nobody said.
 */
export function abandonOnboarding(): void {
  if (!untrack(onboardingShown)) return
  if (untrack(entry) === 'onboarding') markOnboardingDone()
  notNowSaid = true
  leaveOnboarding('not-now')
}

/** How the onboarding last left, for its tests and its walk. */
export function onboardingExit(): OnboardingExit | null {
  return lastExit
}

/**
 * The shell's half, for as long as the shell lives: the flag settled, the
 * layer opened when the Sing tab comes up while it is due (or the app
 * starts on it), Back, and the range Keep links to. `preload` loads the
 * layer's code (the shell's lazy component), for a Sing door to start.
 */
export function installNativeOnboarding(preload?: () => void): void {
  preloadLayer = preload ?? null
  // A new install, counted once: the flag settles only on the first mount.
  if (settleOnboarding(welcomeSeen()) === 'due') {
    trackNativeOnboarding('native_onboarding_install')
  }
  onCleanup(registerOnboardingBack(backAsNotNow))
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
    expectNoOnboarding()
    preloadLayer = null
    letInNow?.()
    afterRange = null
    layerRange = null
    layerNotNow = null
    notNowSaid = false
    setOnboardingShown(false)
    setMounted(false)
    setEntry('onboarding')
  })
}
