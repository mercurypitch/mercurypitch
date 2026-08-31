// ============================================================
// Performance Take tests — local Night replay and score contracts
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceTakeRecord } from '@/db/entities'
import { keepInstrumentNightTake, parsePerformanceTakeScore, performanceTakeSourceLabel, takeSupportsVoiceAnalysis, } from '@/lib/domain/performance-take'

const { saveVoiceTakeMock } = vi.hoisted(() => ({
  saveVoiceTakeMock: vi.fn(),
}))

vi.mock('@/db/services/voice-take-service', () => ({
  saveVoiceTake: saveVoiceTakeMock,
}))

function take(
  source: VoiceTakeRecord['source'],
  metrics: Record<string, unknown>,
  overrides: Partial<VoiceTakeRecord> = {},
): VoiceTakeRecord {
  return {
    id: `${source}-take`,
    createdAt: '2026-08-31T12:00:00.000Z',
    updatedAt: '2026-08-31T12:00:00.000Z',
    source,
    comparisonKey: `${source}:fixture:v1`,
    contextVersion: 1,
    capturedAt: '2026-08-31T12:00:00.000Z',
    durationMs: 2_000,
    mimeType: 'audio/wav',
    sizeBytes: 128,
    peaks: [0.2, 0.8],
    title: 'Night take',
    favorite: false,
    contextJson: '{}',
    metricsJson: JSON.stringify(metrics),
    metricsVersion: 1,
    ...overrides,
  }
}

function readyDrumMetrics(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    status: 'ready',
    evidenceScope: 'timing-and-dynamics',
    confidence: 0.9,
    targetHitCount: 16,
    capturedHitCount: 15,
    omittedCaptureHitCount: 0,
    matchedHitCount: 14,
    unmatchedTargetCount: 2,
    unmatchedCaptureCount: 1,
    uncertainTimingCount: 0,
    earlyCount: 3,
    centredCount: 10,
    lateCount: 1,
    meanTimingOffsetMs: -8.4,
    meanAbsoluteTimingOffsetMs: 18,
    meanVelocityOffset: 4.7,
    meanAbsoluteVelocityOffset: 9,
    recoveryFocus: 'timing',
    recoveryBarNumber: 2,
    ...overrides,
  }
}

describe('performance take persistence', () => {
  beforeEach(() => {
    saveVoiceTakeMock.mockReset()
    saveVoiceTakeMock.mockResolvedValue({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
  })

  it('keeps prepared Night audio and versioned scalar context locally', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], {
      type: 'audio/wav',
    })

    await keepInstrumentNightTake({
      source: 'guitar-night',
      comparisonKey: 'guitar-night:song:lead:0-16:v1',
      title: 'Lead — Verse',
      audio: {
        blob,
        durationMs: 4_321,
        peaks: new Float32Array([0.1, 0.9]),
        capturedAt: '2026-08-31T12:00:00.000Z',
      },
      context: { threadTitle: 'Lead — Verse', trackId: 'lead' },
      metrics: { score: 88, grade: 'A' },
    })

    expect(saveVoiceTakeMock).toHaveBeenCalledWith({
      source: 'guitar-night',
      comparisonKey: 'guitar-night:song:lead:0-16:v1',
      contextVersion: 1,
      capturedAt: '2026-08-31T12:00:00.000Z',
      durationMs: 4_321,
      blob,
      peaks: new Float32Array([0.1, 0.9]),
      title: 'Lead — Verse',
      context: { threadTitle: 'Lead — Verse', trackId: 'lead' },
      metrics: { score: 88, grade: 'A' },
      metricsVersion: 1,
    })
  })
})

