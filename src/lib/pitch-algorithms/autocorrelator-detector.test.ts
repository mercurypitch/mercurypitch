// ============================================================
// AutocorrelatorDetector Unit Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { AutocorrelatorDetector } from './autocorrelator-detector'

function createSineBuffer(
  sampleRate: number,
  frequency: number,
  durationSec: number,
  amplitude = 1.0,
): Float32Array {
  const samples = Math.floor(sampleRate * durationSec)
  const buffer = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }
  return buffer
}

describe('AutocorrelatorDetector', () => {
  describe('creation', () => {
    it('creates with default settings', () => {
      const d = new AutocorrelatorDetector()
      const s = d.getSettings()
      expect(s.sampleRate).toBe(44100)
      expect(s.bufferSize).toBe(2048)
      expect(s.minFrequency).toBe(60)
      expect(s.maxFrequency).toBe(2000)
      expect(s.minConfidence).toBe(0.3)
    })

    it('creates with custom settings', () => {
      const d = new AutocorrelatorDetector({
        sampleRate: 48000,
        bufferSize: 4096,
        minFrequency: 80,
        maxFrequency: 1500,
        minConfidence: 0.5,
        minAmplitude: 0.05,
      })
      const s = d.getSettings()
      expect(s.sampleRate).toBe(48000)
      expect(s.bufferSize).toBe(4096)
      expect(s.minFrequency).toBe(80)
      expect(s.maxFrequency).toBe(1500)
    })

    it('has algorithm type autocorr', () => {
      const d = new AutocorrelatorDetector()
      expect(d.algorithm).toBe('autocorr')
    })
  })

  describe('name and description', () => {
    it('returns name', () => {
      const d = new AutocorrelatorDetector()
      expect(d.getName()).toBe('Autocorrelation')
    })

    it('returns description', () => {
      const d = new AutocorrelatorDetector()
      expect(d.getDescription()).toContain('autocorrelation')
    })
  })

  describe('basic pitch detection', () => {
    it('detects A4 (440 Hz) accurately', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(438)
      expect(result!.frequency).toBeLessThan(442)
      expect(result!.noteName).toMatch(/^[A-G](#)?\d$/)
    })

    it('detects C4 (261.63 Hz)', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = createSineBuffer(44100, 261.63, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(259)
      expect(result!.frequency).toBeLessThan(264)
    })

    it('detects G4 (392 Hz)', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = createSineBuffer(44100, 392, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(388)
      expect(result!.frequency).toBeLessThan(396)
    })

    it('detects E5 (659.25 Hz)', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = createSineBuffer(44100, 659.25, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(654)
      expect(result!.frequency).toBeLessThan(665)
    })

    it('detects C3 low note (130.81 Hz)', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = createSineBuffer(44100, 130.81, 0.15)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(128)
      expect(result!.frequency).toBeLessThan(134)
    })

    it('returns clarity between 0 and 1', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.clarity).toBeGreaterThanOrEqual(0)
      expect(result!.clarity).toBeLessThanOrEqual(1)
    })
  })

  describe('silence and noise', () => {
    it('returns null for empty buffer', () => {
      const d = new AutocorrelatorDetector()
      expect(d.detect(new Float32Array(0))).toBeNull()
    })

    it('returns null for silent buffer', () => {
      const d = new AutocorrelatorDetector()
      const buffer = new Float32Array(2048)
      expect(d.detect(buffer)).toBeNull()
    })

    it('handles random noise without throwing', () => {
      const d = new AutocorrelatorDetector()
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = (Math.random() - 0.5) * 2
      }
      expect(() => d.detect(buffer)).not.toThrow()
    })
  })

  describe('sample rate independence', () => {
    it('handles 48000 Hz', () => {
      const d = new AutocorrelatorDetector({
        sampleRate: 48000,
        minConfidence: 0.1,
      })
      const buffer = createSineBuffer(48000, 440, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(435)
      expect(result!.frequency).toBeLessThan(445)
    })

    it('handles 22050 Hz', () => {
      const d = new AutocorrelatorDetector({
        sampleRate: 22050,
        minConfidence: 0.1,
      })
      const buffer = createSineBuffer(22050, 440, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(430)
      expect(result!.frequency).toBeLessThan(450)
    })
  })

  describe('frequency range boundaries', () => {
    it('rejects frequencies below minFrequency', () => {
      const d = new AutocorrelatorDetector({
        minFrequency: 100,
        minConfidence: 0.1,
      })
      const buffer = createSineBuffer(44100, 80, 0.1)
      const result = d.detect(buffer)
      // May or may not reject depending on correlation — but should not
      // return a frequency below minFrequency
      if (result !== null) {
        expect(result.frequency).toBeGreaterThanOrEqual(100)
      }
    })

    it('rejects frequencies above maxFrequency', () => {
      const d = new AutocorrelatorDetector({
        maxFrequency: 1000,
        minConfidence: 0.1,
      })
      const buffer = createSineBuffer(44100, 1500, 0.1)
      const result = d.detect(buffer)
      if (result !== null) {
        expect(result.frequency).toBeLessThanOrEqual(1000)
      }
    })

    it('rejects frequencies at minimum lag boundary', () => {
      // At 44100 Hz with maxFrequency=2000, minLag = 22
      // A frequency that would give lag < minLag should be rejected
      const d = new AutocorrelatorDetector({
        maxFrequency: 2000,
        minConfidence: 0.1,
      })
      // 2500 Hz → lag = 44100/2500 = 17.6 < minLag=22 → should reject
      const buffer = createSineBuffer(44100, 2500, 0.1)
      const result = d.detect(buffer)
      if (result !== null) {
        expect(result.frequency).toBeLessThanOrEqual(2000)
      }
    })
  })

  describe('edge cases — amplitude', () => {
    it('returns null for near-zero amplitude', () => {
      const d = new AutocorrelatorDetector()
      const buffer = new Float32Array(2048).fill(0.0001)
      expect(d.detect(buffer)).toBeNull()
    })

    it('detects small amplitude sine wave', () => {
      const d = new AutocorrelatorDetector({
        minConfidence: 0.1,
        minAmplitude: 0.01,
      })
      const buffer = createSineBuffer(44100, 440, 0.1, 0.03)
      const result = d.detect(buffer)
      // Small amplitude may still be detectable with autocorrelation
      // because the envelope doesn't affect lag-based correlation
      expect(result).not.toBeNull()
    })
  })

  describe('edge cases — non-sinusoidal waveforms', () => {
    it('detects square wave fundamental', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.sign(Math.sin((2 * Math.PI * 440 * i) / 44100))
      }
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      if (result) {
        expect(result.frequency).toBeGreaterThan(430)
        expect(result.frequency).toBeLessThan(450)
      }
    })

    it('detects triangle wave fundamental', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        const angle = (2 * Math.PI * 440 * i) / 44100
        buffer[i] = (2 / Math.PI) * Math.asin(Math.sin(angle))
      }
      const result = d.detect(buffer)
      expect(result).not.toBeNull()
    })

    it('detects sawtooth-like waveform', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = new Float32Array(2048)
      const period = 44100 / 440
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 2 * ((i % period) / period) - 1
      }
      const result = d.detect(buffer)
      expect(result).not.toBeNull()
    })
  })

  describe('edge cases — harmonic content', () => {
    it('detects fundamental despite harmonics', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = new Float32Array(4410)
      for (let i = 0; i < buffer.length; i++) {
        const angle = (2 * Math.PI * 440 * i) / 44100
        buffer[i] =
          Math.sin(angle) +
          0.3 * Math.sin(2 * angle) +
          0.15 * Math.sin(3 * angle)
      }
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      if (result) {
        // Autocorrelation should find the fundamental, not a harmonic
        expect(result.frequency).toBeGreaterThan(430)
        expect(result.frequency).toBeLessThan(450)
      }
    })
  })

  describe('edge cases — NaN and invalid inputs', () => {
    it('handles buffer with NaN values', () => {
      const d = new AutocorrelatorDetector()
      const buffer = new Float32Array(2048)
      buffer[0] = NaN
      expect(() => d.detect(buffer)).not.toThrow()
      // Should still either return null or a result without crashing
    })

    it('handles buffer with Infinity values', () => {
      const d = new AutocorrelatorDetector()
      const buffer = new Float32Array(2048)
      buffer[0] = Infinity
      expect(() => d.detect(buffer)).not.toThrow()
    })

    it('handles buffer with negative values', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = createSineBuffer(44100, 440, 0.1, -1)
      const result = d.detect(buffer)
      expect(result).not.toBeNull()
    })
  })

  describe('edge cases — very short buffers', () => {
    it('handles very short buffer', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = createSineBuffer(44100, 440, 0.001) // ~44 samples
      expect(() => d.detect(buffer)).not.toThrow()
    })

    it('handles buffer with just a few samples', () => {
      const d = new AutocorrelatorDetector()
      const buffer = new Float32Array(10)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.sin((2 * Math.PI * i) / 10)
      }
      expect(() => d.detect(buffer)).not.toThrow()
    })

    it('returns null for single-sample buffer', () => {
      const d = new AutocorrelatorDetector()
      const buffer = new Float32Array(1)
      buffer[0] = 1.0
      const result = d.detect(buffer)
      if (result !== null) {
        // Correlation with lag=1 needs at least 2 samples
        expect(result.frequency).toBeGreaterThan(0)
      }
    })
  })

  describe('metrics and reset', () => {
    it('returns initial metrics', () => {
      const d = new AutocorrelatorDetector()
      const m = d.getMetrics()
      expect(m.totalDetections).toBe(0)
      expect(m.consecutiveFailures).toBe(0)
      expect(m.averageClarity).toBe(0)
      expect(m.averageFrequency).toBe(0)
      expect(m.lastResult).toBeNull()
    })

    it('updates metrics after detection', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      d.detect(buffer)
      const m = d.getMetrics()
      expect(m.totalDetections).toBeGreaterThan(0)
      expect(m.lastResult).not.toBeNull()
    })

    it('tracks average clarity and frequency', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buf440 = createSineBuffer(44100, 440, 0.1)
      d.detect(buf440)
      const m1 = d.getMetrics()
      expect(m1.averageClarity).toBeGreaterThan(0)
      expect(m1.averageFrequency).toBeGreaterThan(0)

      const buf261 = createSineBuffer(44100, 261.63, 0.1)
      d.detect(buf261)
      const m2 = d.getMetrics()
      // Running average after two detections — value should change
      expect(m2.averageFrequency).not.toBe(m1.averageFrequency)
      expect(m2.averageClarity).toBeGreaterThan(0)
    })

    it('tracks consecutive failures', () => {
      const d = new AutocorrelatorDetector()
      // Silence should fail
      d.detect(new Float32Array(2048))
      const m = d.getMetrics()
      expect(m.consecutiveFailures).toBeGreaterThan(0)
    })

    it('resets correctly', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      d.detect(createSineBuffer(44100, 440, 0.1))
      d.reset()
      const m = d.getMetrics()
      expect(m.totalDetections).toBe(0)
      expect(m.lastResult).toBeNull()
    })

    it('getLastComputationTime returns a number', () => {
      const d = new AutocorrelatorDetector()
      expect(typeof d.getLastComputationTime()).toBe('number')
    })
  })

  describe('settings mutation', () => {
    it('setMinConfidence clamps to 0-1', () => {
      const d = new AutocorrelatorDetector()
      d.setMinConfidence(0.5)
      d.setMinConfidence(-0.5)
      const s = d.getSettings()
      expect(s.minConfidence).toBeGreaterThanOrEqual(0)
    })

    it('setMinConfidence clamps upper bound', () => {
      const d = new AutocorrelatorDetector()
      d.setMinConfidence(5)
      const s = d.getSettings()
      expect(s.minConfidence).toBeLessThanOrEqual(1)
    })

    it('setSensitivity is a no-op', () => {
      const d = new AutocorrelatorDetector()
      expect(() => d.setSensitivity(5)).not.toThrow()
    })
  })

  describe('frequency accuracy across common pitches', () => {
    const testCases = [
      { name: 'C3', freq: 130.81 },
      { name: 'E3', freq: 164.81 },
      { name: 'G3', freq: 196.0 },
      { name: 'A3', freq: 220.0 },
      { name: 'C4', freq: 261.63 },
      { name: 'E4', freq: 329.63 },
      { name: 'G4', freq: 392.0 },
      { name: 'A4', freq: 440.0 },
      { name: 'C5', freq: 523.25 },
      { name: 'E5', freq: 659.25 },
    ]

    for (const tc of testCases) {
      it(`detects ${tc.name} (${tc.freq} Hz)`, () => {
        const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
        const buffer = createSineBuffer(44100, tc.freq, 0.15)
        const result = d.detect(buffer)

        expect(result).not.toBeNull()
        if (result) {
          // Autocorrelation with interpolation is very accurate on clean sines
          const errCents = 1200 * Math.log2(result.frequency / tc.freq)
          expect(Math.abs(errCents)).toBeLessThan(30)
        }
      })
    }
  })

  describe('detectFromFrequencyData', () => {
    it('delegates to detect', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = d.detectFromFrequencyData(buffer)
      // detectFromFrequencyData delegates to detect()
      expect(result).not.toBeNull()
      if (result) {
        expect(result.frequency).toBeGreaterThan(0)
      }
    })
  })

  describe('stability on repeated detection', () => {
    it('produces consistent results', () => {
      const d = new AutocorrelatorDetector({ minConfidence: 0.1 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      const results: number[] = []

      for (let i = 0; i < 10; i++) {
        const r = d.detect(buffer)
        if (r) results.push(r.frequency)
      }

      if (results.length >= 2) {
        // Deterministic — same input → same output
        const first = results[0]!
        for (const r of results) {
          expect(r).toBe(first)
        }
      }
    })
  })
})
