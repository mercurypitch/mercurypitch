// Run-kind taxonomy tests — the one place that decides what counts as what.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { SessionRecord } from '@/db/entities'
import type { SessionResult } from '@/types'
import type { ProgressRun } from './run-kinds'
import { bestScore, countRunsByKind, inTimeOrder, recentAverageScore, RUN_KINDS, runFromLocalResult, runFromRecord, runKindMeta, runKindOf, } from './run-kinds'

function record(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'r1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    userId: 'u1',
    melodyName: 'Warmup',
    startedAt: '2026-08-01T10:00:00.000Z',
    endedAt: '2026-08-01T10:05:00.000Z',
    score: 70,
    accuracy: 70,
    notesHit: 4,
    notesTotal: 4,
    streak: 1,
    results: [],
    ...over,
  } as SessionRecord
}

function local(over: Partial<SessionResult> = {}): SessionResult {
  return {
    sessionId: 's1',
    name: 'Warmup',
    sessionName: 'Warmup',
    completedAt: 1_700_000_000_000,
    itemsCompleted: 1,
    totalItems: 1,
    score: 60,
    practiceItemResult: [],
    ...over,
  } as SessionResult
}

describe('the taxonomy itself', () => {
  it('names every source the database can store', () => {
    // If a fifth SessionSource is added and not declared here, every surface
    // silently files it under practice. This is the test that notices.
    expect(RUN_KINDS.map((meta) => meta.kind)).toEqual([
      'practice',
      'exercise',
      'challenge',
      'weekly',
    ])
  })

  it('marks exactly the comparable kinds as ranked', () => {
    // Practice is free singing over a self-chosen melody, and an exercise is
    // fixed but not competed — neither can be ranked between people.
    expect(
      RUN_KINDS.filter((meta) => meta.ranked).map((meta) => meta.kind),
    ).toEqual(['challenge', 'weekly'])
  })

  it('gives every kind its own tone, so no two pills read alike', () => {
    const tones = RUN_KINDS.map((meta) => meta.tone)
    expect(new Set(tones).size).toBe(tones.length)
  })
})

describe('runKindOf', () => {
  it('passes a known source straight through', () => {
    expect(runKindOf('weekly')).toBe('weekly')
  })

  it('reads a missing source as practice, which is what old rows are', () => {
    // `source` post-dates the table. The entity comment is explicit that rows
    // without it are practice, so this is the oldest answer rather than a
    // guess.
    expect(runKindOf(undefined)).toBe('practice')
    expect(runKindOf(null)).toBe('practice')
  })

  it('does not invent a kind for a source it has never heard of', () => {
    expect(runKindOf('podcast' as never)).toBe('practice')
  })
})

describe('runKindMeta', () => {
  it('describes the kind asked for', () => {
    expect(runKindMeta('challenge').label).toBe('Challenge')
  })

  it('falls back to the first kind rather than returning nothing', () => {
    expect(runKindMeta('podcast' as never).kind).toBe('practice')
  })
})

describe('runFromRecord', () => {
  it('normalises a cloud row', () => {
    const run = runFromRecord(record({ source: 'exercise', score: 82 }))
    expect(run).toEqual({
      kind: 'exercise',
      score: 82,
      completedAt: Date.parse('2026-08-01T10:05:00.000Z'),
      hasNoteDetail: false,
    })
  })

  it('reports note detail when the row actually carries some', () => {
    const run = runFromRecord(
      record({ results: [{ noteResult: [] }] as never }),
    )
    expect(run?.hasNoteDetail).toBe(true)
  })

  it('drops a row whose end time cannot be read', () => {
    // Better absent than plotted at the epoch, which would drag every trend
    // line back to 1970.
    expect(runFromRecord(record({ endedAt: 'not a date' }))).toBeNull()
  })

  it('clamps a score the database should never have held', () => {
    expect(runFromRecord(record({ score: 140 }))?.score).toBe(100)
    expect(runFromRecord(record({ score: -5 }))?.score).toBe(0)
    expect(runFromRecord(record({ score: Number.NaN }))?.score).toBe(0)
  })
})

