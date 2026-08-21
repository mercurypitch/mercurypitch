// Guitar Pro song projection tests — explicit all-or-nothing event budget.

import type * as alphaTab from '@coderline/alphatab'
import { describe, expect, it } from 'vitest'
import { GpSongProjectionLimitError, scoreToMidiSong } from './gp-to-midi-song'

function scoreWithTwoBars(): alphaTab.model.Score {
  return {
    tempo: 120,
    tracks: [],
    masterBars: [
      {
        start: 0,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
        tempoAutomations: [],
        calculateDuration: () => 3840,
      },
      {
        start: 3840,
        timeSignatureNumerator: 3,
        timeSignatureDenominator: 4,
        tempoAutomations: [],
        calculateDuration: () => 2880,
      },
    ],
  } as unknown as alphaTab.model.Score
}

describe('scoreToMidiSong event budget', () => {
  it('rejects the whole projection instead of returning a truncated song', () => {
    expect(() =>
      scoreToMidiSong(scoreWithTwoBars(), { maximumEvents: 1 }),
    ).toThrowError(
      expect.objectContaining({
        name: 'GpSongProjectionLimitError',
        maximumEvents: 1,
      }),
    )
    expect(() =>
      scoreToMidiSong(scoreWithTwoBars(), { maximumEvents: 1 }),
    ).toThrow(GpSongProjectionLimitError)
  })

  it('keeps the existing unbounded projection default for other callers', () => {
    expect(scoreToMidiSong(scoreWithTwoBars()).timeSignatures).toEqual([
      { beat: 0, numerator: 4, denominator: 4 },
      { beat: 4, numerator: 3, denominator: 4 },
    ])
  })
})
