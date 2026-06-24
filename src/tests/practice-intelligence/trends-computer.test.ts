// ============================================================
// trends-computer.test.ts — aggregation and trend utilities
// ============================================================

import { describe, expect, it } from 'vitest'
import { computeImprovementRate, computeMonthlyTrends, computePerExerciseStats, computePracticeStats, computeRollingAverage, computeWeeklyTrends, getRecentScores, } from '@/features/practice-intelligence/trends-computer'
import { clearExerciseHistory, recordExerciseResult, } from '@/stores/exercise-history-store'
import { setSessionResults } from '@/stores/practice-session-store'

function seedSession(score: number, daysAgo: number) {
  const ts = Date.now() - daysAgo * 86400000
  setSessionResults((prev) => [
    {
      name: 'Test',
      score,
      itemsCompleted: 5,
      sessionName: 'Test Session',
      completedAt: ts,
      practiceItemResult: [],
    },
    ...prev,
  ])
}

function clearSessionHistory() {
  setSessionResults([])
}

describe('getRecentScores', () => {
  it('returns empty array when no history', () => {
    clearSessionHistory()
    expect(getRecentScores(20)).toEqual([])
  })

  it('returns scores in chronological order (oldest first)', () => {
    clearSessionHistory()
    seedSession(60, 5)
    seedSession(80, 2)
    seedSession(100, 0)
    const scores = getRecentScores(20)
    expect(scores.length).toBe(3)
    expect(scores[0]).toBe(60) // oldest
    expect(scores[2]).toBe(100) // newest
  })

  it('caps at requested count', () => {
    clearSessionHistory()
    for (let i = 0; i < 25; i++) seedSession(50 + i, i)
    expect(getRecentScores(10).length).toBe(10)
  })
})

describe('computeWeeklyTrends', () => {
  it('returns empty array when no sessions', () => {
    clearSessionHistory()
    expect(computeWeeklyTrends()).toEqual([])
  })

  it('groups sessions by week', () => {
    clearSessionHistory()
    // Same week (today, yesterday)
    seedSession(80, 0)
    seedSession(90, 1)
    const trends = computeWeeklyTrends()
    expect(trends.length).toBeGreaterThanOrEqual(1)
    const thisWeek = trends[trends.length - 1]
    expect(thisWeek.sessionCount).toBe(2)
    expect(thisWeek.avgScore).toBe(85)
  })

  it('caps at requested number of weeks', () => {
    clearSessionHistory()
    for (let i = 0; i < 100; i++) seedSession(70, i * 7) // one per week for 100 weeks
    expect(computeWeeklyTrends(4).length).toBeLessThanOrEqual(4)
  })
})

describe('computeMonthlyTrends', () => {
  it('returns empty array when no sessions', () => {
    clearSessionHistory()
    expect(computeMonthlyTrends()).toEqual([])
  })

  it('groups by month key', () => {
    clearSessionHistory()
    seedSession(100, 0)
    const trends = computeMonthlyTrends()
    expect(trends.length).toBeGreaterThanOrEqual(1)
  })
})

describe('computeRollingAverage', () => {
  it('returns null for last5 when fewer than 5 sessions', () => {
    clearSessionHistory()
    seedSession(80, 0)
    seedSession(90, 1)
    expect(computeRollingAverage().last5).toBeNull()
  })

  it('computes last5 average when 5+ sessions exist', () => {
    clearSessionHistory()
    for (let i = 0; i < 5; i++) seedSession(80, i)
    expect(computeRollingAverage().last5).toBe(80)
  })

  it('returns null for last10 when fewer than 10 sessions', () => {
    clearSessionHistory()
    for (let i = 0; i < 5; i++) seedSession(80, i)
    expect(computeRollingAverage().last10).toBeNull()
  })
})

describe('computeImprovementRate', () => {
  it('returns null when fewer than 2 weeks of data', () => {
    clearSessionHistory()
    seedSession(80, 0)
    expect(computeImprovementRate()).toBeNull()
  })

  it('returns positive slope for improving scores', () => {
    clearSessionHistory()
    // Scores improving over last 3 weeks
    seedSession(50, 21) // 3 weeks ago
    seedSession(100, 0) // today
    const rate = computeImprovementRate()
    expect(rate).not.toBeNull()
    expect(rate!).toBeGreaterThan(0)
  })
})

describe('computePracticeStats', () => {
  it('returns zeroes when no sessions', () => {
    clearSessionHistory()
    const stats = computePracticeStats()
    expect(stats.totalSessions).toBe(0)
    expect(stats.bestScore).toBe(0)
    expect(stats.overallAvg).toBe(0)
  })

  it('correctly identifies best and worst scores', () => {
    clearSessionHistory()
    seedSession(40, 5)
    seedSession(95, 2)
    seedSession(70, 0)
    const stats = computePracticeStats()
    expect(stats.bestScore).toBe(95)
    expect(stats.worstScore).toBe(40)
  })

  it('computes overall average from all sessions', () => {
    clearSessionHistory()
    seedSession(50, 2)
    seedSession(100, 0)
    expect(computePracticeStats().overallAvg).toBe(75)
  })
})

describe('computePerExerciseStats', () => {
  it('returns empty array when no history', () => {
    clearExerciseHistory()
    expect(computePerExerciseStats()).toEqual([])
  })

  it('groups stats per exercise type', () => {
    clearExerciseHistory()
    recordExerciseResult({
      type: 'long-note',
      score: 80,
      metrics: {},
      completedAt: Date.now(),
    })
    recordExerciseResult({
      type: 'long-note',
      score: 90,
      metrics: {},
      completedAt: Date.now(),
    })
    recordExerciseResult({
      type: 'vibrato',
      score: 50,
      metrics: {},
      completedAt: Date.now(),
    })
    const stats = computePerExerciseStats()
    expect(stats.length).toBe(2)
    const longNote = stats.find((s) => s.type === 'long-note')
    expect(longNote?.totalPlays).toBe(2)
    expect(longNote?.bestScore).toBe(90)
    expect(longNote?.lastScore).toBe(90) // newest first, second insert (90) is entries[0]
  })
})
