// ============================================================
// Lesson 27 sounds — every chord the page plays, by voice, at FACTS 72 to 74's pitches, lengths and levels
// ============================================================
//
// Written for the higher voice, G3 to G5, on the treble staff; the lower
// voice plays each an octave down, G2 to G4, on the bass staff (`voiced`).
// The hero and quick check 4 play as written, for everyone, in Merc's
// register (FACTS 74). A chord's notes sound together: three at Lesson
// 12's 0.075 a voice, four at 0.056, so a seventh adds a note, not
// loudness; Step 3's two notes together are Lesson 23's own, at the soft
// tone's 0.13 (FACTS 73). A chord is named by its root position, its notes
// low to high from the root, which is also its room's corners in their
// order round the ring (WEB-SPEC, Look); Turn over moves its lowest note
// up an octave and the press after the last inversion brings back its
// first pitches (kit/inversions.ts; FACTS 50).

import { positionsOf } from '@/features/lessons/kit/inversions'
import type { Letter, Spelled } from '@/features/lessons/kit/notes'
import { CHORD_GAIN, CHORD4_GAIN, NOTE_GAIN, } from '@/features/lessons/kit/sound'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf, writtenOf } from '@/features/lessons/kit/staff-places'

/** A note written for the higher voice. */
export const note = (letter: Letter, alter = 0, octave = 4): Spelled => ({
  letter,
  alter,
  octave,
})

/** A note written for the higher voice, as the learner's staff sounds it: an octave lower on the bass staff. */
export const voiced = (n: Spelled, clef: Clef): Spelled =>
  clef === 'bass' ? { ...n, octave: n.octave - 1 } : n

/** A chord the page draws as a room: its name in the ring's centre and its root position for the higher voice. */
export interface Chord {
  readonly id: ChordId
  /** In the ring's centre: Lesson 12's "I · C major", "V7", or the letters of a chord the page does not name. */
  readonly centre: string
  /** Root position, low to high from the root, written for the higher voice (FACTS 72). */
  readonly notes: readonly Spelled[]
}

export type ChordId = 'I' | 'I7' | 'V' | 'V7' | 'iii' | 'V+F' | 'V+F#'

/** Every chord the page sounds as a room (FACTS 15, 16, 28, 72). */
export const CHORDS: Readonly<Record<ChordId, Chord>> = {
  I: {
    id: 'I',
    centre: 'I · C major',
    notes: [note('C'), note('E'), note('G')],
  },
  I7: {
    id: 'I7',
    centre: 'C E G B',
    notes: [note('C'), note('E'), note('G'), note('B')],
  },
  V: {
    id: 'V',
    centre: 'V · G major',
    notes: [note('G', 0, 3), note('B', 0, 3), note('D')],
  },
  V7: {
    id: 'V7',
    centre: 'V7',
    notes: [note('G', 0, 3), note('B', 0, 3), note('D'), note('F')],
  },
  iii: {
    id: 'iii',
    centre: 'iii · E minor',
    notes: [note('E'), note('G'), note('B')],
  },
  // the hero's answering plays: V with a fourth note, named by its letters
  // until the reveal (FACTS 37, 38)
  'V+F': {
    id: 'V+F',
    centre: 'G B D F',
    notes: [note('G', 0, 3), note('B', 0, 3), note('D'), note('F')],
  },
  'V+F#': {
    id: 'V+F#',
    centre: 'G B D F♯',
    notes: [note('G', 0, 3), note('B', 0, 3), note('D'), note('F', 1)],
  },
}

/** A chord's room on the ring: its corners, semitones from C, in their order round the ring from its root. */
export const cornersOf = (c: Chord): number[] =>
  c.notes.map((n) => ((midiOf(n) % 12) + 12) % 12)

/** Each voice of a chord of `count` notes: 0.13 alone, Lesson 23's pair at 0.13 a note, 0.075 for three, 0.056 for four (FACTS 73). */
export const gainOf = (count: number): number =>
  count >= 4 ? CHORD4_GAIN : count === 3 ? CHORD_GAIN : NOTE_GAIN

/**
 * A chord's positions in `clef`'s voice, root position first, each the
 * last turned over: three for a triad, four for a seventh chord (FACTS
 * 50). Each note is written as the staff writes its key, the one black
 * key here, the hero's F♯, as a sharp.
 */
export function positionsIn(c: Chord, clef: Clef): Spelled[][] {
  const root = c.notes.map((n) => midiOf(voiced(n, clef)))
  return positionsOf(root).map((midis) => midis.map((m) => writtenOf(m)))
}

/** The note a position turned over from the one before: its lowest, an octave down from its new place. */
export const climbOf = (
  from: readonly Spelled[],
): { from: Spelled; to: Spelled } => {
  const low = from.reduce((a, b) => (midiOf(b) < midiOf(a) ? b : a))
  return { from: low, to: { ...low, octave: low.octave + 1 } }
}

// ---------------------------------------------------------------- plays

/** How long a chip's chord and Turn over's sound, s (WEB-SPEC, Toys 1; FACTS 50). */
export const CHIP_SEC = 1.2
/** The hero's chords and Steps 2 and 3's, s (FACTS 32, 37, 43, 44). */
export const LONG_SEC = 1.5

