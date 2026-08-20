import { describe, expect, it } from 'vitest'
import type { ScoreAlignment } from '@/lib/transcription/score-alignment'
import { alignmentDriftSeconds, alignmentFromWindowOffsets, constantAlignment, createAudioToScoreClock, createScoreToAudioClock, IDENTITY_ALIGNMENT, normalizeAlignment, nudgeAlignment, } from '@/lib/transcription/score-alignment'

const measured = (
  ...anchors: Array<[audioSeconds: number, scoreSeconds: number]>
): ScoreAlignment => ({
  source: 'measured',
  anchors: anchors.map(([audioSeconds, scoreSeconds]) => ({
    audioSeconds,
    scoreSeconds,
  })),
})

describe('normalizeAlignment', () => {
  it('puts anchors in recording order', () => {
    const { anchors } = normalizeAlignment(measured([10, 12], [0, 0]))
    expect(anchors.map((anchor) => anchor.audioSeconds)).toEqual([0, 10])
  })

  it('drops an anchor that runs the score backwards', () => {
    // A window that matched the wrong repeat of a riff: later in the recording,
    // earlier in the score. Never a real measurement.
    const { anchors } = normalizeAlignment(measured([0, 12], [10, 4], [20, 22]))
    expect(anchors.map((anchor) => anchor.audioSeconds)).toEqual([0, 20])
  })

  it('drops a second anchor on the same instant', () => {
    const { anchors } = normalizeAlignment(measured([0, 0], [0, 1], [8, 8]))
    expect(anchors).toHaveLength(2)
  })

  it('drops anchors placed nowhere real', () => {
    const { anchors } = normalizeAlignment(
      measured([Number.NaN, 4], [0, Number.POSITIVE_INFINITY], [4, 4]),
    )
    expect(anchors).toEqual([{ audioSeconds: 4, scoreSeconds: 4 }])
  })

  it('keeps where the alignment came from', () => {
    expect(normalizeAlignment(constantAlignment(2)).source).toBe('manual')
  })
})

describe('alignmentFromWindowOffsets', () => {
  it('reads a window offset as the gap between the two clocks there', () => {
    const alignment = alignmentFromWindowOffsets([
      { startSeconds: 0, offsetSeconds: 1.5 },
      { startSeconds: 6, offsetSeconds: 1.8 },
    ])
    expect(alignment.anchors).toEqual([
      { audioSeconds: 0, scoreSeconds: 1.5 },
      { audioSeconds: 6, scoreSeconds: 7.8 },
    ])
    expect(alignment.source).toBe('measured')
  })

  it('has nothing to say when no window aligned', () => {
    expect(alignmentFromWindowOffsets([]).anchors).toEqual([])
  })
})

