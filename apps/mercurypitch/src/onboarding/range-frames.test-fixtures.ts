// ============================================================
// Frames for the range's tests: a quiet room, slides, held notes, noise
// ============================================================
//
// What the room kit's capture would hand the range, RATE frames a second,
// on each window's own clock. A slide ends on a short hold of its last
// note, as a singer's does: the Voice Mirror's range counts a semitone
// only after 150 ms on it, and a glide's last note gets half that.

import type { PitchFrame } from '@/lib/pitch-f0-stream'

/** Frames a second. */
export const RATE = 100

/** How long a slide holds its last note, s. */
export const END_HOLD_SEC = 0.4

/** A note's frequency, Hz. */
export function hzOf(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

function span(
  t0: number,
  seconds: number,
  at: (k: number) => Omit<PitchFrame, 't'>,
): PitchFrame[] {
  const count = Math.round(seconds * RATE)
  const frames: PitchFrame[] = []
  for (let i = 0; i < count; i++) {
    frames.push({ t: t0 + i / RATE, ...at(count <= 1 ? 0 : i / (count - 1)) })
  }
  return frames
}

/** A quiet room from `t0`: no pitch, next to no sound. */
export function room(t0: number, seconds: number): PitchFrame[] {
  return span(t0, seconds, () => ({ f0: 0, conf: 0, rms: 0.002 }))
}

/** A voice from `t0`, gliding from one note to another, MIDI. */
export function glide(
  t0: number,
  fromMidi: number,
  toMidi: number,
  seconds: number,
): PitchFrame[] {
  return span(t0, seconds, (k) => ({
    f0: hzOf(fromMidi + (toMidi - fromMidi) * k),
    conf: 0.95,
    rms: 0.12,
  }))
}

/** One note held from `t0`. */
export function hold(t0: number, midi: number, seconds: number): PitchFrame[] {
  return glide(t0, midi, midi, seconds)
}

/** Loud sound with no pitch in it, from `t0`: a fan, a tap running. */
export function noise(t0: number, seconds: number): PitchFrame[] {
  return span(t0, seconds, () => ({ f0: 0, conf: 0, rms: 0.12 }))
}

/**
 * One slide's window, as the capture gives it: a second of room, the
 * slide and its short hold, then `rest` s of quiet, which ends it.
 */
export function slideWindow(
  fromMidi: number,
  toMidi: number,
  { seconds = 3, rest = 1.2 }: { seconds?: number; rest?: number } = {},
): PitchFrame[] {
  const end = 1 + seconds
  return [
    ...room(0, 1),
    ...glide(1, fromMidi, toMidi, seconds),
    ...hold(end, toMidi, END_HOLD_SEC),
    ...room(end + END_HOLD_SEC, rest),
  ]
}

/** One note held through a whole window, then quiet. */
export function heldWindow(midi: number): PitchFrame[] {
  return [...room(0, 1), ...hold(1, midi, 3), ...room(4, 1.2)]
}

/** A window of loud noise with no pitch, to the longest a slide runs. */
export function noiseWindow(seconds: number): PitchFrame[] {
  return [...room(0, 1), ...noise(1, seconds)]
}
