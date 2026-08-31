// ============================================================
// Performance Take Audio tests — bounded PCM replay preparation
// ============================================================

import { describe, expect, it } from 'vitest'
import { computeMonoPerformancePeaks, preparePcmPerformanceTake, } from '@/lib/performance-take-audio'

describe('computeMonoPerformancePeaks', () => {
  it('normalizes absolute peaks into a compact fixed-size envelope', () => {
    const peaks = computeMonoPerformancePeaks(
      new Float32Array([0.1, -0.25, 0.5, -1]),
      2,
    )

    expect(Array.from(peaks)).toEqual([0.25, 1])
  })

  it('returns a silent envelope for an empty input', () => {
    expect(
      Array.from(computeMonoPerformancePeaks(new Float32Array(), 3)),
    ).toEqual([0, 0, 0])
  })
})

describe('preparePcmPerformanceTake', () => {
  it('prepares a replayable WAV, duration, timestamp, and normalized peaks', () => {
    const prepared = preparePcmPerformanceTake({
      samples: new Float32Array([0, 0.5, -0.25, 0]),
      sampleRate: 2_000,
      capturedAt: '2026-08-31T12:00:00.000Z',
    })

    expect(prepared?.blob.type).toBe('audio/wav')
    expect(prepared?.blob.size).toBe(52)
    expect(prepared?.durationMs).toBe(2)
    expect(prepared?.capturedAt).toBe('2026-08-31T12:00:00.000Z')
    expect(Math.max(...(prepared?.peaks ?? []))).toBe(1)
  })

  it('rejects empty, silent, or invalid PCM evidence', () => {
    expect(
      preparePcmPerformanceTake({
        samples: new Float32Array(),
        sampleRate: 48_000,
        capturedAt: '2026-08-31T12:00:00.000Z',
      }),
    ).toBeNull()
    expect(
      preparePcmPerformanceTake({
        samples: new Float32Array([0, 0.00001]),
        sampleRate: 48_000,
        capturedAt: '2026-08-31T12:00:00.000Z',
      }),
    ).toBeNull()
    expect(
      preparePcmPerformanceTake({
        samples: new Float32Array([0.5]),
        sampleRate: Number.NaN,
        capturedAt: '2026-08-31T12:00:00.000Z',
      }),
    ).toBeNull()
  })
})
