// ============================================================
// Lesson 12 lines — every string the page's toys build
// ============================================================
//
// Pure (WEB-SPEC, Toys 1, 2, 5 and 6; Tests 10). Accessible names and live
// lines are in words only: a note's name goes through `wordName`, so F♯ is
// "F sharp", and a numeral through its number, so vii° is "chord seven"
// (Contract; numerals.ts). What the eye reads inside the figure, the centre's
// label and Sing it's readout, keeps its signs and numerals, the readout as
// markup that speaks them.
//
// The syllables come in as a function from degree to syllable, the names
// switch's (the kit's `MAJOR_SOLFEGE`, kit/names-modes.ts). Under Do-re-mi a
// chord's notes are named by syllable, and its own name, "C major", stays in
// letters. Step 4's moves and Step 1's "on do" are always syllables.
//
// Sing it's readout names do and the line in Lesson 4's names for the key
// (kit/major-scale.ts; FACTS 60): a lower do reads "do is A♭3: A♭3, E♭3, F3,
// D♭3, A♭3", spoken "do is A flat 3: …".

import { majorScale } from '@/features/lessons/kit/major-scale'
import type { Spelled } from '@/features/lessons/kit/notes'
import { nameHtml, signName, spellOn, wordName, } from '@/features/lessons/kit/notes'
import type { Chord, KeyName, TuneId } from './music'
import { chordsOf, LOOP_DEGREES, loopOf, rootLine } from './music'
import { numberWord } from './numerals'

/** How the toy names a chord's notes. */
export interface Naming {
  /** A degree's syllable, 0 do to 6 ti: the names switch's. */
  readonly syllable: (degree: number) => string
  /** True under Do-re-mi: a chord's notes by syllable, not by letter. */
  readonly solfege: boolean
}

/** The chip strip's two states: Step 1's "on do", and the numerals from Step 2 on. */
export type ChipStep = 'build' | 'numerals'

