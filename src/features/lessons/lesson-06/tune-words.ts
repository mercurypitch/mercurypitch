// ============================================================
// Lesson 6 tune words — what the tune line says, drawn and spoken
// ============================================================
//
// Every name and line the tune line shows or announces, in one place and
// pure (WEB-SPEC, Toys 1, Keyboard and screen readers): the names under the
// beads (letters spelled as Lesson 4 spells the key, or do-re-mi), each
// gap's size and word, the live summary, each bead's and gap's button, the
// slider's value and the readout. Whatever is printed keeps its sign; a
// note that is spoken (in an accessible name, a live line) is in words, "B
// flat 4", never the sign (Contract). A gap's button starts with what the
// gap draws, its size with any minus sign ("−2, step: gap 6, down 2
// semitones"), so a voice control user can say what they see.

import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import type { Spelled } from '@/features/lessons/kit/notes'
import { nameHtml, signName, wordName } from '@/features/lessons/kit/notes'
import type { GapWords } from '@/features/lessons/kit/tune-line-draw'
import type { MelodyNote } from './melody'
import { classify, gapsOf, intervalName, lineNames, SOLFEGE, swapSizes, tuneMidis, TWINKLE, } from './melody'

/** Every note of both lines, in order. */
const NOTES: readonly MelodyNote[] = TWINKLE.flat()

/** Note g's spelling from a start, one letter per degree. */
export const spelledAt = (g: number, start: number): Spelled =>
  TWINKLE.flatMap((line) => lineNames(line, start))[g]

/** A note as a screen reader says it: "F 5", "B flat 4" (a space before every octave). */
export function spoken(s: Spelled, o: { octave?: boolean } = {}): string {
  if (o.octave === false) return wordName(s, { octave: false })
  return s.alter === 0 ? `${s.letter} ${s.octave}` : wordName(s)
}

/** The name drawn under note g: its letter with any sign, or its do-re-mi name. */
export function drawnName(
  g: number,
  start: number,
  mode: LettersSolfegeMode,
): string {
  if (mode === 'solfege') return SOLFEGE[NOTES[g].degree]
  return signName(spelledAt(g, start), { octave: false })
}

/** The sizes in semitones of the gaps from note g to g + 1, across both lines. */
export const GAPS: readonly number[] = gapsOf(tuneMidis(60))

/** A gap's size as drawn: "7", "−2" (a minus sign, not a hyphen), "0". */
export const sizeText = (semitones: number): string =>
  semitones < 0 ? `−${-semitones}` : String(semitones)

/** What gap g's label draws: its size over "step", "leap" or "same". */
export function gapWords(g: number): GapWords {
  const size = GAPS[g]
  return { size: sizeText(size), word: classify(size) }
}

/** A move in words: "same", "up 7", "down 2". */
export function moveWords(semitones: number): string {
  if (semitones === 0) return 'same'
  return `${semitones > 0 ? 'up' : 'down'} ${Math.abs(semitones)}`
}

/**
 * Gap g's button: "7, leap: gap 2, up 7 semitones". It starts with what the
 * gap draws, its size over its word, so a voice control user can say what
 * they see (WCAG 2.5.3).
 */
export function gapLabel(g: number): string {
  const size = GAPS[g]
  const { size: drawn, word } = gapWords(g)
  if (size === 0) return `${drawn}, ${word}: gap ${g + 1}, the same note again`
  const n = Math.abs(size)
  const unit = n === 1 ? 'semitone' : 'semitones'
  return `${drawn}, ${word}: gap ${g + 1}, ${size > 0 ? 'up' : 'down'} ${n} ${unit}`
}

/** The notes shown, by global index: the first line's seven, or both lines' fourteen. */
export const shownNotes = (lines: number): number[] =>
  Array.from({ length: lines === 1 ? 7 : 14 }, (_, g) => g)

/** Note g's button: "Note 3 of 7, F 5, twin"; with do-re-mi showing, "Note 3 of 7, so, F 5". */
export function noteLabel(
  g: number,
  of: number,
  start: number,
  mode: LettersSolfegeMode,
): string {
  const name = spoken(spelledAt(g, start))
  const head = `Note ${g + 1} of ${of}`
  return mode === 'solfege'
    ? `${head}, ${SOLFEGE[NOTES[g].degree]}, ${name}`
    : `${head}, ${name}, ${NOTES[g].syllable}`
}

