// ============================================================
// Song tempo record — what is read back of a stored tempo
// ============================================================

import { describe, expect, it } from 'vitest'
import { parseSongTempoRecord } from './song-tempo-record'

describe('parseSongTempoRecord', () => {
  it('keeps an estimate and a typed tempo', () => {
    const record = {
      estimate: { bpm: 92, confidence: 0.3 },
      typedBpm: 100,
    }
    expect(parseSongTempoRecord(record)).toEqual(record)
  })

  it('keeps an estimate that found no tempo apart from one that never ran', () => {
    expect(parseSongTempoRecord({ estimate: null })).toEqual({
      estimate: null,
    })
    expect(parseSongTempoRecord({ typedBpm: 100 })).toEqual({
      typedBpm: 100,
    })
  })

  it.each([
    ['not an object', 'fast'],
    ['null', null],
    ['a NaN estimate', { estimate: { bpm: Number.NaN, confidence: 0.3 } }],
    ['a negative typed tempo', { typedBpm: -4 }],
    ['an estimate with no confidence', { estimate: { bpm: 92 } }],
  ])('reads %s as no record', (_label, value) => {
    expect(parseSongTempoRecord(value)).toBeUndefined()
  })
})
