// ============================================================
// Lesson 25 sounds — minor's three forms, the chord on so and the pairs, with every timing
// ============================================================
//
// What the steps' toy plays (FACTS 60 to 64; WEB-SPEC, Toys 1, and Audio),
// in the learner's clef's octave: A minor from A2 on the bass staff, for
// the lower voice or none stored, or from A3 on the treble, for the
// higher, and Step 4's C major and C minor from C3 or C4. A scale is the
// soft tone, a note every 0.4 s, each sounding 0.35 s: up, 3.15 s; up and
// down, 5.95 s; two scales 0.5 s apart, 6.8 s. Step 1's figures are so, te
// or ti, and do, 0.6, 0.6 and 1.2 s, and its chord on so, then home, two
// chords of 1.2 s at 0.075 a voice; Step 2's pairs are Lesson 6's, 1.55 s
// each and 0.5 s apart, 3.6 s. Every note is spelled one letter per degree
// (kit/chords.ts), so C minor's third is E♭, never D♯.
//
// A play is figures, each one staff play, a bar of its own, so the staff
// never cancels a sign (WEB-SPEC, Toys 1): melodic minor's way up, F♯ and
// G♯ with their sharps, and its way down, plain, are two. Each figure says
// what the staircase shows while it sounds, its stairs and its do, and how
// long the chord column's chord sounds in it. Do is written with its house.
// Pure: no DOM, no sound.

import type { ChordTone, Raises } from '@/features/lessons/kit/chords'
import { chordOnSo, HARMONIC_MINOR_DEGREES, MELODIC_MINOR_UP_DEGREES, minorDegrees, minorScale, NATURAL_MINOR_DEGREES, scaleOf, triad, } from '@/features/lessons/kit/chords'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import { pair, PAIR_SEC } from '@/features/lessons/kit/pair'
import { CHORD_GAIN } from '@/features/lessons/kit/sound'
import type { PlayNote } from '@/features/lessons/kit/staff'
import type { KeySig } from '@/features/lessons/kit/staff-key'
import type { Clef } from '@/features/lessons/kit/staff-places'

/** A minor's do: A2 on the bass staff, A3 on the treble (FACTS 60). */
export const minorDo = (clef: Clef): number => (clef === 'treble' ? 57 : 45)

/** C major's and C minor's do, three semitones above A's: C3 or C4 (FACTS 64). */
export const cDo = (clef: Clef): number => minorDo(clef) + 3

/**
 * The staircase's rows, A2 to C4 or A3 to C5: A minor on A with its chord
 * on so up to B, and C major and C minor on C, over rows that stand still
 * while do glides between them (kit/stairs-geometry.ts `StairsRoom`).
 */
export const rowsOf = (clef: Clef): { lo: number; hi: number } => ({
  lo: minorDo(clef),
  hi: cDo(clef) + 12,
})

/** A scale's pace: a note every 0.4 s, each sounding 0.35 s (FACTS 60). */
export const SCALE = { every: 0.4, dur: 0.35 } as const

/** One scale up, do to do: 3.15 s. */
export const UP_SEC = 7 * SCALE.every + SCALE.dur

/** The quiet between a play's two halves, s (FACTS 60, 62 to 64). */
export const BETWEEN_SEC = 0.5

/** Step 1's figures, so and te or ti 0.6 s each and do 1.2 s, and its chords, 1.2 s each (FACTS 61). */
export const FIGURE = { note: 0.6, last: 1.2, chord: 1.2 } as const

/** How long do glides from C to A, or A to C, and C minor's flats travel into the signature, s (WEB-SPEC, Look). */
export const GLIDE_SEC = 0.6

/** Natural minor, harmonic minor (te raised) and melodic minor (le and te raised going up). */
export const NATURAL: Raises = { te: false, le: false }
export const HARMONIC: Raises = { te: true, le: false }
export const MELODIC: Raises = { te: true, le: true }

/** What the staircase shows while a figure sounds. */
export interface Look {
  /** Its stairs, semitones above do. */
  readonly degrees: readonly number[]
  /** Do, MIDI. */
  readonly tonic: number
}