/**
 * The line's live summary, in spoken names: "Twinkle from B flat 4: B flat,
 * B flat, F, F, G, G, F. Same, up 7, same, up 2, same, down 2."
 */
export function summary(
  start: number,
  lines: number,
  mode: LettersSolfegeMode,
): string {
  const notes = shownNotes(lines)
  const names = notes.map((g) =>
    mode === 'solfege'
      ? SOLFEGE[NOTES[g].degree]
      : spoken(spelledAt(g, start), { octave: false }),
  )
  const moves = notes.slice(0, -1).map((g) => moveWords(GAPS[g]))
  const sentence = (words: string[]): string =>
    `${words[0].charAt(0).toUpperCase()}${words[0].slice(1)}${words.length > 1 ? `, ${words.slice(1).join(', ')}` : ''}`
  const head = `Twinkle from ${spoken(spelledAt(0, start))}`
  if (lines === 1) return `${head}: ${names.join(', ')}. ${sentence(moves)}.`
  return `${head}: ${names.slice(0, 7).join(', ')}, then ${names.slice(7).join(', ')}. ${sentence(moves)}.`
}

/** The slider's spoken value: "Starts on F sharp 4: every interval the same". */
export const sliderText = (start: number): string =>
  `Starts on ${spoken(spelledAt(0, start))}: every interval the same`

/** The slider's printed value, as markup: "Starts on B♭4", the sign spoken. */
export const sliderHtml = (start: number): string =>
  `Starts on ${nameHtml(spelledAt(0, start))}`

/** The readout, as markup: "Twinkle from B♭4: do do so so la la so". */
export const readoutHtml = (start: number): string =>
  `Twinkle from ${nameHtml(spelledAt(0, start))}: ${TWINKLE[0].map((n) => SOLFEGE[n.degree]).join(' ')}`

/** The readout as a screen reader hears it, after a slide lands. */
export const readoutSaid = (start: number): string =>
  `Twinkle from ${spoken(spelledAt(0, start))}: ${TWINKLE[0].map((n) => SOLFEGE[n.degree]).join(' ')}`

/** The swapped version's notes above the start, and the gaps it changes with the sizes it has instead. */
export function swapOverlay(): {
  at: number[]
  changed: { gap: number; size: string }[]
} {
  const line = tuneMidis(0).slice(0, 7)
  const swapped = swapSizes(line)
  const before = gapsOf(line)
  const after = gapsOf(swapped)
  return {
    at: swapped,
    changed: after.flatMap((g, i) =>
      g === before[i] ? [] : [{ gap: i, size: sizeText(g) }],
    ),
  }
}

/** What Swap sizes announces, on and off. */
export const SWAP_SAID = {
  on: 'Swapped: up 2, then up 7. Same ups and downs, two intervals changed.',
  off: 'The tune as it was: up 7, then up 2.',
} as const

/** Step 5's brackets: over "-kle, twin-", "-tle star" and "I won-" (FACTS 13, 22). */
export const BRACKET_GAPS: readonly number[] = [1, 5, 8]

/** A bracket's drawn label: "P5 · 7". */
export function bracketText(g: number): string {
  const size = GAPS[g]
  return `${intervalName(size)?.label ?? ''} · ${Math.abs(size)}`
}

/**
 * A bracket's button: "P5, 7 semitones: play C 4 up to G 4, a perfect
 * fifth". It starts with the bracket's drawn label, so "tap P5" finds it
 * (WCAG 2.5.3).
 */
export function bracketLabel(g: number, start: number): string {
  const size = GAPS[g]
  const n = Math.abs(size)
  const from = spoken(spelledAt(g, start))
  const to = spoken(spelledAt(g + 1, start))
  const interval = intervalName(size)
  return `${interval?.label ?? ''}, ${n} ${n === 1 ? 'semitone' : 'semitones'}: play ${from} ${size > 0 ? 'up' : 'down'} to ${to}, a ${interval?.name ?? ''}`
}
