// ============================================================
// First Light — onboarding flow state
// ============================================================
//
// Which beat the visitor is on, which track they picked, and what (if
// anything) the voiceprint measured.
//
// Completion is a plain seen-flag. It is deliberately NOT keyed off
// APP_VERSION — doing that is exactly what made the old welcome
// overlay re-impose itself on every release. Version news belongs in
// the changelog modal. A lesson's practise link (`?lesson=NN`) spends
// it before the flow ever opens: see stepAsideForLesson.
//
// See docs/plans/onboarding-first-light.md.

import { batch, createSignal } from 'solid-js'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import type { Beat, FlowState, OnboardingTrack, } from '@/features/onboarding/flow'
import { beatProgress, firstBeat, nextBeat, walkedBeats, } from '@/features/onboarding/flow'
import { lessonFromSearch } from '@/lib/lesson-marker'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { createPersistedSignal } from '@/lib/storage'
import { exposeForE2E } from '@/lib/test-utils'
// One-way: ui-store knows nothing about onboarding, so this is not a cycle.
import { dismissWelcome, showWelcome, welcomeSeen } from '@/stores/ui-store'

const DONE_KEY = 'pitchperfect_onboarding_done'

/** '1' once the visitor has finished or skipped the flow. */
const [onboardingDone, setOnboardingDone] = createPersistedSignal<string>(
  DONE_KEY,
  '',
)

export { onboardingDone }

/** True when the flow has never been completed or skipped on this device. */
export function isFirstRun(): boolean {
  return onboardingDone() !== '1'
}

const RESUME_KEY = 'pitchperfect_onboarding_resume'

/**
 * The beat a sign-in redirect left from, '' when none is pending. Google
 * sign-in is a full-page navigation (COOP severs the GIS popup), and on
 * Android the redirect can land in the installed PWA — a different
 * browsing context — so this lives in localStorage, the one store both
 * contexts share. Consumed one-shot by `startOrResumeOnboarding`.
 */
const [authResumeBeat, setAuthResumeBeat] = createPersistedSignal<string>(
  RESUME_KEY,
  '',
)

// ── Live flow state ─────────────────────────────────────────────

const [flowOpen, setFlowOpen] = createSignal(false)
const [currentBeat, setCurrentBeat] = createSignal<Beat>('sky')
const [track, setTrack] = createSignal<OnboardingTrack | null>(null)
const [voiceprint, setVoiceprint] = createSignal<MirrorResult | null>(null)
/**
 * The singer's glides as one line, for the twin's stat card
 * (features/onboarding/voice-strip.ts). Recorded with its voiceprint and
 * replaced with it, so a card never draws another run's take.
 */
const [voiceStrip, setVoiceStrip] = createSignal<readonly number[] | null>(null)
const [micDenied, setMicDenied] = createSignal(false)
/** The one note heard at beat 2, kept so beat 3 can name it back. */
const [firstNote, setFirstNote] = createSignal<string | null>(null)
/**
 * Voiceprints this visitor already had before the flow opened, newest
 * first. Loaded once by FirstLight — the flow itself never fetches, so
 * a slow or offline read cannot stall a beat.
 */
const [savedVoiceprints, setSavedVoiceprints] = createSignal<
  readonly VoiceprintRecord[]
>([])

export {
  currentBeat,
  firstNote,
  flowOpen,
  micDenied,
  savedVoiceprints,
  track,
  voiceprint,
  voiceStrip,
}

/**
 * The beats the app can currently render. Beats land phase by phase;
 * anything not in here is skipped by the traversal, so a half-built
 * beat is never shown. Phase 2 adds first-light / voiceprint / twin,
 * Phase 3 adds keep.
 */
const [availableBeats, setAvailableBeats] = createSignal<ReadonlySet<Beat>>(
  new Set<Beat>(['sky', 'fork', 'map']),
)

export { availableBeats }

