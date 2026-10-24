// ============================================================
// Lesson 9 ladder data — do, the two ladders, their names and the windows
// ============================================================
//
// The notes every state of the ladder chart draws and Sing it measures
// (WEB-SPEC, Toys 1 and 4), by construction from FACTS 20, 22, 73 to 75 and
// 90, for either voice: do is D3 for the lower (Merc) and D4 for the higher
// (Tavi), and only Sing it's Move do moves it, up to four semitones either
// way (kit/move-do.ts). The full ladder climbs do, mi, so and the top do;
// the smaller one goes do, mi, so, mi and do. Each rung is spelled as Lesson
// 4 spells its key, from `majorScale(do)` at degrees 1, 3, 5 and 8, so no
// rung is ever a double sign, E♯, B♯, C♭ or F♭, and from D the ladder reads
// D, F♯, A, D (FACTS 22). A rung's name comes three ways: in signs for the
// canvas ("mi · F♯3"), as markup that shows the sign and speaks its word,
// and in words alone ("mi, F sharp 3") for a button's name or a live
// region. Pure, so each is tested against FACTS and against the app's own
// presets (`VOCAL_RANGES`), which the page itself never loads.

import { MAJOR_DEGREES, majorScale } from '@/features/lessons/kit/major-scale'
import { clampMove } from '@/features/lessons/kit/move-do'
import type { Spelled } from '@/features/lessons/kit/notes'
import { nameHtml, signName, wordName } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/voice-choice'

// -------------------------------------------------------------- do

/** Do before Move do: D3 for the lower voice, D4 for the higher (FACTS 69, 74). */
export const HOME_DO: Readonly<Record<Voice, number>> = {
  lower: 50,
  higher: 62,
}

/** Do for a voice, moved by Move do's `shift`, which stays within its four. */
export const doOf = (voice: Voice, shift = 0): number =>
  HOME_DO[voice] + clampMove(shift)

// -------------------------------------------------------------- rungs

/** The ladder's four rungs, low to high. */
export type RungId = 'do' | 'mi' | 'so' | 'top'

export interface LadderRung {
  /** Semitones above do. */
  readonly step: number
  /** Its degree of the major scale on do. */
  readonly degree: 1 | 3 | 5 | 8
  /** As the page writes it, lower case: "so", "top do". */
  readonly syllable: string
}

export const RUNGS: Readonly<Record<RungId, LadderRung>> = {
  do: { step: 0, degree: 1, syllable: 'do' },
  mi: { step: 4, degree: 3, syllable: 'mi' },
  so: { step: 7, degree: 5, syllable: 'so' },
  top: { step: 12, degree: 8, syllable: 'top do' },
}

/** The rungs low to high: free play's four buttons, in order. */
export const RUNG_ORDER: readonly RungId[] = ['do', 'mi', 'so', 'top']

/** A rung's note, MIDI, on a ladder from `doMidi`. */
export const rungMidi = (doMidi: number, id: RungId): number =>
  doMidi + RUNGS[id].step

/**
 * A degree of the major scale on `doMidi`, spelled as that scale spells it:
 * 2 and 4 are the cold open's re and fa, 1, 3, 5 and 8 the rungs.
 */
export const spelledDegree = (doMidi: number, degree: number): Spelled =>
  majorScale(doMidi)[degree - 1]

/** The semitones above do of a degree of the major scale: re is 2, fa 5. */
export const degreeStep = (degree: number): number => MAJOR_DEGREES[degree - 1]

/** A rung spelled on its own letter: from D, mi is F♯. */
export const spelledRung = (doMidi: number, id: RungId): Spelled =>
  spelledDegree(doMidi, RUNGS[id].degree)

/** A rung's name: in signs for the canvas, as speakable markup, and in words. */
export interface RungName {
  /** "mi · F♯3": the canvas's rung names, which a screen reader never reads. */
  readonly text: string
  /** "mi · F♯3" shown, "mi · F sharp 3" read. */
  readonly html: string
  /** "mi, F sharp 3": a rung button's name, and what a live region says. */
  readonly spoken: string
}

