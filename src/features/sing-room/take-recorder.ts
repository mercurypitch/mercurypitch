// ============================================================
// The take recorder — what a run collects while it happens
// ============================================================
//
// AT MODULE SCOPE, for the same reason the room's context is: leaving the
// Sing tab unmounts the room, and a take that is only PARKED has to come back
// whole. A recorder living in the component would restart its clock and throw
// away its frames on every tab hop, so a five-minute take returned from the
// session pill as a thirty-second one with nothing in it.
//
// TWO COLLECTIONS, and they are not the same thing:
//
//   frames   20 Hz, the whole take, for the end card's maths. Downsampled
//            because a thirty-minute take at sixty frames a second is a
//            hundred thousand objects to answer four questions with.
//   trail    every frame, the last 25 seconds, for the canvas. This one is
//            MUTATED IN PLACE: `PitchCanvas` reads it from its own rAF loop,
//            and rebuilding a 1500-entry array sixty times a second to hand
//            it something it is about to read anyway is work nobody sees.
//
// Nothing here is a signal. The canvas polls and the end card asks once.

import type { PitchSample } from '@/types'
import type { TakeFrame } from './take-summary'

/** About 25 seconds at 60 fps — comfortably more than the canvas's window. */
const TRAIL_SAMPLES = 1500

/**
 * The floor between two kept frames.
 *
 * A 60 fps stream lands on 64 ms (the first multiple of 16 that clears it),
 * so a 150 ms hold is two or three frames — enough to see it, and a thirtieth
 * of what keeping every frame would cost on a half-hour take.
 */
const FRAME_INTERVAL_MS = 50

export interface TakeRecording {
  /** The downsampled take, for `summarizeTake`. */
  frames: TakeFrame[]
  /** The canvas's trail, in seconds since the take began. */
  trail: PitchSample[]
  /** `performance.now()` when the take began. */
  startedAtMs: number
  /** `Date.now()` when it began — the end card says a date and a clock. */
  startedAtEpoch: number
  /** Seconds since it began, which is the free run's whole x axis. */
  elapsedSeconds: number
}

const recording: TakeRecording = {
  frames: [],
  trail: [],
  startedAtMs: 0,
  startedAtEpoch: 0,
  elapsedSeconds: 0,
}

let lastFrameMs = 0

export const takeRecording = recording

/** Begin a take. A resume continues one; only a new run calls this. */
export function startTakeRecording(nowMs = performance.now()): void {
  recording.frames = []
  // Emptied in place: the canvas holds this array.
  recording.trail.length = 0
  recording.startedAtMs = nowMs
  recording.startedAtEpoch = Date.now()
  recording.elapsedSeconds = 0
  // NOT zero: `performance.now()` starts near zero on a fresh page, and a
  // recorder that begins its downsampling clock at the take's own start
  // silently drops the take's FIRST frame — which is the one a very short
  // take has nothing but.
  lastFrameMs = Number.NEGATIVE_INFINITY
}

/**
 * One detection frame.
 *
 * `cents` and `midi` are measured by the caller, because what they are
 * measured AGAINST is the room's decision: the nearest note of the key in a
 * free run, the target in a melody run.
 */
export function recordTakeFrame(sample: {
  atMs: number
  freq: number
  cents: number
  midi: number
  /** A melody run draws from the app's own history, so it needs no trail. */
  trail: boolean
}): void {
  recording.elapsedSeconds = (sample.atMs - recording.startedAtMs) / 1000

  if (sample.trail) {
    recording.trail.push(
      sample.freq > 0
        ? {
            freq: sample.freq,
            cents: sample.cents,
            time: recording.elapsedSeconds,
          }
        : { freq: null, time: recording.elapsedSeconds },
    )
    if (recording.trail.length > TRAIL_SAMPLES) {
      recording.trail.splice(0, recording.trail.length - TRAIL_SAMPLES)
    }
  }

  if (sample.atMs - lastFrameMs < FRAME_INTERVAL_MS) return
  lastFrameMs = sample.atMs
  recording.frames.push(
    sample.freq > 0
      ? {
          atMs: sample.atMs,
          freq: sample.freq,
          cents: sample.cents,
          midi: sample.midi,
        }
      : { atMs: sample.atMs, freq: 0, cents: 0, midi: 0 },
  )
}

/** Tests only. */
export function resetTakeRecording(): void {
  startTakeRecording(0)
}
