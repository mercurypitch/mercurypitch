// ============================================================
// Lesson 15 sounds — every fixed example's notes and timing
// ============================================================
//
// What each play on the page sounds, as the staff toy plays it (kit/
// staff.ts `StaffPlay`), with the timings LESSON.md's examples give (FACTS
// 62 to 69): the climb; the steps' plays, one set a step; and the states
// the staff toy opens each step in. A note is written, not just a pitch,
// so B♭4 is a flat on B's line where A♯4 would be a sharp in A's space.

import type { Spelled } from '@/features/lessons/kit/notes'
import type { PlayNote, StaffPlay, StaffState, } from '@/features/lessons/kit/staff'
import { GRAND_WHITE_KEYS, writtenOf, } from '@/features/lessons/kit/staff-places'

/** A note from its name: "G4", "F♯4", "B♭4". */
export function note(name: string): Spelled {
  const m = /^([A-G])([♯♭]?)(\d)$/.exec(name)
  if (m === null) throw new Error(`no note ${name}`)
  return {
    letter: m[1] as Spelled['letter'],
    alter: m[2] === '♯' ? 1 : m[2] === '♭' ? -1 : 0,
    octave: Number(m[3]),
  }
}

/**
 * Notes `names`, each `dur` s long, an onset every `every` s, from 0;
 * `each` adds to each note what the play lights.
 */
export function evenly(
  names: readonly string[],
  dur: number,
  every: number,
  each: Partial<Omit<PlayNote, 't' | 'dur' | 'note'>> = {},
): PlayNote[] {
  return names.map((name, i) => ({
    t: Math.round(i * every * 1000) / 1000,
    dur,
    note: note(name),
    ...each,
  }))
}

/** The climb up the treble staff, E4 to F5: 0.5 s notes, onsets 0.6 s apart, 5.3 s (FACTS 62). */
export const CLIMB: readonly string[] = [
  'E4',
  'F4',
  'G4',
  'A4',
  'B4',
  'C5',
  'D5',
  'E5',
  'F5',
]

/** How long a play lasts, s: its last note's end. */
export const playLength = (p: StaffPlay): number =>
  Math.max(0, ...p.notes.map((n) => n.t + n.dur))

/** The steps' plays, each its button's `data-staff-play` (FACTS 64 to 68). */
export const STEP_PLAYS: Readonly<Record<string, StaffPlay>> = {
  // Step 1: G4 for 1.0 s, its clef's line gold
  g4: {
    show: 'cursor',
    clef: 'treble',
    notes: [{ t: 0, dur: 1, note: note('G4'), gold: 'treble' }],
  },
  // Step 2: three letters up, 0.5 s each, onsets 0.6 s apart, 1.7 s
  efg: {
    show: 'run',
    clef: 'treble',
    notes: evenly(['E4', 'F4', 'G4'], 0.5, 0.6),
  },
  bcd: {
    show: 'run',
    clef: 'treble',
    notes: evenly(['B4', 'C5', 'D5'], 0.5, 0.6),
  },
  // a letter, then its sign on the same place, 0.8 s each with 0.2 s between, 1.8 s
  'f-sharp': {
    show: 'run',
    clef: 'treble',
    notes: evenly(['F4', 'F♯4'], 0.8, 1),
  },
  'b-flat': {
    show: 'run',
    clef: 'treble',
    notes: evenly(['B4', 'B♭4'], 0.8, 1),
  },
  // Step 3: the note jumps to each, 0.6 s with 0.1 s between, 2.0 s
  above: {
    show: 'cursor',
    clef: 'treble',
    notes: evenly(['G5', 'A5', 'C6'], 0.6, 0.7),
  },
  below: {
    show: 'cursor',
    clef: 'treble',
    notes: evenly(['D4', 'C4', 'A3'], 0.6, 0.7),
  },
  // Step 4: Merc sings F3 on "ooh" for 1.5 s, blue on the bass clef's F line, gold
  'merc-f': {
    show: 'cursor',
    clef: 'bass',
    kind: 'merc',
    notes: [{ t: 0, dur: 1.5, note: note('F3'), tone: 'blue', gold: 'bass' }],
  },
  // the bass clef's nine places and on past its top line, 7.1 s, each letter kept
  'g2-d4': {
    show: 'cursor',
    clef: 'bass',
    keep: true,
    notes: evenly(
      ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4'],
      0.5,
      0.6,
    ),
  },
  // Step 5: one key twice, written on each staff, 0.8 s each with 0.4 s between, 2.0 s
  'middle-c': {
    show: 'cursor',
    notes: [
      { t: 0, dur: 0.8, note: note('C4'), on: 'treble', staffLit: 'treble' },
      { t: 1.2, dur: 0.8, note: note('C4'), on: 'bass', staffLit: 'bass' },
    ],
  },
  // the range's 21 white keys, one every 0.25 s, each 0.22 s, 5.22 s
  'white-keys': {
    show: 'cursor',
    notes: GRAND_WHITE_KEYS.map((midi, i) => ({
      t: i * 0.25,
      dur: 0.22,
      note: writtenOf(midi),
    })),
  },
}

/** Step 3's end line, past two ledger lines (WEB-SPEC, Toys 1, the ledger state). */
export const LEDGER_END = 'This season reads up to two ledger lines.'

/** The staff toy's state in each step (WEB-SPEC, Toys 1, states 1 to 5). */
export const STEP_STATE: Readonly<Record<number, StaffState>> = {
  // the nine places, E4 to F5, each letter kept as it plays; no ledger lines
  1: {
    staff: 'single',
    clef: 'treble',
    tap: 'place',
    keep: true,
    reach: [0, 8],
  },
  // the staff with the pitch-line switch to the fore
  2: { staff: 'single', clef: 'treble', tap: 'place', reach: [0, 8] },
  // one note to move, A3 to C6, from F5
  3: {
    staff: 'single',
    clef: 'treble',
    tap: 'mover',
    start: note('F5'),
    endLine: LEDGER_END,
  },
  // the clef switch, Treble · Bass
  4: { staff: 'single', clef: 'treble', tap: 'place' },
  // the grand staff over the key strip, G2 to F5
  5: {
    staff: 'grand',
    tap: 'place',
    keys: {
      lo: GRAND_WHITE_KEYS[0],
      hi: GRAND_WHITE_KEYS[GRAND_WHITE_KEYS.length - 1],
    },
  },
}

/** Free play's three staves, each with every tap and the switches (WEB-SPEC, Toys 1, state 7). */
export const FREE_STATE: Readonly<
  Record<'treble' | 'bass' | 'grand', StaffState>
> = {
  treble: { staff: 'single', clef: 'treble', tap: 'place' },
  bass: { staff: 'single', clef: 'bass', tap: 'place' },
  grand: STEP_STATE[5],
}
