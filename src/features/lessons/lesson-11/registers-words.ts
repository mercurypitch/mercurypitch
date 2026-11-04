// ============================================================
// Lesson 11 chart words — what the range chart says, in spoken names
// ============================================================
//
// The chart's canvas is a picture; these are its words (WEB-SPEC, Toys 1,
// "Keyboard and screen readers"): the group's summary for each state, the
// polite live line for each play, the scrub bar's value in words, and the
// controls' names, which follow the chart's voice. Notes are spoken names
// ("G sharp 3"), never the sign. Merc sings the lower voice's lines and Tavi
// the higher's.

import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { GearLine } from './lines'
import { figureNotes, flipFrom, gearNoteOf, JUMP, lineAt, sirenFloor, SMOOTHER_JUMPS, spoken, } from './lines'

/** The chart's states: one a step, in step order (Step 1 to 5). */
export const STATES = ['gears', 'slide', 'three', 'smoother', 'styles'] as const
export type ToyState = (typeof STATES)[number]

/** The step a state shows on, 1 to 5: its parts' `data-part`. */
export const stepOf = (s: ToyState): number => STATES.indexOf(s) + 1

/** Who sings a voice's lines. */
export const singerOf = (v: Voice): string => (v === 'lower' ? 'Merc' : 'Tavi')

/** The words for a gear. */
export const GEAR_NAME = { lower: 'Lower gear', upper: 'Upper gear' } as const
export type Gear = keyof typeof GEAR_NAME

/** Step 1's buttons: "Lower gear, G sharp 3". */
export const gearLabel = (v: Voice, g: Gear): string =>
  `${GEAR_NAME[g]}, ${spoken(gearNoteOf(v))}`

/** Step 1's live line as a gear's note sounds. */
export const gearSaid = (v: Voice, g: Gear): string =>
  g === 'lower'
    ? `Lower gear: ${spoken(gearNoteOf(v))}, drawn thick.`
    : `Upper gear: ${spoken(gearNoteOf(v))}, the same height, drawn thin.`

/** The seam a voice's flips cross: "between G 3 and A 3". */
const seamWords = (v: Voice): string =>
  `between ${spoken(flipFrom(v))} and ${spoken(flipFrom(v) + JUMP)}`

/** Step 2's live line after a play. */
export const slideSaid = (v: Voice): string =>
  `${singerOf(v)}'s slide: the stretch rose evenly the whole way, and the line jumped across the seam ${seamWords(v)}.`

/** Step 3's live line as slide `k` (0 to 2) sounds. */
export function threeSaid(v: Voice, k: number): string {
  if (k === 0) return `Slide 1: switching gear ${seamWords(v)}.`
  if (k === 1) {
    const lo = sirenFloor(v) + 5
    return `Slide 2: switching later, between ${spoken(lo)} and ${spoken(lo + JUMP)}.`
  }
  return 'Slide 3: one gear the whole way, with no seam.'
}

/** A Step 4 jump in words. */
const JUMP_WORDS: Readonly<Record<number, string>> = {
  2: '2 semitones',
  1.5: '1.5 semitones',
  1: '1 semitone',
  0.5: 'half a semitone',
  0.25: 'a quarter of a semitone',
}

/** Step 4's live line as slide `k` (0 to 4) sounds. */
export function fiveSaid(k: number): string {
  const j = SMOOTHER_JUMPS[k] ?? SMOOTHER_JUMPS[0]
  const line = `${k + 1} of 5: a jump of ${JUMP_WORDS[j]}`
  return k === SMOOTHER_JUMPS.length - 1
    ? `${line}; the seam is a hairline`
    : line
}

/** Step 5's live line as a way sounds. */
export function styleSaid(v: Voice, way: 'flip' | 'hide'): string {
  if (way === 'hide')
    return 'Hide the switch: the same notes in one even sound.'
  const notes = figureNotes(v).map(spoken).join(', ')
  return `Flip on purpose: ${notes}. Each leap across the seam changes gear.`
}

/** The scrub bar's value in words: "0.9 seconds of 4: lower gear, near F sharp 3". */
export function scrubWords(
  line: GearLine,
  t: number,
  jump: {
    readonly t0: number
    readonly t1: number
    readonly lo: number
    readonly hi: number
  },
): string {
  const head = `${t.toFixed(1)} seconds of 4`
  // a tenth of a second either side of the jump is where the scrub's steps land on it
  if (jump.t1 >= t - 0.05 && jump.t0 <= t + 0.05)
    return `${head}: the switch, from ${spoken(jump.lo)} to ${spoken(jump.hi)}`
  const { midi, share } = lineAt(line, t)
  const gear = share >= 0.5 ? 'lower gear' : 'upper gear'
  return `${head}: ${gear}, near ${spoken(midi)}`
}

/** The chart's summary for a state, its group's name. */
export function summaryOf(s: ToyState, v: Voice): string {
  const lo = sirenFloor(v)
  const who = singerOf(v)
  switch (s) {
    case 'gears':
      return `Merc's model: ${spoken(gearNoteOf(v))} in each gear, side by side at one height, the lower gear thick and the upper thin`
    case 'slide':
      return `Merc's model: ${who}'s slide, from ${spoken(lo)} up to ${spoken(lo + 9)}, jumping across the switch ${seamWords(v)}, with the stretch gauge under it`
    case 'three':
      return `Merc's model: three slots for three slides, from ${spoken(lo)} up to ${spoken(lo + 9)}`
    case 'smoother':
      return `Merc's model: five slots for five slides across a seam that narrows, from 2 semitones to a quarter of a semitone`
    case 'styles':
      return `Merc's model: one figure, ${figureNotes(v).map(spoken).join(', ')}, either side of the switch ${seamWords(v)}`
  }
}
