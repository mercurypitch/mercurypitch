// ============================================================
// Lesson 9 sounds — the notes of the page's own sounds, at FACTS 91 to 95
// ============================================================
//
// Merc's notes are 1.0 s each, back to back: his leap and the cold open's
// three paths, Step 1's step and leap, Step 2's so heard first, Step 3's
// climb and its two leaps, and the Four words' plays. Step 4's five leaps
// come in the syllabus's order with 0.6 s between them, 12.4 s in all
// (FACTS 93); Sing it's ladder is 1.5 s a note (FACTS 95). No fact times
// free play, so it borrows Step 1's 1.0 s for each tapped rung and Step 4's
// 0.6 s before a leap whose landing note Hear it first sounds alone. Slow
// doubles every length and onset and never shifts a pitch (FACTS 92).
// Times are seconds from the press, so nothing drifts, and each note is its
// own voice, so a repeated note is heard as two (WEB-SPEC, Audio). A note
// carries its MIDI number and sounds at hz(m), so every frequency is FACTS
// 90's. Step 5's landing is the one sound that glides: do, then one voice
// that lands 80 cents under so, slides up and settles 25 cents under
// (FACTS 94). It and Step 2's silent copy, which lands 75 cents under so
// (FACTS 98), are drawn as a singer's violet line, an illustration, in
// cents from do, the chart's target, as its rungs are. Merc's "ooh" sings
// his notes; the landing and free play's rungs are the soft tone (WEB-SPEC,
// Audio). The recall plays Lesson 6's own sound, so it has none here.

import type { TracePoint } from '@/features/lessons/kit/band-chart'
import { hz } from '@/features/lessons/kit/notes'
import type { RunNote } from '@/features/lessons/kit/run'
import type { ContourPoint } from '@/features/lessons/kit/sound'
import { contourOf } from '@/features/lessons/kit/sound'
import type { LadderId, Leap, RungId } from './ladder-data'
import { degreeStep, ladderNotes, rungMidi, RUNGS } from './ladder-data'

/**
 * One note of a sound: when it starts and how long it lasts, seconds, and
 * its MIDI note. The kit's run note (kit/run.ts), so the page's stoppable
 * runs play these notes as they are.
 */
export type SoundNote = RunNote

/** Every note of Merc's leaps, paths and climb (FACTS 91 to 93); free play borrows it for a tapped rung. */
export const NOTE_SEC = 1
/** Slow: every length and onset twice as long. */
export const SLOW = 2
/** Between Step 4's leaps (FACTS 93); free play borrows it before a leap Hear it first announces. */
export const GAP_SEC = 0.6
/** Between the Third's two pairs (FACTS 91). */
export const THIRD_GAP_SEC = 0.3
/** Each note of Merc's ladder in Sing it (FACTS 76, 95). */
export const LADDER_NOTE_SEC = 1.5

/** Notes one after another from `from` seconds, `dur` each. */
export function inTurn(
  midis: readonly number[],
  dur = NOTE_SEC,
  from = 0,
): SoundNote[] {
  return midis.map((midi, i) => ({ t: from + i * dur, midi, dur }))
}

/** Seconds from a sound's start to the end of its last note. */
export const lengthOf = (notes: readonly SoundNote[]): number =>
  notes.reduce((end, n) => Math.max(end, n.t + n.dur), 0)

/** A leap's two notes, 1.0 s each; `slow` 2 for Slow. */
export const leapNotes = (doMidi: number, l: Leap, slow = 1): SoundNote[] =>
  inTurn([rungMidi(doMidi, l.from), rungMidi(doMidi, l.to)], NOTE_SEC * slow)

// -------------------------------------------------------------- the cold open

/** Merc's leap: do up to so. Step 1's and Step 2's Leap, and the Four words' Leap, play it too. */
export const MERC_LEAP: Leap = { from: 'do', to: 'so' }

/** The predict's three choices: the note between do and so. */
export type PathId = 're' | 'mi' | 'fa'

export const PATH_IDS: readonly PathId[] = ['re', 'mi', 'fa']

/** Each middle note's degree of the major scale on do (FACTS 17). */
export const PATH_DEGREE: Readonly<Record<PathId, number>> = {
  re: 2,
  mi: 3,
  fa: 4,
}

/** A path's middle note, MIDI: re, mi or fa above `doMidi`. */
export const pathMiddle = (doMidi: number, p: PathId): number =>
  doMidi + degreeStep(PATH_DEGREE[p])

