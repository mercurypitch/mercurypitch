// Guitar Night score-note index tests protect dense-score lookup complexity.
// ============================================================

import { describe, expect, it } from 'vitest'
import { buildScoreNoteStartIndex, lowerBoundScoreNoteStart, nextScoreNoteStart, } from './score-note-index'

describe('score-note index', () => {
  it('keeps finite starts in authored-time order', () => {
    const index = buildScoreNoteStartIndex([
      { startBeat: 8 },
      { startBeat: Number.NaN },
      { startBeat: 2.5 },
      { startBeat: Number.POSITIVE_INFINITY },
      { startBeat: 2.5 },
      { startBeat: 0 },
    ])

    expect(index).toEqual([0, 2.5, 2.5, 8])
    expect(nextScoreNoteStart(index, 2.5)).toBe(2.5)
    expect(nextScoreNoteStart(index, 2.6)).toBe(8)
    expect(nextScoreNoteStart(index, 9)).toBeUndefined()
  })

  it('keeps a 2,245-note rehearsal lookup logarithmic without a timing gate', () => {
    const noteCount = 2_245
    const durationBeats = 1_254
    const samples = 13_350 // roughly 30 Hz across 1,254 beats at 169 BPM
    const index = buildScoreNoteStartIndex(
      Array.from({ length: noteCount }, (_, note) => ({
        startBeat: (note / (noteCount - 1)) * durationBeats,
      })),
    )
    let elementReads = 0
    const tracked = new Proxy(index, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^(?:0|[1-9]\d*)$/.test(property)) {
          elementReads += 1
        }
        return Reflect.get(target, property, receiver)
      },
    })

    for (let sample = 0; sample < samples; sample += 1) {
      const beat = (sample / (samples - 1)) * durationBeats
      const found = lowerBoundScoreNoteStart(tracked, beat)
      expect(index[found] === undefined || index[found] >= beat).toBe(true)
      expect(found === 0 || (index[found - 1] ?? beat) < beat).toBe(true)
    }

    const logarithmicReadCeiling =
      samples * (Math.ceil(Math.log2(noteCount + 1)) + 1)
    expect(elementReads).toBeLessThanOrEqual(logarithmicReadCeiling)
    expect(elementReads).toBeLessThan(samples * noteCount)
  })
})
