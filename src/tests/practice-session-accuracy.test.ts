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
    // Existing scoring: `avgCents >= -5 ? 100 : max(0, 100 - abs(avgCents)*5)`.
    // Only flat/negative deviations beyond -5¢ are penalized; anything >= -5¢
    // (incl. all sharp/positive deviations) scores 100.
    // Session B (seeded last -> iterated first): 60@-10, 67@30, 72@-14
    seedSessionWithNotes([
      { midi: 60, avgCents: -10 },
      { midi: 67, avgCents: 30 },
      { midi: 72, avgCents: -14 },
    ])
    // Session A: 60@-3, 64@-20
    seedSessionWithNotes([
      { midi: 60, avgCents: -3 },
      { midi: 64, avgCents: -20 },
    ])

    const map = getNoteAccuracyMap()
    // midi 60: -10¢ -> 100 - 50 = 50, -3¢ -> 100 (within tolerance); avg = 75
    expect(map.get(60)).toBe(75)
    // midi 64: -20¢ -> max(0, 100 - 100) = 0
    expect(map.get(64)).toBe(0)
    // midi 67: 30¢ -> 100 (positive deviations are never penalized)
    expect(map.get(67)).toBe(100)
    // midi 72: -14¢ -> 100 - 70 = 30
    expect(map.get(72)).toBe(30)
  })
})