/** A path: do, the middle note, so, 1.0 s each (FACTS 91). */
export const pathNotes = (doMidi: number, p: PathId): SoundNote[] =>
  inTurn([doMidi, pathMiddle(doMidi, p), rungMidi(doMidi, 'so')])

// -------------------------------------------------------------- Steps 1 to 3

/** Step 1's Step: do then re, 1.0 s each (FACTS 92). */
export const stepNotes = (doMidi: number, slow = 1): SoundNote[] =>
  inTurn([doMidi, doMidi + degreeStep(2)], NOTE_SEC * slow)

/** Step 2's Hear it first: so alone, while its band lights (FACTS 92). */
export const hearFirstNotes = (doMidi: number, slow = 1): SoundNote[] =>
  inTurn([rungMidi(doMidi, 'so')], NOTE_SEC * slow)

/** Step 3's Climb: do, mi, so and the top do, 1.0 s each (FACTS 92). */
export const climbNotes = (doMidi: number, slow = 1): SoundNote[] =>
  inTurn(ladderNotes('full', doMidi), NOTE_SEC * slow)

/** Step 3's two leaps over the climb: Leap to so, and Leap to the top do. */
export const OVER_LEAPS: readonly Leap[] = [
  { from: 'do', to: 'so' },
  { from: 'do', to: 'top' },
]

// -------------------------------------------------------------- Step 4

/**
 * The five leaps in the Royal Conservatory's order (FACTS 36, 93): mi to so,
 * do to mi, do to so, so to the top do, do to the top do.
 */
export const FIVE_LEAPS: readonly Leap[] = [
  { from: 'mi', to: 'so' },
  { from: 'do', to: 'mi' },
  { from: 'do', to: 'so' },
  { from: 'so', to: 'top' },
  { from: 'do', to: 'top' },
]

/**
 * Step 4's play: each leap two notes of 1.0 s, 0.6 s between leaps, 12.4 s,
 * or 24.8 s with Slow. Leap k's notes are 2k and 2k + 1, its arc drawn as
 * the second starts.
 */
export const fiveLeapsNotes = (doMidi: number, slow = 1): SoundNote[] =>
  FIVE_LEAPS.flatMap((l, k) =>
    leapNotes(doMidi, l, slow).map((n) => ({
      ...n,
      t: n.t + k * (2 * NOTE_SEC + GAP_SEC) * slow,
    })),
  )

// -------------------------------------------------------------- Step 5

/** Step 5's illustrated landing, seconds and cents from so (FACTS 94). */
export const LANDING = {
  /** Do, held before the leap. */
  doSec: 1,
  /** Where the leap lands, and how long it holds there. */
  lands: -80,
  hold: 0.6,
  /** The slide up into the band, and where it settles. */
  slide: 0.6,
  settles: -25,
  rest: 0.8,
} as const

/** Its length at speed, and the scrub bar's span: 3.0 s. */
export const LANDING_SEC =
  LANDING.doSec + LANDING.hold + LANDING.slide + LANDING.rest

/** The landing's rung and its distance from it, cents, `t` seconds in: do for its first second, then so. */
export function landingAt(t: number): {
  readonly rung: Extract<RungId, 'do' | 'so'>
  readonly cents: number
} {
  if (t < LANDING.doSec) return { rung: 'do', cents: 0 }
  const slideAt = LANDING.doSec + LANDING.hold
  if (t <= slideAt) return { rung: 'so', cents: LANDING.lands }
  if (t >= slideAt + LANDING.slide)
    return { rung: 'so', cents: LANDING.settles }
  const k = (t - slideAt) / LANDING.slide
  return {
    rung: 'so',
    cents: LANDING.lands + (LANDING.settles - LANDING.lands) * k,
  }
}

/** A distance from so as cents from do, the chart's target. */
const fromDo = (centsFromSo: number): number =>
  RUNGS.so.step * 100 + centsFromSo

/**
 * Step 5's line from its start to `until` seconds, cents from do: its
 * corners up to then, and where it stands at `until`. A glide even in
 * octaves is straight in cents, so the corners draw it exactly; the leap is
 * two points at one moment.
 */
