// ============================================================
// Tests: vocal-analyzer.ts
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  approximateBreathiness,
  compareIntensity,
  computeHNR,
  computeRMSEnvelope,
  detectSlides,
  intensityFromPitchResults,
} from '@/lib/vocal-analyzer'
import type { EnvelopePoint } from '@/lib/vocal-analyzer'

// ── computeRMSEnvelope ─────────────────────────────────────────

describe('computeRMSEnvelope', () => {
  it('returns empty array for empty input', () => {
    const result = computeRMSEnvelope(new Float32Array(0), 44100)
    expect(result).toEqual([])
  })

  it('produces envelope points from a sine wave', () => {
    const sampleRate = 44100
    const duration = 1
    const freq = 440
    const samples = new Float32Array(sampleRate * duration)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate)
    }

    const envelope = computeRMSEnvelope(samples, sampleRate)
    expect(envelope.length).toBeGreaterThan(0)

    // RMS of a sine wave with amplitude 1 is sqrt(2)/2 ≈ 0.707
    for (const pt of envelope) {
      expect(pt.rms).toBeGreaterThan(0.6)
      expect(pt.rms).toBeLessThan(0.8)
      expect(pt.db).toBeLessThan(0) // 0.707 = -3dB
    }
  })

  it('produces lower RMS for quieter signal', () => {
    const sampleRate = 8000
    const samples = new Float32Array(8000)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.1 * Math.sin((2 * Math.PI * 440 * i) / sampleRate)
    }

    const envelope = computeRMSEnvelope(samples, sampleRate, 1024, 512)
    for (const pt of envelope) {
      expect(pt.rms).toBeLessThan(0.1)
    }
  })

  it('accepts number arrays', () => {
    const samples = [0.1, 0.2, -0.3, 0.1, 0.5, -0.2, 0.1, 0.0]
    const envelope = computeRMSEnvelope(samples, 8000, 4, 2)
    expect(envelope.length).toBeGreaterThan(0)
  })
})

// ── compareIntensity ───────────────────────────────────────────

describe('compareIntensity', () => {
  it('returns zero match for empty envelopes', () => {
    const result = compareIntensity([], [])
    expect(result.overallMatch).toBe(0)
    expect(result.notes).toHaveLength(0)
  })

  it('gives 100% match for identical envelopes', () => {
    const envelope: EnvelopePoint[] = [
      { time: 0, rms: 0.5, db: -6 },
      { time: 0.1, rms: 0.7, db: -3 },
      { time: 0.2, rms: 0.5, db: -6 },
    ]

    const result = compareIntensity(envelope, envelope)
    expect(result.overallMatch).toBe(100)
    for (const note of result.notes) {
      expect(note.delta).toBe(0)
      expect(note.score).toBe(100)
    }
  })

  it('detects intensity mismatch', () => {
    const user: EnvelopePoint[] = [
      { time: 0, rms: 0.3, db: -10 },
      { time: 0.1, rms: 0.4, db: -8 },
    ]
    const ref: EnvelopePoint[] = [
      { time: 0, rms: 0.7, db: -3 },
      { time: 0.1, rms: 0.8, db: -2 },
    ]

    const result = compareIntensity(user, ref)
    expect(result.overallMatch).toBeLessThan(100)
    expect(result.overallMatch).toBeGreaterThan(0)
  })

  it('interpolates user envelope to reference timeline', () => {
    const user: EnvelopePoint[] = [
      { time: 0.05, rms: 0.5, db: -6 },
      { time: 0.15, rms: 0.6, db: -4 },
    ]
    const ref: EnvelopePoint[] = [
      { time: 0, rms: 0.5, db: -6 },
      { time: 0.1, rms: 0.6, db: -4 },
      { time: 0.2, rms: 0.5, db: -6 },
    ]

    const result = compareIntensity(user, ref)
    expect(result.notes.length).toBeGreaterThan(0)
  })
})

// ── intensityFromPitchResults ──────────────────────────────────

describe('intensityFromPitchResults', () => {
  it('returns empty for empty input', () => {
    const result = intensityFromPitchResults([])
    expect(result.envelope).toHaveLength(0)
    expect(result.avgDb).toBe(0)
  })

  it('produces envelope from clarity values', () => {
    const results = [
      { time: 0, clarity: 80, midi: 60 },
      { time: 0.01, clarity: 70, midi: 62 },
      { time: 0.02, clarity: 90, midi: 64 },
    ]

    const profile = intensityFromPitchResults(results)
    expect(profile.envelope).toHaveLength(3)
    expect(profile.dynamicRange).toBeGreaterThanOrEqual(0)
  })

  it('handles clarity=0 without -Infinity', () => {
    const results = [
      { time: 0, clarity: 0, midi: 60 },
      { time: 0.01, clarity: 50, midi: 62 },
    ]

    const profile = intensityFromPitchResults(results)
    for (const pt of profile.envelope) {
      expect(Number.isFinite(pt.db)).toBe(true)
    }
  })
})

