// ============================================================
// drill-generator.test.ts — micro-drill generation
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  generateDrills,
  generateIntervalDrill,
  generatePrecisionDrill,
  generateRangeDrill,
  generateStaminaDrill,
} from '@/features/practice-intelligence/drill-generator'
import type {
  WeakExercise,
  WeakInterval,
  WeakPitch,
} from '@/features/practice-intelligence/weakness-analyzer'

describe('generatePrecisionDrill', () => {
  it('generates a drill for a weak exercise', () => {
    const exercise: WeakExercise = {
      type: 'long-note',
      recentAvg: 42,
      totalPlays: 12,
      trend: 'declining',
    }
    const drill = generatePrecisionDrill(exercise)
    expect(drill).not.toBeNull()
    expect(drill!.exerciseType).toBe('long-note')
    expect(drill!.config.difficulty).toBe(3) // default 5 - 2
    expect(drill!.reason).toContain('42%')
  })
})

describe('generateRangeDrill', () => {
  it('returns null for empty pitches', () => {
    expect(generateRangeDrill([])).toBeNull()
  })

  it('generates a scale-runner drill for weak pitches', () => {
    const pitches: WeakPitch[] = [
      { midi: 72, noteName: 'C5', avgDeviation: 35, occurrences: 5 },
      { midi: 67, noteName: 'G4', avgDeviation: 28, occurrences: 4 },
    ]
    const drill = generateRangeDrill(pitches)
    expect(drill).not.toBeNull()
    expect(drill!.exerciseType).toBe('scale-runner')
    expect(drill!.config.targetNote).toBe('C5')
    expect(drill!.reason).toContain('35')
  })

  it('handles single weak pitch', () => {
    const pitches: WeakPitch[] = [
      { midi: 60, noteName: 'C4', avgDeviation: 25, occurrences: 3 },
    ]
    const drill = generateRangeDrill(pitches)
    expect(drill).not.toBeNull()
    // Single pitch: no range text appended
    expect(drill!.reason).not.toContain('Range:')
  })
})

describe('generateIntervalDrill', () => {
  it('returns null for empty intervals', () => {
    expect(generateIntervalDrill([])).toBeNull()
  })

  it('generates a drill for the weakest interval category', () => {
    const intervals: WeakInterval[] = [
      {
        category: 'large',
        label: 'Large Intervals',
        range: '>8 semitones',
        accuracy: 30,
        occurrences: 5,
      },
    ]
    const drill = generateIntervalDrill(intervals)
    expect(drill).not.toBeNull()
    expect(drill!.exerciseType).toBe('interval-trainer')
    expect(drill!.reason).toContain('30%')
  })
})

describe('generateStaminaDrill', () => {
  it('returns null for empty pitches', () => {
    expect(generateStaminaDrill([])).toBeNull()
  })

  it('generates a long-note drill for the worst pitch', () => {
    const pitches: WeakPitch[] = [
      { midi: 72, noteName: 'C5', avgDeviation: 40, occurrences: 8 },
    ]
    const drill = generateStaminaDrill(pitches)
    expect(drill).not.toBeNull()
    expect(drill!.exerciseType).toBe('long-note')
    expect(drill!.config.targetNote).toBe('C5')
    expect(drill!.reason).toContain('40')
  })
})

describe('generateDrills', () => {
  it('returns empty array when no weaknesses', () => {
    expect(generateDrills([], [], [])).toEqual([])
  })

  it('caps at 4 drills maximum', () => {
    const exercises: WeakExercise[] = [
      { type: 'long-note', recentAvg: 40, totalPlays: 10, trend: 'declining' },
      { type: 'vibrato', recentAvg: 45, totalPlays: 8, trend: 'declining' },
      { type: 'slide', recentAvg: 50, totalPlays: 12, trend: 'stable' },
    ]
    const pitches: WeakPitch[] = [
      { midi: 72, noteName: 'C5', avgDeviation: 35, occurrences: 5 },
      { midi: 67, noteName: 'G4', avgDeviation: 28, occurrences: 4 },
      { midi: 60, noteName: 'C4', avgDeviation: 25, occurrences: 3 },
    ]
    const intervals: WeakInterval[] = [
      {
        category: 'large',
        label: 'Large Intervals',
        range: '>8 semitones',
        accuracy: 30,
        occurrences: 5,
      },
    ]
    const drills = generateDrills(exercises, pitches, intervals)
    expect(drills.length).toBeLessThanOrEqual(4)
  })

  it('includes precision drill first', () => {
    const exercises: WeakExercise[] = [
      { type: 'vibrato', recentAvg: 35, totalPlays: 10, trend: 'declining' },
    ]
    const drills = generateDrills(exercises, [], [])
    expect(drills.length).toBe(1)
    expect(drills[0].id).toContain('precision')
  })

  it('each drill has required fields', () => {
    const exercises: WeakExercise[] = [
      { type: 'long-note', recentAvg: 40, totalPlays: 10, trend: 'declining' },
    ]
    const drills = generateDrills(exercises, [], [])
    for (const drill of drills) {
      expect(drill.id).toBeTruthy()
      expect(drill.title).toBeTruthy()
      expect(drill.description).toBeTruthy()
      expect(drill.exerciseType).toBeTruthy()
      expect(drill.config).toBeDefined()
      expect(drill.reason).toBeTruthy()
      expect(drill.icon).toBeDefined()
    }
  })
})