export function landingTrace(until = LANDING_SEC): TracePoint[] {
  const end = Math.min(Math.max(until, 0), LANDING_SEC)
  const slideAt = LANDING.doSec + LANDING.hold
  const corners: TracePoint[] = [
    { t: 0, c: 0 },
    { t: LANDING.doSec, c: 0 },
    { t: LANDING.doSec, c: fromDo(LANDING.lands) },
    { t: slideAt, c: fromDo(LANDING.lands) },
    { t: slideAt + LANDING.slide, c: fromDo(LANDING.settles) },
  ]
  const at = landingAt(end)
  const last = { t: end, c: at.rung === 'do' ? 0 : fromDo(at.cents) }
  const drawn = corners.filter((p) => p.t <= end)
  const prev = drawn[drawn.length - 1]
  return prev.t === last.t && prev.c === last.c ? drawn : [...drawn, last]
}

/**
 * Step 5's sound, in the soft tone: do, then one voice that leaps to 80
 * cents under so, holds, slides up and settles 25 cents under; `slow` 2 for
 * Slow's 6.0 s. The slide starts `at` seconds in, as do ends.
 */
export function landingSound(
  doMidi: number,
  slow = 1,
): {
  readonly first: SoundNote
  readonly slide: { readonly at: number; readonly points: ContourPoint[] }
} {
  const so = rungMidi(doMidi, 'so')
  return {
    first: { t: 0, midi: doMidi, dur: LANDING.doSec * slow },
    slide: {
      at: LANDING.doSec * slow,
      points: contourOf(hz(so + LANDING.lands / 100), [
        { hold: LANDING.hold * slow },
        { glide: LANDING.slide * slow, to: hz(so + LANDING.settles / 100) },
        { hold: LANDING.rest * slow },
      ]),
    },
  }
}

// -------------------------------------------------------------- Step 2's copy

/** Where Step 2's illustrated copy lands, cents from so (FACTS 98). */
export const COPY_LANDS = -75

/**
 * Step 2's silent illustration, over do's slot and so's, 1.0 s each, cents
 * from do: it leaps from do's band and lands 75 cents under so's.
 */
export const COPY_TRACE: readonly TracePoint[] = [
  { t: 0, c: 0 },
  { t: NOTE_SEC, c: 0 },
  { t: NOTE_SEC, c: fromDo(COPY_LANDS) },
  { t: 2 * NOTE_SEC, c: fromDo(COPY_LANDS) },
]

// -------------------------------------------------------------- the Four words

/** The Four words, in the page's order. */
export type WordId = 'leap' | 'third' | 'arpeggio' | 'zone'

/**
 * Each word's play (FACTS 91): Leap, do up to so; Third, do up to mi, then
 * mi up to so, 0.3 s between the pairs; Arpeggio, do, mi, so and the top do;
 * Landing zone plays nothing and lights so's band.
 */
export function wordNotes(
  doMidi: number,
): Readonly<Record<WordId, SoundNote[]>> {
  const [d, mi, so] = ladderNotes('full', doMidi)
  return {
    leap: leapNotes(doMidi, MERC_LEAP),
    third: [
      ...inTurn([d, mi]),
      ...inTurn([mi, so], NOTE_SEC, 2 * NOTE_SEC + THIRD_GAP_SEC),
    ],
    arpeggio: climbNotes(doMidi),
    zone: [],
  }
}

// -------------------------------------------------------------- Sing it

/** Merc's ladder: each note 1.5 s, back to back, 6.0 s full or 7.5 s smaller (FACTS 76, 95). */
export const mercLadderNotes = (id: LadderId, doMidi: number): SoundNote[] =>
  inTurn(ladderNotes(id, doMidi), LADDER_NOTE_SEC)

// -------------------------------------------------------------- free play

export interface FreeOptions {
  /** Hear it first: the landing note sounds alone before the leap. */
  readonly hearFirst?: boolean
  /** 2 for Slow. */
  readonly slow?: number
}

/**
 * Free play's tap on `to` after a tap on `from`, in the soft tone: the rung
 * alone, for the first tap or the same rung again; otherwise the leap
 * between them, up or down, with its landing note first, then 0.6 s, under
 * Hear it first. No fact gives free play's timing, so it borrows Step 1's
 * 1.0 s a note and Step 4's 0.6 s gap.
 */
export function freeNotes(
  doMidi: number,
  from: RungId | null,
  to: RungId,
  o: FreeOptions = {},
): SoundNote[] {
  const dur = NOTE_SEC * (o.slow ?? 1)
  const landing = rungMidi(doMidi, to)
  if (from === null || from === to) return inTurn([landing], dur)
  const leap = [rungMidi(doMidi, from), landing]
  if (o.hearFirst !== true) return inTurn(leap, dur)
  return [
    ...inTurn([landing], dur),
    ...inTurn(leap, dur, dur + GAP_SEC * (o.slow ?? 1)),
  ]
}
