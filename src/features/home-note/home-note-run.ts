// ============================================================
// A finished Home note run — its numbers, what it keeps, what Merc says
// ============================================================
//
// The live run's end, out of useHomeNoteController: the run's numbers,
// whether it was a run at all, what it leaves behind and Merc's line over
// its result.
//
// A run in which no voice was heard is not a run (an aborted run is not a
// result): the singer put the phone down, and keeping six misses would
// put a zero in their history they never sang. Every other finished run is
// kept, once, through recordExerciseResult (which credits practice and the
// streak), and the level's best takes it when it beats the last.

import { EXERCISE_HOME_NOTE_LIGHTHOUSE } from '@/lib/domain/exercise-contracts'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { recordHomeNoteBest } from '@/stores/home-note-store'
import type { RoundOutcome } from './home-note-machine'
import type { HomeMoment } from './merc-lines'

/** A landing this soon after the turn opened is "straight home", s. */
const QUICK_SECONDS = 1.2

export interface HomeNoteSummary {
  readonly found: number
  readonly rounds: number
  /** The found rounds' mean time to home, s; null when none was found. */
  readonly seconds: number | null
  /** The found rounds' mean distance from home, cents; null when none. */
  readonly cents: number | null
  /** Any voice was heard in the run. */
  readonly voiced: boolean
}

function mean(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((a, b) => a + b, 0) / values.length
}

/** The run's numbers, from its outcomes. */
export function summarizeRun(
  outcomes: readonly RoundOutcome[],
): HomeNoteSummary {
  const landed = outcomes.filter((outcome) => outcome.landed)
  return {
    found: landed.length,
    rounds: outcomes.length,
    seconds: mean(
      landed.flatMap((o) => (o.seconds === null ? [] : [o.seconds])),
    ),
    cents: mean(
      landed.flatMap((o) => (o.cents === null ? [] : [Math.abs(o.cents)])),
    ),
    voiced: outcomes.some((outcome) => outcome.voiced),
  }
}

/** The result's line under the count: how quickly, or how close. */
export function detailLine(summary: HomeNoteSummary): string | null {
  if (summary.seconds === null) return null
  return `Found in ${summary.seconds.toFixed(1)} s on average`
}

/** A landing quick enough to say so. */
export function isQuick(outcome: RoundOutcome): boolean {
  return (
    outcome.landed &&
    !outcome.heardAgain &&
    outcome.seconds !== null &&
    outcome.seconds <= QUICK_SECONDS
  )
}

export interface KeptRun {
  /** The run was kept (any voice was heard). */
  readonly kept: boolean
  /** It beat the level's previous best. */
  readonly improved: boolean
}

/** A finished run is kept: the history, and the level's best. */
export function keepHomeNoteRun(
  level: ExerciseLevel,
  summary: HomeNoteSummary,
  now: number = Date.now(),
): KeptRun {
  if (!summary.voiced || summary.rounds === 0) {
    return { kept: false, improved: false }
  }
  recordExerciseResult({
    type: EXERCISE_HOME_NOTE_LIGHTHOUSE,
    score: Math.round((100 * summary.found) / summary.rounds),
    metrics: {
      roundsFound: summary.found,
      rounds: summary.rounds,
      ...(summary.seconds === null ? {} : { secondsToHome: summary.seconds }),
      ...(summary.cents === null ? {} : { centsFromHome: summary.cents }),
    },
    completedAt: now,
  })
  if (summary.seconds === null) return { kept: true, improved: false }
  const { improved } = recordHomeNoteBest(level, {
    found: summary.found,
    rounds: summary.rounds,
    seconds: summary.seconds,
    at: now,
  })
  return { kept: true, improved }
}

/** What Merc says over the result. */
export function resultMoment(
  summary: HomeNoteSummary,
  kept: KeptRun,
): HomeMoment {
  if (!kept.kept) return 'silentRun'
  if (kept.improved) return 'newBest'
  if (summary.found === summary.rounds) return 'resultAll'
  if (summary.found === 0) return 'resultNone'
  return summary.found * 2 >= summary.rounds ? 'resultMost' : 'resultSome'
}
