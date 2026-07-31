// ============================================================
// Live pitch analysis — adapter over vocal-analyzer
//
// This module no longer implements metrics of its own; the maths is tested
// in vocal-analyzer.test.ts. What matters here is the adaptation: voiced
// filtering, real-RMS intensity, and whether real spectral timbre is used
// in preference to approximations.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LivePitchSample, LiveSpectralTimbre, } from '@/lib/live-pitch-analysis'
import { analyzeLiveBuffer } from '@/lib/live-pitch-analysis'

function makeSample(overrides: Partial<LivePitchSample> = {}): LivePitchSample {
  return {
    frequency: 440,
    clarity: 0.9,
    amplitude: 0.5,
    noteName: 'A4',
    timestamp: 0,
    ...overrides,
  }
}

/** A steady note with optional sinusoidal pitch modulation (vibrato). */
function makeContour(
  baseFreq: number,
  modFreq: number,
  modDepthHz: number,
  durationSec: number,
  opts: { amplitude?: number; samplesPerSec?: number } = {},
): LivePitchSample[] {
  const rate = opts.samplesPerSec ?? 60
  const count = Math.floor(durationSec * rate)
  const out: LivePitchSample[] = []
  for (let i = 0; i < count; i++) {
    const t = i / rate
    out.push(
      makeSample({
        frequency: baseFreq + Math.sin(2 * Math.PI * modFreq * t) * modDepthHz,
        amplitude: opts.amplitude ?? 0.5,
        timestamp: t,
      }),
    )
  }
  return out
}

const STUB_TIMBRE: LiveSpectralTimbre = {
  breathiness: { hnrDb: 24.5, quality: 'resonant', efficiency: 65 },
  richness: {
    richnessScore: 71,
    harmonicCount: 9,
    harmonicProfile: [],
    quality: 'rich',
  },
  resonance: {
    dominantZone: 'mask',
    chestRatio: 0.2,
    maskRatio: 0.6,
    headRatio: 0.2,
    spectralCentroid: 1400,
  },
}

describe('analyzeLiveBuffer', () => {
  it('returns vocal-analyzer result shapes, not a parallel set', () => {
    const snapshot = analyzeLiveBuffer(makeContour(440, 5, 15, 2))

    // vocal-analyzer field names — the old duplicate types used
    // score/label/rate/zone and produced different numbers for the same audio.
    expect(typeof snapshot.breathiness.hnrDb).toBe('number')
    expect(typeof snapshot.breathiness.efficiency).toBe('number')
    expect(typeof snapshot.richness.richnessScore).toBe('number')
    expect(typeof snapshot.resonance.dominantZone).toBe('string')
    expect(typeof snapshot.vibrato.rateHz).toBe('number')
    expect(typeof snapshot.slides.totalTransitions).toBe('number')
  })

  it('handles an empty buffer without throwing', () => {
    const snapshot = analyzeLiveBuffer([])

    expect(snapshot.sampleCount).toBe(0)
    expect(snapshot.intensity.avgDb).toBe(-60)
    expect(snapshot.breathiness).toBeDefined()
    expect(snapshot.vibrato).toBeDefined()
    expect(snapshot.resonance).toBeDefined()
  })

  it('counts every frame, voiced or not, as sampleCount', () => {
    const samples = [
      makeSample({ timestamp: 0 }),
      makeSample({ frequency: 0, clarity: 0, timestamp: 0.1 }),
      makeSample({ timestamp: 0.2 }),
    ]

    expect(analyzeLiveBuffer(samples).sampleCount).toBe(3)
  })

  it('drives intensity from real RMS amplitude', () => {
    const loud = analyzeLiveBuffer(
      makeContour(440, 0, 0, 1, { amplitude: 0.8 }),
    )
    const quiet = analyzeLiveBuffer(
      makeContour(440, 0, 0, 1, { amplitude: 0.05 }),
    )

    expect(loud.intensity.avgDb).toBeGreaterThan(quiet.intensity.avgDb)
  })

  it('uses supplied spectral timbre verbatim and flags it', () => {
    const snapshot = analyzeLiveBuffer(makeContour(440, 5, 15, 2), STUB_TIMBRE)

    expect(snapshot.spectral).toBe(true)
    expect(snapshot.breathiness).toEqual(STUB_TIMBRE.breathiness)
    expect(snapshot.richness).toEqual(STUB_TIMBRE.richness)
    expect(snapshot.resonance).toEqual(STUB_TIMBRE.resonance)
  })

  it('falls back to approximations when no spectrum is available', () => {
    const snapshot = analyzeLiveBuffer(makeContour(440, 5, 15, 2))

    expect(snapshot.spectral).toBe(false)
    // Approximations still produce a usable result, just not the stub's.
    expect(snapshot.breathiness).not.toEqual(STUB_TIMBRE.breathiness)
    expect(snapshot.resonance.dominantZone).toBeDefined()
  })

  it('detects vibrato on a modulated contour', () => {
    const snapshot = analyzeLiveBuffer(makeContour(440, 5.5, 15, 3))

    expect(snapshot.vibrato.detected).toBe(true)
    expect(snapshot.vibrato.rateHz).toBeGreaterThan(3)
    expect(snapshot.vibrato.rateHz).toBeLessThan(9)
  })

  it('reports no vibrato on a steady tone', () => {
    const snapshot = analyzeLiveBuffer(makeContour(440, 0, 0, 3))

    expect(snapshot.vibrato.detected).toBe(false)
  })
})
