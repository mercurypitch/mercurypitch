// ============================================================
// Staircase words — what each stair, the readout and the slider say
// ============================================================
//
// Pure text, from the scale the staircase stands on. A stair shows its name
// in the page's names mode (Letters, Numbers or Do-re-mi); its button says
// all of it, "Stair 3, mi, F sharp 4", and do's two add "home", since the
// house glyph that marks them is hidden from a screen reader. Letters follow
// each scale's own spelling, one letter per step (kit/major-scale.ts), and
// every ♯ and ♭ is spoken: in words here, and as markup where a line is
// shown (`signsHtml`). Another scale's stairs (stairs-scales.ts, Lesson
// 20's pentatonic) are named the same way, from their own degrees: "Stair
// 2, me, E flat 3", printed as do, me, fa, so, te on the minor five, and
// their summary gives each riser's size.

import { blackKeysOf, MAJOR_DEGREES, MAJOR_STEPS, majorScale, stepSizes, whiteKeysFrom, } from './major-scale'
import type { NamesMode } from './names-modes'
import type { Spelled } from './notes'
import { signName, signsHtml, wordName } from './notes'
import type { Degrees } from './stairs-scales'
import { risersOf, scaleKind, spellDegrees, syllableOf } from './stairs-scales'

const COUNT = ['no', 'one', 'two', 'three', 'four', 'five']

const STEP_WORD = { T: 'tone', S: 'semitone' } as const

const plain = (s: Spelled): string => signName(s, { octave: false })
const spoken = (s: Spelled): string => wordName(s, { octave: false })

/**
 * Stair `i`'s name in a mode: its letter, its number (1 to 7, then 1 at
 * the top) or its sung name. Another scale's stairs take theirs from its
 * own degrees: the major five's numbers are 1, 2, 3, 5, 6 and 1, and a
 * degree outside the major scale, the minor five's me, is named by its
 * syllable in Numbers too.
 */
export function stairName(
  i: number,
  tonic: number,
  mode: NamesMode,
  degrees: Degrees = MAJOR_DEGREES,
): string {
  const d = degrees[i]
  if (mode === 'numbers') {
    const k = MAJOR_DEGREES.indexOf(d % 12)
    return k === -1 ? syllableOf(d) : String(k + 1)
  }
  if (mode === 'solfege') return syllableOf(d)
  return plain(spellDegrees(tonic, degrees)[i])
}

/**
 * A stair's button: "Stair 3, mi, F sharp 4"; do's stairs end ", home".
 * Another scale's stairs are named from its own degrees: "Stair 2, me, E
 * flat 3".
 */
export function stairLabel(
  i: number,
  tonic: number,
  degrees: Degrees = MAJOR_DEGREES,
): string {
  const note = wordName(spellDegrees(tonic, degrees)[i])
  const home = degrees[i] % 12 === 0 ? ', home' : ''
  return `Stair ${i + 1}, ${syllableOf(degrees[i])}, ${note}${home}`
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

/** A scale's risers in words: "2, 2, 3, 2 and 3". */
export function risersSaid(degrees: Degrees): string {
  const sizes = risersOf(degrees).map(String)
  return `${sizes.slice(0, -1).join(', ')} and ${sizes[sizes.length - 1]}`
}

/**
 * The staircase's live summary: "D major: D, E, F sharp, G, A, B, C sharp,
 * D. Tone, tone, semitone, tone, tone, tone, semitone." Another scale's
 * gives its risers in semitones: "C major pentatonic: C, D, E, G, A, C.
 * Steps of 2, 2, 3, 2 and 3 semitones."
 */
export function summary(
  tonic: number,
  degrees: Degrees = MAJOR_DEGREES,
): string {
  const kind = scaleKind(degrees) ?? 'scale'
  if (kind === 'major') {
    const notes = majorScale(tonic).map(spoken).join(', ')
    return `${scaleName(tonic, true)}: ${notes}. ${capital(sayingSteps(MAJOR_STEPS))}.`
  }
  const spelled = spellDegrees(tonic, degrees)
  const notes = spelled.map(spoken).join(', ')
  return `${spoken(spelled[0])} ${kind}: ${notes}. Steps of ${risersSaid(degrees)} semitones.`
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

/** Stop on ti's line: "Stopped on ti, C sharp 5. Landing on do finishes the scale." */
export function stopSaid(tonic: number): string {
  return `Stopped on ti, ${wordName(majorScale(tonic)[6])}. Landing on do finishes the scale.`
}
