// ============================================================
// The sung line: its words, its melody and its key (S7b beat 8)
// ============================================================
//
// One line, ten notes, one a syllable, carried in the bundle: nothing is
// fetched to sing it. The words are the line the owner's storyboards sang
// (concept 06, 5 Oct: "Open the window, let the morning in"); the melody is
// this build's own, from the tonic up to the fifth and home again, by step
// but for one leap of a third. The example songs the app carries are not
// used: their notes are the vocal analysis's, never checked by ear, and
// their first lines read as one E3 with blips (Josephine) or jump octaves
// inside a word (Goodbye to Spring), nothing to score a first try against.
//
// IN THE SINGER'S KEY. The range the reveal showed (measured, or kept on
// this phone), as the exercises use it (practiceRange: two octaves at
// most), places the line a little under the middle of it, where a first
// try sits easy; a range too narrow for the line centres it. With no
// range (Skip for now) it is sung from C4, the middle of the keyboard. The
// score is the Karaoke engine's, which is octave-agnostic, so any voice can
// answer in its own octave; the key decides where Merc sings it.
//
// Merc sings it first (useLine.ts): his recorded "ooh" (merc-sampler.ts)
// reaches D#2 to G5, so the line is kept inside that.

import { practiceRange } from '@/lib/hold/hold-target'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'

/** The words, as the screen shows them. */
export const LINE_TEXT = 'Open the window, let the morning in'

/** One note of the line: its syllable, its word, its pitch and its time. */
export interface LineSyllable {
  readonly syllable: string
  /** Which word of LINE_WORDS it belongs to. */
  readonly word: number
  /** Semitones above the tonic. */
  readonly degree: number
  /** Its onset, seconds from the line's first note. */
  readonly at: number
  readonly seconds: number
}

/** The words, in order, as the screen lights them. */
export const LINE_WORDS: readonly string[] = LINE_TEXT.split(' ')

/**
 * At 60 beats a minute: a beat a second, the short syllables half a beat,
 * a breath before "let", and "in" held, but within the 1.3 s Merc's
 * recorded notes hold (merc-voice-set.ts).
 */
export const LINE: readonly LineSyllable[] = [
  { syllable: 'O', word: 0, degree: 0, at: 0, seconds: 0.5 },
  { syllable: 'pen', word: 0, degree: 2, at: 0.5, seconds: 0.5 },
  { syllable: 'the', word: 1, degree: 4, at: 1, seconds: 0.5 },
  { syllable: 'win', word: 2, degree: 7, at: 1.5, seconds: 1 },
  { syllable: 'dow', word: 2, degree: 5, at: 2.5, seconds: 1 },
  { syllable: 'let', word: 3, degree: 4, at: 4, seconds: 0.5 },
  { syllable: 'the', word: 4, degree: 2, at: 4.5, seconds: 0.5 },
  { syllable: 'mor', word: 5, degree: 4, at: 5, seconds: 1 },
  { syllable: 'ning', word: 5, degree: 2, at: 6, seconds: 0.5 },
  { syllable: 'in', word: 6, degree: 0, at: 6.5, seconds: 1.2 },
]

/** A beat, s: the count-in counts two of them. */
export const LINE_BEAT_SEC = 1

/** The line's length, from its first onset to its last note's end, s. */
export const LINE_SEC = LINE.reduce(
  (end, note) => Math.max(end, note.at + note.seconds),
  0,
)

/** From the tonic to the line's highest note, semitones: a fifth. */
export const LINE_SPAN = Math.max(...LINE.map((note) => note.degree))

/** The tonic with no range to fit the line to: C4. */
export const MIDDLE_TONIC = 60

/** Below the middle of a range, semitones: a first try sits easy there. */
const UNDER_MIDDLE = 1

/**
 * The lowest and highest tonic Merc's voice can sing the line from: his
 * set reaches D#2 to G5 (MIDI 39 to 79, merc-voice-set.ts). Kept as
 * numbers here, so this file does not pull his recordings in.
 */
const LOWEST_TONIC = 39
const HIGHEST_TONIC = 79 - LINE_SPAN

/** The ends of a range, MIDI. */
export interface LineRange {
  readonly lowMidi: number
  readonly highMidi: number
}

/**
 * The tonic the line is sung from, MIDI: a little under the middle of the
 * range, inside it where it is wide enough; from C4 with no range.
 */
export function lineTonic(range: LineRange | null): number {
  if (range === null) return MIDDLE_TONIC
  // Read as the exercises read it: at most two octaves, so a slide that
  // dipped into a growl does not pull the line under the voice.
  const { low, high } = practiceRange({
    low: range.lowMidi,
    high: range.highMidi,
  })
  const middle = (low + high) / 2
  const centred = Math.round(middle - LINE_SPAN / 2)
  const tonic =
    high - low >= LINE_SPAN
      ? Math.min(high - LINE_SPAN, Math.max(low, centred - UNDER_MIDDLE))
      : centred
  return Math.min(HIGHEST_TONIC, Math.max(LOWEST_TONIC, tonic))
}

/** The line as Merc's call sings it, from `tonic`. */
export function linePhrase(tonic: number): PhraseNote[] {
  return LINE.map((note) => ({
    midi: tonic + note.degree,
    at: note.at,
    seconds: note.seconds,
  }))
}

/** One note of the line on the frames' clock, as it is sung or scored. */
export interface TimedNote {
  readonly midi: number
  /** Its onset and end, seconds on the frames' clock. */
  readonly from: number
  readonly to: number
  /** Its index in LINE. */
  readonly index: number
}

/** The line from `tonic`, its first note at `start` on the frames' clock. */
export function lineNotes(tonic: number, start: number): TimedNote[] {
  return LINE.map((note, index) => ({
    midi: tonic + note.degree,
    from: start + note.at,
    to: start + note.at + note.seconds,
    index,
  }))
}

/** Whether the line's note `index` is one of its two high ones ("win-dow"). */
export function highNote(index: number): boolean {
  return LINE[index].degree >= 5
}
