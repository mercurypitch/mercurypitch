// ============================================================
// Lesson 4 staircase words — what each stair, the readout and the slider say
// ============================================================
//
// Pure text, from the scale the staircase stands on. A stair shows its name
// in the page's names mode (Letters, Numbers or Do-re-mi); its button says
// all of it, "Stair 3, mi, F sharp 4", and do's two add "home", since the
// house glyph that marks them is hidden from a screen reader. Letters follow
// each scale's own spelling, one letter per step (kit/major-scale.ts), and
// every ♯ and ♭ is spoken: in words here, and as markup where a line is
// shown (`signsHtml`).

import { blackKeysOf, MAJOR_STEPS, majorScale, stepSizes, whiteKeysFrom, } from '@/features/lessons/kit/major-scale'
import type { Spelled } from '@/features/lessons/kit/notes'
import { signName, signsHtml, wordName } from '@/features/lessons/kit/notes'

export type NamesMode = 'letters' | 'numbers' | 'solfege'

export const NAMES_MODES: readonly NamesMode[] = [
  'letters',
  'numbers',
  'solfege',
]

/** The sung names, do to do (FACTS 19 and 20: so, as the CURRICULUM card writes it). */
export const SOLFEGE: readonly string[] = [
  'do',
  're',
  'mi',
  'fa',
  'so',
  'la',
  'ti',
  'do',
]

/** The starts the staircase slides through: C4 to B4. */
export const START_LO = 60
export const START_HI = 71

const COUNT = ['no', 'one', 'two', 'three', 'four', 'five']

const STEP_WORD = { T: 'tone', S: 'semitone' } as const

const plain = (s: Spelled): string => signName(s, { octave: false })
const spoken = (s: Spelled): string => wordName(s, { octave: false })

/** Stair `i`'s name in a mode: its letter, its number (1 to 7, then 1 at the top) or its sung name. */
export function stairName(i: number, tonic: number, mode: NamesMode): string {
  if (mode === 'numbers') return i === 7 ? '1' : String(i + 1)
  if (mode === 'solfege') return SOLFEGE[i]
  return plain(majorScale(tonic)[i])
}

/** A stair's button: "Stair 3, mi, F sharp 4"; do's stairs end ", home". */
export function stairLabel(i: number, tonic: number): string {
  const note = wordName(majorScale(tonic)[i])
  const home = i === 0 || i === 7 ? ', home' : ''
  return `Stair ${i + 1}, ${SOLFEGE[i]}, ${note}${home}`
}

/** The scale's name, "D major", for the eye or in words. */
export function scaleName(tonic: number, inWords = false): string {
  const tonicName = majorScale(tonic)[0]
  return `${inWords ? spoken(tonicName) : plain(tonicName)} major`
}

/** The readout under the staircase, as markup: "D major · 2 black keys: F♯, C♯". */
export function readout(tonic: number): string {
  const blacks = blackKeysOf(tonic)
  const n = blacks.length
  const keys =
    n === 0
      ? 'no black keys'
      : `${n} black ${n === 1 ? 'key' : 'keys'}: ${blacks.map(plain).join(', ')}`
  return signsHtml(`${scaleName(tonic)} · ${keys}`)
}

/** The start slider's value: "Do is D4: D major, two black keys". */
export function sliderText(tonic: number): string {
  const n = blackKeysOf(tonic).length
  const keys = `${COUNT[n]} black ${n === 1 ? 'key' : 'keys'}`
  return `Do is ${wordName(majorScale(tonic)[0])}: ${scaleName(tonic, true)}, ${keys}`
}

const sayingSteps = (steps: readonly ('T' | 'S')[]): string =>
  steps.map((s) => STEP_WORD[s]).join(', ')

const capital = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1)

/**
 * The staircase's live summary: "D major: D, E, F sharp, G, A, B, C sharp,
 * D. Tone, tone, semitone, tone, tone, tone, semitone."
 */
export function summary(tonic: number): string {
  const notes = majorScale(tonic).map(spoken).join(', ')
  return `${scaleName(tonic, true)}: ${notes}. ${capital(sayingSteps(MAJOR_STEPS))}.`
}

/**
 * What White keys only says from a white-key start: its steps, and whether
 * they are the major scale's.
 */
export function whiteKeysSaid(start: number): string | null {
  const keys = whiteKeysFrom(start)
  if (keys === null) return null
  const from = spoken(majorScale(start)[0])
  const steps = sayingSteps(stepSizes(keys))
  const verdict =
    start % 12 === 0
      ? 'On C, the white keys are the major scale.'
      : 'Not a major scale.'
  return `White keys from ${from}: ${steps}. ${verdict}`
}

/** Stop on ti's line: "Stopped on ti, C sharp 5. Land on do finishes the scale." */
export function stopSaid(tonic: number): string {
  return `Stopped on ti, ${wordName(majorScale(tonic)[6])}. Land on do finishes the scale.`
}
