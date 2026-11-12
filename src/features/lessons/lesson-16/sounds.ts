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

// ---------------------------------------------------------------- Sing it

/** Sing it's two phrases by degree from do: do, re, mi, re, do; then do, so, mi, re, do (WEB-SPEC, Toys 6). */
export const PHRASES: Readonly<Record<1 | 2, readonly number[]>> = {
  1: [0, 1, 2, 1, 0],
  2: [0, 4, 2, 1, 0],
}

/** Phrase `id`'s written notes in `clef`'s octave: G3 A3 B3 A3 G3 for the bass, G4 up for the treble. */
export const phraseOf = (id: 1 | 2, clef: Clef): Spelled[] =>
  PHRASES[id].map((d) => doToSo(clef)[d])

/** The start: do alone this long, s, then this quiet, s, then do, mi, so, mi, do (FACTS 42). */
export const START_DO_SEC = 1
export const START_QUIET_SEC = 0.4
/** The start's broken triad, by degree from do. */
const TRIAD_RUN = [0, 2, 4, 2, 0] as const

/** A sung note of Sing it: its onset, its note, its length, and the phrase column it lights, if any. */
export interface SungNote {
  readonly t: number
  readonly note: Spelled
  readonly dur: number
  /** The phrase whose notes it lights (1 or 2), by column; none for the start's mi and so. */
  readonly lights: {
    readonly phrase: 1 | 2
    readonly cols: readonly number[]
  } | null
}

/**
 * The start in `clef`'s octave from `t0`: do for 1.0 s, 0.4 s of quiet,
 * then do, mi, so, mi, do, 0.6 s a note, 4.4 s, sung in Merc's "ooh" by
 * the chosen voice (FACTS 42). Only its do's light: every written do of
 * the phrase `next` reads, at once, never where mi or so sit.
 */
export function startNotes(clef: Clef, next: 1 | 2, t0 = 0): SungNote[] {
  const notes = doToSo(clef)
  // every written do of the phrase: its first and last notes
  const doCols = {
    phrase: next,
    cols: PHRASES[next].flatMap((d, col) => (d === 0 ? [col] : [])),
  }
  const runAt = t0 + START_DO_SEC + START_QUIET_SEC
  return [
    { t: round(t0), note: notes[0], dur: START_DO_SEC, lights: doCols },
    ...TRIAD_RUN.map((d, i) => ({
      t: round(runAt + i * EVERY_SEC),
      note: notes[d],
      dur: EVERY_SEC,
      lights: d === 0 ? doCols : null,
    })),
  ]
}

/** The start's length, s: 4.4 (FACTS 42). */
export const START_SEC = round(
  START_DO_SEC + START_QUIET_SEC + TRIAD_RUN.length * EVERY_SEC,
)

/** The quiet after the start, and between the phrases, in Play Merc's phrases, s (FACTS 70). */
export const AFTER_START_SEC = 0.6
export const BETWEEN_SEC = 1

/**
 * Play Merc's phrases in `clef`'s octave: the start, 0.6 s of quiet, the
 * first phrase at 0.6 s a note, 1.0 s of quiet and the second, 12.0 s,
 * each phrase note lighting its column as it sounds (FACTS 70).
 */
export function mercPhrases(clef: Clef): SungNote[] {
  const first = START_SEC + AFTER_START_SEC
  const second = first + PHRASES[1].length * EVERY_SEC + BETWEEN_SEC
  const phrase = (id: 1 | 2, t0: number): SungNote[] =>
    phraseOf(id, clef).map((note, col) => ({
      t: round(t0 + col * EVERY_SEC),
      note,
      dur: EVERY_SEC,
      lights: { phrase: id, cols: [col] },
    }))
  return [...startNotes(clef, 1), ...phrase(1, first), ...phrase(2, second)]
}

/** A sung play's length, s: its last note's end. */
export const sungLength = (notes: readonly SungNote[]): number =>
  round(Math.max(...notes.map((n) => n.t + n.dur)))

/** The sung notes as a run's notes, MIDI. */
export const runOf = (notes: readonly SungNote[]): RunNote[] =>
  notes.map((n) => ({ t: n.t, midi: midiOf(n.note), dur: n.dur }))
