// ============================================================
// Read the Note: which notes a run asks for, and what counts as right
// ============================================================
//
// A run is a row of notes, each written on one staff and answered by its
// letter. This file is the drill's arithmetic: which places on the staff a
// level may ask for, the row a run draws from them, whether an answer is
// right, and the words Merc has for a note after a miss. No DOM, no sound.
//
// A place is the lessons' own count (kit/staff-places.ts): letters up from
// the staff's bottom line, so 0 is the bottom line and 8 the top one, even
// places are lines and odd ones spaces, and a place outside 0 to 8 hangs on
// ledger lines. The drill reads the staff exactly as Lesson 15 teaches it,
// so it borrows that file's notes and its words for a place.

import type { Clef, Letter, Spelled } from './staff-kit'
import { noteAt, placeWords } from './staff-kit'

/** The notes a run asks for. Ten is about a minute at a reader's pace. */
export const NOTE_READING_ROUNDS = 10

/** The answers, in a keyboard's order from C. */
export const ANSWER_LETTERS: readonly Letter[] = [
  'C',
  'D',
  'E',
  'F',
  'G',
  'A',
  'B',
]

export const isAnswerLetter = (value: string): value is Letter =>
  (ANSWER_LETTERS as readonly string[]).includes(value)

/** The staff a run is written on: one clef, or a clef drawn for each note. */
export type ClefChoice = Clef | 'both'

export const CLEF_CHOICES: readonly ClefChoice[] = ['treble', 'bass', 'both']

export const isClefChoice = (value: unknown): value is ClefChoice =>
  (CLEF_CHOICES as readonly unknown[]).includes(value)

/** The places a level may ask for, lowest to highest. */
export interface NoteReadingSpan {
  lowest: number
  highest: number
}

/**
 * The staff's own nine places up to the level every singer starts on, then
 * one ledger line each way, then two, which is as far as a part for a voice
 * goes before it changes clef.
 */
export function spanFor(difficulty: number): NoteReadingSpan {
  // The adaptive level is 1 to 10; anything else is read as its nearest end.
  const level = Math.min(10, Math.max(1, Math.round(difficulty)))
  if (level <= 5) return { lowest: 0, highest: 8 }
  if (level <= 7) return { lowest: -2, highest: 10 }
  return { lowest: -4, highest: 12 }
}

/** A span in the setup screen's words. */
export function spanLabel(span: NoteReadingSpan): string {
  if (span.lowest >= 0) return 'lines and spaces'
  return span.lowest >= -2 ? 'up to one ledger line' : 'up to two ledger lines'
}

/** One note of a run: its staff, its place on it, and the note that is. */
export interface NoteReadingRound {
  clef: Clef
  place: number
  note: Spelled
}

export interface PlanOptions {
  clef: ClefChoice
  difficulty: number
  /** How many notes; a run's ten unless a test asks for fewer. */
  rounds?: number
  /** A number in [0, 1); `Math.random` unless a test wants its own. */
  random?: () => number
}

/**
 * The notes of one run.
 *
 * Each staff's places are dealt like a pack of cards: every place comes up
 * once before any comes up twice, so a run of ten on a nine-place staff
 * covers the staff. A new pack never opens on the note the last one closed
 * on, so no note is asked twice running.
 */
export function planRounds(options: PlanOptions): NoteReadingRound[] {
  const random = options.random ?? Math.random
  const total = options.rounds ?? NOTE_READING_ROUNDS
  const span = spanFor(options.difficulty)
  const clefs: readonly Clef[] =
    options.clef === 'both' ? ['treble', 'bass'] : [options.clef]
  const all: NoteReadingRound[] = []
  for (const clef of clefs) {
    for (let place = span.lowest; place <= span.highest; place++) {
      all.push({ clef, place, note: noteAt(place, clef) })
    }
  }

  const rounds: NoteReadingRound[] = []
  let pack: NoteReadingRound[] = []
  while (rounds.length < total) {
    if (pack.length === 0) {
      pack = shuffled(all, random)
      const last = rounds[rounds.length - 1]
      if (last !== undefined && sameNote(pack[0], last) && pack.length > 1) {
        // Swap the repeat to the far end of the new pack.
        pack.push(pack.shift()!)
      }
    }
    rounds.push(pack.shift()!)
  }
  return rounds
}

const sameNote = (a: NoteReadingRound, b: NoteReadingRound): boolean =>
  a.clef === b.clef && a.place === b.place

/** Fisher-Yates, on a copy. */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** A letter answers a note whatever its octave: the drill asks for names. */
export const answerIsRight = (
  round: NoteReadingRound,
  letter: Letter,
): boolean => round.note.letter === letter

/**
 * Where a round's note sits, in the lessons' words: "the second line",
 * "one ledger line below". What Merc says after a miss, and what a screen
 * reader is given in place of the picture, since it names no letter.
 */
export const placeOfRound = (round: NoteReadingRound): string =>
  placeWords(round.place, round.clef)
