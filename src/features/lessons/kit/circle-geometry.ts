// ============================================================
// Circle geometry — Lesson 2's ring of twelve, by semitones or threaded by fifths
// ============================================================
//
// Lesson 2's ring of twelve beads, the spiral seen from the top, a bead a
// semitone (Lesson 21's WEB-SPEC, Toys 3). Threaded by fifths, the same
// twelve beads sit a fifth from their neighbours: the circle of fifths, C
// at the top, G one place clockwise, F one place anticlockwise, each key a
// fifth from the next (Lesson 21 FACTS 23, 24). Each bead is then a major
// key: its name, its key signature, and, for the bottom three, two names,
// the sharp name above the flat. A page reads only the keys within three
// sharps and three flats (FACTS 25), and the house moves within a part of
// them; the rest are drawn and named but take no tap.
//
// The walk round the circle is twelve fifths up from C4, each folded into
// the octave from C4 (FACTS 31): pure fifths, 3 to 2, run past C by 23.46
// cents; equal ones, 700 cents, close the ring on C.
//
// Pure: no DOM, no sound.

import type { Spelled } from './notes'
import type { KeySig } from './staff-key'

/** How the beads sit: a semitone apart (Lesson 2's ring) or a fifth apart (the circle of fifths). */
export type Threading = 'semitones' | 'fifths'

/** A bead's pitch class: C 0 up to B 11. */
export type PitchClass = number

/** The twelve major keys clockwise from C, a fifth apart: their tonics' pitch classes. */
export const FIFTHS: readonly PitchClass[] = [
  0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5,
]

/** A bead's place round the ring, 0 at the top, clockwise, by its threading. */
export function seatOf(pc: PitchClass, threading: Threading): number {
  const p = ((pc % 12) + 12) % 12
  return threading === 'semitones' ? p : FIFTHS.indexOf(p)
}

/** A seat's angle, radians, clockwise from the top. */
export const angleOf = (seat: number): number => (seat * 2 * Math.PI) / 12

/** A point on a ring of radius `r` round (cx, cy), at angle `a` clockwise from the top. */
export function onRing(
  cx: number,
  cy: number,
  r: number,
  a: number,
): { x: number; y: number } {
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) }
}

/**
 * A bead's angle part way between two threadings, `u` from 0 to 1: each
 * bead takes the shorter way round, so the beads move round the ring until
 * each sits a fifth from its neighbours. From semitones to fifths the beads
 * of C, D, E, F sharp, G sharp and A sharp stay put and the other six cross
 * to the far side (seat 7p for pitch class p), a tie each goes clockwise.
 */
export function angleBetween(
  pc: PitchClass,
  from: Threading,
  to: Threading,
  u: number,
): number {
  const a0 = angleOf(seatOf(pc, from))
  const a1 = angleOf(seatOf(pc, to))
  // within (-half a turn, half a turn]: a tie goes clockwise, whatever rounding says
  let d = a1 - a0
  if (d > Math.PI + 1e-9) d -= 2 * Math.PI
  else if (d < -Math.PI + 1e-9) d += 2 * Math.PI
  return a0 + d * Math.min(1, Math.max(0, u))
}

/** A major key on the circle. */
export interface CircleKey {
  /** Its seat on the circle of fifths, 0 (C) to 11 (F), clockwise. */
  readonly seat: number
  readonly pc: PitchClass
  /** Its tonic as the circle names it: the sharp name for the bottom three, as the kit's scales spell F♯. */
  readonly tonic: Spelled
  /** The bottom three's second name, the flat one (FACTS 23); none for the others. */
  readonly twin: Spelled | null
  /** Its key signature: the sharps clockwise from C, the flats anticlockwise. */
  readonly key: KeySig
  /** Within three sharps or three flats: a key the page reads (FACTS 25). */
  readonly read: boolean
}

const S = (letter: Spelled['letter'], alter = 0): Spelled => ({
  letter,
  alter,
  octave: 4,
})

