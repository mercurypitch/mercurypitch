// ============================================================
// Lesson 9 lines — what the ladder chart's sounds say, in words
// ============================================================
//
// The lines the chart's status and live region speak for its sounds
// (WEB-SPEC, Toys 1): the cold open's leap and its three paths; Step 1's
// step and leap, with the folds' change as a ratio, since the kit's
// `slowRate` prints do and re alike as 0.7 a second (FACTS 30); Step 2's
// so heard first; Step 3's leaps over the rungs the climb touched; Step 4's
// five, numbered; Step 5's readout and scrub bar in the band chart's own
// words (kit/band-words.ts), from the moment the leap lands; and free
// play's leaps, up or down. A note is
// named in words, "F sharp 3", never the sign, so the same line serves the
// eye and a screen reader (`wordName`). Intervals take Lesson 6's names
// (FACTS 15); mi to the top do, which the ladder holds but the lesson never
// names, is said by its size alone (FACTS 20). Pure, so the tests hold
// every line to the guided-voice claims check and to no sign at all.

import { BAND_WORDS, bandOf, bandValueText, gapWords, } from '@/features/lessons/kit/band-words'
import { hz, wordName } from '@/features/lessons/kit/notes'
import type { Leap, RungId } from './ladder-data'
import { degreeStep, leapName, leapSize, RUNG_ORDER, rungMidi, rungName, RUNGS, spelledDegree, } from './ladder-data'
import type { PathId } from './sounds'
import { FIVE_LEAPS, landingAt, PATH_DEGREE } from './sounds'

/** A degree of do's scale in words: "F sharp 3", "A3". */
const said = (doMidi: number, degree: number): string =>
  wordName(spelledDegree(doMidi, degree))

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** A rung as the steps say it: "mi", "the top do". */
const theRung = (id: RungId): string =>
  id === 'top' ? `the ${RUNGS.top.syllable}` : RUNGS[id].syllable

/** "a perfect fifth, 7 semitones": a leap's name, then its size. */
function sized(semitones: number): string {
  const n = Math.abs(semitones)
  const name = leapName(n)
  const size = `${n} semitones`
  return name === null ? size : `${name}, ${size}`
}

// -------------------------------------------------------------- the cold open

/** Merc's leap: "Merc's leap: do, D3, up to so, A3, a perfect fifth". */
export function mercLeapLine(doMidi: number): string {
  const n = RUNGS.so.step
  return `Merc's leap: ${rungName(doMidi, 'do').spoken}, up to ${rungName(doMidi, 'so').spoken}, ${leapName(n)}`
}

/** A path: "Do, D3, up to mi, F sharp 3, a major third; then up to so, A3, a minor third". */
export function pathLine(doMidi: number, p: PathId): string {
  const degree = PATH_DEGREE[p]
  const first = degreeStep(degree)
  return (
    `Do, ${said(doMidi, 1)}, up to ${p}, ${said(doMidi, degree)}, ${leapName(first)}; ` +
    `then up to so, ${said(doMidi, 5)}, ${leapName(RUNGS.so.step - first)}`
  )
}

// -------------------------------------------------------------- Step 1

/** Step 1's two moves: the step to re, and the leap to so. */
export type FoldsMove = 'step' | 'leap'

/** The degree each move lands on: re, or so. */
const MOVE_DEGREE: Readonly<Record<FoldsMove, number>> = { step: 2, leap: 5 }

/** The move alone: "The step: D3 to E3, a tone." Step 2's Leap can say it too. */
export function moveLine(doMidi: number, move: FoldsMove): string {
  const degree = MOVE_DEGREE[move]
  return `The ${move}: ${said(doMidi, 1)} to ${said(doMidi, degree)}, ${leapName(degreeStep(degree))}.`
}

/** How many times as fast the folds go after the move, two decimals: "1.12", "1.50" (FACTS 28, 30). */
export function foldsRatio(doMidi: number, move: FoldsMove): string {
  const to = doMidi + degreeStep(MOVE_DEGREE[move])
  return (hz(to) / hz(doMidi)).toFixed(2)
}

/** How each move changes the folds, as Step 1's Notice says it. */
const FOLDS_WORDS: Readonly<Record<FoldsMove, string>> = {
  step: 'go about an eighth faster',
  leap: 'go one and a half times as fast',
}

/** Step 1's status: "The step: D3 to E3, a tone. The folds go about an eighth faster: 1.12 times." */
export const foldsLine = (doMidi: number, move: FoldsMove): string =>
  `${moveLine(doMidi, move)} The folds ${FOLDS_WORDS[move]}: ${foldsRatio(doMidi, move)} times.`

// -------------------------------------------------------------- Steps 2 to 4

/** Step 2's status while so sounds alone and its band lights. */
export const HEAR_LINE = 'So: hear where the leap lands.'

/** Step 3's leap over the climb: "Do to so: a perfect fifth, 7 semitones, over mi." */
export function overLine(l: Leap): string {
  const lo = RUNG_ORDER.indexOf(l.from)
  const hi = RUNG_ORDER.indexOf(l.to)
  const between = RUNG_ORDER.slice(lo + 1, hi).map(theRung)
  const over = between.length === 0 ? '' : `, over ${between.join(' and ')}`
  return `${capital(theRung(l.from))} to ${theRung(l.to)}: ${sized(leapSize(l))}${over}.`
}

/** Step 4's status for its leap `k`, from 0: "1 of 5: mi to so, a minor third, 3 semitones". */
export function orderLine(k: number): string {
  const l = FIVE_LEAPS[k]
  return `${k + 1} of ${FIVE_LEAPS.length}: ${theRung(l.from)} to ${theRung(l.to)}, ${sized(leapSize(l))}`
}

// -------------------------------------------------------------- Step 5

/** The scrub bar's span, seconds: the landing at speed, whatever Slow does to its sound. */
export const SCRUB_SEC = 3

/**
 * Step 5's readout `t` seconds into the landing, at speed, in the band
 * chart's words, against so, whose band glows throughout: "80 cents below
 * Merc's note: outside the band; nearest note G sharp 3". Null during do's
 * first second: the readout begins as the leap lands (FACTS 94).
 */
export function landingReadout(doMidi: number, t: number): string | null {
  const { rung, cents } = landingAt(t)
  if (rung === 'do') return null
  return bandValueText(rungMidi(doMidi, 'so'), cents)
}

/**
 * The scrub bar's `aria-valuetext`: "1.4 seconds of 3: 80 cents below
 * Merc's note, outside the band"; before the leap lands, the moment alone,
 * "0.4 seconds of 3", as the readout says nothing yet.
 */
export function scrubText(t: number): string {
  const at = Math.min(Math.max(t, 0), SCRUB_SEC)
  const moment = `${at.toFixed(1)} seconds of ${SCRUB_SEC}`
  const { rung, cents } = landingAt(at)
  if (rung === 'do') return moment
  return `${moment}: ${gapWords(cents)}, ${BAND_WORDS[bandOf(cents)]}`
}

// -------------------------------------------------------------- free play

/**
 * Free play's line for a tap on `to` after `from`: the rung alone, "So,
 * A3", or the leap, "So to top do: a perfect fourth, 5 semitones, up".
 */
export function freeLine(
  doMidi: number,
  from: RungId | null,
  to: RungId,
): string {
  if (from === null || from === to) return capital(rungName(doMidi, to).spoken)
  const n = leapSize({ from, to })
  return `${capital(RUNGS[from].syllable)} to ${RUNGS[to].syllable}: ${sized(n)}, ${n > 0 ? 'up' : 'down'}`
}
