// ============================================================
// Difficulty Store — Persisted per-exercise difficulty levels
// ============================================================
//
// Tracks the current difficulty (1-10) for each exercise type.
// Updated automatically when exercises are completed based on
// EMA performance trends from adaptive-difficulty.ts.

import type { ExerciseType } from '@/features/exercises/types'
import { createPersistedSignal } from '@/lib/storage'
import { clampDifficulty, getSuggestedDifficulty } from './adaptive-difficulty'

const STORAGE_KEY = 'mercurypitch_exercise_difficulty'

type DifficultyMap = Partial<Record<ExerciseType, number>>

const [difficultyMap, setDifficultyMap] = createPersistedSignal<DifficultyMap>(
  STORAGE_KEY,
  {},
)

/** Get the current difficulty level for an exercise (default 5). */
export function getDifficulty(type: ExerciseType): number {
  return difficultyMap()[type] ?? 5
}

/** Set difficulty directly (for manual overrides). */
export function setDifficulty(type: ExerciseType, level: number): void {
  setDifficultyMap((prev) => ({
    ...prev,
    [type]: clampDifficulty(level),
  }))
}

/**
 * Update difficulty for an exercise based on its recent EMA score.
 * Call this after recording an exercise result.
 *
 * Returns the new difficulty level (or null if unchanged).
 */
export function updateDifficultyFromEma(type: ExerciseType): number | null {
  const current = getDifficulty(type)
  const { difficulty } = getSuggestedDifficulty(type, current)

  if (difficulty !== current) {
    setDifficultyMap((prev) => ({
      ...prev,
      [type]: difficulty,
    }))
    return difficulty
  }
  return null
}

/** Reset all difficulties to defaults. */
export function resetAllDifficulties(): void {
  setDifficultyMap({})
}

/** Get all difficulty levels for display. */
export function getAllDifficulties(): DifficultyMap {
  return { ...difficultyMap() }
}
