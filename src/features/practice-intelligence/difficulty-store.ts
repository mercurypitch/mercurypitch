// ============================================================
// Difficulty Store — Persisted per-exercise difficulty levels
// ============================================================
//
// Tracks the current difficulty (1-10) for each exercise type.
// Updated automatically when exercises are completed based on
// EMA performance trends from adaptive-difficulty.ts.

import type { ExerciseType } from '@/features/exercises/types'
import { createPersistedSignal } from '@/lib/storage'
import { exerciseHistory } from '@/stores/exercise-history-store'
import { showNotification } from '@/stores/notifications-store'
import { clampDifficulty, getSuggestedDifficulty } from './adaptive-difficulty'

const STORAGE_KEY = 'mercurypitch_exercise_difficulty'
const ADJUST_COUNT_KEY = 'mercurypitch_exercise_difficulty_adjusted_at'

// Minimum number of new plays of an exercise between two automatic
// difficulty adjustments. Without this, a strong (or struggling) player's
// EMA stays past the threshold and the level ratchets on every single run.
const ADJUST_COOLDOWN = 5

type DifficultyMap = Partial<Record<ExerciseType, number>>

const [difficultyMap, setDifficultyMap] = createPersistedSignal<DifficultyMap>(
  STORAGE_KEY,
  {},
)

// Per-type play count (entries for that type in history) at the last
// automatic adjustment — drives the cooldown above.
const [lastAdjustCount, setLastAdjustCount] =
  createPersistedSignal<DifficultyMap>(ADJUST_COUNT_KEY, {})

function playCount(type: ExerciseType): number {
  return exerciseHistory().filter((e) => e.type === type).length
}

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
  // Hysteresis: wait for at least ADJUST_COOLDOWN new plays since the last
  // adjustment before nudging again, so the level can't ratchet every run.
  const count = playCount(type)
  const since = count - (lastAdjustCount()[type] ?? 0)
  if (since < ADJUST_COOLDOWN) return null

  const current = getDifficulty(type)
  const { difficulty } = getSuggestedDifficulty(type, current)

  if (difficulty !== current) {
    setDifficultyMap((prev) => ({
      ...prev,
      [type]: difficulty,
    }))
    setLastAdjustCount((prev) => ({
      ...prev,
      [type]: count,
    }))
    // The adaptive engine used to adjust silently — surfacing the change is
    // the cheapest progression mechanic we have (UX audit finding 6).
    showNotification(
      difficulty > current
        ? `Level up! This drill is now Lv ${difficulty}`
        : `Level eased to Lv ${difficulty} — keep at it`,
      difficulty > current ? 'success' : 'info',
    )
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
