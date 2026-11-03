// ============================================================
// Exercise comparability — when do two runs of a drill compare?
// ============================================================
//
// The Progress page threads history rows whose records share a persisted
// comparabilityKey (`sessionComparisonKey` in progress/model.ts: only an
// explicit key proves target and scoring semantics match — names don't).
// Challenge and weekly attempts always wrote one; plain drill runs never
// did, so repeating the same exercise never created a Skill Thread and
// every plain row read "cannot be compared like for like"
// (CLAUDE-JOURNEY-007).
//
// A drill's runs compare on its 0-100 score, whose meaning is stable per
// drill TYPE until that drill's scoring is redesigned. The table below is
// that scoring contract: bump a drill's entry when its score stops meaning
// what it meant, and its thread starts fresh instead of drawing a false
// trend across two different rulers.
//
// A run compares only if it also ran to its end. The round-based drills
// grade the rounds a run reached, so one good round and Stop graded like a
// flawless whole run: it completed the 85-point Subwoofer Sound challenge,
// earned Perfect Run and, five times over, lifted the level. A stopped run
// is practice, not a result. Its controller marks it where the result is
// made (`stoppedEarlyMark`, in the result contract), and every bar reads
// only runs that compare (`isComparableRun`): the level, the best, the weak
// list, the averages and the trends.

import type { ExerciseType } from './types'
import { EXERCISE_ARPEGGIO_JUMPER, EXERCISE_DRONE_INTONATION, EXERCISE_INTERVAL_TRAINER, EXERCISE_SCALE_RUNNER, EXERCISE_SIREN, runStoppedEarly, } from './types'

/** Bump when a drill's SCORING changes meaning — never for UI changes. */
const SCORING_VERSION: Partial<Record<ExerciseType, number>> = {
  // Redesigned 2026-08 to per-note slots; the old whole-window average
  // scored a correct performance ~0. Those scores share no ruler.
  [EXERCISE_INTERVAL_TRAINER]: 2,
  // Rescored 2026-10: its 30 % part now scores the glide, which a smooth
  // glide never earned.
  [EXERCISE_SIREN]: 2,
  // Rescored 2026-10-25: the grade is the mean of the note scores, each
  // note scored on its own window, settled, in the octave that fits the
  // whole run. Version 1 blended in the best note and a dead richness term
  // and could not pass 75.
  [EXERCISE_ARPEGGIO_JUMPER]: 2,
  // Rescored 2026-11-02: each grade's weights were divided by their sum,
  // so a flawless run grades 100. Version 1 lost richness's 0.2 on
  // 2026-10-25 without a reweighting and could not pass 80.
  [EXERCISE_SCALE_RUNNER]: 2,
  [EXERCISE_DRONE_INTONATION]: 2,
}

/**
 * The scoring version a drill's records are stamped with. The server's
 * evidence rule requires it wherever a comparabilityKey is sent — a key
 * without it is a 400 the client swallows, which silently uncredits the
 * whole run (session row, minutes, streak, badges).
 */
export function exerciseScoringVersion(type: ExerciseType): number {
  return SCORING_VERSION[type] ?? 1
}

/**
 * Runs recorded before the version was stamped were scored on version 1,
 * except the interval trainer's, which mix its two versions and keep
 * counting as its second, as they always have.
 */
const UNSTAMPED_VERSION: Partial<Record<ExerciseType, number>> = {
  [EXERCISE_INTERVAL_TRAINER]: 2,
}

/** Whether a recorded run was scored the way its drill scores now. */
export function onCurrentScoring(
  type: ExerciseType,
  recorded: number | undefined,
): boolean {
  return (
    (recorded ?? UNSTAMPED_VERSION[type] ?? 1) === exerciseScoringVersion(type)
  )
}

/**
 * Whether a recorded run compares with its drill's other runs: run to its
 * end, and scored the way the drill scores now.
 */
export function isComparableRun(run: {
  readonly type: ExerciseType
  readonly scoringVersion?: number
  readonly metrics: Readonly<Record<string, number>>
}): boolean {
  return (
    onCurrentScoring(run.type, run.scoringVersion) &&
    !runStoppedEarly(run.metrics)
  )
}

/**
 * The persisted key that lets two plain runs of the same drill compare
 * like for like. Same shape family as the challenge/weekly keys
 * (`voice:challenge:<id>:v<n>:<sig>`), scoped by drill type and its
 * scoring version.
 */
export function exerciseComparabilityKey(type: ExerciseType): string {
  return `voice:exercise:${type}:v${exerciseScoringVersion(type)}`
}