describe('performance take score summaries', () => {
  it('reads the existing Karaoke score contract', () => {
    expect(
      parsePerformanceTakeScore(
        take('karaoke', {
          accuracyPct: 90,
          grade: 'A',
          notesHit: 18,
          notesTotal: 20,
          averageCentsOff: 14,
          matchedSamples: 36,
          judgedSamples: 40,
        }),
      ),
    ).toEqual({
      eyebrow: 'Karaoke score',
      primaryValue: '90%',
      primaryLabel: 'pitch accuracy',
      grade: 'A',
      stats: [
        { label: 'Notes hit', value: '18/20' },
        { label: 'Average deviation', value: '±14¢' },
        { label: 'Samples matched', value: '36' },
      ],
    })
  })

  it('reads Guitar and Piano result metrics', () => {
    expect(
      parsePerformanceTakeScore(
        take('guitar-night', {
          score: 85.7,
          grade: 'A',
          hitTargets: 12,
          missedTargets: 2,
          skippedTargets: 1,
          bestStreak: 7,
          targetCount: 15,
          judgedTargets: 14,
          evidenceStatus: 'complete',
          detectedGapCount: 0,
          basis: 'cumulative',
        }),
      ),
    ).toMatchObject({
      eyebrow: 'Guitar Night score',
      primaryValue: '86',
      grade: 'A',
    })
    expect(
      parsePerformanceTakeScore(
        take('piano-night', {
          accuracyPercent: 93,
          score: 2_425,
          hits: 25,
          misses: 1,
          judgedNotes: 26,
          skippedNotes: 1,
          totalNotes: 27,
          bestStreak: 11,
          playedNoteCount: 25,
          capturedDurationMs: 4_000,
        }),
      ),
    ).toMatchObject({
      eyebrow: 'Piano Night score',
      primaryValue: '93%',
      grade: null,
    })
  })

  it('preserves Drum evidence instead of inventing a score or grade', () => {
    const summary = parsePerformanceTakeScore(
      take('drum-night', readyDrumMetrics()),
    )

    expect(summary).toEqual({
      eyebrow: 'Drum Night evidence',
      primaryValue: '14/16',
      primaryLabel: 'matched attacks',
      grade: null,
      stats: [
        { label: 'Mean timing', value: '-8 ms' },
        { label: 'Early', value: '3' },
        { label: 'Centred', value: '10' },
        { label: 'Late', value: '1' },
        { label: 'Mean velocity', value: '+5' },
      ],
    })
  })

  it('reads a valid no-captures Drum projection as evidence, not a score', () => {
    expect(
      parsePerformanceTakeScore(
        take(
          'drum-night',
          readyDrumMetrics({
            status: 'no-captures',
            evidenceScope: 'timing-only',
            confidence: null,
            capturedHitCount: 0,
            omittedCaptureHitCount: 1,
            matchedHitCount: 0,
            unmatchedTargetCount: 16,
            unmatchedCaptureCount: 0,
            uncertainTimingCount: 0,
            earlyCount: 0,
            centredCount: 0,
            lateCount: 0,
            meanTimingOffsetMs: null,
            meanAbsoluteTimingOffsetMs: null,
            meanVelocityOffset: null,
            meanAbsoluteVelocityOffset: null,
            recoveryFocus: null,
            recoveryBarNumber: null,
          }),
        ),
      ),
    ).toMatchObject({
      eyebrow: 'Drum Night evidence',
      primaryValue: '0/16',
      grade: null,
    })
  })

  it('preserves completed Guitar counts when the overall score is unavailable', () => {
    expect(
      parsePerformanceTakeScore(
        take('guitar-night', {
          score: null,
          grade: null,
          targetCount: 8,
          judgedTargets: 0,
          hitTargets: 0,
          missedTargets: 0,
          skippedTargets: 8,
          bestStreak: 0,
          evidenceStatus: 'event-gap',
          detectedGapCount: 1,
          basis: 'cumulative',
        }),
      ),
    ).toEqual({
      eyebrow: 'Guitar Night score',
      primaryValue: 'Unscored',
      primaryLabel: 'completed take',
      grade: null,
      stats: [
        { label: 'Hit', value: '0' },
        { label: 'Missed', value: '0' },
        { label: 'Skipped', value: '8' },
        { label: 'Best streak', value: '0' },
      ],
    })
  })

  it('fails closed for contradictory source score formulas', () => {
    expect(
      parsePerformanceTakeScore(
        take('karaoke', {
          accuracyPct: 91,
          grade: 'A',
          notesHit: 18,
          notesTotal: 20,
          averageCentsOff: 14,
          matchedSamples: 36,
          judgedSamples: 40,
        }),
      ),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take('karaoke', {
          accuracyPct: 90,
          grade: 'B',
          notesHit: 18,
          notesTotal: 20,
          averageCentsOff: 14,
          matchedSamples: 36,
          judgedSamples: 40,
        }),
      ),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take('guitar-night', {
          score: null,
          grade: 'D',
          targetCount: 4,
          judgedTargets: 0,
          hitTargets: 0,
          missedTargets: 0,
          skippedTargets: 4,
          bestStreak: 0,
          evidenceStatus: 'complete',
          detectedGapCount: 0,
          basis: 'cumulative',
        }),
      ),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take('guitar-night', {
          score: 100,
          grade: 'S',
          targetCount: 4,
          judgedTargets: 4,
          hitTargets: 0,
          missedTargets: 4,
          skippedTargets: 0,
          bestStreak: 0,
          evidenceStatus: 'complete',
          detectedGapCount: 0,
          basis: 'cumulative',
        }),
      ),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take('guitar-night', {
          score: 100,
          grade: 'S',
          targetCount: 3,
          judgedTargets: 3,
          hitTargets: 3,
          missedTargets: 0,
          skippedTargets: 0,
          bestStreak: 3,
          evidenceStatus: 'complete',
          detectedGapCount: 0,
          basis: 'cumulative',
        }),
      ),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take('guitar-night', {
          score: 100,
          grade: 'S',
          targetCount: 4,
          judgedTargets: 4,
          hitTargets: 4,
          missedTargets: 0,
          skippedTargets: 0,
          bestStreak: 4,
          evidenceStatus: 'event-gap',
          detectedGapCount: 0,
          basis: 'cumulative',
        }),
      ),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take('piano-night', {
          score: 100,
          accuracyPercent: 100,
          hits: 0,
          misses: 1,
          judgedNotes: 1,
          skippedNotes: 0,
          totalNotes: 1,
          bestStreak: 0,
          playedNoteCount: 1,
          capturedDurationMs: 1_000,
        }),
      ),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take('piano-night', {
          score: 70,
          accuracyPercent: 70,
          hits: 1,
          misses: 1,
          judgedNotes: 2,
          skippedNotes: 0,
          totalNotes: 2,
          bestStreak: 1,
          playedNoteCount: 1,
          capturedDurationMs: 1_000,
        }),
      ),
    ).toBeNull()
  })

  it('fails closed for incomplete or contradictory Drum projections', () => {
    expect(
      parsePerformanceTakeScore(
        take('drum-night', {
          matchedHitCount: 14,
          targetHitCount: 16,
          uncertainTimingCount: 0,
          earlyCount: 3,
          centredCount: 10,
          lateCount: 1,
          meanTimingOffsetMs: -8.4,
          meanVelocityOffset: 4.7,
        }),
      ),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take('drum-night', readyDrumMetrics({ meanAbsoluteTimingOffsetMs: 1 })),
      ),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take('drum-night', readyDrumMetrics({ evidenceScope: 'timing-only' })),
      ),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take(
          'drum-night',
          readyDrumMetrics({ status: 'insufficient-evidence' }),
        ),
      ),
    ).toBeNull()
  })

  it('fails closed for malformed, future, or unrelated score payloads', () => {
    expect(
      parsePerformanceTakeScore(take('guitar-night', {}, { metricsJson: '{' })),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take('guitar-night', { score: 90 }, { metricsVersion: 2 }),
      ),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(take('freeform', { score: 90 })),
    ).toBeNull()
    expect(
      parsePerformanceTakeScore(
        take('piano-night', {
          score: 100,
          accuracyPercent: 999,
          hits: 1,
          misses: 0,
          judgedNotes: 1,
          skippedNotes: 0,
          totalNotes: 1,
          bestStreak: 1,
          playedNoteCount: 1,
          capturedDurationMs: 1_000,
        }),
      ),
    ).toBeNull()
  })
})

describe('performance take capabilities', () => {
  it('labels each Night source and keeps it out of vocal analysis', () => {
    expect(performanceTakeSourceLabel('guitar-night')).toBe('Guitar Night')
    expect(performanceTakeSourceLabel('piano-night')).toBe('Piano Night')
    expect(performanceTakeSourceLabel('drum-night')).toBe('Drum Night')

    for (const source of [
      'guitar-night',
      'piano-night',
      'drum-night',
    ] as const) {
      expect(takeSupportsVoiceAnalysis(source)).toBe(false)
    }
    expect(takeSupportsVoiceAnalysis('karaoke')).toBe(true)
  })
})
