// ============================================================
// Staircase scales — which stairs a staircase draws, and their names
// ============================================================
//
// Lesson 4's staircase draws the major scale's eight notes, do to do
// (major-scale.ts). Lesson 20's draws two more scales on the same stairs
// (its WEB-SPEC, Toys 1; FACTS 21 to 27): the major pentatonic, the major
// scale with fa and ti left out, do, re, mi, so, la and do; and the minor
// pentatonic, the same five started on la and sung from do as do, me, fa,
// so, te and do. A scale is its stairs as semitones above do (`Degrees`).
// From those come its risers (2, 2, 3, 2 and 3 semitones for the major
// five), each stair's sung name and its letter, spelled as the scale is: a
// degree of the major scale as major-scale.ts spells it (from D, F♯ and
// C♯), and any other degree from the relative major, the major scale whose
// la is this do, so the minor five on C reads C, E♭, F, G, B♭ and C.

import { MAJOR_DEGREES, majorScale } from './major-scale'
import type { Spelled } from './notes'

/** A staircase's stairs as semitones above do, low to high. */
export type Degrees = readonly number[]

/** The major pentatonic, do re mi so la and the top do: the major scale with fa and ti left out. */
export const MAJOR_FIVE: Degrees = [0, 2, 4, 7, 9, 12]

/** The minor pentatonic, do me fa so te and the top do: the major five started on la. */
export const MINOR_FIVE: Degrees = [0, 3, 5, 7, 10, 12]

/** Each riser between neighbouring stairs, semitones: 2, 2, 1, 2, 2, 2, 1 for the major scale. */
export const risersOf = (degrees: Degrees): number[] =>
  degrees.slice(1).map((d, i) => d - degrees[i])

/**
 * The same notes started on one of their own degrees, `from` semitones
 * above do and below the top: the major five from la (9) is the minor
 * five. Throws for a degree the scale does not hold.
 */
export function rotation(degrees: Degrees, from: number): number[] {
  const octave = degrees.slice(0, -1)
  const i = octave.indexOf(from)
  if (i === -1) throw new Error(`No degree ${from} in ${degrees.join(', ')}`)
  const turned = [...octave.slice(i), ...octave.slice(0, i).map((d) => d + 12)]
  return [...turned.map((d) => d - from), 12]
}

/** The sung names from do: the major scale's, with me, le and te for natural minor's third, sixth and seventh. */
const SYLLABLES: Readonly<Record<number, string>> = {
  0: 'do',
  2: 're',
  3: 'me',
  4: 'mi',
  5: 'fa',
  7: 'so',
  8: 'le',
  9: 'la',
  10: 'te',
  11: 'ti',
}

/** A degree's sung name from do: the top do is do. Throws for one the lessons never name. */
export function syllableOf(degree: number): string {
  const s = SYLLABLES[degree % 12]
  if (s === undefined) throw new Error(`No sung name for degree ${degree}`)
  return s
}

/** A major scale's degrees, two octaves of them, for spelling from the relative major. */
const TWO_OCTAVES = [
  ...MAJOR_DEGREES.slice(0, 7),
  ...MAJOR_DEGREES.map((d) => d + 12),
]

/**
 * The scale on `tonic` (a MIDI number) spelled, a letter a stair. Degrees
 * of the major scale take the major scale's own letters; any other set is
 * spelled from the relative major, `tonic` its la, so C's minor five reads
 * C, E♭, F, G, B♭, C and A's reads A, C, D, E, G, A. Throws for a degree
 * neither holds.
 */
export function spellDegrees(tonic: number, degrees: Degrees): Spelled[] {
  if (degrees.every((d) => MAJOR_DEGREES.includes(d))) {
    const major = majorScale(tonic)
    return degrees.map((d) => major[MAJOR_DEGREES.indexOf(d)])
  }
  const relative = tonic - 9
  const notes = [
    ...majorScale(relative).slice(0, 7),
    ...majorScale(relative + 12),
  ]
  return degrees.map((d) => {
    const i = TWO_OCTAVES.indexOf(9 + d)
    if (i === -1) throw new Error(`No letter for degree ${d} from ${tonic}`)
    return notes[i]
  })
}

/** Whether two sets of degrees are the same stairs. */
export const sameDegrees = (a: Degrees, b: Degrees): boolean =>
  a.length === b.length && a.every((d, i) => d === b[i])

/** A scale's kind, as its name says it: "major", "major pentatonic" or "minor pentatonic"; null for another. */
export function scaleKind(degrees: Degrees): string | null {
  if (sameDegrees(degrees, MAJOR_DEGREES)) return 'major'
  if (sameDegrees(degrees, MAJOR_FIVE)) return 'major pentatonic'
  if (sameDegrees(degrees, MINOR_FIVE)) return 'minor pentatonic'
  return null
}
