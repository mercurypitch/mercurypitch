// ============================================================
// Lesson 16 sounds — every step's notes and timing, and the staff's states
// ============================================================
//
// What each play in the steps sounds, as the staff toy plays it (kit/
// staff.ts `StaffPlay`), with LESSON.md's timings (FACTS 68): the soft tone
// at 0.5 s a note, onsets 0.6 s apart, in the learner's octave, do on G3 in
// the bass clef's top space and on G4, the treble clef's second line (FACTS
// 8, 16). A tap, on a note or the house, and Play do sound 0.8 s. Hear it
// inside lights each note of a run 1.0 s before it sounds, for 0.6 s, so do
// to so takes 8.0 s; and the staff toy's states: the five notes do to so,
// the house on do and the syllables under them (WEB-SPEC, Toys 2). No play
// here is the cold open's line or Sing it's second phrase (FACTS 43).

import type { Letter, Spelled } from '@/features/lessons/kit/notes'
import type { RunNote } from '@/features/lessons/kit/run'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { PlayNote, StaffPlay, StaffState, } from '@/features/lessons/kit/staff-state'

/** A natural note: G3 is `nat('G', 3)`. */
const nat = (letter: Letter, octave: number): Spelled => ({
  letter,
  alter: 0,
  octave,
})

/** Do, G, in each clef's octave: G3 in the bass staff's top space, G4 on the treble staff's second line. */
export const DO: Readonly<Record<Clef, Spelled>> = {
  bass: nat('G', 3),
  treble: nat('G', 4),
}

/** Do, re, mi, fa, so in G, in `clef`'s octave: G, A, B, C, D. */
export function doToSo(clef: Clef): Spelled[] {
  const o = DO[clef].octave
  return [
    nat('G', o),
    nat('A', o),
    nat('B', o),
    nat('C', o + 1),
    nat('D', o + 1),
  ]
}

/** A note of a run, s, and the onsets' spacing (FACTS 68). */
export const NOTE_SEC = 0.5
export const EVERY_SEC = 0.6
/** A tap on a note or the house, and Play do, s. */
export const TAP_SEC = 0.8
/** Hear it inside: each note of a run lit this long before it sounds, s, then sounding this long. */
export const AHEAD_SEC = 1
export const INSIDE_SEC = 0.6

/** The stage's plays, each its button's `data-staff-play`. */
export type StepPlay = 'do' | 'do-so' | 'triad' | 'turn'

const round = (s: number): number => Math.round(s * 1000) / 1000

/** Do to so's notes `degrees` (do 0, so 4), an onset every 0.6 s from `t0`. */
const run = (clef: Clef, degrees: readonly number[], t0 = 0): PlayNote[] =>
  degrees.map((d, i) => ({
    t: round(t0 + i * EVERY_SEC),
    dur: NOTE_SEC,
    note: doToSo(clef)[d],
  }))

/**
 * A play's notes as written: Play do, 0.8 s; do to so, 2.9 s; do, mi, so,
 * mi, do, 2.9 s; and do, mi, then do, so, 1.1 s, 0.5 s of quiet and 1.1 s,
 * 2.7 s, the third and then the fifth Step 4 puts on the staff.
 */
export function stepNotes(name: StepPlay, clef: Clef): PlayNote[] {
  switch (name) {
    case 'do':
      return [{ t: 0, dur: TAP_SEC, note: DO[clef] }]
    case 'do-so':
      return run(clef, [0, 1, 2, 3, 4])
    case 'triad':
      return run(clef, [0, 2, 4, 2, 0])
    case 'turn':
      return [...run(clef, [0, 2]), ...run(clef, [0, 4], 1.6)]
  }
}

/**
 * A run as Hear it inside plays it (Step 3): each note lit 1.0 s before it
 * sounds, silent, then sounding 0.6 s, and the next lit as it ends; quiet
 * the run leaves between its notes, past the 0.1 s every note leaves,
 * stays. One note is no run, and plays as it is.
 */
export function inside(notes: readonly PlayNote[]): PlayNote[] {
  if (notes.length < 2) return [...notes]
  let at = 0
  return notes.map((n, i) => {
    const before = i > 0 ? notes[i - 1] : null
    const quiet = before === null ? 0 : n.t - (before.t + before.dur)
    if (quiet > EVERY_SEC - NOTE_SEC + 1e-6) at += quiet
    const note: PlayNote = {
      ...n,
      t: round(at + AHEAD_SEC),
      dur: INSIDE_SEC,
      ahead: AHEAD_SEC,
    }
    at += AHEAD_SEC + INSIDE_SEC
    return note
  })
}

/** A stage play, each note lighting its place on the staff, with Hear it inside on or off. */
export const stepPlay = (
  name: StepPlay,
  clef: Clef,
  hearInside: boolean,
): StaffPlay => {
  const notes = stepNotes(name, clef)
  return { show: 'score', notes: hearInside ? inside(notes) : notes }
}

/** How long a play lasts, s: its last note's end. */
export const playLength = (p: StaffPlay): number =>
  Math.max(0, ...p.notes.map((n) => n.t + n.dur))

/**
 * The staff toy's state in Steps 2 to 5, in `clef`: the five notes do to so,
 * the house on do and each note's syllable under it, shown or not as
 * `names` says; a tap plays its place for 0.8 s.
 */
export function staffState(clef: Clef, names: boolean): StaffState {
  return {
    staff: 'single',
    clef,
    tap: 'place',
    tapSec: TAP_SEC,
    score: doToSo(clef).map((note, i) =>
      i === 0 ? { note, home: true } : { note },
    ),
    solfa: DO[clef],
    names,
  }
}

/**
 * Step 1's staff, in `clef`: once the staircase has turned into it, Steps
 * 2 to 5's with the names, where a tap on a note plays do and then that
 * note, 0.8 s each with 0.2 s between; before, the bare staff, whose taps
 * do the same.
 */
export const stairsStaff = (clef: Clef, turned: boolean): StaffState =>
  turned
    ? { ...staffState(clef, true), lead: DO[clef] }
    : {
        staff: 'single',
        clef,
        tap: 'place',
        tapSec: TAP_SEC,
        lead: DO[clef],
      }

/** Quick check 4's quiet between do and re, s (FACTS 69). */
export const QUIZ_GAP_SEC = 1

/** Quick check 4's do, a second of quiet, then re, in `clef`'s octave: 0.8 s each, 2.6 s (FACTS 69). */
export function quizDoRe(clef: Clef): RunNote[] {
  const [d, r] = doToSo(clef)
  return [
    { t: 0, midi: midiOf(d), dur: TAP_SEC },
    { t: round(TAP_SEC + QUIZ_GAP_SEC), midi: midiOf(r), dur: TAP_SEC },
  ]
}