/** One staff play: when it starts in the play, its notes timed from there, and the staircase's look. */
export interface Figure {
  readonly at: number
  readonly notes: readonly PlayNote[]
  readonly look: Look
  /** Each voice's level, the soft tone's own unless given: a chord heard alone. */
  readonly gain?: number
  /** How long the chord column's chord sounds, from the figure's start, s. */
  readonly chord?: number
}

/** A play: its figures, in order. */
export type Play = readonly Figure[]

/** Every play the toy has, by its button's name. */
export type PlayId =
  | 'so-te-do'
  | 'so-ti-do'
  | 'chord-home'
  | 'harmonic'
  | 'le-pairs'
  | 'melodic'
  | 'major-melodic'
  | 'scale'
  | 'relative'
  | 'c-minor'

/** A time on the ms grid, so sums of 0.4 s land where they should. */
const ms = (s: number): number => Math.round(s * 1000) / 1000

const isDo = (midi: number, tonic: number): boolean => (midi - tonic) % 12 === 0

/** Notes one after another at the scale's pace, do with its house. */
function paced(tones: readonly ChordTone[], tonic: number): PlayNote[] {
  return tones.map((n, i) => ({
    t: ms(i * SCALE.every),
    dur: SCALE.dur,
    note: n.spelled,
    home: isDo(n.midi, tonic) || undefined,
  }))
}

/** One scale up, do to do, from `at` s, the staircase on `degrees` from its first note. */
export function scaleUp(
  tones: readonly ChordTone[],
  degrees: readonly number[],
  at = 0,
): Figure {
  const tonic = tones[0].midi
  return { at, notes: paced(tones, tonic), look: { degrees, tonic } }
}

/**
 * A minor scale as the switches set it, up, then down as a figure of its
 * own: harmonic minor the same both ways, melodic minor's le and te back
 * down coming down (FACTS 12, 13, 62, 63).
 */
export function upAndDown(clef: Clef, raises: Raises): Play {
  const tonic = minorDo(clef)
  const up = minorScale(tonic, raises, 'up')
  // the way down from the top do: te or ti, le or la, and on to do
  const down = minorScale(tonic, raises, 'down').slice(0, 7).reverse()
  return [
    {
      at: 0,
      notes: paced(up, tonic),
      look: { degrees: minorDegrees(raises, 'up'), tonic },
    },
    {
      at: ms(up.length * SCALE.every),
      notes: paced(down, tonic),
      look: { degrees: minorDegrees(raises, 'down'), tonic },
    },
  ]
}

/** Play so, te, do, or so, ti, do: 0.6, 0.6 and 1.2 s, the stairs lifting te for ti (FACTS 61). */
export function soToDo(clef: Clef, ti: boolean): Play {
  const tonic = minorDo(clef)
  const raises = ti ? HARMONIC : NATURAL
  const s = minorScale(tonic, raises)
  return [
    {
      at: 0,
      look: { degrees: minorDegrees(raises), tonic },
      notes: [
        { t: 0, dur: FIGURE.note, note: s[4].spelled },
        { t: FIGURE.note, dur: FIGURE.note, note: s[6].spelled },
        {
          t: ms(2 * FIGURE.note),
          dur: FIGURE.last,
          note: s[7].spelled,
          home: true,
        },
      ],
    },
  ]
}

/**
 * Play the chord on so, then home: E, G and B, or E, G♯ and B with te
 * raised, for 1.2 s, then A, C and E, each chord in a column of its own, at
 * 0.075 a voice (FACTS 61).
 */
export function chordThenHome(clef: Clef, raised: boolean): Play {
  const tonic = minorDo(clef)
  const chord = (tones: readonly ChordTone[], t: number, col: number) =>
    tones.map((n) => ({
      t,
      dur: FIGURE.chord,
      note: n.spelled,
      col,
      home: isDo(n.midi, tonic) || undefined,
    }))
  return [
    {
      at: 0,
      gain: CHORD_GAIN,
      chord: FIGURE.chord,
      look: { degrees: minorDegrees(raised ? HARMONIC : NATURAL), tonic },
      notes: [
        ...chord(chordOnSo(tonic, raised), 0, 0),
        ...chord(triad(tonic, 'minor'), FIGURE.chord, 1),
      ],
    },
  ]
}

