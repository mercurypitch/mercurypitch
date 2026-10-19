// ============================================================
// Major scale — the pattern of steps, spelled from any of the twelve starts
// ============================================================
//
// A major scale climbs tone, tone, semitone, tone, tone, tone, semitone,
// one letter per step (Lesson 4 FACTS 2 and 13). Which letter its tonic
// takes is a choice for the five black-key starts: this kit spells them D♭,
// E♭, F♯, A♭ and B♭ major, F♯ over its twin G♭ to match the sharps of the
// app's pitch line (FACTS 13), so F♯ major writes its seventh note E♯ and
// F major its fourth B♭. notes.ts does the spelling itself (`spellScale`);
// this file picks the letters, and answers the questions a scale toy asks:
// which of its notes are black keys, what its step sizes are, and what the
// white keys from the same start would play instead.

import type { Letter, Spelled } from './notes'
import { isBlack, sharpOf, spellScale } from './notes'

/** The major scale's eight notes as semitones above the tonic, do to do. */
export const MAJOR_DEGREES: readonly number[] = [0, 2, 4, 5, 7, 9, 11, 12]

/** A step between neighbouring notes: a tone (two semitones) or a semitone. */
export type StepSize = 'T' | 'S'

/** The tonic's letter for the major scale on each pitch class, C to B. */
const TONIC_LETTER: readonly Letter[] = [
  'C',
  'D',
  'D',
  'E',
  'E',
  'F',
  'F',
  'G',
  'A',
  'A',
  'B',
  'B',
]

const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12

/** The major scale on `tonic` (a MIDI number), do to do, one letter per step. */
export function majorScale(tonic: number): Spelled[] {
  return spellScale(TONIC_LETTER[pitchClass(tonic)], tonic, MAJOR_DEGREES)
}

/** The scale's eight notes as MIDI numbers, do to do. */
export const scaleNotes = (tonic: number): number[] =>
  MAJOR_DEGREES.map((d) => tonic + d)

/**
 * The scale's black keys, each once and in scale order, as the scale spells
 * them: F♯ and C♯ for D major, none for C major.
 */
export function blackKeysOf(tonic: number): Spelled[] {
  const spelled = majorScale(tonic)
  return scaleNotes(tonic)
    .slice(0, 7)
    .flatMap((midi, i) => (isBlack(midi) ? [spelled[i]] : []))
}

/** The steps between neighbouring notes, as tones and semitones; anything else throws. */
export function stepSizes(notes: readonly number[]): StepSize[] {
  return notes.slice(1).map((midi, i) => {
    const d = midi - notes[i]
    if (d === 2) return 'T'
    if (d === 1) return 'S'
    throw new Error(`major scale: a step of ${d} semitones is neither`)
  })
}

/** The major pattern itself: T T S T T T S. */
export const MAJOR_STEPS: readonly StepSize[] = stepSizes(MAJOR_DEGREES)

/**
 * The white keys from a white-key start up to the same letter an octave
 * higher (eight notes), or null for a black-key start, which is not a white
 * key at all.
 */
export function whiteKeysFrom(start: number): number[] | null {
  if (isBlack(start)) return null
  const out = [start]
  let midi = start
  while (out.length < 8) {
    midi += 1
    if (!isBlack(midi)) out.push(midi)
  }
  return out
}

/**
 * A key's name in a scale: the scale's own spelling for a note it holds (E♯
 * on F in F♯ major, B♭ in F major), the sharp name for any other.
 */
export function nameInScale(midi: number, tonic: number): Spelled {
  const i = scaleNotes(tonic).indexOf(midi)
  return i === -1 ? sharpOf(midi) : majorScale(tonic)[i]
}