describe('runFromLocalResult', () => {
  it('files every local entry as practice', () => {
    // The signal has one writer, `endPracticeSession`, so this is true by
    // construction rather than by inspection.
    expect(runFromLocalResult(local())?.kind).toBe('practice')
  })

  it('sees the per-note detail a local run keeps', () => {
    const run = runFromLocalResult(
      local({
        practiceItemResult: [{ noteResult: [{ midi: 60 }] }] as never,
      }),
    )
    expect(run?.hasNoteDetail).toBe(true)
  })

  it('reports no detail when the items carry no notes', () => {
    const run = runFromLocalResult(
      local({ practiceItemResult: [{ noteResult: [] }] as never }),
    )
    expect(run?.hasNoteDetail).toBe(false)
  })

  it('survives an entry whose items are missing entirely', () => {
    const run = runFromLocalResult(
      local({ practiceItemResult: undefined as never }),
    )
    expect(run?.hasNoteDetail).toBe(false)
  })

  it('drops an entry with no readable completion time', () => {
    expect(runFromLocalResult(local({ completedAt: Number.NaN }))).toBeNull()
  })
})

describe('countRunsByKind', () => {
  it('counts each kind and keeps the empty ones', () => {
    // The row exists to answer "where did my work go". A kind that vanishes
    // when it is zero cannot answer that.
    const counts = countRunsByKind([
      runFromRecord(record({ source: 'exercise' }))!,
      runFromRecord(record({ source: 'exercise' }))!,
      runFromRecord(record({ source: 'weekly' }))!,
    ])

    expect(counts.map((entry) => [entry.meta.kind, entry.count])).toEqual([
      ['practice', 0],
      ['exercise', 2],
      ['challenge', 0],
      ['weekly', 1],
    ])
  })

  it('returns every kind at zero for no runs at all', () => {
    expect(countRunsByKind([]).every((entry) => entry.count === 0)).toBe(true)
  })
})

describe('inTimeOrder', () => {
  it('puts the oldest run first, which is how a trend is drawn', () => {
    const older = runFromRecord(record({ endedAt: '2026-08-01T10:00:00Z' }))!
    const newer = runFromRecord(record({ endedAt: '2026-08-09T10:00:00Z' }))!
    expect(inTimeOrder([newer, older])).toEqual([older, newer])
  })

  it('leaves the input alone', () => {
    const older = runFromRecord(record({ endedAt: '2026-08-01T10:00:00Z' }))!
    const newer = runFromRecord(record({ endedAt: '2026-08-09T10:00:00Z' }))!
    const input = [newer, older]
    inTimeOrder(input)
    expect(input).toEqual([newer, older])
  })
})

describe('bestScore', () => {
  it('takes the best across every kind, not just the ranked ones', () => {
    expect(
      bestScore([
        runFromRecord(record({ source: 'practice', score: 91 }))!,
        runFromRecord(record({ source: 'weekly', score: 44 }))!,
      ]),
    ).toBe(91)
  })

  it('is zero when nothing has been run', () => {
    expect(bestScore([])).toBe(0)
  })
})

describe('recentAverageScore', () => {
  const at = (score: number, day: number): ProgressRun => ({
    kind: 'practice',
    score,
    completedAt: day * 86_400_000,
    hasNoteDetail: false,
  })

  it('averages the newest runs, not the first ones it was handed', () => {
    // Deliberately unsorted: no caller should have to sort to be right.
    const runs = [at(10, 1), at(90, 9), at(20, 2), at(80, 8)]
    expect(recentAverageScore(runs, 2)).toBe(85)
  })

  it('averages everything when there are fewer runs than the window', () => {
    expect(recentAverageScore([at(40, 1), at(60, 2)], 5)).toBe(50)
  })

  it('rounds to a whole percent', () => {
    expect(recentAverageScore([at(50, 1), at(51, 2)], 5)).toBe(51)
  })

  it('is zero with no runs, for the view to hide rather than print', () => {
    expect(recentAverageScore([])).toBe(0)
  })

  it('treats a nonsense window as one run rather than dividing by zero', () => {
    expect(recentAverageScore([at(40, 1), at(70, 2)], 0)).toBe(70)
  })
})
