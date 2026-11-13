// ============================================================
// Lesson 26 parts — "Twinkle", its copies, the steps' parts and every play's notes
// ============================================================
//
// The page's notes, all in C around C4 but Sing it's, which are in G in the
// learner's voice (FACTS 50, 51), and every play's timing (FACTS 75 to 78).
// A note is semitones above C4 on the tune line (kit/tune-line.ts); a play
// is a run of notes (kit/run.ts), two parts note against note sharing their
// onsets, so each pair starts in one timer task (FACTS 26). A third is the
// key's own note three letters up, both ends counted (FACTS 11, 12): in a
// major key 4 semitones over do, fa and so, and 3 over re, mi, la and ti.

import type { RunNote } from '@/features/lessons/kit/run'

/** C4, the tune line's start and the cold open's do. */
export const C4 = 60

/** A major scale's degrees, semitones above do. */
export const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const

/** The pitch classes of C major: its lanes. */
export const C_MAJOR = [0, 2, 4, 5, 7, 9, 11] as const

/** The key's third above a note of the major scale, semitones above do: three letters up, in the key. */
export function thirdAbove(semi: number): number {
  const octave = Math.floor(semi / 12)
  const degree = MAJOR.indexOf(
    (((semi % 12) + 12) % 12) as (typeof MAJOR)[number],
  )
  if (degree < 0) throw new Error(`not in the key: ${semi}`)
  const up = degree + 2
  return octave * 12 + Math.floor(up / 7) * 12 + MAJOR[up % 7]
}

/** The key's third below a note of the major scale, semitones above do. */
export function thirdBelow(semi: number): number {
  const octave = Math.floor(semi / 12)
  const degree = MAJOR.indexOf(
    (((semi % 12) + 12) % 12) as (typeof MAJOR)[number],
  )
  if (degree < 0) throw new Error(`not in the key: ${semi}`)
  const down = degree - 2
  return octave * 12 + Math.floor(down / 7) * 12 + MAJOR[((down % 7) + 7) % 7]
}

/** A line of the tune line: each note's semitones above C4, and its length in crotchets. */
export interface Line {
  readonly at: readonly number[]
  readonly beats: readonly number[]
}

const line = (at: readonly number[], beats: readonly number[]): Line => ({
  at,
  beats,
})

/** "Twinkle"'s two lines in C (FACTS 13): do do so so la la so, fa fa mi mi re re do. */
export const TWINKLE: readonly [Line, Line] = [
  line([0, 0, 7, 7, 9, 9, 7], [1, 1, 1, 1, 1, 1, 2]),
  line([5, 5, 4, 4, 2, 2, 0], [1, 1, 1, 1, 1, 1, 2]),
]

/** The copy that stays in the key: the key's third above every note (FACTS 14). */
export const KEY_COPY = TWINKLE.map((l) => l.at.map(thirdAbove))

/** The copy moved four semitones everywhere (FACTS 15). */
export const UP4_COPY = TWINKLE.map((l) => l.at.map((a) => a + 4))

/** The lines the steps' tune line holds, by index: "Twinkle"'s two, the scale, do re mi re do, do re mi, and Merc's do re mi re do an octave down. */
export const LINE = {
  twinkle1: 0,
  twinkle2: 1,
  scale: 2,
  tune5: 3,
  tune3: 4,
  merc5: 5,
} as const

/** Step 1's scale, C4 to B4, a crotchet each (FACTS 12). */
export const SCALE = line([...MAJOR], [1, 1, 1, 1, 1, 1, 1])
/** Step 3's tune, do re mi re do on C4, and Step 4's, do re mi. */
export const TUNE5 = line([0, 2, 4, 2, 0], [1, 1, 1, 1, 2])
export const TUNE3 = line([0, 2, 4], [1, 1, 1])
/** Step 3's Merc and Tavi: Merc's tune an octave down, C3 to E3 (FACTS 19). */
export const MERC5 = line([-12, -10, -8, -10, -12], [1, 1, 1, 1, 2])

/** Every line the steps' tune line holds, in LINE's order. */
export const LINES: readonly Line[] = [
  TWINKLE[0],
  TWINKLE[1],
  SCALE,
  TUNE5,
  TUNE3,
  MERC5,
]

/** Step 3's parts, a third above and a third below do re mi re do (FACTS 17). */
export const ABOVE5 = TUNE5.at.map(thirdAbove)
export const BELOW5 = TUNE5.at.map(thirdBelow)
/** Tavi's part in the duet: the part above, E4 to G4, a tenth over Merc's tune (FACTS 19). */
export const TAVI5 = ABOVE5
/** Step 4's part above do re mi: mi fa so (FACTS 23). */
export const ABOVE3 = TUNE3.at.map(thirdAbove)
/** Step 4's chord, C3, E3 and G3, held under its plays (FACTS 23, 46). */
export const CHORD = [48, 52, 55] as const
/** C major's chord notes, by pitch class: a chord note glows gold as it sounds (FACTS 46). */
export const CHORD_PCS = [0, 4, 7] as const

/** The semitones between each note of a line and its part's. */
export const sizes = (
  tune: readonly number[],
  part: readonly number[],
): number[] => part.map((p, i) => Math.abs(p - tune[i]))

/** A pitch class's name off C major's lanes, as a bead draws it, or null on a lane. */
export function offLane(semi: number): string | null {
  const pc = ((semi % 12) + 12) % 12
  return (C_MAJOR as readonly number[]).includes(pc) ? null : `${NAMES[pc]}`
}

/** Each pitch class's letter, a black key by its sharp, as a bead names it. */
const NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const

/** A letter, a black key by its sharp spoken, and its octave, for a screen reader: "C sharp 5". */
export function spoken(midi: number): string {
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return `${NAMES[pc].replace('♯', ' sharp')} ${octave}`
}

/** A letter alone, a black key by its sharp spoken. */
export const letterSaid = (midi: number): string =>
  spoken(midi).replace(/ -?\d+$/, '')

// ---------------------------------------------------------------- timing (FACTS 75 to 78)

/** "Twinkle" at Lesson 6's tempo: 0.5 s a crotchet (FACTS 75). */
export const TWINKLE_BEAT = 0.5
/** Step 3's and the words' do re mi re do: 0.5 s a note, the last 1.0 s (FACTS 76, 77). */
export const SHORT_BEAT = 0.5
/** Step 1's pairs and Step 4's notes, 1.0 s each (FACTS 77). */
export const PAIR_SEC = 1.0

/** A line's notes as a run's, from `t0`, at `beat` seconds a crotchet, each `shift` semitones from C4. */
export function timed(
  at: readonly number[],
  beats: readonly number[],
  beat: number,
  t0 = 0,
  shift = C4,
): RunNote[] {
  let t = t0
  return at.map((a, i) => {
    const dur = beats[i] * beat
    const n = { t, midi: shift + a, dur }
    t += dur
    return n
  })
}

/** A run's length, seconds: its last note's end. */
export const lengthOf = (notes: readonly RunNote[]): number =>
  notes.reduce((m, n) => Math.max(m, n.t + n.dur), 0)