describe('the clocks', () => {
  it('leaves time alone when there is no alignment', () => {
    const toAudio = createScoreToAudioClock(IDENTITY_ALIGNMENT)
    expect(toAudio(42)).toBe(42)
    expect(createAudioToScoreClock(IDENTITY_ALIGNMENT)(42)).toBe(42)
  })

  it('shifts by a constant when only one moment is known', () => {
    const toAudio = createScoreToAudioClock(measured([10, 12]))
    expect(toAudio(12)).toBe(10)
    expect(toAudio(30)).toBe(28)
  })

  it('answers the first anchor for a time that is not a number', () => {
    expect(
      createScoreToAudioClock(measured([10, 12], [20, 23]))(Number.NaN),
    ).toBe(10)
    expect(createScoreToAudioClock(measured([10, 12]))(Number.NaN)).toBe(-2)
  })

  it('runs the line between two anchors', () => {
    // The score runs 10% long: 11 score seconds to 10 recording seconds.
    const toAudio = createScoreToAudioClock(measured([0, 0], [10, 11]))
    expect(toAudio(0)).toBe(0)
    expect(toAudio(5.5)).toBeCloseTo(5, 10)
    expect(toAudio(11)).toBeCloseTo(10, 10)
  })

  it('keeps drifting past the last anchor rather than freezing the offset', () => {
    // Freezing would put a 528 s score's last chorus eleven seconds out, which
    // is the exact failure the anchors exist to remove.
    const toAudio = createScoreToAudioClock(measured([0, 0], [10, 11]))
    expect(toAudio(22)).toBeCloseTo(20, 10)
  })

  it('extends the first segment backwards before the first anchor', () => {
    const toAudio = createScoreToAudioClock(measured([10, 11], [20, 22]))
    expect(toAudio(0)).toBeCloseTo(0, 10)
  })

  it('picks the segment a time actually falls in', () => {
    // Steady, then the recording and the score agree exactly.
    const toAudio = createScoreToAudioClock(
      measured([0, 0], [10, 11], [20, 21]),
    )
    expect(toAudio(5.5)).toBeCloseTo(5, 10)
    expect(toAudio(16)).toBeCloseTo(15, 10)
  })

  it('reads the same instant either way round', () => {
    const alignment = measured([0, 1], [30, 32], [60, 62.5])
    const toAudio = createScoreToAudioClock(alignment)
    const toScore = createAudioToScoreClock(alignment)
    for (const audioSeconds of [0, 7.25, 30, 45, 60, 90]) {
      expect(toAudio(toScore(audioSeconds))).toBeCloseTo(audioSeconds, 8)
    }
  })

  it('stays finite when two anchors claim the same instant', () => {
    // Two anchors at one moment would make the segment between them vertical.
    // Building the clock only from normalized anchors is what prevents it.
    const toAudio = createScoreToAudioClock({
      source: 'measured',
      anchors: [
        { audioSeconds: 0, scoreSeconds: 5 },
        { audioSeconds: 10, scoreSeconds: 5 },
      ],
    })
    expect(toAudio(5)).toBe(0)
    expect(toAudio(105)).toBe(100)
  })
})

describe('nudgeAlignment', () => {
  it('slides every anchor along the recording together', () => {
    const nudged = nudgeAlignment(measured([0, 0], [10, 11]), 0.5)
    expect(nudged.anchors.map((anchor) => anchor.audioSeconds)).toEqual([
      0.5, 10.5,
    ])
    expect(nudged.anchors.map((anchor) => anchor.scoreSeconds)).toEqual([0, 11])
  })

  it('keeps the measured drift instead of flattening it', () => {
    const before = measured([0, 0], [100, 102])
    expect(alignmentDriftSeconds(nudgeAlignment(before, 3))).toBeCloseTo(
      alignmentDriftSeconds(before),
      10,
    )
  })

  it('marks the result as a decision somebody made', () => {
    expect(nudgeAlignment(measured([0, 0], [10, 11]), 0.5).source).toBe(
      'manual',
    )
    expect(nudgeAlignment(measured([0, 0]), 0).source).toBe('manual')
    expect(nudgeAlignment(measured([0, 0]), Number.NaN).source).toBe('manual')
  })

  it('leaves the anchors alone for a nudge of nothing', () => {
    const before = measured([0, 0], [10, 11])
    expect(nudgeAlignment(before, 0).anchors).toEqual(before.anchors)
  })
})

describe('constantAlignment', () => {
  it('offers a flat offset as two anchors, so it is still a line', () => {
    const toAudio = createScoreToAudioClock(constantAlignment(2))
    expect(toAudio(2)).toBeCloseTo(0, 10)
    expect(toAudio(102)).toBeCloseTo(100, 10)
  })

  it('treats an offset that is not a number as no offset', () => {
    expect(createScoreToAudioClock(constantAlignment(Number.NaN))(5)).toBe(5)
  })

  it('can be marked as a measurement when that is what it is', () => {
    expect(constantAlignment(1, 'measured').source).toBe('measured')
  })
})

describe('alignmentDriftSeconds', () => {
  it('has no drift to report without two anchors', () => {
    expect(alignmentDriftSeconds(IDENTITY_ALIGNMENT)).toBe(0)
    expect(alignmentDriftSeconds(measured([0, 1]))).toBe(0)
  })

  it('measures how far the gap moved from first anchor to last', () => {
    // Dance of Death: 528 seconds of score against 517 of recording.
    expect(alignmentDriftSeconds(measured([0, 0], [517, 528]))).toBeCloseTo(
      11,
      10,
    )
  })

  it('reports a drift the same size whichever way it went', () => {
    expect(alignmentDriftSeconds(measured([0, 11], [517, 517]))).toBeCloseTo(
      11,
      10,
    )
  })
})
