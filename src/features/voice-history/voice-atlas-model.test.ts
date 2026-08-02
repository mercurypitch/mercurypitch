// ============================================================
// Voice Atlas Render Model tests — comparison geometry without invention
// ============================================================

import { describe, expect, it } from 'vitest'
import type { DecodedVoiceAtlasContour } from '@/lib/voice-contour'
import { buildVoiceAtlasRenderModel } from './voice-atlas-model'

interface TestPoint {
  timeMs: number
  midiCents: number | null
  confidence?: number
  level?: number
}

function contour(points: readonly TestPoint[]): DecodedVoiceAtlasContour {
  const pitches = points.flatMap((point) =>
    point.midiCents === null ? [] : [point.midiCents],
  )
  return {
    version: 1,
    source: 'f0-stream-yin-v1',
    sampleRateHz: 30,
    pitchRange:
      pitches.length === 0
        ? null
        : ([Math.min(...pitches), Math.max(...pitches)] as const),
    voicedRatio: points.length === 0 ? 0 : pitches.length / points.length,
    points: points.map((point) => ({
      timeMs: point.timeMs,
      midiCents: point.midiCents,
      confidence: point.confidence ?? 0.9,
      level: point.level ?? 0.5,
    })),
  }
}

describe('Voice Atlas render model', () => {
  it('uses one true-seconds domain without stretching the shorter take', () => {
    const model = buildVoiceAtlasRenderModel({
      earlier: {
        durationSeconds: 4,
        contour: contour([
          { timeMs: 0, midiCents: 6_000 },
          { timeMs: 4_000, midiCents: 6_200 },
        ]),
      },
      later: {
        durationSeconds: 8,
        contour: contour([
          { timeMs: 0, midiCents: 6_800 },
          { timeMs: 8_000, midiCents: 7_000 },
        ]),
      },
    })

    expect(model.availability).toBe('twin-trails')
    expect(model.durationSeconds).toBe(8)
    expect(model.earlier.points.at(-1)?.x).toBe(0.5)
    expect(model.later.points.at(-1)?.x).toBe(1)
    expect(model.pitchDomain).toEqual({
      minMidiCents: 5_800,
      maxMidiCents: 7_200,
    })
    expect(model.earlier.points[0].y).not.toBeNull()
    expect(model.later.points[0].y).not.toBeNull()
  })

  it('keeps unvoiced observations as gaps between drawable segments', () => {
    const model = buildVoiceAtlasRenderModel({
      earlier: {
        durationSeconds: 3,
        contour: contour([
          { timeMs: 0, midiCents: 6_900 },
          { timeMs: 1_000, midiCents: null },
          { timeMs: 2_000, midiCents: 7_100 },
        ]),
      },
      later: null,
    })

    expect(model.earlier.points[1]).toMatchObject({
      midiCents: null,
      y: null,
    })
    expect(model.earlier.segments).toHaveLength(2)
    expect(
      model.earlier.segments.map((segment) => segment.points.length),
    ).toEqual([1, 1])
  })

  it('does not bridge a capture stall into an invented pitch gesture', () => {
    const model = buildVoiceAtlasRenderModel({
      earlier: {
        durationSeconds: 4,
        contour: contour([
          { timeMs: 0, midiCents: 6_900 },
          { timeMs: 33, midiCents: 6_910 },
          { timeMs: 66, midiCents: 6_920 },
          { timeMs: 99, midiCents: 6_930 },
          { timeMs: 2_500, midiCents: 7_000 },
          { timeMs: 2_533, midiCents: 7_010 },
        ]),
      },
      later: null,
    })

    expect(model.earlier.segments).toHaveLength(2)
    expect(model.earlier.segments[0]).toMatchObject({
      startSeconds: 0,
      endSeconds: 0.099,
    })
    expect(model.earlier.segments[1]).toMatchObject({
      startSeconds: 2.5,
      endSeconds: 2.533,
    })
  })

  it('keeps low-confidence detections as energy without drawing pitch', () => {
    const model = buildVoiceAtlasRenderModel({
      earlier: {
        durationSeconds: 2,
        contour: contour([
          { timeMs: 0, midiCents: 6_900, confidence: 0.9 },
          { timeMs: 1_000, midiCents: 8_500, confidence: 0.2, level: 0.8 },
        ]),
      },
      later: null,
    })

    expect(model.earlier.points[1]).toMatchObject({
      midiCents: null,
      y: null,
      level: 1,
    })
    expect(model.pitchDomain?.maxMidiCents).toBeLessThan(8_500)
  })

  it('distinguishes one mapped contour from an older playable take', () => {
    const model = buildVoiceAtlasRenderModel({
      earlier: {
        durationSeconds: 5,
        contour: contour([{ timeMs: 0, midiCents: 6_900 }]),
      },
      later: { durationSeconds: 6, contour: null },
    })

    expect(model.availability).toBe('single-trail')
    expect(model.contourTrailCount).toBe(1)
    expect(model.voicedTrailCount).toBe(1)
    expect(model.earlier.state).toBe('mapped')
    expect(model.later.state).toBe('legacy')
  })

  it('marks a comparison with no contours as a legacy waveform archive', () => {
    const model = buildVoiceAtlasRenderModel({
      earlier: { durationSeconds: 4, contour: null },
      later: { durationSeconds: 7, contour: null },
    })

    expect(model).toMatchObject({
      availability: 'legacy',
      durationSeconds: 7,
      pitchDomain: null,
      contourTrailCount: 0,
      voicedTrailCount: 0,
    })
    expect(model.earlier.points).toEqual([])
    expect(model.later.points).toEqual([])
  })

  it('retains energy for a captured contour with no trustworthy pitch', () => {
    const model = buildVoiceAtlasRenderModel({
      earlier: {
        durationSeconds: 2,
        contour: contour([
          { timeMs: 0, midiCents: null, level: 0.1 },
          { timeMs: 1_000, midiCents: null, level: 0.4 },
        ]),
      },
      later: null,
    })

    expect(model.availability).toBe('energy-only')
    expect(model.earlier.state).toBe('energy-only')
    expect(model.pitchDomain).toBeNull()
    expect(model.pitchTicks).toEqual([])
    expect(model.earlier.segments).toEqual([])
    expect(model.earlier.points.map((point) => point.level)).toEqual([0.25, 1])
  })

  it('falls back to the waveform when expected analysis has no samples', () => {
    const model = buildVoiceAtlasRenderModel({
      earlier: {
        durationSeconds: 2,
        contour: contour([]),
        analysisExpected: true,
      },
      later: null,
    })

    expect(model.availability).toBe('unavailable')
    expect(model.earlier.state).toBe('unavailable')
    expect(model.earlier.points).toEqual([])
    expect(model.contourTrailCount).toBe(0)
  })

  it('distinguishes failed expected analysis from a legacy take', () => {
    const model = buildVoiceAtlasRenderModel({
      earlier: {
        durationSeconds: 2,
        contour: null,
        analysisExpected: true,
      },
      later: null,
    })

    expect(model.availability).toBe('unavailable')
    expect(model.earlier.state).toBe('unavailable')
  })

  it('normalizes level independently for each trail', () => {
    const model = buildVoiceAtlasRenderModel({
      earlier: {
        durationSeconds: 2,
        contour: contour([
          { timeMs: 0, midiCents: 6_900, level: 0.2 },
          { timeMs: 1_000, midiCents: 7_000, level: 0.4 },
        ]),
      },
      later: {
        durationSeconds: 2,
        contour: contour([
          { timeMs: 0, midiCents: 6_900, level: 0.1 },
          { timeMs: 1_000, midiCents: 7_000, level: 0.4 },
        ]),
      },
    })

    expect(model.earlier.points.map((point) => point.level)).toEqual([0.5, 1])
    expect(model.later.points.map((point) => point.level)).toEqual([0.25, 1])
    expect(model.earlier.observedPeakLevel).toBe(0.4)
    expect(model.later.observedPeakLevel).toBe(0.4)
  })
})
