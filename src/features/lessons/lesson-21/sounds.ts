// ============================================================
// Lesson 21 sounds — every scale, key and round the steps play
// ============================================================
//
// What each play on the steps' stage sounds and writes (FACTS 60 to 63):
// the scales at a note every 0.4 s, each 0.35 s long, and the circle's in
// Step 2 and free play at 0.3 s and 0.27 s; each key's do in the learner's
// clef's octave, inside Lesson 15's two ledger lines each way (the bass
// clef's F2 to E flat 4, the treble's B flat 3 to A5); the white keys from G
// and from F; F major spelled both ways, the same notes twice with 0.5 s
// between, 6.8 s; Find do's six rounds, their do and their lines (FACTS 26;
// WEB-SPEC, Toys 4). A note is written, not just a pitch: each scale is
// spelled as its key spells it (kit/major-scale.ts), one letter a degree,
// and a play's signature is the one its key shares with the key before
// until the scale ends: then the new signs join it (Toys 2), and a note
// whose sign is joining is ringed while it shows (Look).

import { majorScale } from '@/features/lessons/kit/major-scale'
import type { Letter, Spelled } from '@/features/lessons/kit/notes'
import type { PlayNote } from '@/features/lessons/kit/staff'
import type { KeySig } from '@/features/lessons/kit/staff-key'
import { covered } from '@/features/lessons/kit/staff-key'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'

/** A note from its name: "G4", "F♯4", "B♭3". */
export function note(name: string): Spelled {
  const m = /^([A-G])([♯♭]?)(\d)$/.exec(name)
  if (m === null) throw new Error(`no note ${name}`)
  return {
    letter: m[1] as Letter,
    alter: m[2] === '♯' ? 1 : m[2] === '♭' ? -1 : 0,
    octave: Number(m[3]),
  }
}

/** How a run is paced: an onset every `every` s, each note `dur` s long. */
export interface Pace {
  readonly every: number
  readonly dur: number
}

/** The steps' scales (FACTS 61, 63), and the circle's in Step 2 and free play. */
export const PACE = {
  step: { every: 0.4, dur: 0.35 },
  circle: { every: 0.3, dur: 0.27 },
} as const satisfies Readonly<Record<string, Pace>>

/** `notes` in turn at `pace`, each with what `each` adds to it. */
export function runOf(
  notes: readonly Spelled[],
  pace: Pace,
  each: (n: Spelled, i: number) => Partial<PlayNote> = () => ({}),
): PlayNote[] {
  return notes.map((n, i) => ({
    t: Math.round(i * pace.every * 1000) / 1000,
    dur: pace.dur,
    note: n,
    ...each(n, i),
  }))
}

/** How long a run lasts, s: its last note's end. */
export const runLength = (notes: readonly PlayNote[]): number =>
  Math.max(0, ...notes.map((n) => n.t + n.dur))

/** The major scale from `tonic`, spelled as its key spells it, do to do. */
export const scaleOf = (tonic: Spelled): Spelled[] => majorScale(midiOf(tonic))

/**
 * Each key's do in each clef, by its seat on the circle (circle-geometry.ts):
 * C3, G2, D3, A2, E flat 3, B flat 2 and F2 for the lower voice, C4, G4, D4,
 * A4, E flat 4, B flat 3 and F4 for the higher (FACTS 63), so every scale
 * stays within two ledger lines of its staff.
 */
const KEY_DO: Readonly<Record<number, Readonly<Record<Clef, string>>>> = {
  0: { bass: 'C3', treble: 'C4' },
  1: { bass: 'G2', treble: 'G4' },
  2: { bass: 'D3', treble: 'D4' },
  3: { bass: 'A2', treble: 'A4' },
  9: { bass: 'E♭3', treble: 'E♭4' },
  10: { bass: 'B♭2', treble: 'B♭3' },
  11: { bass: 'F2', treble: 'F4' },
}

/** A key's do on the learner's staff, by its seat on the circle. */
export function doOf(seat: number, clef: Clef): Spelled {
  const names = KEY_DO[seat]
  if (names === undefined) throw new Error(`no key read at seat ${seat}`)
  return note(names[clef])
}

/** Step 1's do, G2 for the lower voice and G4 for the higher (FACTS 63). */
export const STEP1_DO: Readonly<Record<Clef, Spelled>> = {
  bass: note('G2'),
  treble: note('G4'),
}

const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** The white keys up an octave from a white `start`: G, A, B, C, D, E, F, G from G. */
export function whiteKeysOf(start: Spelled): Spelled[] {
  const from = LETTERS.indexOf(start.letter)
  return Array.from({ length: 8 }, (_, i) => {
    const at = from + i
    return {
      letter: LETTERS[at % 7],
      alter: 0,
      octave: start.octave + Math.floor(at / 7),
    }
  })
}

