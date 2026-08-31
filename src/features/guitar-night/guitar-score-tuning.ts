// Guitar score tuning — development-only overrides for the live matcher.
// ============================================================
//
// The shipped constants (180 ms window, 0.6 clarity floor, exact MIDI, 180 ms
// dense-onset exclusion) were never derived from a measurement on real
// hardware, because no end-to-end route latency has ever been measured. Rather
// than guess new ones, this makes them adjustable on a development build so
// they can be found against an actual guitar in one sitting.
//
// Production always reads the defaults: every accessor short-circuits on
// `import.meta.env.DEV`, so a stale localStorage value cannot follow a build
// to a player.

import { createSignal } from 'solid-js'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarLiveScorePolicy } from '@/lib/guitar/guitar-live-score'
import { GUITAR_LIVE_SCORE_MATCH_TOLERANCE_MS, GUITAR_LIVE_SCORE_MINIMUM_PITCH_CLARITY, } from '@/lib/guitar/guitar-live-score'
import { PITCH_ATTACH_WINDOW_MS } from '@/lib/guitar/input-events'

const STORAGE_KEY = 'guitar-night-score-tuning'

export interface GuitarScoreTuning {
  /** How early a strike may land and still prove a target. */
  matchToleranceMs: number
  /** How late it may land. Split from the early side: route delay is one-way. */
  lateToleranceMs: number
  /** NSDF clarity a reading must reach before it can score. */
  minimumPitchClarity: number
  /** Onset spacing under which acoustic targets are excluded, not judged. */
  denseTargetSpacingMs: number
  /** Accept the target's pitch class one octave away. */
  octaveTolerantPitch: boolean
  /** Judge chords and dense passages instead of excluding them. */
  judgeDenseTargets: boolean
  /** Let a pitch change prove a note, not only a picked attack. */
  matchPitchChanges: boolean
  /**
   * Whether a chord or a dense run is excluded before the evidence is read, or
   * judged against it like any other note.
   */
  scorePolicy: GuitarLiveScorePolicy
  /**
   * Samples the performance analyser reads per detection. 2048 at 48 kHz is a
   * 42.7 ms window, which holds only about 2.3 periods of low E (82.4 Hz) —
   * right at the edge where NSDF starts picking the wrong lobe. 4096 doubles
   * the window and quadruples the cost. Worth trying against a real guitar.
   */
  performanceAnalyserSize: number
}

/**
 * Defaults. Two differ from the constants that shipped, and both are
 * deliberate:
 *
 *   `lateToleranceMs` 320 — capture and playback delay can only ever make a
 *   player look late, and neither is compensated until somebody runs the
 *   latency wizard. A symmetric window spends half its budget on an error that
 *   cannot occur. This widens association only; the score is 100 either way,
 *   so no timing claim is made (REQ-GN-SCORE-004).
 *
 *   `octaveTolerantPitch` true — on the low strings the second harmonic
 *   routinely exceeds the fundamental, so a monophonic detector naming the
 *   octave above is physics, not a player error. Guitar Practice already folds
 *   microphone input to pitch class for this exact reason
 *   (useGuitarPracticeController.ts). MIDI stays exact regardless.
 */
export const GUITAR_SCORE_TUNING_DEFAULTS: Readonly<GuitarScoreTuning> = {
  matchToleranceMs: GUITAR_LIVE_SCORE_MATCH_TOLERANCE_MS,
  lateToleranceMs: 320,
  minimumPitchClarity: GUITAR_LIVE_SCORE_MINIMUM_PITCH_CLARITY,
  denseTargetSpacingMs: PITCH_ATTACH_WINDOW_MS * 2,
  octaveTolerantPitch: true,
  judgeDenseTargets: false,
  // On by default for acoustic routes. Measured on two real takes of a fast
  // piece: attacks alone covered 1% and 15% of the authored notes, while the
  // pitch path covered 85% and 94%. Replaying those takes with pitch changes
  // admitted moved the graded result from 0% and 6% to 66% and 66%.
  matchPitchChanges: true,
  // Evidence-first. Measured by replaying a real take of a fast piece through
  // the engine: exclude-first refused to judge 317 of 406 targets and reported
  // 95% on the 96 it graded; evidence-first judges 349 of them and reports
  // 63%, which is what the playing actually was. Only one of the 91 hits the
  // old policy found changed, and the hit predicate is untouched — the change
  // is which targets are allowed to ask, not what counts as a hit.
  scorePolicy: 'evidence-first',
  // 4096. MPM correlates to a lag of half the buffer, so the deepest pitch a
  // window can even represent is sampleRate / (bufferSize / 2): 46.9 Hz here,
  // against 93.8 Hz at 2048 once the shrinking NSDF window is accounted for.
  // Guitar low E is 82.4 Hz, so 2048 sat right on the edge and reported the
  // octave above — with high confidence — whenever it fell off. Four times the
  // MPM cost per frame; the adaptive frame limiter absorbs that on weak
  // devices by dropping the detection rate rather than the accuracy.
  performanceAnalyserSize: 4096,
}

