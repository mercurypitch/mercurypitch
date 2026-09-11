// The Top Shelf's voice: a stop, and what it does to him.
// ============================================================
//
// The Line's slide tracker finds where the voice settles (docs/games/
// top-shelf.md §3.1); this decides what a settled note means in a room
// of shelves. One rule, three cases, and the reference is its only
// state:
//
//   above the reference, on the ground   a leap, as high as the interval
//   at or below it, on the ground        the reference moves; he readies
//   anything, in the air                 the reference moves; nothing else
//
// Above is by at least `MIN_LEAP_SEMIS`, the tracker's own half
// semitone. A stop nearer the reference than that is the note held
// again -- a tail that flicked up and settled a few cents sharp, a
// re-attack scooped in from below -- and counts as at it.
//
// EVERY STOP BECOMES THE REFERENCE, whichever case it is. That is what
// makes down free (D1): the next leap is measured from the last note
// held, wherever it was held, so each is sung from somewhere comfortable
// rather than stacked on the one before. A stop in the air is a stop
// like any other (D8); it only cannot launch him, because nothing in the
// air has anything to push off.
//
// It knows nothing about shelves or walls. It says how high; the stage
// launches him, and `levels/shelf` decides where he comes down.

import { leapHeight } from '../levels/shelf'
import type { SlideState } from './line-grade'
import { emptySlide, slideStep } from './line-grade'

export interface ShelfVoice {
  /** The Line's tracker, unchanged: 150 ms within a tenth of a
   * semitone is a stop, and a new one needs half a semitone of leaving. */
  readonly slide: SlideState
  /** The last stop, in MIDI, or null before the first (§3.1). */
  reference: number | null
}

export const emptyVoice = (): ShelfVoice => ({
  slide: emptySlide(),
  reference: null,
})

export type VoiceStop =
  /** A stop at least `MIN_LEAP_SEMIS` above the reference, sung on the
   * ground: he leaps. */
  | {
      readonly kind: 'leap'
      readonly stop: number
      /** Semitones above the reference, as sung. Not capped: the leap
       * is, at his spring, and the grade wants what the voice did. */
      readonly interval: number
      /** Metres, capped at `MAX_LEAP`. */
      readonly height: number
    }
  /** A stop on the ground less than `MIN_LEAP_SEMIS` above the
   * reference, on it or below it, or the first stop of all: the
   * reference moves, and he crouches a little, readying. */
  | { readonly kind: 'ready'; readonly stop: number }
  /** A stop in the air: the reference moves, and that is all. */
  | { readonly kind: 'held'; readonly stop: number }

/**
 * Feed one step's voice: the note heard, or null for silence. Returns
 * what a stop did, on the step it stops, and null on every other step.
 * Mutates `v`, like the slide it carries.
 */
export const voiceStep = (
  v: ShelfVoice,
  midi: number | null,
  dt: number,
  grounded: boolean,
): VoiceStop | null => {
  const stop = slideStep(v.slide, midi, dt)
  if (stop === null) return null
  const from = v.reference
  v.reference = stop
  if (!grounded) return { kind: 'held', stop }
  const height = from === null ? null : leapHeight(from, stop)
  if (from === null || height === null) return { kind: 'ready', stop }
  return { kind: 'leap', stop, interval: stop - from, height }
}

// ------------------------------------------------------------
// Naming what was sung.
// ------------------------------------------------------------

/** The intervals by semitone, as the ruler and its flash name them
 * (§6). The ruler labels only the ones the rooms ask for; a leap can be
 * any of them. */
const NAMES = [
  'unison',
  'm2',
  'M2',
  'm3',
  'M3',
  'P4',
  'TT',
  'P5',
  'm6',
  'M6',
  'm7',
  'M7',
  '8ve',
] as const

/** The nearest interval's name: `P5` for 7, `8ve` for 12. */
export const intervalName = (semis: number): string => {
  const n = Math.round(semis)
  if (n < 0) return `-${String(-n)} st`
  return NAMES[n] ?? `${String(n)} st`
}

/**
 * An interval as the flash at a leap's apex says it (§6): the nearest
 * name and how far off it, in cents -- `P5 +12¢`, `P4 -30¢`, and `P5`
 * alone when it is exact to the cent.
 */
export const intervalLabel = (semis: number): string => {
  const n = Math.round(semis)
  const cents = Math.round((semis - n) * 100)
  const name = intervalName(n)
  if (cents === 0) return name
  return `${name} ${cents > 0 ? '+' : '-'}${String(Math.abs(cents))}¢`
}
