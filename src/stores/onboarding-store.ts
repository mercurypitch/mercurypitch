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
// the changelog modal.
//
// See docs/plans/onboarding-first-light.md.

import { createSignal } from 'solid-js'
import type { Beat, FlowState, OnboardingTrack, } from '@/features/onboarding/flow'
import { beatProgress, firstBeat, nextBeat } from '@/features/onboarding/flow'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { createPersistedSignal } from '@/lib/storage'
import { exposeForE2E } from '@/lib/test-utils'

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

// ── Live flow state ─────────────────────────────────────────────

const [flowOpen, setFlowOpen] = createSignal(false)
const [currentBeat, setCurrentBeat] = createSignal<Beat>('sky')
const [track, setTrack] = createSignal<OnboardingTrack | null>(null)
const [voiceprint, setVoiceprint] = createSignal<MirrorResult | null>(null)

export { currentBeat, flowOpen, track, voiceprint }

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
  return { track: track(), hasVoiceprint: voiceprint() !== null }
}

/** 0–1 across the beats THIS visitor will see (not all seven). */
export function onboardingProgress(): number {
  return beatProgress(currentBeat(), flowState(), availableBeats())
}

// ── Actions ─────────────────────────────────────────────────────

/** Open the flow from the top. Used by the welcome door and replays. */
export function startOnboarding(): void {
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

export function chooseTrack(next: OnboardingTrack): void {
  setTrack(next)
}

export function recordVoiceprint(result: MirrorResult | null): void {
  setVoiceprint(result)
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

/** Close the flow and mark it seen — both "done" and "skip" land here. */
export function finishOnboarding(): void {
  setFlowOpen(false)
  setOnboardingDone('1')
}

/**
 * Close a replay without touching the seen-flag or the flow state, so
 * reopening the Map later resumes where it was rather than restarting.
 */
export function closeOnboarding(): void {
  setFlowOpen(false)
}

/** Test/e2e hook: forget the flow so the next load runs it again. */
export function resetOnboarding(): void {
  setOnboardingDone('')
  setTrack(null)
  setVoiceprint(null)
  setCurrentBeat('sky')
  setFlowOpen(false)
}

// Not reactive scopes — these are e2e escape hatches invoked from the test
// runner, so the lint rule's "changes will be ignored" warning doesn't apply.
/* eslint-disable solid/reactivity */
exposeForE2E('__resetOnboarding', () => resetOnboarding())
exposeForE2E('__startOnboarding', () => startOnboarding())
/* eslint-enable solid/reactivity */
