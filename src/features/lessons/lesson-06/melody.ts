// ============================================================
// Lesson 6 melody — "Twinkle", "Auld Lang Syne" and the sizes between notes
// ============================================================
//
// The page's one tune is the first two lines of "Twinkle, Twinkle, Little
// Star" as the published score has them (FACTS 20): C4 C4 G4 G4 A4 A4 G4,
// F4 F4 E4 E4 D4 D4 C4, crotchets with a minim at each line's end. It is kept
// as scale degrees, so it can start on any note and is spelled as Lesson 4
// spells that key, one letter per degree (major-scale.ts; FACTS 24, 38):
// from B♭ the first line reads B♭ B♭ F F G G F, and F major's fa is B♭.
//
// Everything the lesson measures is here and pure: a line's notes from a
// start, the gaps between them in semitones, the transposed line, the
// swapped version Step 4 plays (its two rises' sizes swapped, FACTS 37),
// whether a gap is the same note, a step or a leap (FACTS 14), and the
// names of the intervals 1 to 12 (FACTS 11) with Leap's labels (FACTS 13).

import { MAJOR_DEGREES, majorScale } from '@/features/lessons/kit/major-scale'
import type { Spelled } from '@/features/lessons/kit/notes'

/** One note of a tune: its scale degree (0 do to 5 la), its length in crotchets, and its syllable. */
export interface MelodyNote {
  /** An index into the major scale, 0 do, 1 re, 2 mi, 3 fa, 4 so, 5 la. */
  readonly degree: number
  /** 1 a crotchet, 2 a minim. */
  readonly beats: number
  /** The sung syllable, as a screen reader says it ("twin", "kle"). */
  readonly syllable: string
}

const n = (degree: number, syllable: string, beats = 1): MelodyNote => ({
  degree,
  beats,
  syllable,
})

/**
 * "Twinkle, Twinkle"'s first two lines (FACTS 20): do do so so la la so,
 * fa fa mi mi re re do, on "Twin-kle, twin-kle, lit-tle star, How I won-der
 * what you are!".
 */
export const TWINKLE: readonly (readonly MelodyNote[])[] = [
  [
    n(0, 'twin'),
    n(0, 'kle'),
    n(4, 'twin'),
    n(4, 'kle'),
    n(5, 'lit'),
    n(5, 'tle'),
    n(4, 'star', 2),
  ],
  [
    n(3, 'How'),
    n(3, 'I'),
    n(2, 'won'),
    n(2, 'der'),
    n(1, 'what'),
    n(1, 'you'),
    n(0, 'are', 2),
  ],
]

/** The do-re-mi name of each degree the tune uses (Lesson 4's names). */
export const SOLFEGE: readonly string[] = ['do', 're', 'mi', 'fa', 'so', 'la']

/** Starts a slide reaches: C4 to B4 (FACTS 36, 62a). */
export const START_LO = 60
export const START_HI = 71
/** The tune on C, the page's home start, and the cold open's F♯ (FACTS 36). */
export const C4 = 60
export const FS4 = 66

/** Semitones above do of a degree. */
export const semitonesOf = (degree: number): number => MAJOR_DEGREES[degree]

/** A line's notes as MIDI numbers, from a start (do). */
export function lineMidis(
  line: readonly MelodyNote[],
  start: number,
): number[] {
  return line.map((note) => start + semitonesOf(note.degree))
}

/** Both lines' fourteen notes, in order, from a start. */
export function tuneMidis(start: number): number[] {
  return TWINKLE.flatMap((line) => lineMidis(line, start))
}

/** A line's notes spelled in the major key of its start, one letter per degree. */
export function lineNames(
  line: readonly MelodyNote[],
  start: number,
): Spelled[] {
  const scale = majorScale(start)
  return line.map((note) => scale[note.degree])
}

/** Every note moved by the same `by` semitones (FACTS 17). */
export const transpose = (midis: readonly number[], by: number): number[] =>
  midis.map((m) => m + by)

/** The gaps from each note to the next, in semitones, up positive and down negative. */
export const gapsOf = (midis: readonly number[]): number[] =>
  midis.slice(1).map((m, i) => m - midis[i])

/**
 * Step 4's swapped version (FACTS 37): the line's two rises keep their
 * places and swap their sizes, every other gap as it was, so the ups and
 * downs survive and the tune does not. From C: C4 C4 D4 D4 A4 A4 G4.
 */
export function swapSizes(midis: readonly number[]): number[] {
  const gaps = gapsOf(midis)
  const rises = gaps.flatMap((g, i) => (g > 0 ? [i] : []))
  if (rises.length !== 2) return [...midis]
  const [a, b] = rises
  const swapped = gaps.map((g, i) =>
    i === a ? gaps[b] : i === b ? gaps[a] : g,
  )
  const out = [midis[0]]
  for (const g of swapped) out.push(out[out.length - 1] + g)
  return out
}

/** A move from one note to the next: the same note, a step or a leap (FACTS 14, 15). */
export type MoveKind = 'same' | 'step' | 'leap'

/** 0 is the same note, 1 and 2 semitones a step, anything bigger a leap. */
export function classify(semitones: number): MoveKind {
  const size = Math.abs(semitones)
  if (size === 0) return 'same'
  return size <= 2 ? 'step' : 'leap'
}

/** An interval's name in words and the label Ear Lab's Leap gives it. */
export interface IntervalName {
  readonly name: string
  readonly label: string
}

/** The intervals 1 to 12 by semitones (FACTS 11), with Leap's labels (FACTS 13). */
const INTERVALS: readonly IntervalName[] = [
  { name: 'minor second', label: 'm2' },
  { name: 'major second', label: 'M2' },
  { name: 'minor third', label: 'm3' },
  { name: 'major third', label: 'M3' },
  { name: 'perfect fourth', label: 'P4' },
  { name: 'tritone', label: 'TT' },
  { name: 'perfect fifth', label: 'P5' },
  { name: 'minor sixth', label: 'm6' },
  { name: 'major sixth', label: 'M6' },
  { name: 'minor seventh', label: 'm7' },
  { name: 'major seventh', label: 'M7' },
  { name: 'octave', label: 'P8' },
]

/** The name of an interval of 1 to 12 semitones, either way; null outside that. */
export function intervalName(semitones: number): IntervalName | null {
  return INTERVALS[Math.abs(semitones) - 1] ?? null
}

/**
 * "Auld Lang Syne"'s first line, "Should auld ac-quain-tance be for-got"
 * (FACTS 25): C4 F4 F4 F4 A4 G4 F4 G4, its lengths in crotchets (a dotted
 * crotchet 1.5, a quaver 0.5). "Should" to "auld" is the perfect fourth.
 */
export const AULD: readonly {
  readonly midi: number
  readonly beats: number
}[] = [
  { midi: 60, beats: 1 },
  { midi: 65, beats: 1.5 },
  { midi: 65, beats: 0.5 },
  { midi: 65, beats: 1 },
  { midi: 69, beats: 1 },
  { midi: 67, beats: 1.5 },
  { midi: 65, beats: 0.5 },
  { midi: 67, beats: 1 },
]
