// ============================================================
// Intervals — an interval's number, semitones, quality and name, from two written notes
// ============================================================
//
// The staff toy's interval state counts with these (staff-interval.ts;
// Lesson 23's WEB-SPEC, Toys 1), and so can Lessons 25 and 27. The number
// counts letters, both ends included: C up to E is a third, C, D and E
// (Lesson 23 FACTS 11). The semitones are the two notes' distance on the
// pitch line. The quality comes from both (FACTS 12 to 17): the unison,
// fourth, fifth and octave are perfect at 0, 5, 7 and 12 semitones, one
// more augmented and one fewer diminished; seconds, thirds, sixths and
// sevenths are major at 2, 4, 9 and 11, a semitone fewer minor, a semitone
// wider than major augmented and narrower than minor diminished. "A
// tritone" is added to the augmented fourth and the diminished fifth alone
// (FACTS 19). Turned upside down, the bottom note moved up an octave, the
// numbers make 9 and the semitones 12; major and minor swap, perfect stays
// perfect, and augmented and diminished swap (FACTS 21 to 24).
//
// The toy's signs are the page's spellings, no more (FACTS 10, 16, 18):
// Sharp on D, F, G and A, Flat on D, E, G, A and B, neither on C, so no
// E♯, B♯, F♭, C♭ or double sign.
//
// Pure: no DOM, no sound.

import type { Letter, Spelled } from './notes'
import { signName, wordName } from './notes'
import { diatonicOf, midiOf } from './staff-places'

export type Quality = 'perfect' | 'major' | 'minor' | 'augmented' | 'diminished'

/** An interval from a lower note up to a higher, within the octave. */
export interface Interval {
  /** Letters, both ends counted: 1 (a unison) to 8 (an octave). */
  readonly number: number
  readonly semitones: number
  readonly quality: Quality
}

/** The perfect numbers' sizes in semitones. */
const PERFECT: Readonly<Partial<Record<number, number>>> = {
  1: 0,
  4: 5,
  5: 7,
  8: 12,
}
/** The major numbers' sizes in semitones. */
const MAJOR: Readonly<Partial<Record<number, number>>> = {
  2: 2,
  3: 4,
  6: 9,
  7: 11,
}

const ORDINAL: Readonly<Record<number, string>> = {
  1: 'unison',
  2: 'second',
  3: 'third',
  4: 'fourth',
  5: 'fifth',
  6: 'sixth',
  7: 'seventh',
  8: 'octave',
}

/** The quality a perfect number takes `off` semitones from its size. */
const perfectBy: Readonly<Record<number, Quality>> = {
  [-1]: 'diminished',
  0: 'perfect',
  1: 'augmented',
}
/** The quality a major number takes `off` semitones from its major size. */
const majorBy: Readonly<Record<number, Quality>> = {
  [-2]: 'diminished',
  [-1]: 'minor',
  0: 'major',
  1: 'augmented',
}

/**
 * The interval from `lo` up to `hi`, or null where it is no interval the
 * page names: wider than an octave, falling, or past augmented or
 * diminished.
 */
export function intervalOf(lo: Spelled, hi: Spelled): Interval | null {
  const number = diatonicOf(hi) - diatonicOf(lo) + 1
  const semitones = midiOf(hi) - midiOf(lo)
  if (number < 1 || number > 8) return null
  const perfect = PERFECT[number]
  const major = MAJOR[number]
  const quality =
    perfect !== undefined
      ? perfectBy[semitones - perfect]
      : major !== undefined
        ? majorBy[semitones - major]
        : undefined
  return quality === undefined ? null : { number, semitones, quality }
}

/** A tritone: the augmented fourth or the diminished fifth, six semitones (FACTS 19). */
export const isTritone = (iv: Interval): boolean =>
  (iv.number === 4 && iv.quality === 'augmented') ||
  (iv.number === 5 && iv.quality === 'diminished')

/** "a major third", "an augmented fourth, a tritone", "a perfect unison". */
export function nameOf(iv: Interval): string {
  const article = iv.quality === 'augmented' ? 'an' : 'a'
  const name = `${article} ${iv.quality} ${ORDINAL[iv.number]}`
  return isTritone(iv) ? `${name}, a tritone` : name
}

const SWAP: Readonly<Record<Quality, Quality>> = {
  perfect: 'perfect',
  major: 'minor',
  minor: 'major',
  augmented: 'diminished',
  diminished: 'augmented',
}

/** The interval turned upside down: its numbers make 9 and its semitones 12 (FACTS 21 to 24). */
export const upsideDown = (iv: Interval): Interval => ({
  number: 9 - iv.number,
  semitones: 12 - iv.semitones,
  quality: SWAP[iv.quality],
})

/** The bottom note moved up an octave: the pair the upside down sounds. */
export const liftedOf = (lo: Spelled): Spelled => ({
  ...lo,
  octave: lo.octave + 1,
})

/** The signs a letter takes on the toy: Sharp on D, F, G and A; Flat on D, E, G, A and B (FACTS 10). */
export function signsOf(letter: Letter): { sharp: boolean; flat: boolean } {
  return {
    sharp: letter === 'D' || letter === 'F' || letter === 'G' || letter === 'A',
    flat: letter !== 'C' && letter !== 'F',
  }
}

/** "3 letters · 4 semitones · a major third", for the readout. */
export function countLine(iv: Interval): string {
  const letters = `${iv.number} letter${iv.number === 1 ? '' : 's'}`
  const semis = `${iv.semitones} semitone${iv.semitones === 1 ? '' : 's'}`
  return `${letters} · ${semis} · ${nameOf(iv)}`
}

/** "C up to E♭", in signs, for the eye. */
export const pairLine = (lo: Spelled, hi: Spelled): string =>
  `${signName(lo, { octave: false })} up to ${signName(hi, { octave: false })}`

/** "C4 up to E flat 4: 3 letters, 3 semitones, a minor third.", for a screen reader. */
export function saidLine(lo: Spelled, hi: Spelled, iv: Interval): string {
  const letters = `${iv.number} letter${iv.number === 1 ? '' : 's'}`
  const semis = `${iv.semitones} semitone${iv.semitones === 1 ? '' : 's'}`
  return `${wordName(lo)} up to ${wordName(hi)}: ${letters}, ${semis}, ${nameOf(iv)}.`
}

/** "5 + 4 = 9 · 7 + 5 = 12": an interval and its upside down, summed. */
export const sumsLine = (iv: Interval): string => {
  const up = upsideDown(iv)
  return `${iv.number} + ${up.number} = 9 · ${iv.semitones} + ${up.semitones} = 12`
}
