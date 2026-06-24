// ============================================================
// Segmenter Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { computeTimbreFeatures, segmentAudio } from '@/lib/segmenter'

describe('computeTimbreFeatures', () => {
  it('returns 16-dim feature vector', () => {
    const spectrum = new Float32Array(256).fill(0.5)
    const result = computeTimbreFeatures(spectrum, 44100)
    expect(result).toHaveLength(16)
    expect(result).toBeInstanceOf(Float32Array)
  })

  it('is normalized to unit length', () => {
    const spectrum = new Float32Array(128)
    // Non-trivial spectrum
    for (let i = 0; i < 128; i++) spectrum[i] = Math.sin((i / 128) * Math.PI)
    const result = computeTimbreFeatures(spectrum, 44100)
    const norm = Math.sqrt(result.reduce((s, v) => s + v * v, 0))
    // Unit norm
    expect(norm).toBeCloseTo(1, 1)
  })

  it('returns zero vector for zero spectrum', () => {
    const spectrum = new Float32Array(100)
    const result = computeTimbreFeatures(spectrum, 44100)
    const sum = result.reduce((a, b) => a + b, 0)
    expect(sum).toBe(0)
  })

  it('produces different features for different spectra', () => {
    const s1 = new Float32Array(128)
    const s2 = new Float32Array(128)
    for (let i = 0; i < 128; i++) {
      s1[i] = Math.random()
      s2[i] = Math.random()
    }
    const f1 = computeTimbreFeatures(s1, 44100)
    const f2 = computeTimbreFeatures(s2, 44100)
    // Features should differ for random spectra
    let diff = 0
    for (let i = 0; i < 16; i++) diff += Math.abs(f1[i] - f2[i])
    expect(diff).toBeGreaterThan(0)
  })
})

describe('segmentAudio', () => {
  it('returns empty for too few frames', () => {
    const spectra = [new Float32Array(64).fill(0.5)]
    const result = segmentAudio(spectra, 44100, 1024)
    expect(result.segments).toHaveLength(0)
    expect(result.labels).toHaveLength(0)
  })

  it('detects segments from structured audio', () => {
    // Create 3 distinct sections with different spectral profiles
    const spectra: Float32Array[] = []
    // Section 1: low-frequency emphasis (10 frames)
    for (let i = 0; i < 10; i++) {
      const s = new Float32Array(64)
      for (let j = 0; j < 16; j++) s[j] = 5 // low bins
      spectra.push(s)
    }
    // Section 2: high-frequency emphasis (10 frames)
    for (let i = 0; i < 10; i++) {
      const s = new Float32Array(64)
      for (let j = 48; j < 64; j++) s[j] = 5 // high bins
      spectra.push(s)
    }
    // Section 3: mid-frequency emphasis (10 frames)
    for (let i = 0; i < 10; i++) {
      const s = new Float32Array(64)
      for (let j = 24; j < 40; j++) s[j] = 5 // mid bins
      spectra.push(s)
    }

    const result = segmentAudio(spectra, 44100, 1024, {
      minSegmentDuration: 0.1,
      maxSegments: 8,
    })

    expect(result.segments.length).toBeGreaterThan(0)
    expect(result.segments.length).toBeLessThanOrEqual(8)
    expect(result.noveltyCurve).toHaveLength(spectra.length)
  })

  it('novelty curve has valid range', () => {
    const spectra: Float32Array[] = []
    for (let i = 0; i < 20; i++) {
      const s = new Float32Array(32)
      for (let j = 0; j < 32; j++) s[j] = Math.random() * (i < 10 ? 1 : 5)
      spectra.push(s)
    }
    const result = segmentAudio(spectra, 44100, 1024)
    for (const v of result.noveltyCurve) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('returns consistent labels per segment', () => {
    const spectra: Float32Array[] = []
    // Two repeating sections
    for (let repeat = 0; repeat < 2; repeat++) {
      for (let i = 0; i < 15; i++) {
        const s = new Float32Array(32)
        s[2] = 10
        spectra.push(s)
      }
      for (let i = 0; i < 15; i++) {
        const s = new Float32Array(32)
        s[20] = 10
        spectra.push(s)
      }
    }

    const result = segmentAudio(spectra, 44100, 1024, {
      minSegmentDuration: 0.05,
      maxSegments: 8,
    })
    expect(result.segments.length).toBeGreaterThan(0)
    // At least one segment should be labeled "Chorus" (most repeated)
    expect(result.segments.some((s) => s.label === 'Chorus')).toBe(true)
  })
})
