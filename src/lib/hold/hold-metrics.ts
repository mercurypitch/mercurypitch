// ============================================================
// Hold metrics — the Long note run's result, ready for the history store
// ============================================================
//
// The counts come from the engine's final state, so the result always agrees
// with what the room showed during the run. Steadiness comes from the frames
// of the held part only (first lock to the end of the note), scored by the
// Voice Mirror's `computeSteadiness`: drift and wobble around the singer's
// own median, vibrato excluded. The scoop before the lock is the time-to-lock
// number's business, not steadiness's.

import type { SteadinessResult } from '@/lib/mirror/metrics'
import { computeSteadiness } from '@/lib/mirror/metrics'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { HoldState } from './hold-engine'

/**
 * The `metrics` of `recordExerciseResult({ type: 'long-note-lantern', ... })`.
 * A type alias, not an interface, so it is assignable to the store's
 * `Record<string, number>`.
 */
export type HoldRunMetrics = {
  inBandSeconds: number
  /** First lock to the last voiced moment of the note. */
  holdSeconds: number
  longestLockSeconds: number
  /** First voiced moment to the band entry of the first lock. Absent when
   *  the run never locked: no number is honest there, and 0 would read as
   *  an instant lock. */
  timeToLockMs?: number
  breaks: number
  targetMidi: number
  durationMs: number
}

export interface HoldResult {
  /** The run's score: steadiness 0-100, 0 when too little was held. */
  score: number
  /** Drift, wobble and vibrato for the results card; null as above. */
  steadiness: SteadinessResult | null
  /** The run reached at least one lock. */
  locked: boolean
  metrics: HoldRunMetrics
}

/** Slack when matching frame times to engine clock times. */
const ALIGN_EPS = 1e-6

const roundSeconds = (seconds: number): number =>
  Math.round(seconds * 1000) / 1000

/**
 * `frames` must be the frames that drove `state`, in order, ticked through
 * `holdTickFromFrame` (or replayed with `runHold`): the engine's clock 0 is
 * `frames[0].t`. `durationMs` is the run's wall time, passed through.
 */
export function computeHoldResult(input: {
  frames: readonly PitchFrame[]
  state: HoldState
  targetMidi: number
  durationMs: number
}): HoldResult {
  const { frames, state, targetMidi, durationMs } = input
  const { firstLockAt, firstVoicedAt } = state
  const noteEnd = state.noteEndedAt ?? state.lastVoicedAt
  const locked = firstLockAt !== null

  let steadiness: SteadinessResult | null = null
  if (locked && noteEnd !== null && frames.length > 0) {
    const base = frames[0].t
    const held = frames.filter((frame) => {
      const at = frame.t - base
      return at >= firstLockAt - ALIGN_EPS && at <= noteEnd + ALIGN_EPS
    })
    steadiness = computeSteadiness(held)
  }

  const metrics: HoldRunMetrics = {
    inBandSeconds: roundSeconds(state.inBandSeconds),
    holdSeconds:
      locked && noteEnd !== null
        ? roundSeconds(Math.max(0, noteEnd - firstLockAt))
        : 0,
    longestLockSeconds: roundSeconds(state.longestLockSeconds),
    breaks: state.breaks,
    targetMidi,
    durationMs,
  }
  if (locked && firstVoicedAt !== null) {
    metrics.timeToLockMs = Math.round((firstLockAt - firstVoicedAt) * 1000)
  }

  return {
    score: steadiness?.score ?? 0,
    steadiness,
    locked,
    metrics,
  }
}
