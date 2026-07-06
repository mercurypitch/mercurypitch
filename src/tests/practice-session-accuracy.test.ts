// ============================================================
// practice-session-accuracy.test.ts — note-accuracy projection
// used by the pitch-accuracy heatmap (getNoteAccuracyMap) and the
// decoupled collectNoteAccuracySamples() accessor.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { collectNoteAccuracySamples, getNoteAccuracyMap, setSessionResults, } from '@/stores/practice-session-store'

function seedSessionWithNotes(
  noteResults: { midi: number; avgCents: number }[],
) {
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

beforeEach(() => {
  setSessionResults([])
})

describe('collectNoteAccuracySamples', () => {
  it('returns empty when there is no session history', () => {
    expect(collectNoteAccuracySamples()).toEqual([])
  })

  it('flattens per-note midi + avgCents from the session history', () => {
    seedSessionWithNotes([
      { midi: 60, avgCents: 0 },
      { midi: 64, avgCents: 10 },
    ])
    expect(collectNoteAccuracySamples()).toEqual([
      { midi: 60, avgCents: 0 },
      { midi: 64, avgCents: 10 },
    ])
  })
})

describe('getNoteAccuracyMap', () => {
  it('returns an empty map when there is no history', () => {
    expect(getNoteAccuracyMap().size).toBe(0)
  })

  it('scores each note and averages per midi across sessions', () => {
    // Scoring: |avgCents| <= 5 -> 100, else max(0, 100 - (|avgCents| - 5) * 5).
    // Sharp and flat are penalized equally.
    // Session B (seeded last -> iterated first): 60@+10, 64@-10, 67@+30, 72@-3
    seedSessionWithNotes([
      { midi: 60, avgCents: 10 },
      { midi: 64, avgCents: -10 },
      { midi: 67, avgCents: 30 },
      { midi: 72, avgCents: -3 },
    ])
    // Session A: 60@-20
    seedSessionWithNotes([{ midi: 60, avgCents: -20 }])

    const map = getNoteAccuracyMap()
    // midi 60: +10¢ -> 100 - 25 = 75, -20¢ -> 100 - 75 = 25; avg = 50
    expect(map.get(60)).toBe(50)
    // midi 64: -10¢ -> 100 - 25 = 75
    expect(map.get(64)).toBe(75)
    // midi 67: +30¢ -> max(0, 100 - 125) = 0 (sharp notes ARE penalized now)
    expect(map.get(67)).toBe(0)
    // midi 72: -3¢ -> 100 (within the +-5¢ tolerance)
    expect(map.get(72)).toBe(100)
  })

  it('penalizes sharp and flat deviations symmetrically', () => {
    seedSessionWithNotes([
      { midi: 60, avgCents: 12 }, // sharp
      { midi: 64, avgCents: -12 }, // flat, same magnitude
    ])
    const map = getNoteAccuracyMap()
    // both: 100 - (12 - 5) * 5 = 65
    expect(map.get(60)).toBe(65)
    expect(map.get(64)).toBe(65)
  })
})
