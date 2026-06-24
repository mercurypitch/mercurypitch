// ============================================================
// adaptive-difficulty.test.ts — EMA computation & difficulty
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  clampDifficulty,
  computeEma,
  difficultyLabel,
  getSuggestedDifficulty,
  suggestedDifficulty,
} from '@/features/practice-intelligence/adaptive-difficulty'
import { clearExerciseHistory, recordExerciseResult, } from '@/stores/exercise-history-store'

function seedScores(type: string, scores: number[]) {
  for (const s of scores) {
    recordExerciseResult({
      type: type as never,
      score: s,
      metrics: {},
      completedAt: Date.now() - (scores.length - scores.indexOf(s)) * 60000,
    })
  }
}

describe('computeEma', () => {
  it('returns null for empty history', () => {
    clearExerciseHistory()
    expect(computeEma('long-note')).toBeNull()
  })

  it('returns the score when only one entry exists', () => {
    clearExerciseHistory()
    seedScores('long-note', [80])
    expect(computeEma('long-note')).toBe(80)
  })

  it('weights recent scores more heavily', () => {
    clearExerciseHistory()
    // Oldest first, newest last in seed order
    seedScores('long-note', [50, 50, 50, 50, 50, 50, 50, 50, 50, 100])
    const ema = computeEma('long-note')
    // EMA should be pulled toward the recent 100 but still reflect history
    expect(ema).toBeGreaterThan(50)
    expect(ema).toBeLessThan(100)
  })

  it('returns exact average for constant scores', () => {
    clearExerciseHistory()
    seedScores('long-note', [70, 70, 70, 70, 70, 70, 70, 70, 70, 70])
    expect(computeEma('long-note')).toBe(70)
  })

  it('filters by exercise type', () => {
    clearExerciseHistory()
    seedScores('long-note', [90, 90, 90])
    seedScores('vibrato', [30, 30, 30])
    expect(computeEma('long-note')).toBe(90)
    expect(computeEma('vibrato')).toBe(30)
  })

  it('caps at last 10 entries', () => {
    clearExerciseHistory()
    // Seed 15 scores — only last 10 should matter
    const scores = Array.from({ length: 15 }, (_, i) => (i < 5 ? 0 : 100))
    seedScores('long-note', scores)
    // Last 10 are all 100
    expect(computeEma('long-note')).toBe(100)
  })
})

describe('suggestedDifficulty', () => {
  it('returns current difficulty when EMA is null', () => {
    expect(suggestedDifficulty(null, 5)).toBe(5)
    expect(suggestedDifficulty(null, 8)).toBe(8)
  })

  it('increases difficulty when EMA >= 90', () => {
    expect(suggestedDifficulty(92, 5)).toBe(6)
    expect(suggestedDifficulty(90, 5)).toBe(6)
  })

  it('decreases difficulty when EMA <= 50', () => {
    expect(suggestedDifficulty(48, 5)).toBe(4)
    expect(suggestedDifficulty(50, 5)).toBe(4)
  })

  it('keeps difficulty when EMA is between 51 and 89', () => {
    expect(suggestedDifficulty(75, 5)).toBe(5)
    expect(suggestedDifficulty(60, 8)).toBe(8)
    expect(suggestedDifficulty(85, 3)).toBe(3)
  })

  it('does not exceed MAX of 10', () => {
    expect(suggestedDifficulty(95, 10)).toBe(10)
  })

  it('does not go below MIN of 1', () => {
    expect(suggestedDifficulty(30, 1)).toBe(1)
  })

  it('clamps currentDifficulty before evaluating', () => {
    // If somehow difficulty is 0 (invalid), clamp to 1 first
    expect(suggestedDifficulty(95, 0)).toBe(2) // clamped to 1, then +1
  })
})

describe('getSuggestedDifficulty', () => {
  it('returns EMA and difficulty for a type', () => {
    clearExerciseHistory()
    seedScores('long-note', [95, 95, 95, 95, 95, 95, 95, 95, 95, 95])
    const result = getSuggestedDifficulty('long-note', 5)
    expect(result.ema).toBe(95)
    expect(result.difficulty).toBe(6)
  })

  it('returns default difficulty for empty history', () => {
    clearExerciseHistory()
    const result = getSuggestedDifficulty('pitch-hold')
    expect(result.ema).toBeNull()
    expect(result.difficulty).toBe(5)
  })
})

describe('clampDifficulty', () => {
  it('keeps valid values unchanged', () => {
    expect(clampDifficulty(5)).toBe(5)
    expect(clampDifficulty(1)).toBe(1)
    expect(clampDifficulty(10)).toBe(10)
  })

  it('clamps values below 1', () => {
    expect(clampDifficulty(0)).toBe(1)
    expect(clampDifficulty(-5)).toBe(1)
  })

  it('clamps values above 10', () => {
    expect(clampDifficulty(11)).toBe(10)
    expect(clampDifficulty(100)).toBe(10)
  })

  it('rounds non-integer values', () => {
    expect(clampDifficulty(5.7)).toBe(6)
    expect(clampDifficulty(3.2)).toBe(3)
  })
})

describe('difficultyLabel', () => {
  it('returns Beginner for levels 1-2', () => {
    expect(difficultyLabel(1)).toBe('Beginner')
    expect(difficultyLabel(2)).toBe('Beginner')
  })

  it('returns Easy for levels 3-4', () => {
    expect(difficultyLabel(3)).toBe('Easy')
    expect(difficultyLabel(4)).toBe('Easy')
  })

  it('returns Medium for levels 5-6', () => {
    expect(difficultyLabel(5)).toBe('Medium')
    expect(difficultyLabel(6)).toBe('Medium')
  })

  it('returns Hard for levels 7-8', () => {
    expect(difficultyLabel(7)).toBe('Hard')
    expect(difficultyLabel(8)).toBe('Hard')
  })

  it('returns Expert for levels 9-10', () => {
    expect(difficultyLabel(9)).toBe('Expert')
    expect(difficultyLabel(10)).toBe('Expert')
  })
})