// ── computeHNR ─────────────────────────────────────────────────

describe('computeHNR', () => {
  it('returns breathy for f0 out of range', () => {
    const spectrum = new Float32Array(1024).fill(0.1)
    const result = computeHNR(spectrum, 44100, 0, 1024)
    expect(result.quality).toBe('breathy')
    expect(result.efficiency).toBe(0)
  })

  it('detects strong harmonic structure', () => {
    const spectrum = new Float32Array(1024)
    const f0 = 440
    const sampleRate = 44100
    const fftSize = 2048
    const binWidth = sampleRate / fftSize
    const f0Bin = Math.round(f0 / binWidth)

    // Create peaks at harmonic positions
    for (let h = 1; h <= 10; h++) {
      const bin = f0Bin * h
      if (bin < spectrum.length) {
        spectrum[bin] = 10 // strong harmonic peak
        // Small side bins
        if (bin + 1 < spectrum.length) spectrum[bin + 1] = 0.5
        if (bin - 1 >= 0) spectrum[bin - 1] = 0.5
      }
    }

    // Fill noise floor
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] === 0) spectrum[i] = 0.01
    }

    const result = computeHNR(spectrum, sampleRate, f0, fftSize)
    expect(result.hnrDb).toBeGreaterThan(15)
    expect(result.quality).not.toBe('breathy')
    expect(result.efficiency).toBeGreaterThan(50)
  })

  it('detects breathy (noise-dominated) signal', () => {
    const spectrum = new Float32Array(1024).fill(0.1) // flat noise spectrum
    const f0 = 440
    const sampleRate = 44100
    const fftSize = 2048
    const binWidth = sampleRate / fftSize
    const f0Bin = Math.round(f0 / binWidth)

    // Small harmonic bumps
    for (let h = 1; h <= 5; h++) {
      const bin = f0Bin * h
      if (bin < spectrum.length) spectrum[bin] = 0.2
    }

    const result = computeHNR(spectrum, sampleRate, f0, fftSize)
    expect(result.hnrDb).toBeLessThan(20)
    expect(result.efficiency).toBeLessThan(70)
  })
})

// ── approximateBreathiness ─────────────────────────────────────

describe('approximateBreathiness', () => {
  it('returns breathy for few samples', () => {
    const result = approximateBreathiness([])
    expect(result.quality).toBe('breathy')
    expect(result.efficiency).toBe(0)
  })

  it('estimates resonant for high-clarity stable pitch', () => {
    const results = [
      { freq: 440, clarity: 95 },
      { freq: 440.1, clarity: 93 },
      { freq: 439.9, clarity: 94 },
      { freq: 440, clarity: 96 },
      { freq: 440.05, clarity: 92 },
    ]

    const result = approximateBreathiness(results)
    expect(result.efficiency).toBeGreaterThan(30)
  })

  it('estimates breathy for low-clarity unstable pitch', () => {
    const results = [
      { freq: 440, clarity: 20 },
      { freq: 470, clarity: 25 },
      { freq: 410, clarity: 18 },
      { freq: 460, clarity: 22 },
    ]

    const result = approximateBreathiness(results)
    expect(result.efficiency).toBeLessThan(60)
  })

  it('filters out invalid frequencies', () => {
    const results = [
      { freq: 0, clarity: 50 },
      { freq: 10, clarity: 30 },
      { freq: 440, clarity: 90 },
      { freq: 441, clarity: 88 },
      { freq: 440.5, clarity: 92 },
      { freq: 0, clarity: 0 },
    ]

    const result = approximateBreathiness(results)
    expect(result.efficiency).toBeGreaterThan(30)
  })
})

// ── detectSlides ───────────────────────────────────────────────

