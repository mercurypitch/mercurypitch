// ============================================================
// Lesson 13 lines — every string the vowel figure speaks
// ============================================================
//
// Pure (WEB-SPEC, Toys 1 and 2; Tests 9). The figure is a group with a live
// summary in spoken names, never a sign: "A 3", "C sharp 4", and hertz in
// words. Nothing here names a bar of 'ah', or says "heights", "louder" or
// "softer" of the bars, before the cold open's reveal: the compact lines
// say only that the line stayed level. Every line is Merc's model, labelled
// so, never the viewer's voice.

import { sharpOf } from '@/features/lessons/kit/notes'
import type { Peaks, Vowel } from './vowels'

/** A vowel as the page writes it, in the hook's single quotation marks. */
export const quoted = (v: Vowel): string => `‘${v}’`

/** The same at the start of a sentence: ‘Ee’. */
export const quotedCap = (v: Vowel): string =>
  `‘${v.charAt(0).toUpperCase()}${v.slice(1)}’`

/** Each vowel's British word, for its button's accessible name (FACTS 38). */
export const VOWEL_WORD: Readonly<Record<Vowel, string>> = {
  ee: 'key',
  eh: 'pet',
  ah: 'half',
  oh: 'paw',
  oo: 'coo',
}

/** A vowel button's accessible name: its label, then its word ("ee, as in key"). */
export const vowelName = (v: Vowel): string => `${v}, as in ${VOWEL_WORD[v]}`

/** A note in spoken words: "A 3", "C sharp 4". */
export function spokenNote(midi: number): string {
  const s = sharpOf(midi)
  return s.alter === 0
    ? `${s.letter} ${s.octave}`
    : `${s.letter} sharp ${s.octave}`
}

/** An ordinal for a bar: 1st, 2nd, 3rd, 4th, 11th, 22nd. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const end = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${end}`
}

/** Hertz in words, with a thousands comma: "3,960". */
export const hertz = (f: number): string =>
  Math.round(f).toLocaleString('en-GB')

/** A list in words: "220, 440 and 660". */
function list(items: readonly string[]): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** The labelled peaks in words: "peaks on the 1st bar and the 10th", or the one. */
export function peaksWords(p: Peaks): string {
  const [a, b] = p
  return b === null
    ? `a peak on the ${ordinal(a)} bar`
    : `peaks on the ${ordinal(a)} bar and the ${ordinal(b)}`
}

// ------------------------------------------------------------ the compact figure: the hero and the cold open

/** Before any play: the still, 'ee' on A3, which says nothing of 'ah'. */
export const COMPACT_REST =
  "Merc's model: ‘ee’ on A 3, one bar for each harmonic, with two peaks marked: the 1st bar and the 10th."
/** After Play Merc's 'ee'. */
export const COMPACT_EE = "Merc's ‘ee’ on A 3: the line stayed level."
/** After Play 'ee', then 'ah'. */
export const COMPACT_EE_AH =
  "Merc's ‘ee’, then ‘ah’, on A 3: the line stayed level."
/** At the reveal. */
export const COMPACT_REVEAL = '‘Ah’: peaks on the 3rd bar and the 5th.'

// ------------------------------------------------------------ the steps' states

/** Step 1, after Add a harmonic: "Harmonics 1 to 3 of A 3: 220, 440 and 660 hertz, 220 hertz apart." */
export function harmonicsLine(n: number, midi: number, f0: number): string {
  const note = spokenNote(midi)
  const apart = `${hertz(f0)} hertz apart`
  if (n === 1) return `Harmonic 1 of ${note}: ${hertz(f0)} hertz.`
  if (n <= 3)
    return `Harmonics 1 to ${n} of ${note}: ${list(
      Array.from({ length: n }, (_, i) => hertz(f0 * (i + 1))),
    )} hertz, ${apart}.`
  return `Harmonics 1 to ${n} of ${note}, up to ${hertz(f0 * n)} hertz, ${apart}.`
}

/** Step 1, after All: "All 18 harmonics of A 3, 220 hertz apart. The line stayed level." */
export const allLine = (count: number, midi: number, f0: number): string =>
  `All ${count} harmonics of ${spokenNote(midi)}, ${hertz(f0)} hertz apart. The line stayed level.`

/** Steps 2 and 3, a vowel played: "‘Ee’ on A 3: peaks on the 1st bar and the 10th." */
export function vowelLine(
  v: Vowel,
  midi: number,
  p: Peaks,
  curves = false,
): string {
  const base = `${quotedCap(v)} on ${spokenNote(midi)}: ${peaksWords(p)}.`
  return curves ? `${base} Each peak sits under a resonance's curve.` : base
}

/** Step 4, after the five: the line stayed level, and the tallest bar of each in turn. */
export function fiveLine(midi: number, tallest: readonly number[]): string {
  const [first, ...rest] = tallest.map(ordinal)
  return `The five vowels on ${spokenNote(midi)}. The line stayed level. The tallest bar was the ${first}, then ${list(rest.map((o) => `the ${o}`))}.`
}

/** Step 5, a voice's 'ah': "Lower voice, ‘ah’ on A 3: 18 bars, 220 hertz apart. The tallest is the 3rd." */
export function voiceLine(
  voice: 'lower' | 'higher',
  midi: number,
  count: number,
  f0: number,
  tallest: number,
): string {
  const name = voice === 'lower' ? 'Lower voice' : 'Higher voice'
  return `${name}, ‘ah’ on ${spokenNote(midi)}: ${count} bars, ${hertz(f0)} hertz apart. The tallest is the ${ordinal(tallest)}.`
}

/** Add a harmonic's accessible name: the harmonic it adds, "Add a harmonic: the 4th, 880 hertz". */
export const addName = (next: number, f0: number): string =>
  `Add a harmonic: the ${ordinal(next)}, ${hertz(f0 * next)} hertz`

/** The readout's top line on Step 1: "A3 · 220 Hz apart". */
export const harmonicsReadout = (label: string, f0: number): string =>
  `${label} · ${Math.round(f0)} Hz apart`

/** The readout's second line on Step 1: "harmonics: 3 of 18". */
export const countReadout = (n: number, count: number): string =>
  `harmonics: ${n} of ${count}`