/**
 * Play le to te, then le to ti: two of Lesson 6's pairs, 0.5 s apart, the
 * stairs natural minor's for the first, a riser of 2, and harmonic minor's
 * for the second, of 3 (FACTS 19, 62).
 */
export function lePairs(clef: Clef): Play {
  const tonic = minorDo(clef)
  const natural = minorScale(tonic, NATURAL)
  const le = natural[5]
  const pairTo = (top: ChordTone, at: number, degrees: readonly number[]) => {
    const [a, b] = pair(le.midi, top.midi)
    return {
      at,
      look: { degrees, tonic },
      notes: [
        { t: a.at, dur: a.dur, note: le.spelled },
        { t: ms(b.at), dur: b.dur, note: top.spelled },
      ],
    }
  }
  return [
    pairTo(natural[6], 0, NATURAL_MINOR_DEGREES),
    pairTo(
      minorScale(tonic, HARMONIC)[6],
      ms(PAIR_SEC + BETWEEN_SEC),
      HARMONIC_MINOR_DEGREES,
    ),
  ]
}

/** Play A major, then melodic minor, going up: the staircase A major's for the first, its third stair mi (FACTS 21, 63). */
export function majorThenMelodic(clef: Clef): Play {
  const tonic = minorDo(clef)
  return [
    scaleUp(scaleOf(tonic, 'major'), MAJOR_DEGREES),
    scaleUp(
      minorScale(tonic, MELODIC),
      MELODIC_MINOR_UP_DEGREES,
      ms(UP_SEC + BETWEEN_SEC),
    ),
  ]
}

/** Play C major, then A minor: the same white keys, do gliding from C down to A between them (FACTS 22, 64). */
export function cMajorThenAMinor(clef: Clef): Play {
  return [
    scaleUp(scaleOf(cDo(clef), 'major'), MAJOR_DEGREES),
    scaleUp(
      minorScale(minorDo(clef), NATURAL),
      NATURAL_MINOR_DEGREES,
      ms(UP_SEC + BETWEEN_SEC),
    ),
  ]
}

/** Play C minor: C natural minor up, its E♭, A♭ and B♭ written with their own signs (FACTS 64). */
export const cMinor = (clef: Clef): Play => [
  scaleUp(minorScale(cDo(clef), NATURAL), NATURAL_MINOR_DEGREES),
]

/** C minor's signature, and the run's columns whose notes carry its flats, in the signature's order: B♭, E♭, A♭ (FACTS 27). */
export const C_MINOR_KEY: KeySig = { sign: 'flat', count: 3 }
export const FLAT_COLUMNS: readonly number[] = [6, 2, 5]

/** A play's length, s: its last note's end. */
export const playLength = (play: Play): number =>
  ms(Math.max(...play.flatMap((f) => f.notes.map((n) => f.at + n.t + n.dur))))

/** Every play, by its button's name, in the learner's clef, with the switches as they stand. */
const PLAYS: Readonly<Record<PlayId, (clef: Clef, raises: Raises) => Play>> = {
  'so-te-do': (clef) => soToDo(clef, false),
  'so-ti-do': (clef) => soToDo(clef, true),
  'chord-home': (clef, raises) => chordThenHome(clef, raises.te),
  harmonic: (clef) => upAndDown(clef, HARMONIC),
  'le-pairs': (clef) => lePairs(clef),
  melodic: (clef) => upAndDown(clef, MELODIC),
  'major-melodic': (clef) => majorThenMelodic(clef),
  scale: (clef, raises) => upAndDown(clef, raises),
  relative: (clef) => cMajorThenAMinor(clef),
  'c-minor': (clef) => cMinor(clef),
}

/** Play `id` in `clef`, as the switches stand. */
export const playOf = (id: PlayId, clef: Clef, raises: Raises): Play =>
  PLAYS[id](clef, raises)
