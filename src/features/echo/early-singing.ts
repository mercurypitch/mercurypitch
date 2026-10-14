// ============================================================
// Early singing: the voice over Merc's call, off his note (pure)
// ============================================================
//
// While Merc sings his call the mic is open, and the engine ignores every
// frame until the call's end plus RESPONSE_GATE_SECONDS. A voice heard
// over a note of the call, further than EARLY_SEMITONES from it (folded to
// its octave, so Merc's own voice through the speaker never counts), for
// EARLY_SECONDS in all, is the singer starting too soon: Merc asks them to
// let him finish, once a call.
//
// The room (useEchoController.ts) watches every call with it, and the
// demo's script (demo/demo-script.ts) dates its "too early" moment with
// the same rule, so the two cannot disagree.

import { offTarget } from '@/lib/hold/hold-reading'
import type { PitchFrame } from '@/lib/pitch-f0-stream'

/** Voice over the call, off Merc's note, for this long: "wait for me", s. */
export const EARLY_SECONDS = 0.3
/** Off Merc's note means further than this from its pitch class, semitones. */
export const EARLY_SEMITONES = 1.5

/** One of Merc's notes in the call, on the frames' clock. */
/** A frame's pitch, fractional MIDI, or null when it is not voiced. */
export function pitchOf(frame: PitchFrame): number | null {
  const cents = offTarget(frame, 0)
  return cents === null ? null : cents / 100
}

export interface CallNote {
  readonly from: number
  readonly to: number
  readonly midi: number
}

/** The voice against a note: cents off it, folded to its octave if asked. */
export function centsOff(pitch: number, target: number, fold: boolean): number {
  const off = (pitch - target) * 100
  return fold ? off - 1200 * Math.round(off / 1200) : off
}

/** How much early singing a call has heard, and whether it has said so. */
export interface EarlyWatch {
  /** Voice over the call, off Merc's note, s. */
  readonly seconds: number
  /** The call has heard enough: once per call. */
  readonly fired: boolean
}

export const NO_EARLY: EarlyWatch = { seconds: 0, fired: false }

/**
 * One frame of the call. `pitch` is the frame's pitch as fractional MIDI,
 * null when it is not voiced; `previous` the frame before it in the same
 * window. Returns the watch as it stands after the frame.
 */
export function watchEarly(
  watch: EarlyWatch,
  frame: PitchFrame,
  previous: PitchFrame | null,
  pitch: number | null,
  notes: readonly CallNote[],
): EarlyWatch {
  if (watch.fired || pitch === null) return watch
  const sounding = notes.find((n) => frame.t >= n.from && frame.t < n.to)
  if (sounding === undefined) return watch
  const apart = Math.abs(centsOff(pitch, sounding.midi, true)) / 100
  if (apart <= EARLY_SEMITONES) return watch
  const dt = previous === null ? 0 : frame.t - previous.t
  const seconds = watch.seconds + dt
  return { seconds, fired: seconds >= EARLY_SECONDS }
}
