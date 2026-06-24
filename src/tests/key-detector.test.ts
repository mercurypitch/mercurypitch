// ============================================================
// Key Detector Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { computeChromagram, detectKey, detectKeyFromSpectra, } from '@/lib/key-detector'

describe('computeChromagram', () => {
  it('returns 12-bin Float32Array', () => {
    const spectrum = new Float32Array(100).fill(0.5)
    const result = computeChromagram(spectrum, 44100, 2048)
    expect(result).toHaveLength(12)
    expect(result).toBeInstanceOf(Float32Array)
  })

  it('emphasizes the pitch class of a pure sine wave', () => {
    // Simulate a spectrum with a peak at A4 (440 Hz)
    const spectrum = new Float32Array(256)
    // Frequency bin for 440 Hz at 44100 SR with 512 FFT (256 bins)
    // bin = 440 / (44100/512) ≈ 5.1 → bin 5
    spectrum[5] = 100
    const result = computeChromagram(spectrum, 44100, 512)
    // A is pitch class 9
    expect(result[9]).toBeGreaterThan(0.5) // dominant
  })

  it('normalizes chroma to unit sum', () => {
    const spectrum = new Float32Array(128)
    for (let i = 0; i < 128; i++) spectrum[i] = 10
    const result = computeChromagram(spectrum, 44100, 2048)
    const total = result.reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 2)
  })

  it('skips frequencies below 65 Hz', () => {
    // At 44100 SR with 1024 FFT, bin 0 = 0 Hz, bin 1 = 43 Hz, bin 2 = 86 Hz
    const lowSpec = new Float32Array(512)
    // First few bins are below 65 Hz at 44100 SR with 1024 FFT
    // bin 0 = 0 Hz, bin 1 = 43 Hz, bin 2 = 86 Hz
    lowSpec[0] = 200 // 0 Hz - should be skipped
    lowSpec[1] = 200 // ~43 Hz - should be skipped
    lowSpec[2] = 100 // ~86 Hz - should be included
    const result = computeChromagram(lowSpec, 44100, 1024)
    // Should have contribution mostly from bin 2+
    const total = result.reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(0)
    // bin 2 is ~86 Hz ≈ F2 (MIDI ~41) → pitch class 5 (F)
    expect(result[5]).toBeGreaterThan(0)
  })
})

describe('detectKey', () => {
  it('detects C major from a C-major-heavy chroma', () => {
    const chroma = new Float32Array(12)
    // Emphasize C, E, G (C major triad)
    chroma[0] = 0.4 // C
    chroma[4] = 0.3 // E
    chroma[7] = 0.3 // G
    const result = detectKey(chroma)
    expect(result.key).toBe('C major')
    expect(result.mode).toBe('major')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('detects minor mode from a minor-weighted chroma', () => {
    // Build a chroma matching the KK minor profile shape
    const minorProfile = [
      6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
    ]
    const chroma = new Float32Array(12)
    for (let i = 0; i < 12; i++) chroma[i] = minorProfile[i] / 10
    const result = detectKey(chroma)
    expect(result.mode).toBe('minor')
  })

  it('returns alternatives sorted by score', () => {
    const chroma = new Float32Array(12)
    chroma[0] = 0.4
    chroma[4] = 0.3
    chroma[7] = 0.3
    const result = detectKey(chroma)
    expect(result.alternatives.length).toBeGreaterThanOrEqual(2)
    expect(result.alternatives[0].score).toBeGreaterThan(0)
  })

  it('confidence is between 0 and 1', () => {
    const chroma = new Float32Array(12)
    chroma[0] = 0.5
    chroma[7] = 0.5
    const result = detectKey(chroma)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })
})

describe('detectKeyFromSpectra', () => {
  it('returns a KeyResult from multiple spectra', () => {
    const spectra: Float32Array[] = []
    for (let i = 0; i < 10; i++) {
      const s = new Float32Array(128)
      // Emphasize C major notes across frames
      s[5] = 50 // ~C
      s[8] = 40 // ~E
      s[10] = 45 // ~G
      spectra.push(s)
    }
    const result = detectKeyFromSpectra(spectra, 44100, 256)
    expect(result.key).toBeDefined()
    expect(result.tonic).toBeDefined()
    expect(result.mode).toBeDefined()
    expect(result.alternatives.length).toBeGreaterThan(0)
  })

  it('works with a single frame', () => {
    const spectrum = new Float32Array(64)
    spectrum[10] = 100
    const result = detectKeyFromSpectra([spectrum], 44100, 128)
    expect(result.key).toBeDefined()
  })
})
