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

import type { ExerciseType } from './types'
import { EXERCISE_INTERVAL_TRAINER } from './types'

/** Bump when a drill's SCORING changes meaning — never for UI changes. */
const SCORING_VERSION: Partial<Record<ExerciseType, number>> = {
  // Redesigned 2026-08 to per-note slots; the old whole-window average
  // scored a correct performance ~0. Those scores share no ruler.
  [EXERCISE_INTERVAL_TRAINER]: 2,
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
 * The persisted key that lets two plain runs of the same drill compare
 * like for like. Same shape family as the challenge/weekly keys
 * (`voice:challenge:<id>:v<n>:<sig>`), scoped by drill type and its
 * scoring version.
 */
export function exerciseComparabilityKey(type: ExerciseType): string {
  return `voice:exercise:${type}:v${exerciseScoringVersion(type)}`
}
