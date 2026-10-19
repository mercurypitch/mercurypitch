// ============================================================
// Lesson 2 ear game rounds — Semitone or tone?, as data and words
// ============================================================
//
// Ten rounds, each one step inside A3 to A4, a semitone or a tone, drawn from
// a seeded sequence so a run can be replayed exactly. With "Up and down" on,
// half the steps fall, as Leap's do (FACTS 32). The feedback names the keys
// and the sound, never the listener (playbook rule 21): "E to F: a semitone,
// no key between them", "C to D: a tone, with C♯ between", a black key named
// in the page's spelling (D♭ under Flats, C♯/D♭ under Both). No rating and
// no streak; after two misses in a row the playbook's line, once.

import type { Spelling } from '@/features/lessons/kit/names'
import { namesFor } from '@/features/lessons/kit/names'
import { nameHtml } from '@/features/lessons/kit/notes'

/** One round's step: from one note to the next, a semitone (1) or a tone (2). */
export interface Step {
  readonly from: number
  readonly to: number
  readonly size: 1 | 2
}

export type Answer = 'semitone' | 'tone'

/** Rounds in a game. */
export const ROUNDS = 10

/** The playbook's line after two misses in a row (rule 15). */
export const TRICKY = "If that felt tricky, good: that's learning."

/** A3 and A4: every step stays between them. */
const LOW = 57
const HIGH = 69

/** The next round's step, from the game's seeded generator. */
export function nextStep(random: () => number, upAndDown: boolean): Step {
  const size: 1 | 2 = random() < 0.5 ? 1 : 2
  const low = LOW + Math.floor(random() * (HIGH - LOW - size + 1))
  const down = upAndDown && random() < 0.5
  return down
    ? { from: low + size, to: low, size }
    : { from: low, to: low + size, size }
}

export const answerOf = (step: Step): Answer =>
  step.size === 1 ? 'semitone' : 'tone'

/** A key named for the feedback, without its octave: "E", "C♯", "C♯/D♭" (markup, the signs spoken). */
export function keyLabel(midi: number, spelling: Spelling): string {
  return namesFor(midi, spelling)
    .map((n) => nameHtml(n, { octave: false }))
    .join('/')
}

/**
 * What the step was, in the keys' names and the sound's: "E to F: a
 * semitone, no key between them", "C to D: a tone, with C♯ between" (markup).
 */
export function stepWords(step: Step, spelling: Spelling): string {
  const ends = `${keyLabel(step.from, spelling)} to ${keyLabel(step.to, spelling)}`
  if (step.size === 1) return `${ends}: a semitone, no key between them`
  const between = Math.min(step.from, step.to) + 1
  return `${ends}: a tone, with ${keyLabel(between, spelling)} between`
}

/** A game in progress: the round, the score, and the misses in a row. */
export interface GameScore {
  readonly round: number
  readonly heard: number
  readonly missesInARow: number
  /** True once the tricky line has been said this game. */
  readonly saidTricky: boolean
}

export const NEW_GAME: GameScore = {
  round: 0,
  heard: 0,
  missesInARow: 0,
  saidTricky: false,
}

/** The score after an answer, and whether this answer earns the tricky line. */
export function scoreAnswer(
  score: GameScore,
  correct: boolean,
): { score: GameScore; tricky: boolean } {
  const misses = correct ? 0 : score.missesInARow + 1
  const tricky = misses >= 2 && !score.saidTricky
  return {
    score: {
      round: score.round,
      heard: score.heard + (correct ? 1 : 0),
      missesInARow: misses,
      saidTricky: score.saidTricky || tricky,
    },
    tricky,
  }
}
