// Drum take summary tests — privacy, aggregates and omitted-only completion.

import { describe, expect, it } from 'vitest'
import type { DrumTakeSummary } from './drum-take-summary'
import { DRUM_TAKE_SUMMARY_MAX_BYTES, normalizeDrumTakeSummary, validateDrumTakeSummary, } from './drum-take-summary'

function readySummary(
  overrides: Partial<DrumTakeSummary> = {},
): DrumTakeSummary {
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

describe('Drum take summary persistence', () => {
  it('validates one bounded scalar-only completed summary', () => {
    expect(validateDrumTakeSummary(readySummary())).toEqual(readySummary())
  })

  it('normalizes, deduplicates and sorts semantic input kinds', () => {
    const normalized = normalizeDrumTakeSummary(
      readySummary({ inputSources: ['touch', 'midi', 'touch', 'keyboard'] }),
    )
    expect(normalized.inputSources).toEqual(['keyboard', 'midi', 'touch'])
  })

  it('allows an omitted-only finished take as no-captures', () => {
    const summary = readySummary({
      status: 'no-captures',
      evidenceScope: 'timing-only',
      confidence: null,
      inputSources: [],
      capturedHitCount: 0,
      omittedCaptureHitCount: 3,
      matchedHitCount: 0,
      unmatchedTargetCount: 8,
      unmatchedCaptureCount: 0,
      uncertainTimingCount: 0,
      earlyCount: 0,
      centredCount: 0,
      lateCount: 0,
      meanTimingOffsetMs: null,
      meanAbsoluteTimingOffsetMs: null,
      meanVelocityOffset: null,
      meanAbsoluteVelocityOffset: null,
      recovery: null,
    })
    expect(validateDrumTakeSummary(summary)).toEqual(summary)
    expect(() =>
      validateDrumTakeSummary({ ...summary, omittedCaptureHitCount: 0 }),
    ).toThrow()
  })

  it('rejects raw/private fields, future rows and contradictory aggregates', () => {
    expect(() =>
      validateDrumTakeSummary({
        ...readySummary(),
        rawHits: [{ midi: 38, deviceId: 'private' }],
      }),
    ).toThrow()
    expect(() =>
      validateDrumTakeSummary({ ...readySummary(), schemaVersion: 2 }),
    ).toThrow()
    expect(() =>
      validateDrumTakeSummary({
        ...readySummary(),
        unmatchedTargetCount: 3,
      }),
    ).toThrow()
    expect(() =>
      validateDrumTakeSummary({
        ...readySummary(),
        meanAbsoluteTimingOffsetMs: 1,
      }),
    ).toThrow()
  })

  it('requires quarter-beat ranges and canonical input ordering', () => {
    expect(() =>
      validateDrumTakeSummary({ ...readySummary(), startBeat: 0.1 }),
    ).toThrow()
    expect(() =>
      validateDrumTakeSummary({
        ...readySummary(),
        inputSources: ['midi', 'keyboard'],
      }),
    ).toThrow()
  })

  it('rejects a JSON row beyond the 16 KiB privacy ceiling', () => {
    const oversized = {
      ...readySummary(),
      padding: 'x'.repeat(DRUM_TAKE_SUMMARY_MAX_BYTES),
    }
    expect(
      new TextEncoder().encode(JSON.stringify(oversized)).byteLength,
    ).toBeGreaterThan(DRUM_TAKE_SUMMARY_MAX_BYTES)
    expect(() => validateDrumTakeSummary(oversized)).toThrow()
  })
})
