// ============================================================
// Lesson 2 examples — the film's sounds, at its pitches and timings
// ============================================================
//
// Where the page plays an example the film plays, it takes the film's
// pitches and times (FACTS 42 to 52; FACTS 25 for the cents glide), so the
// page and the episode sound alike. A two-note example is a "pair": the
// first note 0.55 s, the second 0.60 s in, for 0.75 s (FACTS 45 to 49, 52).
// Times are seconds from the press; every note is the kit's soft tone at its
// equal-tempered frequency, and Merc's slides are her "ooh" (FACTS 50, 51).

import { hz } from '@/features/lessons/kit/notes'
import type { ContourPoint } from '@/features/lessons/kit/sound'
import { contourOf, Sound } from '@/features/lessons/kit/sound'

/** One note of an example: its MIDI number, its onset and its length, seconds. */
export interface NoteEvent {
  readonly midi: number
  readonly at: number
  readonly dur: number
}

/** A pair of notes, the film's way: 0.55 s, then 0.75 s from 0.60 s, `at` seconds in. */
export const pair = (a: number, b: number, at = 0): NoteEvent[] => [
  { midi: a, at, dur: 0.55 },
  { midi: b, at: at + 0.6, dur: 0.75 },
]

/** `first-step` (FACTS 42): A3, then the very next note up. */
export const FIRST_STEP: readonly NoteEvent[] = [
  { midi: 57, at: 0, dur: 0.85 },
  { midi: 58, at: 1, dur: 0.95 },
]

/** A tone at the first step's pace: A3, then B3 (the words strip's "Play: A to B"). */
export const A_TO_B: readonly NoteEvent[] = [
  { midi: 57, at: 0, dur: 0.85 },
  { midi: 59, at: 1, dur: 0.95 },
]

/** `climb` (FACTS 43): A3 to A4 in thirteen notes, 0.42 s apart, the last held. */
export const CLIMB: readonly NoteEvent[] = Array.from(
  { length: 13 },
  (_, k) => ({ midi: 57 + k, at: 0.42 * k, dur: k === 12 ? 0.9 : 0.4 }),
)

/** `bc-cd` (FACTS 45), in its two halves. */
export const B_TO_C: readonly NoteEvent[] = pair(59, 60)
export const C_TO_D: readonly NoteEvent[] = pair(60, 62)

/** `neighbours` (FACTS 46): C to C♯, then B to C. */
export const NEIGHBOURS: readonly NoteEvent[] = [
  ...pair(60, 61),
  ...pair(59, 60, 1.9),
]

/** `e-f` (FACTS 47). */
export const E_TO_F: readonly NoteEvent[] = pair(64, 65)

/** C to C♯: the words strip's "Play: C to C♯", at the pair's pace. */
export const C_TO_C_SHARP: readonly NoteEvent[] = pair(60, 61)

/** `tone-split` (FACTS 48): C, C♯, D, then C to D. */
export const TONE_SPLIT: readonly NoteEvent[] = [
  { midi: 60, at: 0, dur: 0.5 },
  { midi: 61, at: 0.55, dur: 0.5 },
  { midi: 62, at: 1.1, dur: 0.7 },
  { midi: 60, at: 2.3, dur: 0.5 },
  { midi: 62, at: 2.85, dur: 0.75 },
]

/** `two-ways` (FACTS 49): C4 up to C♯4, then D4 down to D♭4, the same key. */
export const TWO_WAYS: readonly NoteEvent[] = [
  ...pair(60, 61),
  ...pair(62, 61, 1.9),
]

/** `quiz-pair` (FACTS 52): A4 to B4, a tone, then B4 to C5, a semitone. */
export const QUIZ_PAIR: readonly NoteEvent[] = [
  ...pair(69, 71),
  ...pair(71, 72, 1.9),
]

/** `cents-glide` (FACTS 25): A3 held, an exponential glide to A♯3 at 40 cents a second, then held. */
export const CENTS_GLIDE: readonly ContourPoint[] = contourOf(220, [
  { hold: 0.5 },
  { glide: 2.5, to: hz(58) },
  { hold: 0.6 },
])

/** The cents sounding `t` seconds into the cents glide. */
export function glideCents(t: number): number {
  if (t <= 0.5) return 0
  if (t >= 3) return 100
  return (t - 0.5) * 40
}

/**
 * Merc's slide (FACTS 50; FACTS 51 an octave up): A held, up one semitone,
 * held, and back, 4.2 s. `root` is the MIDI number of the A.
 */
export function slide(root: number): ContourPoint[] {
  return contourOf(hz(root), [
    { hold: 1.2 },
    { glide: 0.5, to: hz(root + 1) },
    { hold: 1 },
    { glide: 0.5, to: hz(root) },
    { hold: 1 },
  ])
}

/** Seconds from an example's start to the end of its last note. */
export const lengthOf = (events: readonly NoteEvent[]): number =>
  events.reduce((end, e) => Math.max(end, e.at + e.dur), 0)

/** The same example `k` times slower, as a missed round replays it. */
export const slower = (events: readonly NoteEvent[], k: number): NoteEvent[] =>
  events.map((e) => ({ midi: e.midi, at: e.at * k, dur: e.dur * k }))

/**
 * Runs `onNote` at each note's onset, and resolves when the last note has
 * ended. Every note is timed from the one press, so they do not drift.
 */
export function schedule(
  events: readonly NoteEvent[],
  onNote: (e: NoteEvent, i: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    events.forEach((e, i) => {
      window.setTimeout(() => onNote(e, i), e.at * 1000)
    })
    window.setTimeout(resolve, lengthOf(events) * 1000)
  })
}

/**
 * Plays an example in the soft tone (silently when `audible` is false, the
 * visuals still running), with `onNote` hearing each note as it starts.
 */
export function playNotes(
  events: readonly NoteEvent[],
  audible: boolean,
  onNote?: (e: NoteEvent, i: number) => void,
): Promise<void> {
  return schedule(events, (e, i) => {
    if (audible) Sound.voice(hz(e.midi), { dur: e.dur })
    onNote?.(e, i)
  })
}
