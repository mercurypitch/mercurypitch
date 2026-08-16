// ============================================================
// Warm-up lead-in — the approach beats before every step
// ============================================================
//
// Every authored warm-up block carries `countInBeats: 2`, and until now no
// runtime read it: the scale began the instant the breathing step ended,
// which is exactly the complaint that opened this work. The transform here
// is how the warm-up finally honors it — the same shape the weekly
// challenge uses (`CHALLENGE_LEAD_IN_BEATS` in challenge-stage-model.ts):
// the lead-in is baked into the targets, so the zen session and canvas need
// no new concept. The playhead simply has an empty approach run before the
// first block, and the singer can see the step coming.
//
// The ticker below is the audible half: pure timing, no audio, the same
// split note-playback.ts uses. The component samples it once per pitch
// frame and plays a click per crossed beat.

import type { ZenExerciseDefinition } from '@/features/zen/types'

/** Seconds the lead-in lasts, straight from the authored count-in. */
export function leadInSeconds(exercise: ZenExerciseDefinition): number {
  return (exercise.countInBeats * 60) / exercise.bpm
}

/**
 * The same exercise with its count-in converted into approach beats: every
 * target shifted late by `countInBeats`, the loop extended to keep the
 * validator's targets-within-loop invariant, and `countInBeats` zeroed —
 * consumed, so a future runtime that honors it natively cannot double it.
 * Applying it twice is therefore a no-op, and an exercise authored without
 * a count-in passes through untouched.
 */
export function applyLeadIn(
  exercise: ZenExerciseDefinition,
): ZenExerciseDefinition {
  const shift = exercise.countInBeats
  if (shift <= 0) return exercise
  return {
    ...exercise,
    countInBeats: 0,
    loopBeats: exercise.loopBeats + shift,
    targets: exercise.targets.map((target) => ({
      ...target,
      startBeat: Number((target.startBeat + shift).toFixed(4)),
    })),
  }
}

export interface LeadInTicker {
  /**
   * The beat index (0-based) newly reached at this sample, or null. Fires
   * each lead-in beat at most once. Deliberately does NOT back-fill beats a
   * stalled frame jumped over: a click is a pulse the singer breathes to,
   * and two clicks landing in the same frame are a stumble, not a rhythm.
   */
  sample: (
    elapsedSec: number,
    leadInSec: number,
    beatSec: number,
  ) => number | null
  /** Start of a new step: the next sample may fire beat zero again. */
  reset: () => void
}

export function createLeadInTicker(): LeadInTicker {
  let lastBeat = -1
  return {
    reset: () => {
      lastBeat = -1
    },
    sample: (elapsedSec, leadInSec, beatSec) => {
      if (elapsedSec < 0 || elapsedSec >= leadInSec) return null
      const current = Math.floor(elapsedSec / beatSec)
      if (current <= lastBeat) return null
      lastBeat = current
      return current
    },
  }
}
