// ============================================================
// weakness-analyzer.test.ts — weakness detection
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  findWeakExercises,
  findWeakIntervals,
  findWeakPitches,
  generateWeaknessReport,
  hasWeaknesses,
} from '@/features/practice-intelligence/weakness-analyzer'
import { clearExerciseHistory, recordExerciseResult, } from '@/stores/exercise-history-store'
import { setSessionResults } from '@/stores/practice-session-store'

function clearAll() {
  clearExerciseHistory()
  setSessionResults([])
}

function seedExercise(type: string, score: number) {
  recordExerciseResult({
    type: type as never,
    score,
    metrics: {},
    completedAt: Date.now(),
  })
}

function seedSessionWithNotes(noteResults: { midi: number; avgCents: number }[]) {
  setSessionResults((prev) => [
    {
      name: 'Test',
      score: 60,
      itemsCompleted: noteResults.length,
      sessionName: 'Test',
      completedAt: Date.now(),
      practiceItemResult: [
        {
          score: 60,
          noteCount: noteResults.length,
          avgCents: 25,
          itemsCompleted: noteResults.length,
          name: 'Test',
          mode: 'once',
          completedAt: Date.now(),
          noteResult: noteResults.map((n) => ({
            item: {
              id: 0,
              note: { midi: n.midi, name: 'C', octave: 4, freq: 261 },
              duration: 1,
              startBeat: 0,
            },
            pitchFreq: 261,
            pitchCents: n.avgCents,
            time: 100,
            rating: 'good' as const,
            avgCents: n.avgCents,
            targetNote: 'C4',
          })),
        },
      ],
    },
    ...prev,
  ])
}

describe('findWeakExercises', () => {
  it('returns empty array when no history', () => {
    clearAll()
    expect(findWeakExercises()).toEqual([])
  })

  it('identifies exercises with low recent average', () => {
    clearAll()
    for (let i = 0; i < 10; i++) seedExercise('long-note', 40)
    const results = findWeakExercises()
    expect(results.length).toBe(1)
    expect(results[0].type).toBe('long-note')
    expect(results[0].recentAvg).toBe(40)
  })

  it('excludes exercises with high enough scores', () => {
    clearAll()
    for (let i = 0; i < 10; i++) seedExercise('long-note', 85)
    expect(findWeakExercises()).toEqual([])
  })

  it('sorts weakest first', () => {
    clearAll()
    for (let i = 0; i < 10; i++) {
      seedExercise('long-note', 30)
      seedExercise('vibrato', 60)
    }
    const results = findWeakExercises()
    expect(results[0].type).toBe('long-note') // 30 < 60
    expect(results[1].type).toBe('vibrato')
  })
})

describe('findWeakPitches', () => {
  it('returns empty array when no sessions', () => {
    clearAll()
    expect(findWeakPitches()).toEqual([])
  })

  it('identifies pitches with high deviation', () => {
    clearAll()
    // Need at least 3 occurrences per note for WEAK_PITCH_MIN_OCCURRENCES
    for (let i = 0; i < 4; i++) {
      seedSessionWithNotes([
        { midi: 60, avgCents: 35 },
        { midi: 64, avgCents: 5 },
        { midi: 67, avgCents: 45 },
      ])
    }
    const pitches = findWeakPitches()
    expect(pitches.length).toBe(2) // 60 (35¢) and 67 (45¢) are weak
    expect(pitches[0].midi).toBe(67) // worst first
  })

  it('requires minimum occurrences', () => {
    clearAll()
    seedSessionWithNotes([{ midi: 60, avgCents: 40 }])
    seedSessionWithNotes([{ midi: 60, avgCents: 40 }])
    // Only 2 occurrences — below threshold of 3
    expect(findWeakPitches()).toEqual([])
  })

  it('excludes pitches below cents threshold', () => {
    clearAll()
    for (let i = 0; i < 3; i++) {
      seedSessionWithNotes([{ midi: 60, avgCents: 5 }])
    }
    expect(findWeakPitches()).toEqual([])
  })
})

describe('findWeakIntervals', () => {
  it('returns empty array when no interval-trainer history', () => {
    clearAll()
    expect(findWeakIntervals()).toEqual([])
  })

  it('identifies weak interval categories', () => {
    clearAll()
    for (let i = 0; i < 5; i++) {
      recordExerciseResult({
        type: 'interval-trainer',
        score: 45,
        metrics: {
          smallIntervalAvg: 40,
          mediumIntervalAvg: 65, // above 60 threshold, not weak
          largeIntervalAvg: 30,
        },
        completedAt: Date.now(),
      })
    }
    const intervals = findWeakIntervals()
    expect(intervals.length).toBe(2) // small (40) and large (30) below 60; medium (65) is above threshold
    // Sorted worst first
    expect(intervals[0].category).toBe('large')
  })

  it('excludes categories with zero occurrences', () => {
    clearAll()
    recordExerciseResult({
      type: 'interval-trainer',
      score: 70,
      metrics: {
        smallIntervalAvg: 80,
        mediumIntervalAvg: 0, // zero = not practiced
        largeIntervalAvg: 0,
      },
      completedAt: Date.now(),
    })
    const intervals = findWeakIntervals()
    // Only small has data and it's above 60, so empty
    expect(intervals.length).toBe(0)
  })
})

describe('generateWeaknessReport', () => {
  it('returns empty report when no data', () => {
    clearAll()
    const report = generateWeaknessReport()
    expect(report.weakExercises).toEqual([])
    expect(report.weakPitches).toEqual([])
    expect(report.weakIntervals).toEqual([])
    expect(report.generatedAt).toBeGreaterThan(0)
  })
})

describe('hasWeaknesses', () => {
  it('returns false when no data', () => {
    clearAll()
    expect(hasWeaknesses()).toBe(false)
  })

  it('returns true when weak exercises exist', () => {
    clearAll()
    for (let i = 0; i < 10; i++) seedExercise('long-note', 40)
    expect(hasWeaknesses()).toBe(true)
  })
})