export function rungName(doMidi: number, id: RungId): RungName {
  const s = spelledRung(doMidi, id)
  const { syllable } = RUNGS[id]
  return {
    text: `${syllable} · ${signName(s)}`,
    html: `${syllable} · ${nameHtml(s)}`,
    spoken: `${syllable}, ${wordName(s)}`,
  }
}

// -------------------------------------------------------------- ladders

/** Sing it's two ladders: up to the top do, or the smaller one back down to do. */
export type LadderId = 'full' | 'smaller'

/** A note of a ladder: its rung, and the label its reading line opens with. */
export interface LadderNote {
  readonly rung: RungId
  readonly label: string
}

/** Each ladder in sung order, its rungs labelled as the reading lines name them (WEB-SPEC, Toys 4). */
export const LADDERS: Readonly<Record<LadderId, readonly LadderNote[]>> = {
  full: [
    { rung: 'do', label: 'Do' },
    { rung: 'mi', label: 'Mi' },
    { rung: 'so', label: 'So' },
    { rung: 'top', label: 'Top do' },
  ],
  smaller: [
    { rung: 'do', label: 'Do' },
    { rung: 'mi', label: 'Mi' },
    { rung: 'so', label: 'So' },
    { rung: 'mi', label: 'Mi again' },
    { rung: 'do', label: 'Do again' },
  ],
}

/** A ladder as semitones above do: [0, 4, 7, 12], or [0, 4, 7, 4, 0]. */
export const ladderSteps = (id: LadderId): number[] =>
  LADDERS[id].map((n) => RUNGS[n.rung].step)

/** A ladder's notes from `doMidi`, MIDI, in sung order. */
export const ladderNotes = (id: LadderId, doMidi: number): number[] =>
  ladderSteps(id).map((s) => doMidi + s)

/** A ladder's highest note, semitones above do: the top do, or so. */
export const ladderTop = (id: LadderId): number => Math.max(...ladderSteps(id))

// -------------------------------------------------------------- leaps

/** A move from one rung to another; `to` above `from` is up. */
export interface Leap {
  readonly from: RungId
  readonly to: RungId
}

/** A leap's size, semitones: negative going down. */
export const leapSize = (l: Leap): number =>
  RUNGS[l.to].step - RUNGS[l.from].step

/**
 * The moves the page names, by size (FACTS 15, 20, 28): the step of a tone,
 * and the five leaps the ladder holds, do to mi, mi to so, do to so, so to
 * the top do and do to the top do. Mi to the top do, 8 semitones, is on the
 * ladder too, but the lesson never names it, so it has no name here.
 */
const LEAP_NAMES: Readonly<Record<number, string>> = {
  2: 'a tone',
  3: 'a minor third',
  4: 'a major third',
  5: 'a perfect fourth',
  7: 'a perfect fifth',
  12: 'an octave',
}

/** A move's name, either way: "a minor third"; null for one the lesson never names. */
export const leapName = (semitones: number): string | null =>
  LEAP_NAMES[Math.abs(semitones)] ?? null

// -------------------------------------------------------------- windows

/** The ladder chart's states (WEB-SPEC, Toys 1); Sing it's live chart has a window of its own. */
export type ChartState =
  | 'compact'
  | 'step'
  | 'hear'
  | 'ladder'
  | 'order'
  | 'landing'
  | 'free'

/** The chart's lowest and highest notes, MIDI: the band chart's notes axis. */
export type NoteWindow = readonly [lo: number, hi: number]

/**
 * A state's window: do − 2 to so + 2, 11 semitones, for the compact chart
 * and Steps 1, 2 and 5; do − 1 to the top do + 1, 14 semitones, for Steps 3
 * and 4 and free play. Each holds every note its state plays.
 */
export function windowOf(state: ChartState, doMidi: number): NoteWindow {
  switch (state) {
    case 'compact':
    case 'step':
    case 'hear':
    case 'landing':
      return [doMidi - 2, rungMidi(doMidi, 'so') + 2]
    case 'ladder':
    case 'order':
    case 'free':
      return [doMidi - 1, rungMidi(doMidi, 'top') + 1]
  }
}

/** Sing it's live window: do − 1 to the ladder's top + 1, 14 semitones for the full ladder, 9 for the smaller. */
export const liveWindow = (id: LadderId, doMidi: number): NoteWindow => [
  doMidi - 1,
  doMidi + ladderTop(id) + 1,
]