/** Register the beats a caller can render (used by FirstLight on mount). */
export function setBeatsAvailable(beats: readonly Beat[]): void {
  setAvailableBeats(new Set(beats))
}

function flowState(): FlowState {
  return {
    track: track(),
    hasVoiceprint: voiceprint() !== null,
    micDenied: micDenied(),
    savedPrints: savedVoiceprints().length,
  }
}

/** 0–1 across the beats THIS visitor will see (not all seven). */
export function onboardingProgress(): number {
  return beatProgress(currentBeat(), flowState(), availableBeats())
}

/**
 * The same walk, as beads for the sky: how many there are and which one
 * the visitor is on. `index` is -1 before the flow starts or on a beat
 * outside the walk (the Map opened on its own as a replay).
 */
export function onboardingBeads(): { count: number; index: number } {
  const walked = walkedBeats(flowState(), availableBeats())
  return { count: walked.length, index: walked.indexOf(currentBeat()) }
}

// ── Actions ─────────────────────────────────────────────────────

/** Open the flow from the top. Used by the welcome door and replays. */
export function startOnboarding(): void {
  // A replay must genuinely restart: last run's transient verdicts — a
  // refused mic, the chosen track, the heard note — would otherwise skip
  // every beat that asks again. A session-old mic denial in particular
  // routed replays straight to the Map with no way to re-allow the mic.
  // The measured voiceprint is data, not flow state, and is kept.
  setMicDenied(false)
  setTrack(null)
  setFirstNote(null)
  const first = firstBeat(flowState(), availableBeats())
  if (first === null) return
  setCurrentBeat(first)
  setFlowOpen(true)
}

/** Jump straight to one beat — the Map replay entry (#/map). */
export function openBeat(beat: Beat): void {
  setCurrentBeat(beat)
  setFlowOpen(true)
}

/**
 * Remember where the flow stands before a sign-in navigation leaves the
 * page. A no-op outside the flow: the other sign-in surfaces (Settings,
 * Karaoke) restore their route through the auth return-hash instead.
 */
export function armOnboardingResume(): void {
  if (!flowOpen()) return
  setAuthResumeBeat(currentBeat())
}

/**
 * Open the flow where a sign-in redirect left it, or from the top. Only
 * the map resumes — it is the one beat that rebuilds itself entirely from
 * persisted data (the saved voiceprints); a capture beat re-entered cold
 * would strand the visitor mid-take, so anything else restarts honestly.
 */
export function startOrResumeOnboarding(): void {
  const resume = authResumeBeat()
  setAuthResumeBeat('')
  if (resume === 'map') {
    openBeat('map')
    return
  }
  startOnboarding()
}

export function chooseTrack(next: OnboardingTrack): void {
  setTrack(next)
}

export function recordVoiceprint(
  result: MirrorResult | null,
  strip: readonly number[] | null = null,
): void {
  setVoiceprint(result)
  setVoiceStrip(result === null ? null : strip)
}

/** Remember the single note heard at beat 2, e.g. 'G3'. */
export function recordFirstNote(note: string | null): void {
  setFirstNote(note)
}

/** What this visitor already had, newest first (FirstLight, on mount). */
export function recordSavedVoiceprints(
  records: readonly VoiceprintRecord[],
): void {
  setSavedVoiceprints(records)
}

/**
 * Mark the microphone unusable — refused, unavailable, or silent. Every
 * beat after this except the Map needs one, so the traversal routes
 * straight to the Map from wherever the visitor is.
 */
export function markMicDenied(): void {
  setMicDenied(true)
}

/**
 * Advance to the next applicable beat, or finish. Returns the beat
 * moved to, or null when the flow ended.
 */
export function advanceBeat(): Beat | null {
  const next = nextBeat(currentBeat(), flowState(), availableBeats())
  if (next === null) {
    finishOnboarding()
    return null
  }
  setCurrentBeat(next)
  return next
}

