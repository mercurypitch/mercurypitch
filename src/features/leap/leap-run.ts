// ============================================================
// A Leap run — its numbers, its leaps, what it keeps, what Merc says
// ============================================================
//
// The live run's end, out of useLeapController: the run's numbers, the
// leaps it asked for as the result's rows draw them, whether it was a run
// at all, what it leaves behind and Merc's line over its result.
//
// A run in which no voice was heard is not a run (an aborted run is not a
// result): the singer put the phone down, and keeping six misses would put
// a zero in their history they never sang. Every other finished run is
// kept, once, through recordExerciseResult (which credits practice and the
// streak), and the level's best takes it when it beats the last.

import { EXERCISE_LEAP_CLIFFS } from '@/lib/domain/exercise-contracts'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { recordLeapBest } from '@/stores/leap-store'
import type { RoundOutcome } from './leap-machine'
import type { LeapRound } from './leap-round'
import type { LeapKind, LeapLevel, LeapSong } from './leap-rules'
import { leapName, leapSong, namesPrecisely, sameLeap } from './leap-rules'
import type { LeapMoment } from './merc-lines'

export interface LeapSummary {
  readonly landed: number
  readonly rounds: number
  /** The landed leaps' mean time from Merc's note to the target, s; null when none. */
  readonly seconds: number | null
  /** The landed leaps' mean distance from the target, cents; null when none. */
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
export function summarizeRun(outcomes: readonly RoundOutcome[]): LeapSummary {
  const landed = outcomes.filter((outcome) => outcome.landed)
  return {
    landed: landed.length,
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

/** The result's line under the count: how quickly the leaps landed. */
export function detailLine(summary: LeapSummary): string | null {
  if (summary.seconds === null) return null
  return `Landed in ${summary.seconds.toFixed(1)} s on average`
}

/** One of the result's rows: a leap the run asked for, and how each try went. */
export interface LeapRow {
  readonly kind: LeapKind
  /** "Up a fifth". */
  readonly name: string
  /** The song that opens on it, or null (a leap down, a size with none). */
  readonly song: LeapSong | null
  /** Each try in the run's order: landed or not, and its round. */
  readonly tries: readonly {
    readonly landed: boolean
    readonly round: LeapRound
  }[]
  readonly landed: number
}

/**
 * The run's leaps as the result lists them: one row a leap, in the order
 * the run first asked for each, its tries in the run's order, named as
 * the run's `level` names them (its songs only where it names them).
 */
export function leapRows(
  outcomes: readonly RoundOutcome[],
  level: LeapLevel,
): LeapRow[] {
  const rows: {
    kind: LeapKind
    tries: { landed: boolean; round: LeapRound }[]
  }[] = []
  for (const outcome of outcomes) {
    const kind = outcome.round.kind
    let row = rows.find((entry) => sameLeap(entry.kind, kind))
    if (row === undefined) {
      row = { kind, tries: [] }
      rows.push(row)
    }
    row.tries.push({ landed: outcome.landed, round: outcome.round })
  }
  const precise = namesPrecisely(level)
  return rows.map((row) => ({
    kind: row.kind,
    name: leapName(row.kind, precise),
    song: level.namesSong ? leapSong(row.kind) : null,
    tries: row.tries,
    landed: row.tries.filter((t) => t.landed).length,
  }))
}

/** What Merc says as he calls a leap, at this level. */
export function callMoment(level: LeapLevel, kind: LeapKind): LeapMoment {
  const song = level.namesSong ? leapSong(kind) : null
  if (song === null) return 'callPlain'
  return level.mercSingsBoth ? 'callMatch' : 'call'
}

/** What Merc says over a landing. */
export function landedMoment(level: LeapLevel, kind: LeapKind): LeapMoment {
  return level.namesSong && leapSong(kind) !== null ? 'landedSong' : 'landed'
}

/** What Merc says over a miss: silent, short of it, past it, or not quite. */
export function missedMoment(outcome: RoundOutcome): LeapMoment {
  if (!outcome.voiced) return 'missedSilent'
  if (outcome.short === true) return 'missedShort'
  if (outcome.short === false) return 'missedOver'
  return 'missed'
}

export interface KeptRun {
  /** The run was kept (any voice was heard). */
  readonly kept: boolean
  /** It beat the level's previous best. */
  readonly improved: boolean
}

/** A finished run is kept: the history, and the level's best. */
export function keepLeapRun(
  level: ExerciseLevel,
  summary: LeapSummary,
  now: number = Date.now(),
): KeptRun {
  if (!summary.voiced || summary.rounds === 0) {
    return { kept: false, improved: false }
  }
  recordExerciseResult({
    type: EXERCISE_LEAP_CLIFFS,
    score: Math.round((100 * summary.landed) / summary.rounds),
    metrics: {
      leapsLanded: summary.landed,
      leaps: summary.rounds,
      ...(summary.seconds === null ? {} : { secondsToLand: summary.seconds }),
      ...(summary.cents === null ? {} : { centsFromTarget: summary.cents }),
    },
    completedAt: now,
  })
  if (summary.seconds === null) return { kept: true, improved: false }
  const { improved } = recordLeapBest(level, {
    landed: summary.landed,
    rounds: summary.rounds,
    seconds: summary.seconds,
    at: now,
  })
  return { kept: true, improved }
}

/** What Merc says over the result. */
export function resultMoment(summary: LeapSummary, kept: KeptRun): LeapMoment {
  if (!kept.kept) return 'silentRun'
  if (kept.improved) return 'newBest'
  if (summary.landed === summary.rounds) return 'resultAll'
  if (summary.landed === 0) return 'resultNone'
  return summary.landed * 2 >= summary.rounds ? 'resultMost' : 'resultSome'
}
