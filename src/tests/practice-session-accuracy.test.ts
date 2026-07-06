// ============================================================
// practice-session-accuracy.test.ts — note-accuracy projection
// used by the pitch-accuracy heatmap (getNoteAccuracyMap) and the
// decoupled collectNoteAccuracySamples() accessor.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { collectNoteAccuracySamples, getNoteAccuracyMap, setSessionResults, } from '@/stores/practice-session-store'
import type { SessionResult } from '@/types'
import { seedSessionWithNotes } from './utils/session-fixtures'

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

  it('skips malformed entries instead of throwing or leaking NaN', () => {
    // Persisted history loads via a bare JSON.parse (no schema validator),
    // so a stale/hand-edited entry can be missing item/note or carry a
    // non-numeric value. These must be dropped, not crash both consumers.
    setSessionResults([
      {
        name: 'Corrupt',
        score: 0,
        itemsCompleted: 3,
        sessionName: 'Corrupt',
        completedAt: Date.now(),
        practiceItemResult: [
          {
            score: 0,
            noteCount: 3,
            avgCents: 0,
            itemsCompleted: 3,
            name: 'Corrupt',
            mode: 'once',
            completedAt: Date.now(),
            // Intentionally malformed shapes an older/edited history could hold.
            noteResult: [
              { avgCents: 12 }, // missing item/note entirely
              {
                item: { id: 0, note: {}, duration: 1, startBeat: 0 },
                avgCents: 8,
              }, // note present but no midi
              {
                item: {
                  id: 0,
                  note: { midi: 64, name: 'E', octave: 4, freq: 329 },
                  duration: 1,
                  startBeat: 0,
                },
                avgCents: Number.NaN, // non-numeric deviation
              },
            ] as unknown as SessionResult['practiceItemResult'][number]['noteResult'],
          },
        ],
      },
    ])
    // The one well-formed note (below) survives; the three malformed ones don't.
    seedSessionWithNotes([{ midi: 60, avgCents: 3 }])

    expect(() => collectNoteAccuracySamples()).not.toThrow()
    expect(collectNoteAccuracySamples()).toEqual([{ midi: 60, avgCents: 3 }])
    // NaN never reaches the averaged scores.
    const map = getNoteAccuracyMap()
    expect(map.get(60)).toBe(100)
    expect(map.has(64)).toBe(false)
  })
})

describe('getNoteAccuracyMap', () => {
  it('returns an empty map when there is no history', () => {
    expect(getNoteAccuracyMap().size).toBe(0)
  })

  it('scores each note and averages per midi across sessions', () => {
    // Scoring is by |avgCents|: <= 5 -> 100, else max(0, 100 - (|c| - 5) * 5).
    // Production avgCents is a non-negative magnitude; the negatives here also
    // exercise the defensive Math.abs (same score either sign).
    // Session B (seeded last -> iterated first): 60@10, 64@-10, 67@30, 72@-3
    seedSessionWithNotes([
      { midi: 60, avgCents: 10 },
      { midi: 64, avgCents: -10 },
      { midi: 67, avgCents: 30 },
      { midi: 72, avgCents: -3 },
    ])
    // Session A: 60@-20
    seedSessionWithNotes([{ midi: 60, avgCents: -20 }])

    const map = getNoteAccuracyMap()
    // midi 60: 10¢ -> 100 - 25 = 75, 20¢ -> 100 - 75 = 25; avg = 50
    expect(map.get(60)).toBe(50)
    // midi 64: 10¢ -> 100 - 25 = 75
    expect(map.get(64)).toBe(75)
    // midi 67: 30¢ -> max(0, 100 - 125) = 0
    expect(map.get(67)).toBe(0)
    // midi 72: 3¢ -> 100 (within the +-5¢ tolerance)
    expect(map.get(72)).toBe(100)
  })

  it('scores by magnitude — the defensive abs treats either sign the same', () => {
    seedSessionWithNotes([
      { midi: 60, avgCents: 12 },
      { midi: 64, avgCents: -12 }, // same magnitude, hypothetical signed input
    ])
    const map = getNoteAccuracyMap()
    // both: 100 - (12 - 5) * 5 = 65
    expect(map.get(60)).toBe(65)
    expect(map.get(64)).toBe(65)
  })
})