describe('detectSlides', () => {
  it('returns empty for insufficient samples', () => {
    const result = detectSlides([
      { time: 0, midi: 60, freq: 262 },
      { time: 0.01, midi: 62, freq: 293 },
    ])
    expect(result.slides).toHaveLength(0)
    expect(result.overallScore).toBe(100)
  })

  it('detects clean transitions', () => {
    const samples: Array<{ time: number; midi: number; freq: number }> = []
    // Stable at C4 (midi 60)
    for (let i = 0; i < 5; i++) {
      samples.push({ time: i * 0.01, midi: 60, freq: 262 })
    }
    // Quick clean transition to E4 (midi 64)
    samples.push({ time: 0.05, midi: 61, freq: 277 })
    samples.push({ time: 0.06, midi: 63, freq: 311 })
    // Stable at E4
    for (let i = 0; i < 5; i++) {
      samples.push({ time: 0.07 + i * 0.01, midi: 64, freq: 330 })
    }

    const result = detectSlides(samples)
    expect(result.slides.length).toBeGreaterThan(0)
    if (result.slides.length > 0) {
      expect(result.slides[0].direction).toBe('ascending')
      expect(result.slides[0].semitoneSpan).toBeCloseTo(4, 0)
    }
  })

  it('detects scoop transitions', () => {
    const samples: Array<{ time: number; midi: number; freq: number }> = []
    // Stable at C4
    for (let i = 0; i < 5; i++) {
      samples.push({ time: i * 0.01, midi: 60, freq: 262 })
    }
    // Scoop: stays below target for most of transition
    samples.push({ time: 0.05, midi: 60.5, freq: 265 })
    samples.push({ time: 0.06, midi: 61, freq: 277 })
    samples.push({ time: 0.07, midi: 61.5, freq: 285 })
    samples.push({ time: 0.08, midi: 62, freq: 294 })
    // Just barely reaches target at end
    for (let i = 0; i < 5; i++) {
      samples.push({ time: 0.09 + i * 0.01, midi: 64, freq: 330 })
    }

    const result = detectSlides(samples)
    expect(result.slides.length).toBeGreaterThan(0)
    // Should detect this as a scoop or less-than-perfect transition
    if (result.slides.length > 0) {
      expect(result.slides[0].score).toBeLessThan(100)
    }
  })

  it('detects overshoot', () => {
    const samples: Array<{ time: number; midi: number; freq: number }> = []
    // Stable at C4
    for (let i = 0; i < 5; i++) {
      samples.push({ time: i * 0.01, midi: 60, freq: 262 })
    }
    // Overshoot: goes past target, then comes back
    samples.push({ time: 0.05, midi: 63, freq: 311 })
    samples.push({ time: 0.06, midi: 66, freq: 392 }) // overshoot!
    samples.push({ time: 0.07, midi: 65, freq: 349 })
    // Eventually settles
    for (let i = 0; i < 5; i++) {
      samples.push({ time: 0.08 + i * 0.01, midi: 64, freq: 330 })
    }

    const result = detectSlides(samples)
    const overshoots = result.slides.filter((s) => s.type === 'overshoot')
    expect(overshoots.length).toBeGreaterThan(0)
  })

  it('handles descending slides', () => {
    const samples: Array<{ time: number; midi: number; freq: number }> = []
    // Stable at E4
    for (let i = 0; i < 5; i++) {
      samples.push({ time: i * 0.01, midi: 64, freq: 330 })
    }
    // Quick descent to C4
    samples.push({ time: 0.05, midi: 63, freq: 311 })
    samples.push({ time: 0.06, midi: 61, freq: 277 })
    // Stable at C4
    for (let i = 0; i < 5; i++) {
      samples.push({ time: 0.07 + i * 0.01, midi: 60, freq: 262 })
    }

    const result = detectSlides(samples)
    expect(result.slides.length).toBeGreaterThan(0)
    if (result.slides.length > 0) {
      expect(result.slides[0].direction).toBe('descending')
    }
  })

  it('scores clean slides higher than wobbles', () => {
    const cleanSamples: Array<{ time: number; midi: number; freq: number }> = []
    // Build two stable regions with a linear transition
    for (let i = 0; i < 5; i++) {
      cleanSamples.push({ time: i * 0.01, midi: 60, freq: 262 })
    }
    // Linear transition
    for (let i = 0; i < 4; i++) {
      cleanSamples.push({
        time: 0.05 + i * 0.01,
        midi: 60 + (i + 1),
        freq: 262 * Math.pow(2, (i + 1) / 12),
      })
    }
    for (let i = 0; i < 5; i++) {
      cleanSamples.push({ time: 0.09 + i * 0.01, midi: 64, freq: 330 })
    }

    const cleanResult = detectSlides(cleanSamples)
    const cleanScore =
      cleanResult.slides.length > 0 ? cleanResult.slides[0].score : 0

    const wobbleSamples: Array<{ time: number; midi: number; freq: number }> = []
    for (let i = 0; i < 5; i++) {
      wobbleSamples.push({ time: i * 0.01, midi: 60, freq: 262 })
    }
    // Wobbly transition
    wobbleSamples.push({ time: 0.05, midi: 62, freq: 294 })
    wobbleSamples.push({ time: 0.06, midi: 60, freq: 262 })
    wobbleSamples.push({ time: 0.07, midi: 63, freq: 311 })
    wobbleSamples.push({ time: 0.08, midi: 61, freq: 277 })
    for (let i = 0; i < 5; i++) {
      wobbleSamples.push({ time: 0.09 + i * 0.01, midi: 64, freq: 330 })
    }

    const wobbleResult = detectSlides(wobbleSamples)
    const wobbleScore =
      wobbleResult.slides.length > 0 ? wobbleResult.slides[0].score : 0

    expect(cleanScore).toBeGreaterThan(wobbleScore)
  })
})
