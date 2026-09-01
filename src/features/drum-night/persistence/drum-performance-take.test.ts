// Drum performance take tests — replay metadata stays scalar and evidence-honest.

import { describe, expect, it, vi } from 'vitest'
import { drumPerformanceTakeComparisonKey, drumPerformanceTakeContext, drumPerformanceTakeMetrics, keepDrumPerformanceTake, } from './drum-performance-take'
import type { DrumTakeSummary } from './drum-take-summary'

function summary(overrides: Partial<DrumTakeSummary> = {}): DrumTakeSummary {
  return {
    schemaVersion: 1,
    id: 'take-1',
    projectId: 'project-1',
    projectRevision: 2,
    projectFingerprint: 'drum-v1-0123456789abcdef',
    completedAt: '2026-08-26T11:00:00.000Z',
    variationId: 'source',
    startBeat: 0,
    endBeat: 8,
    tempoBpm: 84,
    speedScale: 1,
    inputSources: ['keyboard', 'midi'],
    evidencePolicy: {
      version: 1,
      matchWindowMs: 120,
      centredWindowMs: 30,
      minimumConfidence: 0.55,
      minimumMatchedHits: 2,
    },
    status: 'ready',
    evidenceScope: 'timing-and-dynamics',
    confidence: 0.9,
    targetHitCount: 8,
    capturedHitCount: 7,
    omittedCaptureHitCount: 0,
    matchedHitCount: 6,
    unmatchedTargetCount: 2,
    unmatchedCaptureCount: 1,
    uncertainTimingCount: 1,
    earlyCount: 1,
    centredCount: 3,
    lateCount: 1,
    meanTimingOffsetMs: -2,
    meanAbsoluteTimingOffsetMs: 18,
    meanVelocityOffset: 3,
    meanAbsoluteVelocityOffset: 7,
    recovery: { focus: 'timing', barNumber: 2 },
    ...overrides,
  }
}

describe('Drum Hear Yourself performance take', () => {
  it('uses one stable saved-groove comparison key across attempts', () => {
    const first = summary()
    const second = summary({
      id: 'take-2',
      completedAt: '2026-08-26T12:00:00.000Z',
      matchedHitCount: 5,
      unmatchedTargetCount: 3,
      unmatchedCaptureCount: 2,
      uncertainTimingCount: 0,
      earlyCount: 2,
      centredCount: 2,
      lateCount: 1,
    })

    expect(drumPerformanceTakeComparisonKey(first)).toBe(
      drumPerformanceTakeComparisonKey(second),
    )
    expect(drumPerformanceTakeComparisonKey(first)).toBe(
      'drum-night:v1:drum-v1-0123456789abcdef:source:0:8',
    )
  })

  it('projects only validated summary context and exact scalar evidence', () => {
    const takeSummary = summary()
    const context = drumPerformanceTakeContext(takeSummary)
    const metrics = drumPerformanceTakeMetrics(takeSummary)

    expect(context).toEqual({
      kind: 'drum-night-take-summary',
      summarySchemaVersion: 1,
      summaryId: 'take-1',
      projectId: 'project-1',
      projectRevision: 2,
      projectFingerprint: 'drum-v1-0123456789abcdef',
      variationId: 'source',
      startBeat: 0,
      endBeat: 8,
      tempoBpm: 84,
      speedScale: 1,
      inputSources: ['keyboard', 'midi'],
      evidencePolicy: takeSummary.evidencePolicy,
    })
    expect(metrics).toEqual({
      status: 'ready',
      evidenceScope: 'timing-and-dynamics',
      confidence: 0.9,
      targetHitCount: 8,
      capturedHitCount: 7,
      omittedCaptureHitCount: 0,
      matchedHitCount: 6,
      unmatchedTargetCount: 2,
      unmatchedCaptureCount: 1,
      uncertainTimingCount: 1,
      earlyCount: 1,
      centredCount: 3,
      lateCount: 1,
      meanTimingOffsetMs: -2,
      meanAbsoluteTimingOffsetMs: 18,
      meanVelocityOffset: 3,
      meanAbsoluteVelocityOffset: 7,
      recoveryFocus: 'timing',
      recoveryBarNumber: 2,
    })
    expect(metrics).not.toHaveProperty('score')
    expect(metrics).not.toHaveProperty('accuracy')
    expect(metrics).not.toHaveProperty('grade')
    expect(JSON.stringify({ context, metrics })).not.toMatch(
      /rawHits|deviceId|gmKey|microphone|audio/i,
    )
  })

  it('keeps live-kit audio through the shared local performance boundary', async () => {
    const save = vi.fn(async () => ({
      ok: true as const,
      quotaExceeded: false,
      roomAvailable: true,
      value: {} as never,
    }))
    const audio = {
      blob: new Blob(['live-kit'], { type: 'audio/webm' }),
      durationMs: 1_250,
      peaks: new Float32Array([0.2, 1]),
      capturedAt: '2026-08-26T10:59:58.000Z',
    }

    await expect(
      keepDrumPerformanceTake(
        { summary: summary(), projectTitle: 'Backbeat Study', audio },
        save,
      ),
    ).resolves.toEqual({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'drum-night',
        comparisonKey: 'drum-night:v1:drum-v1-0123456789abcdef:source:0:8',
        title: 'Backbeat Study',
        audio,
        metrics: expect.objectContaining({
          matchedHitCount: 6,
          targetHitCount: 8,
        }),
      }),
    )
  })
})