/** The twelve keys round the circle, C at the top. */
const KEYS: readonly Pick<CircleKey, 'tonic' | 'twin' | 'key'>[] = [
  { tonic: S('C'), twin: null, key: { sign: 'sharp', count: 0 } },
  { tonic: S('G'), twin: null, key: { sign: 'sharp', count: 1 } },
  { tonic: S('D'), twin: null, key: { sign: 'sharp', count: 2 } },
  { tonic: S('A'), twin: null, key: { sign: 'sharp', count: 3 } },
  { tonic: S('E'), twin: null, key: { sign: 'sharp', count: 4 } },
  { tonic: S('B'), twin: S('C', -1), key: { sign: 'sharp', count: 5 } },
  { tonic: S('F', 1), twin: S('G', -1), key: { sign: 'sharp', count: 6 } },
  { tonic: S('C', 1), twin: S('D', -1), key: { sign: 'sharp', count: 7 } },
  { tonic: S('A', -1), twin: null, key: { sign: 'flat', count: 4 } },
  { tonic: S('E', -1), twin: null, key: { sign: 'flat', count: 3 } },
  { tonic: S('B', -1), twin: null, key: { sign: 'flat', count: 2 } },
  { tonic: S('F'), twin: null, key: { sign: 'flat', count: 1 } },
]

/** Each key with its seat, its pitch class and whether the page reads its signature. */
export const CIRCLE: readonly CircleKey[] = KEYS.map((k, seat) => ({
  ...k,
  seat,
  pc: FIFTHS[seat],
  read: k.key.count <= 3,
}))

/** A part of the circle the house moves within: its seats, from the anticlockwise end round to the clockwise end. */
export interface CirclePart {
  /** The anticlockwise end, as a seat. */
  readonly from: number
  /** How many steps clockwise it runs from there. */
  readonly span: number
}

/** Step 2's part, C round to A (the sharp side); Step 3's, E♭ round to C (the flat side); free play's, E♭ round to A (WEB-SPEC, Toys 3). */
export const PARTS = {
  sharps: { from: 0, span: 3 },
  flats: { from: 9, span: 3 },
  all: { from: 9, span: 6 },
} as const satisfies Readonly<Record<string, CirclePart>>

/** The seats of a part, in clockwise order. */
export const seatsOf = (part: CirclePart): number[] =>
  Array.from({ length: part.span + 1 }, (_, i) => (part.from + i) % 12)

/** Whether `seat` is in `part`. */
export const inPart = (seat: number, part: CirclePart): boolean =>
  seatsOf(part).includes(((seat % 12) + 12) % 12)

/**
 * The seat one step clockwise (1) or anticlockwise (-1) from `seat`, or
 * null at the part's end.
 */
export function stepSeat(
  seat: number,
  dir: 1 | -1,
  part: CirclePart,
): number | null {
  const seats = seatsOf(part)
  const i = seats.indexOf(seat)
  const j = i + dir
  return i < 0 || j < 0 || j >= seats.length ? null : seats[j]
}

/** C4, where the walk starts, Hz (A4 = 440). */
export const WALK_FROM_HZ = 440 * 2 ** (-9 / 12)

/** A pure fifth, 3 to 2, and an equal-tempered one, 700 cents, as frequency ratios. */
const PURE = 3 / 2
const EQUAL = 2 ** (7 / 12)

/**
 * The walk's thirteen notes: twelve fifths up from C4, each folded into the
 * octave from C4, and the C it reaches (FACTS 31). Pure fifths end 23.46
 * cents above C4; equal ones end on C4.
 */
export function walkHz(tuning: 'pure' | 'equal'): number[] {
  const ratio = tuning === 'pure' ? PURE : EQUAL
  const out: number[] = []
  let r = 1
  for (let i = 0; i <= 12; i++) {
    out.push(WALK_FROM_HZ * r)
    r *= ratio
    while (r >= 2 - 1e-9) r /= 2
  }
  return out
}

/** How far the walk ends above where it began, cents. */
export const walkGapCents = (tuning: 'pure' | 'equal'): number => {
  const hz = walkHz(tuning)
  return 1200 * Math.log2(hz[12] / hz[0])
}