/**
 * Close the flow and mark it seen — "done", "skip" and a lesson's link
 * (stepAsideForLesson) all land here.
 *
 * Batched, and that is load-bearing rather than tidy. `showWelcome`
 * being true with the flow shut is what OPENS the flow now that the
 * welcome door is gone, so an unbatched `setFlowOpen(false)` ran that
 * effect while the seen-flag was still unspent and reopened the flow on
 * beat 1 the instant it closed. Both writes have to land as one.
 */
export function finishOnboarding(): void {
  batch(() => {
    setFlowOpen(false)
    setOnboardingDone('1')
    // A finished flow has nothing to resume; a leftover marker would
    // otherwise sit in localStorage until some later replayed boot.
    setAuthResumeBeat('')
    // Spend the welcome flag too. It is the "this visitor has not been
    // offered the flow yet" flag, and leaving it unspent left the flow
    // permanently due.
    dismissWelcome()
  })
}

/**
 * Close a replay without touching the seen-flag or the flow state, so
 * reopening the Map later resumes where it was rather than restarting.
 */
export function closeOnboarding(): void {
  setFlowOpen(false)
}

// ── A lesson's practise link ────────────────────────────────────

/** The lesson whose link stepped the flow aside on this page load. */
const [lessonArrival, setLessonArrival] = createSignal<number | null>(null)

export { lessonArrival }

/**
 * A Find Your Pitch lesson sent this visitor to one room (`?lesson=NN`,
 * lib/lesson-marker.ts): First Light steps aside, for good, before App
 * decides this is a first run. index.tsx calls it once, before the render.
 *
 * For good rather than for this visit, because the lesson pages told a
 * first visitor to do exactly this by hand — "close it with the × at the
 * top right" — and the × ends the flow for good. A step-aside that lasted
 * one visit would bring "Welcome to MercuryPitch" back over the app on
 * their next visit without a marker, or within this one: /exercises/<slug>
 * cleans its address to `/`, so the next reload boots without the marker.
 * The links that bring somebody to do one thing (a jam room, a sync code,
 * a password reset) already spend the welcome flag the same way. Nothing
 * is lost: Settings' "Replay the intro" and #/map still open it.
 *
 * Not counted as `onboarding_skipped`: nobody saw the flow, and that event
 * is the skip rate of the people who did.
 *
 * Returns the lesson when the flow stepped aside; null when there was
 * nothing to step aside: no valid marker, a visitor who was offered the
 * flow before, or the native build, whose first run is the alley.
 */
export function stepAsideForLesson(search: string): number | null {
  const lesson = lessonFromSearch(search)
  if (lesson === null || !showWelcome()) return null
  setLessonArrival(lesson)
  finishOnboarding()
  return lesson
}

/**
 * Had this device been here before this page load? What's New asks, to
 * tell a returning visitor from a first-ever one. The spent welcome flag
 * says so — unless this load's lesson link is what spent it, which says
 * nothing about having been here.
 */
export function returningVisitor(): boolean {
  return welcomeSeen() !== '' && lessonArrival() === null
}

/** Test/e2e hook: forget the flow so the next load runs it again. */
export function resetOnboarding(): void {
  setOnboardingDone('')
  setAuthResumeBeat('')
  setTrack(null)
  setVoiceprint(null)
  setVoiceStrip(null)
  setMicDenied(false)
  setFirstNote(null)
  setSavedVoiceprints([])
  setCurrentBeat('sky')
  setFlowOpen(false)
  setLessonArrival(null)
}

// Not reactive scopes — these are e2e escape hatches invoked from the test
// runner, so the lint rule's "changes will be ignored" warning doesn't apply.
/* eslint-disable solid/reactivity */
exposeForE2E('__resetOnboarding', () => resetOnboarding())
exposeForE2E('__startOnboarding', () => startOnboarding())
/* eslint-enable solid/reactivity */