function readStored(): GuitarScoreTuning {
  if (!import.meta.env.DEV) return { ...GUITAR_SCORE_TUNING_DEFAULTS }
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw === null || raw === undefined) {
      return { ...GUITAR_SCORE_TUNING_DEFAULTS }
    }
    const parsed = JSON.parse(raw) as Partial<GuitarScoreTuning>
    const merged = { ...GUITAR_SCORE_TUNING_DEFAULTS, ...parsed }
    // A window under 2048 puts its own floor above guitar low E (82.4 Hz), so
    // the detector cannot represent the note at all and returns the octave
    // instead. That is never a valid choice here, so a stored one is dropped
    // rather than honoured — the rest of the tuning is left alone.
    if (merged.performanceAnalyserSize < 2048) {
      merged.performanceAnalyserSize =
        GUITAR_SCORE_TUNING_DEFAULTS.performanceAnalyserSize
    }
    return merged
  } catch {
    return { ...GUITAR_SCORE_TUNING_DEFAULTS }
  }
}

const [tuning, setTuningSignal] = createSignal<GuitarScoreTuning>(readStored())

export const guitarScoreTuning = tuning

export function setGuitarScoreTuning(
  patch: Partial<GuitarScoreTuning>,
): GuitarScoreTuning {
  const next = { ...tuning(), ...patch }
  setTuningSignal(next)
  if (import.meta.env.DEV) {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // A blocked storage is not a reason to lose the in-memory override.
    }
  }
  return next
}

export function resetGuitarScoreTuning(): GuitarScoreTuning {
  return setGuitarScoreTuning(GUITAR_SCORE_TUNING_DEFAULTS)
}

/**
 * The engine options this tuning implies. MIDI keeps exact pitch and the
 * symmetric window: its clock is not delayed by a capture route, so widening
 * either would only invent matches.
 */
export function guitarScoreEngineTuning(inputKind: GuitarInputProfileKind): {
  matchToleranceMs: number
  lateToleranceMs: number
  minimumPitchClarity: number
  denseTargetSpacingMs: number
  octaveTolerantPitch: boolean
  matchPitchChanges: boolean
  scorePolicy: GuitarLiveScorePolicy
} {
  const current = import.meta.env.DEV ? tuning() : GUITAR_SCORE_TUNING_DEFAULTS
  const acoustic = inputKind !== 'midi'
  return {
    matchToleranceMs: current.matchToleranceMs,
    lateToleranceMs: acoustic
      ? current.lateToleranceMs
      : current.matchToleranceMs,
    minimumPitchClarity: current.minimumPitchClarity,
    denseTargetSpacingMs: current.judgeDenseTargets
      ? 0
      : current.denseTargetSpacingMs,
    octaveTolerantPitch: acoustic && current.octaveTolerantPitch,
    // MIDI already reports one event per note played; admitting pitch changes
    // there would only double-count.
    matchPitchChanges: acoustic && current.matchPitchChanges,
    // MIDI reports one event per note played, so it can judge every voice of a
    // chord independently and has nothing to reclaim. An explicit ternary
    // rather than `acoustic && ...`, which would yield `false`, not a policy.
    scorePolicy: acoustic ? current.scorePolicy : 'exclude-first',
  }
}

/** The performance analyser window this build should use. */
export function guitarPerformanceAnalyserSize(): number {
  if (!import.meta.env.DEV) {
    return GUITAR_SCORE_TUNING_DEFAULTS.performanceAnalyserSize
  }
  const requested = tuning().performanceAnalyserSize
  return [1024, 2048, 4096, 8192].includes(requested)
    ? requested
    : GUITAR_SCORE_TUNING_DEFAULTS.performanceAnalyserSize
}
