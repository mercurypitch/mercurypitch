// ============================================================
// Difficulty Scaling — map a 1-10 level to per-exercise params
// ============================================================
//
// Exercises pick their own parameters (cents tolerance, note count,
// duration, tempo, …) and scale them by their stored difficulty level.
// All scaling is centred on difficulty 5 so that the DEFAULT level
// reproduces each exercise's original behaviour exactly — raising or
// lowering difficulty only nudges from there.

import { clampDifficulty } from './adaptive-difficulty'

const DIFFICULTY_DEFAULT = 5

/**
 * Normalised difficulty in [0, 1]: level 1 → 0 (easiest), 10 → 1 (hardest).
 * Use with `lerpDifficulty` when a param has explicit easy/hard endpoints.
 */
export function difficultyT(level: number): number {
  return (clampDifficulty(level) - 1) / 9
}

/**
 * Interpolate a parameter between its easiest and hardest value.
 * `easy` is returned at level 1, `hard` at level 10.
 */
export function lerpDifficulty(
  level: number,
  easy: number,
  hard: number,
): number {
  return easy + (hard - easy) * difficultyT(level)
}

/** `lerpDifficulty` rounded to an integer (note counts, repetitions, …). */
export function lerpDifficultyInt(
  level: number,
  easy: number,
  hard: number,
): number {
  return Math.round(lerpDifficulty(level, easy, hard))
}

/**
 * Multiplier centred on difficulty 5 (== 1.0). Easier levels return > 1,
 * harder levels return < 1. Multiply a baseline tolerance/window/duration
 * so the default level is unchanged and harder = tighter.
 *
 * `perStep` is the fractional change per level away from 5 (default 8%).
 * Result is clamped to stay positive.
 */
export function difficultyFactor(level: number, perStep = 0.08): number {
  const factor = 1 + (DIFFICULTY_DEFAULT - clampDifficulty(level)) * perStep
  return Math.max(0.1, factor)
}
