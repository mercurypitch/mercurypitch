// ============================================================
// Trace model — layout rules per capability tier
//
// The load-bearing assertion is that a practice session is laid out from
// recorded per-note durations and never from an invented clock. The page this
// replaced synthesised timestamps as `i * 0.01` across concatenated sessions
// and then measured vibrato rate on them.
// ============================================================

import { describe, expect, it } from 'vitest'
import { buildTraceModel, notesToModel, padRange, resultsToModel, samplesToModel, } from '@/features/analysis/trace-model'
import type { LivePitchSample } from '@/lib/live-pitch-analysis'
import type { MergedNote } from '@/lib/midi-generator'
import type { AccuracyRating, NoteResult } from '@/types'

function note(midi: number, startSec: number, endSec: number): MergedNote {
  return { midi, noteName: 'C4', startSec, endSec }
}

function result(
  midi: number,
  timeMs: number,
  rating: AccuracyRating = 'good',
): NoteResult {
  return {
    item: {
      id: midi,
      note: { midi, name: 'C', octave: 4, freq: 261.63 },
      duration: 1,
      startBeat: 0,
    },
    pitchFreq: 261.63,
    pitchCents: 0,
    time: timeMs,
    rating,
    avgCents: 0,
    targetNote: 'C4',
  } as NoteResult
}

function sample(freq: number, timestamp: number): LivePitchSample {
  return {
    frequency: freq,
    clarity: 0.9,
    amplitude: 0.5,
    noteName: 'A4',
    timestamp,
  }
}

describe('padRange', () => {
  it('widens a narrow band so a monotone take is still readable', () => {
    const { low, high } = padRange(60, 60)
    expect(high - low).toBeGreaterThanOrEqual(8)
  })

  it('falls back to a sane band when the range is not finite', () => {
    expect(padRange(Infinity, -Infinity)).toEqual({ low: 48, high: 72 })
  })
})

describe('notesToModel', () => {
  it('positions notes on their real seconds', () => {
    const model = notesToModel([note(60, 0, 1), note(64, 3, 4)])

    expect(model.span).toBe(4)
    expect(model.bars[0].x).toBe(0)
    // Second note starts 3s into a 4s span.
    expect(model.bars[1].x).toBeCloseTo(75, 5)
  })

  it('widths track note duration', () => {
    const model = notesToModel([note(60, 0, 1), note(60, 1, 3)])

    expect(model.bars[1].width).toBeCloseTo(model.bars[0].width * 2, 5)
  })

  it('puts higher pitches nearer the top', () => {
    const model = notesToModel([note(48, 0, 1), note(72, 1, 2)])

    expect(model.bars[1].y).toBeLessThan(model.bars[0].y)
  })
})

describe('resultsToModel', () => {
  it('lays notes out by cumulative recorded duration, not a fabricated clock', () => {
    // 1s then 3s → the second note starts a quarter of the way in.
    const model = resultsToModel([result(60, 1000), result(62, 3000)])

    expect(model.bars[0].x).toBe(0)
    expect(model.bars[1].x).toBeCloseTo(25, 5)
    expect(model.span).toBe(4)
  })

  it('gives a longer note a wider bar', () => {
    const model = resultsToModel([result(60, 500), result(62, 2500)])

    expect(model.bars[1].width).toBeGreaterThan(model.bars[0].width)
  })

  it('falls back to an equal slot when a duration is missing', () => {
    const model = resultsToModel([result(60, 0), result(62, 0)])

    expect(model.bars[0].x).toBe(0)
    expect(model.bars[1].x).toBeCloseTo(50, 5)
  })

  it('colours bars by rating rather than uniformly', () => {
    const model = resultsToModel([
      result(60, 1000, 'perfect'),
      result(62, 1000, 'off'),
    ])

    expect(model.bars[0].color).not.toBe(model.bars[1].color)
  })
})

describe('samplesToModel', () => {
  it('draws a contour across the captured timestamps', () => {
    const model = samplesToModel([
      sample(220, 0),
      sample(330, 1),
      sample(440, 2),
    ])

    expect(model.kind).toBe('path')
    expect(model.path.startsWith('M')).toBe(true)
    expect(model.span).toBe(2)
  })

  it('ignores unvoiced and low-clarity frames', () => {
    const model = samplesToModel([
      sample(220, 0),
      { ...sample(0, 1), clarity: 0 },
      sample(440, 2),
    ])

    // Two usable points → exactly one line segment.
    expect(model.path.match(/L/g)?.length).toBe(1)
  })

  it('returns an empty path when there is nothing voiced to draw', () => {
    const model = samplesToModel([{ ...sample(0, 0), clarity: 0 }])

    expect(model.path).toBe('')
  })
})

describe('buildTraceModel', () => {
  it('prefers detected notes over every weaker source', () => {
    const model = buildTraceModel({
      notes: [note(60, 0, 1)],
      results: [result(72, 1000)],
      samples: [sample(440, 0), sample(440, 1)],
    })

    expect(model?.kind).toBe('bars')
    expect(model?.span).toBe(1)
  })

  it('prefers practice results over live samples', () => {
    const model = buildTraceModel({
      results: [result(60, 2000)],
      samples: [sample(440, 0), sample(440, 5)],
    })

    expect(model?.span).toBe(2)
  })

  it('returns null when there is no source at all', () => {
    expect(buildTraceModel({})).toBeNull()
    expect(buildTraceModel({ notes: [], results: [], samples: [] })).toBeNull()
  })
})
