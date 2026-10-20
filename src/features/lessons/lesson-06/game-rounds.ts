// ============================================================
// Lesson 6 game rounds — Step or leap? and Name it, dealt from a seed
// ============================================================
//
// Pure, so a fixed seed deals a known game (WEB-SPEC, Toys 4; Tests 5;
// FACTS 67). Step or leap? plays ten pairs of 1, 2, 3, 4, 5 or 7 semitones,
// up or down at a coin flip, from a first note between C4 and G4, so every
// note lies between F3 and D5 (FACTS 62a). Name it plays each of 1, 2, 5
// and 7 semitones twice, in a shuffled order with no size twice running:
// the steps down and the leaps up, as their anchors go ("I won-der", "lit-tle
// star", "Should auld", "twin-kle, twin-kle"). Each round carries its line,
// which names the interval and the sound, never the listener.

import type { EarRound } from '@/features/lessons/kit/ear-game'
import { pair } from './examples'
import { classify } from './melody'

export type StepOrLeap = 'step' | 'leap'
export type IntervalAnswer = 'm2' | 'M2' | 'P4' | 'P5'

/** The answers, in key order. */
export const STEP_OR_LEAP: readonly StepOrLeap[] = ['step', 'leap']
export const NAME_IT: readonly IntervalAnswer[] = ['m2', 'M2', 'P4', 'P5']

/** Step or leap?'s sizes, in semitones (FACTS 67). */
export const STEP_LEAP_SIZES: readonly number[] = [1, 2, 3, 4, 5, 7]
/** Every round's first note: C4 to G4. */
export const FIRST_LO = 60
export const FIRST_HI = 67
export const STEP_LEAP_ROUNDS = 10

/** Name it's sizes, each twice, and each answer's interval. */
export const NAME_IT_SIZES: Readonly<Record<IntervalAnswer, number>> = {
  m2: 1,
  M2: 2,
  P4: 5,
  P5: 7,
}

const pick = <T>(random: () => number, xs: readonly T[]): T =>
  xs[Math.floor(random() * xs.length)]

const firstNote = (random: () => number): number =>
  FIRST_LO + Math.floor(random() * (FIRST_HI - FIRST_LO + 1))

/** Step or leap?'s line for a size, as played: "A leap: 7 semitones up, a perfect fifth." */
export function stepLeapWords(size: number, up: boolean): string {
  const dir = up ? 'up' : 'down'
  if (size === 1) return `A step: a semitone ${dir}.`
  if (size === 2) return `A step: 2 semitones ${dir}, a tone.`
  if (size === 5) return `A leap: 5 semitones ${dir}, a perfect fourth.`
  if (size === 7) return `A leap: 7 semitones ${dir}, a perfect fifth.`
  // thirds are named only by their semitones: the page never names them
  return `A leap: ${size} semitones ${dir}.`
}

/** Name it's line for each answer, in its anchor's direction. */
export const NAME_IT_WORDS: Readonly<Record<IntervalAnswer, string>> = {
  P5: 'A perfect fifth, up: “twin-kle, twin-kle”.',
  P4: 'A perfect fourth, up: “Should auld”.',
  M2: 'A tone, down: “lit-tle star”.',
  m2: 'A semitone, down: “I won-der”.',
}

/** Ten rounds of Step or leap?. */
export function dealStepOrLeap(random: () => number): EarRound<StepOrLeap>[] {
  return Array.from({ length: STEP_LEAP_ROUNDS }, () => {
    const size = pick(random, STEP_LEAP_SIZES)
    const up = random() < 0.5
    const a = firstNote(random)
    const b = a + (up ? size : -size)
    const kind = classify(b - a)
    return {
      events: pair(a, b),
      answer: kind === 'step' ? 'step' : 'leap',
      words: stepLeapWords(size, up),
    }
  })
}

/** A Fisher-Yates shuffle of a copy. */
function shuffled<T>(random: () => number, xs: readonly T[]): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const noRepeat = <T>(xs: readonly T[]): boolean =>
  xs.every((x, i) => i === 0 || x !== xs[i - 1])

/** Each of Name it's four answers twice, shuffled so that no answer comes twice running. */
export function nameItOrder(random: () => number): IntervalAnswer[] {
  const bag = NAME_IT.flatMap((a) => [a, a])
  // about a third of all shuffles have no repeat, so a few tries find one
  for (let tries = 0; tries < 64; tries++) {
    const order = shuffled(random, bag)
    if (noRepeat(order)) return order
  }
  // never in practice: the four in a shuffled order, twice over
  const four = shuffled(random, NAME_IT)
  return [...four, ...four]
}

/** Eight rounds of Name it: steps played down, leaps up. */
export function dealNameIt(random: () => number): EarRound<IntervalAnswer>[] {
  return nameItOrder(random).map((answer) => {
    const size = NAME_IT_SIZES[answer]
    const a = firstNote(random)
    const b = size <= 2 ? a - size : a + size
    return { events: pair(a, b), answer, words: NAME_IT_WORDS[answer] }
  })
}
