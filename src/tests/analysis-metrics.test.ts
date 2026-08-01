// ============================================================
// Analysis metrics — only what practice records can honestly support
// ============================================================

import { describe, expect, it } from 'vitest'
import { buildPracticeMetrics, buildTrend } from '@/features/analysis/metrics'
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

  it('averages stored per-note error magnitudes as production writes them', () => {
    // finalizeNoteResult stores avgCents as mean(|cents|): always >= 0.
    // The metrics layer must treat it as an unsigned magnitude and expose
    // no sharp/flat direction derived from it.
    const metrics = buildPracticeMetrics(
      makeSession([makeNote(60, 30), makeNote(62, 10)]),
    )

    expect(metrics?.avgAbsCents).toBe(20)
    expect(metrics).not.toHaveProperty('centsBias')
  })

  it('skips malformed legacy rows instead of crashing or calling them perfect', () => {
    const missingNoteResult = {
      score: 50,
      noteCount: 1,
      avgCents: 0,
      itemsCompleted: 1,
      name: 'Old item',
      mode: 'once',
      completedAt: 1_600_000_000_000,
      // no noteResult array at all — pre-refactor records
    } as SessionResult['practiceItemResult'][number]

    const nanNote = makeNote(64, Number.NaN)
    const unratedNote = {
      ...makeNote(65, 40),
      rating: 'legacy-tier' as AccuracyRating,
    }
    const session = makeSession([makeNote(60, 10), nanNote, unratedNote])
    session.practiceItemResult.push(missingNoteResult)

    const metrics = buildPracticeMetrics(session)

    expect(metrics).not.toBeNull()
    // The NaN row is unmeasurable: it must not average as 0¢ or count as
    // in tune. Two measurable notes remain: 10¢ (in tune) and 40¢ (not).
    expect(metrics?.avgAbsCents).toBe(25)
    expect(metrics?.inTunePercent).toBe(50)
    // Unknown ratings don't invent buckets.
    expect(Object.keys(metrics!.ratings)).not.toContain('legacy-tier')
    expect(metrics?.noteCount).toBe(3)
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
