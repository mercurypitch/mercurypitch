// ============================================================
// Guitar score history tests — privacy, evidence, and storage bounds.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { GuitarLiveScoreDisplay } from './guitar-live-score'
import { GUITAR_SCORE_HISTORY_LIMIT, GUITAR_SCORE_HISTORY_MAX_BYTES, GUITAR_SCORE_HISTORY_STORAGE_KEY, loadGuitarScoreHistory, saveGuitarScoreTake, summarizeGuitarScoreTake, } from './guitar-score-history'

const COMPLETED_DISPLAY: GuitarLiveScoreDisplay = {
  phase: 'completed',
  basis: 'cumulative',
  score: 92,
  grade: 'A',
  rollingScore: 92,
  rollingGrade: 'A',
  cumulativeScore: 92,
  cumulativeGrade: 'A',
  currentStreak: 0,
  bestStreak: 3,
  targetCount: 6,
  totals: {
    judgedTargets: 5,
    hitTargets: 4,
    missedTargets: 1,
    skippedTargets: 1,
    points: 460,
    possiblePoints: 500,
  },
  evidenceStatus: 'complete',
  detectedGapCount: 0,
  recentJudgments: [
    {
      targetId: 'private-target-one',
      midi: 64,
      onsetFrame: 1_024,
      outcome: 'hit',
      score: 96,
      eventId: 'private-event-one',
      timingOffsetMs: -18,
      skipReason: null,
      reclaimedFrom: null,
    },
    {
      targetId: 'private-target-two',
      midi: 67,
      onsetFrame: 2_048,
      outcome: 'miss',
      score: 0,
      eventId: null,
      timingOffsetMs: null,
      skipReason: null,
      reclaimedFrom: null,
    },
    {
      targetId: 'private-target-three',
      midi: 69,
      onsetFrame: 3_072,
      outcome: 'skipped',
      score: null,
      eventId: null,
      timingOffsetMs: null,
      skipReason: 'fast-passage',
      reclaimedFrom: null,
    },
  ],
}

function completedSummary(savedAt = 1_725_000_000_000) {
  return summarizeGuitarScoreTake(
    COMPLETED_DISPLAY,
    {
      pieceLabel: 'Velvet Changes',
      trackLabel: 'Lead guitar',
      range: { startBeat: 4, endBeat: 8 },
      inputKind: 'interface',
      status: 'completed',
    },
    savedAt,
  )
}

describe('guitar score history', () => {
  beforeEach(() => localStorage.clear())

  it('reduces live evidence to objective scalar outcomes without raw identities', () => {
    const summary = completedSummary()

    expect(summary).toMatchObject({
      status: 'completed',
      pieceLabel: 'Velvet Changes',
      trackLabel: 'Lead guitar',
      range: { startBeat: 4, endBeat: 8 },
      inputKind: 'interface',
      score: 92,
      grade: 'A',
      counts: {
        targetCount: 6,
        judgedTargets: 5,
        hitTargets: 4,
        missedTargets: 1,
        skippedTargets: 1,
      },
      bestStreak: 3,
      recentOutcomes: [
        { outcome: 'hit', score: 96 },
        { outcome: 'miss', score: 0 },
        { outcome: 'skipped', score: null },
      ],
    })

    const serialized = JSON.stringify(summary)
    expect(serialized).not.toContain('private-event')
    expect(serialized).not.toContain('private-target')
    expect(serialized).not.toContain('eventId')
    expect(serialized).not.toContain('targetId')
    expect(serialized).not.toContain('onsetFrame')
    expect(serialized).not.toContain('timingOffsetMs')
    expect(serialized).not.toContain('midi')
  })

  it('presents a held score in memory but refuses to persist it', () => {
    const partial = summarizeGuitarScoreTake(
      {
        ...COMPLETED_DISPLAY,
        phase: 'active',
        basis: 'rolling-16',
      },
      {
        pieceLabel: 'Velvet Changes',
        trackLabel: 'Lead guitar',
        range: { startBeat: 4, endBeat: 8 },
        inputKind: 'microphone',
        status: 'partial',
      },
      1_725_000_000_001,
    )

    expect(partial?.status).toBe('partial')
    expect(partial?.basis).toBe('rolling-16')
    expect(
      partial === null ? null : saveGuitarScoreTake(localStorage, partial),
    ).toBeNull()
    expect(localStorage.getItem(GUITAR_SCORE_HISTORY_STORAGE_KEY)).toBeNull()
  })

  it('keeps the newest bounded completed takes and de-duplicates one save', () => {
    for (let index = 0; index < GUITAR_SCORE_HISTORY_LIMIT + 3; index += 1) {
      const summary = completedSummary(1_725_000_000_000 + index)
      expect(summary).not.toBeNull()
      if (summary !== null) saveGuitarScoreTake(localStorage, summary)
    }
    const newest = completedSummary(
      1_725_000_000_000 + GUITAR_SCORE_HISTORY_LIMIT + 2,
    )
    if (newest !== null) saveGuitarScoreTake(localStorage, newest)

    const history = loadGuitarScoreHistory(localStorage)
    expect(history).toHaveLength(GUITAR_SCORE_HISTORY_LIMIT)
    expect(history[0]?.savedAt).toBe(1_725_000_000_003)
    expect(history.at(-1)?.savedAt).toBe(
      1_725_000_000_000 + GUITAR_SCORE_HISTORY_LIMIT + 2,
    )
  })

  it('rejects oversized, versionless, impossible, and identity-bearing records', () => {
    localStorage.setItem(
      GUITAR_SCORE_HISTORY_STORAGE_KEY,
      'x'.repeat(GUITAR_SCORE_HISTORY_MAX_BYTES + 1),
    )
    expect(loadGuitarScoreHistory(localStorage)).toEqual([])

    const summary = completedSummary()
    expect(summary).not.toBeNull()
    if (summary === null) return

    localStorage.setItem(
      GUITAR_SCORE_HISTORY_STORAGE_KEY,
      JSON.stringify([{ ...summary, schemaVersion: 99 }]),
    )
    expect(loadGuitarScoreHistory(localStorage)).toEqual([])

    localStorage.setItem(
      GUITAR_SCORE_HISTORY_STORAGE_KEY,
      JSON.stringify([
        {
          ...summary,
          counts: { ...summary.counts, hitTargets: 99 },
        },
      ]),
    )
    expect(loadGuitarScoreHistory(localStorage)).toEqual([])

    localStorage.setItem(
      GUITAR_SCORE_HISTORY_STORAGE_KEY,
      JSON.stringify([{ ...summary, eventId: 'must-not-cross-boundary' }]),
    )
    expect(loadGuitarScoreHistory(localStorage)).toEqual([])

    localStorage.setItem(
      GUITAR_SCORE_HISTORY_STORAGE_KEY,
      JSON.stringify([{ ...summary, savedAt: Number.MAX_SAFE_INTEGER }]),
    )
    expect(loadGuitarScoreHistory(localStorage)).toEqual([])
  })

  it('treats blocked or throwing storage as an empty, non-fatal history', () => {
    const summary = completedSummary()
    expect(summary).not.toBeNull()
    if (summary === null) return
    const blocked = {
      getItem(): string | null {
        throw new Error('blocked')
      },
      setItem(): void {
        throw new Error('blocked')
      },
    }

    expect(loadGuitarScoreHistory(blocked)).toEqual([])
    expect(saveGuitarScoreTake(blocked, summary)).toBeNull()
  })
})
