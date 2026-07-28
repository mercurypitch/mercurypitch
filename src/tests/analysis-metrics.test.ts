// ============================================================
// Analysis metrics — only what practice records can honestly support
// ============================================================

import { describe, expect, it } from 'vitest'
import { buildPracticeMetrics, buildTrend, centsBiasLabel, } from '@/features/analysis/metrics'
import type { AccuracyRating, NoteResult, SessionResult } from '@/types'

function makeNote(
  midi: number,
  avgCents: number,
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
    pitchCents: avgCents,
    time: 500,
    rating,
    avgCents,
    targetNote: 'C4',
  } as NoteResult
}

function makeSession(
  notes: NoteResult[],
  overrides: Partial<SessionResult> = {},
): SessionResult {
  return {
    name: 'Warmup',
    sessionName: 'Warmup',
    score: 80,
    itemsCompleted: notes.length,
    completedAt: 1_700_000_000_000,
    practiceItemResult: [
      {
        score: 80,
        noteCount: notes.length,
        avgCents: 0,
        itemsCompleted: notes.length,
        name: 'Warmup',
        mode: 'once',
        completedAt: 1_700_000_000_000,
        noteResult: notes,
      },
    ],
    ...overrides,
  } as SessionResult
}

describe('buildPracticeMetrics', () => {
  it('returns null when a session has no note results', () => {
    expect(
      buildPracticeMetrics(makeSession([], { practiceItemResult: [] })),
    ).toBeNull()
  })

  it('separates absolute error from directional bias', () => {
    // Equal and opposite errors: real average error is 20¢, bias is zero.
    const metrics = buildPracticeMetrics(
      makeSession([makeNote(60, -20), makeNote(62, 20)]),
    )

    expect(metrics?.avgAbsCents).toBe(20)
    expect(metrics?.centsBias).toBe(0)
  })

  it('detects a consistent flat bias', () => {
    const metrics = buildPracticeMetrics(
      makeSession([makeNote(60, -30), makeNote(62, -25), makeNote(64, -35)]),
    )

    expect(metrics?.centsBias).toBeLessThan(0)
    expect(centsBiasLabel(metrics!.centsBias)).toContain('flat')
  })

  it('counts notes within ±25¢ as in tune', () => {
    const metrics = buildPracticeMetrics(
      makeSession([
        makeNote(60, 5),
        makeNote(62, -24),
        makeNote(64, 60),
        makeNote(65, -80),
      ]),
    )

    expect(metrics?.inTunePercent).toBe(50)
  })

  it('reports the sung range from the melody notes', () => {
    const metrics = buildPracticeMetrics(
      makeSession([makeNote(60, 0), makeNote(72, 0), makeNote(64, 0)]),
    )

    expect(metrics?.rangeSemitones).toBe(12)
    expect(metrics?.lowNote).toBe('C4')
    expect(metrics?.highNote).toBe('C5')
  })

  it('tallies the rating distribution', () => {
    const metrics = buildPracticeMetrics(
      makeSession([
        makeNote(60, 0, 'perfect'),
        makeNote(62, 0, 'perfect'),
        makeNote(64, 0, 'off'),
      ]),
    )

    expect(metrics?.ratings.perfect).toBe(2)
    expect(metrics?.ratings.off).toBe(1)
    expect(metrics?.ratings.good).toBe(0)
  })
})

describe('centsBiasLabel', () => {
  it('calls a near-zero bias centred rather than a direction', () => {
    expect(centsBiasLabel(2)).toBe('Centred')
    expect(centsBiasLabel(-4.9)).toBe('Centred')
  })

  it('names the direction once the drift is real', () => {
    expect(centsBiasLabel(12)).toContain('sharp')
    expect(centsBiasLabel(-12)).toContain('flat')
  })
})

describe('buildTrend', () => {
  it('orders points oldest first regardless of input order', () => {
    const trend = buildTrend([
      makeSession([makeNote(60, 0)], { completedAt: 3000 }),
      makeSession([makeNote(60, 0)], { completedAt: 1000 }),
      makeSession([makeNote(60, 0)], { completedAt: 2000 }),
    ])

    expect(trend.map((p) => p.completedAt)).toEqual([1000, 2000, 3000])
  })

  it('skips sessions with no notes instead of plotting them as zero', () => {
    const trend = buildTrend([
      makeSession([makeNote(60, 0)], { completedAt: 1000 }),
      makeSession([], { completedAt: 2000, practiceItemResult: [] }),
    ])

    expect(trend).toHaveLength(1)
  })
})