const letterWord = (s: Spelled): string => wordName(s, { octave: false })

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** "one", "one and two", "one, two and three". */
function listOf(words: readonly string[]): string {
  if (words.length < 2) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** A chord's name in words: "C major", "F sharp diminished". */
export const chordName = (chord: Chord): string =>
  `${letterWord(chord.spelled[0])} ${chord.quality}`

/** A chord's three notes, root up, by letter or under Do-re-mi by syllable. */
function noteWords(chord: Chord, naming: Naming): string[] {
  if (!naming.solfege) return chord.spelled.map(letterWord)
  return [0, 2, 4].map((up) => naming.syllable((chord.degree + up) % 7))
}

/**
 * A chip's accessible name: "The chord on do: C, E, G" in Step 1, "Chord
 * seven, F sharp diminished: F sharp, A, C" from Step 2 on.
 */
export function chipName(chord: Chord, step: ChipStep, naming: Naming): string {
  const notes = noteWords(chord, naming).join(', ')
  if (step === 'build')
    return `The chord on ${naming.syllable(chord.degree)}: ${notes}`
  return `Chord ${numberWord(chord.degree + 1)}, ${chordName(chord)}: ${notes}`
}

/** The figure's summary: "C major's seven chords, three lit: one, two and three." */
export function figureSummary(
  key: KeyName,
  degrees: readonly number[],
): string {
  const head = `${key} major's seven chords`
  if (degrees.length === 0) return `${head}, none lit.`
  const lit = listOf(degrees.map((d) => numberWord(d + 1)))
  return `${head}, ${numberWord(degrees.length)} lit: ${lit}.`
}

/** The key switch's live line: "G major: every chord turned round the ring." */
export const keyTurnedLine = (key: KeyName): string =>
  `${key} major: every chord turned round the ring.`

/**
 * Play I, then vi's live line: "One, C major, then six, A minor: C and E
 * stay, and G becomes A." The notes kept and the one that moves are read
 * off the two chords.
 */
export function slideLine(key: KeyName, naming: Naming): string {
  const chords = chordsOf(key)
  const [one, six] = [chords[0], chords[5]]
  const pcs = (c: Chord): number[] => c.midis.map((m) => m % 12)
  const [onePcs, sixPcs] = [pcs(one), pcs(six)]
  const oneWords = noteWords(one, naming)
  const sixWords = noteWords(six, naming)
  const kept = oneWords.filter((_, i) => sixPcs.includes(onePcs[i]))
  const from = oneWords.find((_, i) => !sixPcs.includes(onePcs[i]))
  const to = sixWords.find((_, i) => !onePcs.includes(sixPcs[i]))
  const name = (c: Chord): string =>
    `${numberWord(c.degree + 1)}, ${chordName(c)}`
  return `${capital(name(one))}, then ${name(six)}: ${listOf(kept)} stay, and ${from} becomes ${to}.`
}

/** Step 4's readout, one move per root as it sounds: "do", "down to so", "up to la", "down to fa". */
export function rootMoves(syllable: (degree: number) => string): string[] {
  const roots = rootLine('C').slice(0, LOOP_DEGREES.length)
  return LOOP_DEGREES.map((degree, i) => {
    if (i === 0) return syllable(degree)
    const way = roots[i] < roots[i - 1] ? 'down' : 'up'
    return `${way} to ${syllable(degree)}`
  })
}

/** The count of notes on a corner, inside the figure: "On a corner: 11 of 15". */
export const cornerCount = (on: number, of: number): string =>
  `On a corner: ${on} of ${of}`

/** The hero's live line as the four chords play: "Four chords: C major, G major, A minor, F major." */
export const fourChordsLine = (key: KeyName): string =>
  `Four chords: ${loopOf(key).map(chordName).join(', ')}.`

/** Each tune as the page names it. */
const TUNE_NAME: Readonly<Record<TuneId, string>> = {
  'tune-1': 'tune 1',
  'tune-2': 'tune 2',
  even: 'tune 2 with even notes',
}

/** The live line as a tune starts: "Tune 1, over the four chords." */
export const tuneStartLine = (id: TuneId): string =>
  `${capital(TUNE_NAME[id])}, over the four chords.`

/** The live line as a tune ends: "On a corner: 11 of 15." */
export const tuneEndLine = (on: number, of: number): string =>
  `${cornerCount(on, of)}.`

/** A tune button's accessible name: "Play tune 1", and "Stop tune 1" while it plays (WCAG 2.5.3). */
export const tuneButtonName = (id: TuneId, playing: boolean): string =>
  `${playing ? 'Stop' : 'Play'} ${TUNE_NAME[id]}`

/** The ring's centre label, drawn in the figure: "C major", and from Step 2 on "vi · A minor". */
export const centreLabel = (chord: Chord, numerals: boolean): string => {
  const name = `${signName(chord.spelled[0], { octave: false })} ${chord.quality}`
  return numerals ? `${chord.numeral} · ${name}` : name
}

/** Sing it's line from a do, do so la fa do, spelled in that key: Lesson 4's names (FACTS 60). */
function singLine(doMidi: number): Spelled[] {
  const scale = majorScale(doMidi)
  const degrees = [...LOOP_DEGREES, 0]
  return rootLine('C').map((m, i) =>
    spellOn(m - 60 + doMidi, scale[degrees[i]].letter),
  )
}

/** Sing it's readout in words: "do is A flat 3: A flat 3, E flat 3, F3, D flat 3, A flat 3". */
export function readoutWords(doMidi: number): string {
  const line = singLine(doMidi).map((s) => wordName(s))
  return `do is ${line[0]}: ${line.join(', ')}`
}

/** Sing it's readout as markup: "do is A♭3: A♭3, E♭3, F3, D♭3, A♭3", every sign spoken. */
export function readoutHtml(doMidi: number): string {
  const line = singLine(doMidi).map((s) => nameHtml(s))
  return `do is ${line[0]}: ${line.join(', ')}`
}
