// ============================================================
// Adaptive Difficulty Engine
// ============================================================
//
// Computes EMA (Exponential Moving Average) of recent exercise
// scores and maps the trend to suggested difficulty levels 1-10.
//
// Algorithm:
//   EMA_new = α × latestScore + (1-α) × EMA_prev
//   where α = 2/(N+1), N = window size (default 10)
//
//   EMA ≥ 90 → suggested difficulty + 1 (harder)
//   EMA ≤ 50 → suggested difficulty - 1 (easier)
//   Otherwise → stay at current level

import type { ExerciseType } from '@/features/exercises/types'
import { exerciseHistory } from '@/stores/exercise-history-store'

// ── Constants ──────────────────────────────────────────────────

const EMA_WINDOW = 10
const EMA_ALPHA = 2 / (EMA_WINDOW + 1) // ≈0.1818
const DIFFICULTY_MIN = 1
const DIFFICULTY_MAX = 10
const DIFFICULTY_DEFAULT = 5

// ── Public API ─────────────────────────────────────────────────

/** Compute EMA score for an exercise type from recent history */
export function computeEma(type: ExerciseType): number | null {
  const entries = exerciseHistory()
    .filter((e) => e.type === type)
    .slice(0, EMA_WINDOW)

  if (entries.length === 0) return null

  const scores = entries.map((e) => e.score).reverse() // oldest first
  let ema = scores[0]
  for (let i = 1; i < scores.length; i++) {
    ema = EMA_ALPHA * scores[i] + (1 - EMA_ALPHA) * ema
  }

  return Math.round(ema * 100) / 100
}

/**
 * Given current difficulty and EMA score, compute the suggested
 * new difficulty level.
 */
export function suggestedDifficulty(
  emaScore: number | null,
  currentDifficulty: number = DIFFICULTY_DEFAULT,
): number {
  if (emaScore === null) return currentDifficulty

  const clamped = Math.max(
    DIFFICULTY_MIN,
    Math.min(DIFFICULTY_MAX, currentDifficulty),
  )

  if (emaScore >= 90 && clamped < DIFFICULTY_MAX) {
    return clamped + 1
  }
  if (emaScore <= 50 && clamped > DIFFICULTY_MIN) {
    return clamped - 1
  }
  return clamped
}

/**
 * Full convenience: compute EMA + suggested difficulty in one call.
 * Returns the difficulty level the exercise should use.
 */
export function getSuggestedDifficulty(
  type: ExerciseType,
  currentDifficulty?: number,
): { ema: number | null; difficulty: number } {
  const ema = computeEma(type)
  const difficulty = suggestedDifficulty(ema, currentDifficulty)
  return { ema, difficulty }
}

/** Clamp a raw difficulty value to the valid range. */
export function clampDifficulty(value: number): number {
  return Math.max(DIFFICULTY_MIN, Math.min(DIFFICULTY_MAX, Math.round(value)))
}

/** Label for a difficulty level */
export function difficultyLabel(level: number): string {
  if (level <= 2) return 'Beginner'
  if (level <= 4) return 'Easy'
  if (level <= 6) return 'Medium'
  if (level <= 8) return 'Hard'
  return 'Expert'
}
