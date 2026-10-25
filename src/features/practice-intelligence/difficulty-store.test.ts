// ============================================================
// Difficulty store — the cooldown across a rescore
// ============================================================
//
// The level moves at most once every five plays. The plays are counted on
// the drill's current scoring, so a rescore sets the old runs aside and the
// count falls below the mark left by the last adjustment. Read as a gap,
// that held a rescored drill's level still until its new runs outnumbered
// its old ones.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyPersistedValue } from '@/lib/storage'
import { flushExerciseHistoryWrites } from '@/stores/exercise-history-store'
import { getDifficulty, updateDifficultyFromEma } from './difficulty-store'

const HISTORY_KEY = 'mercurypitch_exercise_history'
const LEVELS_KEY = 'mercurypitch_exercise_difficulty'
const MARK_KEY = 'mercurypitch_exercise_difficulty_adjusted_at'

function siren(score: number, completedAt: number, scoringVersion?: number) {
  return { type: 'siren', score, metrics: {}, completedAt, scoringVersion }
}

describe('the difficulty cooldown across a rescore', () => {
  beforeEach(() => {
    applyPersistedValue(LEVELS_KEY, JSON.stringify({}))
    applyPersistedValue(MARK_KEY, JSON.stringify({}))
    applyPersistedValue(HISTORY_KEY, JSON.stringify([]))
  })

  afterEach(async () => {
    await flushExerciseHistoryWrites()
  })

  it('steps a rescored drill up after five strong runs on its new scoring', () => {
    // Arrange: twelve Siren runs on its first scoring, and the last level
    // change marked at the twelfth; then five runs of 95 on its second.
    const old = Array.from({ length: 12 }, (_, i) => siren(70, 100 - i))
    const fresh = Array.from({ length: 5 }, (_, i) => siren(95, 200 - i, 2))
    applyPersistedValue(HISTORY_KEY, JSON.stringify([...fresh, ...old]))
    applyPersistedValue(MARK_KEY, JSON.stringify({ siren: 12 }))

    // Act
    const level = updateDifficultyFromEma('siren')

    // Assert
    expect(level).toBe(6)
    expect(getDifficulty('siren')).toBe(6)
  })

  it('waits for five plays on the new scoring before its first change', () => {
    // Arrange: ten runs on the Siren's first scoring and one of 95 on its
    // second, with no level change yet. One run is not a trend.
    const old = Array.from({ length: 10 }, (_, i) => siren(70, 100 - i))
    applyPersistedValue(
      HISTORY_KEY,
      JSON.stringify([siren(95, 200, 2), ...old]),
    )

    // Act
    const level = updateDifficultyFromEma('siren')

    // Assert
    expect(level).toBeNull()
    expect(getDifficulty('siren')).toBe(5)
  })

  it('still waits for five plays after an adjustment on the same scoring', () => {
    // Arrange: seven runs of 95 on the current scoring, with the last level
    // change marked at the fourth: three plays since.
    const runs = Array.from({ length: 7 }, (_, i) => siren(95, 200 - i, 2))
    applyPersistedValue(HISTORY_KEY, JSON.stringify(runs))
    applyPersistedValue(MARK_KEY, JSON.stringify({ siren: 4 }))

    // Act
    const level = updateDifficultyFromEma('siren')

    // Assert
    expect(level).toBeNull()
    expect(getDifficulty('siren')).toBe(5)
  })
})
