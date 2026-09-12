// ============================================================
// The take recorder — what a run collects while it happens
// ============================================================
//
// AT MODULE SCOPE, for the same reason the room's context is: leaving the
// Sing tab unmounts the room, and a take that is only PARKED has to come back
// whole. A recorder living in the component would restart its clock and throw
// away its answers on every tab hop, so a five-minute take returned from the
// session pill as a thirty-second one with nothing in it.
//
// TWO COLLECTIONS, and neither of them is the frames:
//
//   summary  a `TakeAccumulator`. Every frame goes in, nothing is kept —
//            two clocks, a running minimum and maximum, and a 1-cent
//            histogram answer the end card in a fixed few kilobytes however
//            long the take runs.
//   trail    every frame of the last ~25 seconds, for the canvas. This one is
//            MUTATED IN PLACE: `PitchCanvas` reads it from its own rAF loop,
//            and rebuilding a 1500-entry array sixty times a second to hand
//            it something it is about to read anyway is work nobody sees.
//
// THE CLOCK IS THE FRAME STREAM, not the wall. A parked take spends its time
// on another tab with the room unmounted and no frames arriving, so the
// accumulator's clamped gaps simply do not count it — which is the answer the
// end card's duration needs AND the answer the canvas's x axis needs, so
// there is one clock rather than two that disagree. Measured before this: a
// seven-second take parked in the middle reported forty-nine seconds, and the
// canvas window jumped by the parked span the moment the room came back.
//
// Nothing here is a signal. The canvas polls and the end card asks once.

import type { PitchSample } from '@/types'
import type { TakeAccumulator } from './take-summary'
import { createTakeAccumulator } from './take-summary'

/** About 25 seconds at 60 fps — comfortably more than the canvas's window. */
const TRAIL_SAMPLES = 1500

export interface TakeRecording {
  /** The end card's four answers, accumulated in constant space. */
  summary: TakeAccumulator
  /** The canvas's trail, in seconds of run time since the take began. */
  trail: PitchSample[]
  /** `Date.now()` when it began — the end card says a date and a clock. */
  startedAtEpoch: number
}

const recording: TakeRecording = {
  summary: createTakeAccumulator(),
  trail: [],
  startedAtEpoch: 0,
}

export const takeRecording = recording

/** Seconds of run time so far — the free run's whole x axis. */
export function takeElapsedSeconds(): number {
  return recording.summary.elapsedSeconds
}

/** Begin a take. A resume continues one; only a new run calls this. */
export function startTakeRecording(): void {
  recording.summary.reset()
  // Emptied in place: the canvas holds this array.
  recording.trail.length = 0
  recording.startedAtEpoch = Date.now()
}

/**
 * One detection frame.
 *
 * `cents` and `midi` are measured by the caller, because what they are
 * measured AGAINST is the room's decision: the nearest note of the key in a
 * free run, the target in a melody run.
 */
export function recordTakeFrame(sample: {
  /** Monotonic milliseconds — `performance.now()`, never a wall clock. */
  atMs: number
  freq: number
  cents: number
  midi: number
  /** A melody run draws from the app's own history, so it needs no trail. */
  trail: boolean
}): void {
  recording.summary.push(
    sample.freq > 0
      ? {
          atMs: sample.atMs,
          freq: sample.freq,
          cents: sample.cents,
          midi: sample.midi,
        }
      : { atMs: sample.atMs, freq: 0, cents: 0, midi: 0 },
  )

  if (!sample.trail) return
  const time = recording.summary.elapsedSeconds
  recording.trail.push(
    sample.freq > 0
      ? { freq: sample.freq, cents: sample.cents, time }
      : { freq: null, time },
  )
  if (recording.trail.length > TRAIL_SAMPLES) {
    recording.trail.splice(0, recording.trail.length - TRAIL_SAMPLES)
  }
}

/** Tests only. */
export function resetTakeRecording(): void {
  startTakeRecording()
}
