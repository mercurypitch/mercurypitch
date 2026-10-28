// ============================================================
// A finished First note run — its numbers, what it keeps, what Merc says
// ============================================================
//
// The live run's end, out of useFirstNoteController: the run's numbers,
// whether it was a run at all, what it leaves behind and Merc's line over
// its result.
//
// The headline is the ear's: entries the singer came in on the note, at
// the first try. Under it, the voice's: notes found by the end of the turn.
// A run in which no voice was heard is not a run (an aborted run is not a
// result): the singer put the phone down. Every other finished run is kept,
// once, through recordExerciseResult (which credits practice and the
// streak), and the level's best takes it when it beats the last. A run of
// fewer than FIRST_NOTE_ROUNDS entries (the singer's own songs, with fewer
// between them) is scored in the history against the entries it had, and
// is never a best: a best is six entries against six.

import { EXERCISE_FIRST_NOTE_STAGE } from '@/lib/domain/exercise-contracts'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { recordFirstNoteBest } from '@/stores/first-note-store'
import type { RoundOutcome } from './first-note-machine'
import { FIRST_NOTE_ROUNDS } from './first-note-rules'
import type { FirstMoment } from './merc-lines'

export interface FirstNoteSummary {
  /** Entries sung on the note at the first try. */
  readonly onNote: number
  /** Entries whose note was found by the end of the turn. */
  readonly found: number
  readonly rounds: number
  /** The entries' mean distance from their notes, cents; null with none. */
  readonly cents: number | null
  /** The found entries' mean time to land, s; null when none was found. */
  readonly seconds: number | null
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
): FirstNoteSummary {
  return {
    onNote: outcomes.filter((outcome) => outcome.entry?.onNote === true).length,
    found: outcomes.filter((outcome) => outcome.landed).length,
    rounds: outcomes.length,
    cents: mean(
      outcomes.flatMap((o) =>
        o.entry === null ? [] : [Math.abs(o.entry.cents)],
      ),
    ),
    seconds: mean(
      outcomes.flatMap((o) => (o.seconds === null ? [] : [o.seconds])),
    ),
    voiced: outcomes.some((outcome) => outcome.voiced),
  }
}

/** The result's line under the count. */
export const ON_NOTE_DETAIL = 'Came in on the note'

/** The line under that: the notes found, and at which level. */
export function foundLine(summary: FirstNoteSummary, level: string): string {
  const found =
    summary.found === summary.rounds
      ? `All ${summary.rounds} found`
      : `${summary.found} of ${summary.rounds} found`
  return level === '' ? found : `${found}, at ${level}`
}

export interface KeptRun {
  /** The run was kept (any voice was heard). */
  readonly kept: boolean
  /** It beat the level's previous best. */
  readonly improved: boolean
}

/**
 * A finished run is kept: the history, against the entries it had, and the
 * level's best, for a run of all FIRST_NOTE_ROUNDS entries only.
 */
export function keepFirstNoteRun(
  level: ExerciseLevel,
  summary: FirstNoteSummary,
  now: number = Date.now(),
): KeptRun {
  if (!summary.voiced || summary.rounds === 0) {
    return { kept: false, improved: false }
  }
  recordExerciseResult({
    type: EXERCISE_FIRST_NOTE_STAGE,
    score: Math.round((100 * summary.onNote) / summary.rounds),
    metrics: {
      entriesOnNote: summary.onNote,
      entriesFound: summary.found,
      rounds: summary.rounds,
      ...(summary.cents === null ? {} : { centsAtEntry: summary.cents }),
      ...(summary.seconds === null ? {} : { secondsToFind: summary.seconds }),
    },
    completedAt: now,
  })
  if (summary.cents === null || summary.rounds < FIRST_NOTE_ROUNDS) {
    return { kept: true, improved: false }
  }
  const { improved } = recordFirstNoteBest(level, {
    onNote: summary.onNote,
    found: summary.found,
    rounds: summary.rounds,
    cents: summary.cents,
    at: now,
  })
  return { kept: true, improved }
}

/** What Merc says over the result. */
export function resultMoment(
  summary: FirstNoteSummary,
  kept: KeptRun,
): FirstMoment {
  if (!kept.kept) return 'silentRun'
  if (kept.improved) return 'newBest'
  if (summary.onNote === summary.rounds) return 'resultAll'
  if (summary.onNote === 0) return 'resultNone'
  return summary.onNote * 2 >= summary.rounds ? 'resultMost' : 'resultSome'
}