/** A figure of a play: a chord, or two notes, sounding together. */
export interface Figure {
  /** When it starts, s from the play's start, and how long it sounds. */
  readonly at: number
  readonly dur: number
  /** Its notes, low to high, as the voice sounds them. */
  readonly notes: readonly Spelled[]
  /** The room it lights; none for two notes alone (Step 3's pairs). */
  readonly chord?: Chord
  /** Its position, 0 for root position: where the bass mark sits. */
  readonly position?: number
  /** The note that climbs an octave as it shows: the chord turned over. */
  readonly climb?: { readonly from: Spelled; readonly to: Spelled }
  /** As it sounds, the arrows from B to C and F to E (Step 3; WEB-SPEC, Look). */
  readonly arrows?: boolean
}

/** The plays in the steps' text and free play, by their buttons' keys (LESSON.md). */
export type PlayId =
  | 'i-seventh'
  | 'v-seventh'
  | 'sevenths'
  | 'dom-home'
  | 'tritone'
  | 'v7-home'
  | 'turn'
  | 'eminor'

/** A chord in root position as `clef`'s voice sounds it, from `at` for `dur` s. */
export const chordFigure = (
  id: ChordId,
  clef: Clef,
  at: number,
  dur: number,
  position = 0,
): Figure => {
  const chord = CHORDS[id]
  const notes = positionsIn(chord, clef)[position]
  return { at, dur, notes, chord, position }
}

/** Two figures back to back, `dur` s each. */
const twice = (a: Figure, b: Figure): Figure[] => [a, { ...b, at: a.dur }]

/**
 * A play's figures in `clef`'s voice (FACTS 42 to 44, 48, 72): Step 1's
 * at a chip's 1.2 s a chord, Steps 2 and 3's at 1.5 s, Step 4's at 1.2 s,
 * each pair of figures back to back.
 */
export function playOf(id: PlayId, clef: Clef): Figure[] {
  const v = (n: Spelled): Spelled => voiced(n, clef)
  switch (id) {
    case 'i-seventh':
      return twice(
        chordFigure('I', clef, 0, CHIP_SEC),
        chordFigure('I7', clef, 0, CHIP_SEC),
      )
    case 'v-seventh':
      return twice(
        chordFigure('V', clef, 0, CHIP_SEC),
        chordFigure('V7', clef, 0, CHIP_SEC),
      )
    case 'sevenths':
      return twice(
        chordFigure('I7', clef, 0, LONG_SEC),
        chordFigure('V7', clef, 0, LONG_SEC),
      )
    case 'dom-home':
      return twice(
        chordFigure('V7', clef, 0, LONG_SEC),
        chordFigure('I', clef, 0, LONG_SEC),
      )
    case 'tritone':
      // Lesson 23's own pair: B and F, then C and E (FACTS 44)
      return [
        { at: 0, dur: LONG_SEC, notes: [v(note('B', 0, 3)), v(note('F'))] },
        {
          at: LONG_SEC,
          dur: LONG_SEC,
          notes: [v(note('C')), v(note('E'))],
          arrows: true,
        },
      ]
    case 'v7-home':
      return twice(chordFigure('V7', clef, 0, LONG_SEC), {
        ...chordFigure('I', clef, 0, LONG_SEC),
        arrows: true,
      })
    case 'turn': {
      // C, E, G, then E, G, C: C turned over (FACTS 48)
      const root = chordFigure('I', clef, 0, CHIP_SEC)
      const first = chordFigure('I', clef, 0, CHIP_SEC, 1)
      return twice(root, { ...first, climb: climbOf(root.notes) })
    }
    case 'eminor':
      return twice(
        chordFigure('I', clef, 0, CHIP_SEC, 1),
        chordFigure('iii', clef, 0, CHIP_SEC),
      )
  }
}

/** A play's length, s: when its last figure ends. */
export const lengthOf = (figures: readonly Figure[]): number =>
  Math.max(...figures.map((f) => f.at + f.dur))

/** The hero's plays, for everyone in Merc's register (FACTS 32, 37, 74). */
export type HeroPlay = 'vi' | 'f' | 'fsharp'

/** Play V, then I; Play it with F; Play it with F♯: 1.5 s a chord, back to back. */
export function heroPlay(id: HeroPlay): Figure[] {
  const first: ChordId = id === 'vi' ? 'V' : id === 'f' ? 'V+F' : 'V+F#'
  return twice(
    chordFigure(first, 'treble', 0, LONG_SEC),
    chordFigure('I', 'treble', 0, LONG_SEC),
  )
}

/** Quick check 4's chord: G3, B3, D4 and F4 together, 1.5 s, for everyone (FACTS 72, 78). */
export const CHECK_CHORD: readonly number[] = [55, 59, 62, 65]
export const CHECK_SEC = LONG_SEC

// ---------------------------------------------------------------- the readout

/** Semitones from a chord's root up to its seventh: 11 for I's, 10 for V's (FACTS 13, 15, 16). */
export const rootToSeventh = (c: Chord): number | null =>
  c.notes.length < 4 ? null : midiOf(c.notes[3]) - midiOf(c.notes[0])