/** F major with its fourth note spelled A sharp, the same sounds as B flat (Step 3's mix-up). */
export const withASharp = (fMajor: readonly Spelled[]): Spelled[] =>
  fMajor.map((n) =>
    n.letter === 'B' && n.alter === -1 ? { ...n, letter: 'A', alter: 1 } : n,
  )

/** The breath between F major spelled with A sharp and spelled with B flat, s (FACTS 63). */
export const BOTH_WAYS_GAP = 0.5

/** What Spell it says of each spelling (WEB-SPEC, Toys 2). */
export const SPELL_SAID = {
  sharp: 'Two notes on A, none on B',
  flat: 'One note on every letter',
} as const

/** The signature two keys share: the fewer signs, of one kind, or none. */
export function sharedKey(a: KeySig | null, b: KeySig | null): KeySig | null {
  if (a === null || b === null || a.sign !== b.sign) return null
  const count = Math.min(a.count, b.count)
  return count === 0 ? null : { sign: a.sign, count }
}

/**
 * A scale on the staff as the house moves to its key: the run, its notes
 * whose sign joins the signature ringed; the signature it plays under, the
 * one the key shares with the key before; and the key's own, which the
 * staff takes as the scale ends.
 */
export function keyRun(
  scale: readonly Spelled[],
  was: KeySig | null,
  key: KeySig | null,
  pace: Pace,
): { notes: PlayNote[]; under: KeySig | null; after: KeySig | null } {
  const under = sharedKey(was, key)
  const after = key === null || key.count === 0 ? null : key
  const joins = (n: Spelled): boolean =>
    n.alter !== 0 &&
    (under === null || !covered(n, under)) &&
    after !== null &&
    covered(n, after)
  return {
    notes: runOf(scale, pace, (n) => (joins(n) ? { outline: true } : {})),
    under,
    after,
  }
}

// ---------------------------------------------------------------- Find do

/** One of Find do's rounds: its key, its do's letter, and what a right or a wrong tap says. */
export interface Round {
  readonly key: KeySig
  readonly do: Letter
  /** Do's name, for the eye: "B♭". */
  readonly name: string
  readonly right: string
  /** The rule, after "That's" and the tapped note. */
  readonly rule: string
}

const SHARP_RULE = 'Look at the last sharp: do sits a semitone above it.'
const FLAT_RULE = 'Look at the second-to-last flat.'

/** The six rounds in their fixed order: G, D and A major, then F, B flat and E flat major (FACTS 26). */
export const ROUNDS: readonly Round[] = [
  {
    key: { sign: 'sharp', count: 1 },
    do: 'G',
    name: 'G',
    right: 'Do is G. The last sharp, F♯, is ti.',
    rule: SHARP_RULE,
  },
  {
    key: { sign: 'sharp', count: 2 },
    do: 'D',
    name: 'D',
    right: 'Do is D. The last sharp, C♯, is ti.',
    rule: SHARP_RULE,
  },
  {
    key: { sign: 'sharp', count: 3 },
    do: 'A',
    name: 'A',
    right: 'Do is A. The last sharp, G♯, is ti.',
    rule: SHARP_RULE,
  },
  {
    key: { sign: 'flat', count: 1 },
    do: 'F',
    name: 'F',
    right: 'One flat: F major.',
    rule: 'One flat means F major.',
  },
  {
    key: { sign: 'flat', count: 2 },
    do: 'B',
    name: 'B♭',
    right: 'Do is B♭: the second-to-last flat.',
    rule: FLAT_RULE,
  },
  {
    key: { sign: 'flat', count: 3 },
    do: 'E',
    name: 'E♭',
    right: 'Do is E♭: the second-to-last flat.',
    rule: FLAT_RULE,
  },
]

/** After the sixth round. */
export const ALL_FOUND = 'All six found.'

/** The places a tap reaches on Find do's staff: its nine lines and spaces and the space just above and below (FACTS 26). */
export const FIND_REACH: readonly [number, number] = [-1, 9]

/** A right tap's answer, from the tapped do: do, mi and so, 0.5 s each, onsets 0.6 s apart, after the tap's own 0.8 s note and 0.2 s of quiet (FACTS 63). */
export const ANSWER_AFTER = 1.0
export function answerOf(tapped: Spelled): PlayNote[] {
  const scale = scaleOf(tapped)
  return [scale[0], scale[2], scale[4]].map((n, i) => ({
    t: Math.round(i * 0.6 * 1000) / 1000,
    dur: 0.5,
    note: n,
    home: i === 0,
  }))
}
