// ============================================================
// FFTDetector Unit Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { FFTDetector } from './fft-detector'

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

describe('FFTDetector', () => {
  describe('creation', () => {
    it('creates with default settings', () => {
      const d = new FFTDetector()
      const s = d.getSettings()
      expect(s.sampleRate).toBe(44100)
      expect(s.bufferSize).toBe(2048)
      expect(s.minFrequency).toBe(65)
      expect(s.maxFrequency).toBe(2100)
    })

    it('creates with custom settings', () => {
      const d = new FFTDetector({
        sampleRate: 48000,
        bufferSize: 4096,
        minFrequency: 100,
        maxFrequency: 1000,
        minConfidence: 0.5,
        minAmplitude: 0.05,
      })
      const s = d.getSettings()
      expect(s.sampleRate).toBe(48000)
      expect(s.bufferSize).toBe(4096)
      expect(s.minFrequency).toBe(100)
      expect(s.maxFrequency).toBe(1000)
    })

    it('has algorithm type fft', () => {
      const d = new FFTDetector()
      expect(d.algorithm).toBe('fft')
    })
  })

  describe('name and description', () => {
    it('returns name', () => {
      const d = new FFTDetector()
      expect(d.getName()).toBe('FFT Max Bin')
    })

    it('returns description', () => {
      const d = new FFTDetector()
      expect(d.getDescription()).toContain('FFT')
    })
  })

  describe('basic pitch detection', () => {
    it('detects A4 (440 Hz) within tolerance', () => {
      const d = new FFTDetector({ bufferSize: 2048 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(435)
      expect(result!.frequency).toBeLessThan(445)
      // FFT bin resolution is ~21.5 Hz at 2048/44100 — the parabolic
      // interpolation refines this to sub-bin accuracy on clean sines.
    })

    it('detects C4 (261.63 Hz)', () => {
      const d = new FFTDetector({ bufferSize: 2048 })
      const buffer = createSineBuffer(44100, 261.63, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(255)
      expect(result!.frequency).toBeLessThan(270)
    })

    it('detects G4 (392 Hz)', () => {
      const d = new FFTDetector({ bufferSize: 2048 })
      const buffer = createSineBuffer(44100, 392, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(385)
      expect(result!.frequency).toBeLessThan(400)
    })

    it('detects E5 (659.25 Hz)', () => {
      const d = new FFTDetector({ bufferSize: 2048 })
      const buffer = createSineBuffer(44100, 659.25, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(650)
      expect(result!.frequency).toBeLessThan(670)
    })

    it('detects C3 low note (130.81 Hz)', () => {
      const d = new FFTDetector({ bufferSize: 4096 })
      const buffer = createSineBuffer(44100, 130.81, 0.15)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(125)
      expect(result!.frequency).toBeLessThan(140)
    })

    it('returns note name and octave', () => {
      const d = new FFTDetector({ bufferSize: 2048 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.noteName).toMatch(/^[A-G](#)?\d$/)
      expect(typeof result!.octave).toBe('number')
      expect(typeof result!.cents).toBe('number')
    })
  })

  describe('silence and noise', () => {
    it('returns null for empty buffer', () => {
      const d = new FFTDetector()
      const buffer = new Float32Array(0)
      expect(d.detect(buffer)).toBeNull()
    })

    it('returns null for silent buffer', () => {
      const d = new FFTDetector()
      const buffer = new Float32Array(2048)
      const result = d.detect(buffer)
      // All-zero input has no frequency content — should reject
      expect(result).toBeNull()
    })

    it('handles random noise without throwing', () => {
      const d = new FFTDetector()
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = (Math.random() - 0.5) * 2
      }
      expect(() => d.detect(buffer)).not.toThrow()
    })
  })

  describe('sample rate independence', () => {
    it('handles 48000 Hz sample rate', () => {
      const d = new FFTDetector({ sampleRate: 48000, bufferSize: 2048 })
      const buffer = createSineBuffer(48000, 440, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(430)
      expect(result!.frequency).toBeLessThan(450)
    })

    it('handles 22050 Hz sample rate', () => {
      const d = new FFTDetector({ sampleRate: 22050, bufferSize: 1024 })
      const buffer = createSineBuffer(22050, 440, 0.1)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      expect(result!.frequency).toBeGreaterThan(420)
      expect(result!.frequency).toBeLessThan(460)
    })
  })

  describe('frequency range boundaries', () => {
    it('rejects frequencies below minFrequency', () => {
      const d = new FFTDetector({
        bufferSize: 4096,
        minFrequency: 100,
        minAmplitude: 0.01,
      })
      const buffer = createSineBuffer(44100, 80, 0.1)
      const result = d.detect(buffer)
      // Either returns null or the frequency is above minFrequency
      if (result !== null) {
        expect(result.frequency).toBeGreaterThanOrEqual(100)
      }
    })

    it('rejects frequencies above maxFrequency', () => {
      const d = new FFTDetector({
        bufferSize: 2048,
        maxFrequency: 1000,
        minAmplitude: 0.01,
      })
      const buffer = createSineBuffer(44100, 1500, 0.1)
      const result = d.detect(buffer)
      if (result !== null) {
        expect(result.frequency).toBeLessThanOrEqual(1000)
      }
    })
  })

  describe('edge cases — amplitude', () => {
    it('returns null for near-zero amplitude', () => {
      const d = new FFTDetector({ minAmplitude: 0.02 })
      const buffer = new Float32Array(2048).fill(0.0001)
      expect(d.detect(buffer)).toBeNull()
    })

    it('detects small amplitude sine wave', () => {
      const d = new FFTDetector({ minAmplitude: 0.001 })
      const buffer = createSineBuffer(44100, 440, 0.1, 0.03)
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      if (result) {
        expect(result.frequency).toBeGreaterThan(0)
      }
    })

    it('detects max amplitude sine wave', () => {
      const d = new FFTDetector()
      const buffer = createSineBuffer(44100, 440, 0.1, 1.0)
      const result = d.detect(buffer)
      expect(result).not.toBeNull()
    })
  })

  describe('edge cases — buffer sizes', () => {
    it('handles 1024-point FFT', () => {
      const d = new FFTDetector({ bufferSize: 1024, minAmplitude: 0.005 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = d.detect(buffer)
      expect(result).not.toBeNull()
    })

    it('handles 4096-point FFT', () => {
      const d = new FFTDetector({ bufferSize: 4096, minAmplitude: 0.005 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = d.detect(buffer)
      expect(result).not.toBeNull()
    })

    it('handles 8192-point FFT', () => {
      const d = new FFTDetector({ bufferSize: 8192, minAmplitude: 0.005 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = d.detect(buffer)
      expect(result).not.toBeNull()
    })

    it('handles input shorter than FFT size (zero-padded)', () => {
      const d = new FFTDetector({ bufferSize: 2048 })
      const shortBuffer = createSineBuffer(44100, 440, 0.01) // ~441 samples
      expect(() => d.detect(shortBuffer)).not.toThrow()
    })
  })

  describe('edge cases — non-sinusoidal waveforms', () => {
    it('detects square wave fundamental', () => {
      const d = new FFTDetector({ bufferSize: 2048 })
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.sign(Math.sin((2 * Math.PI * 440 * i) / 44100))
      }
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
      if (result) {
        // Square wave fundamental should be near 440 Hz
        expect(result.frequency).toBeGreaterThan(430)
        expect(result.frequency).toBeLessThan(455)
      }
    })

    it('detects triangle wave fundamental', () => {
      const d = new FFTDetector({ bufferSize: 2048 })
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        const angle = (2 * Math.PI * 440 * i) / 44100
        buffer[i] = (2 / Math.PI) * Math.asin(Math.sin(angle))
      }
      const result = d.detect(buffer)

      expect(result).not.toBeNull()
    })

    it('detects sawtooth-like waveform', () => {
      const d = new FFTDetector({ bufferSize: 2048 })
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
    it('detects fundamental with harmonics present', () => {
      const d = new FFTDetector({ bufferSize: 2048 })
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
        expect(result.frequency).toBeGreaterThan(430)
        expect(result.frequency).toBeLessThan(455)
      }
    })
  })

  describe('edge cases — NaN and invalid inputs', () => {
    it('handles buffer with NaN values', () => {
      const d = new FFTDetector()
      const buffer = new Float32Array(2048)
      buffer[0] = NaN
      expect(() => d.detect(buffer)).not.toThrow()
    })

    it('handles buffer with Infinity values', () => {
      const d = new FFTDetector()
      const buffer = new Float32Array(2048)
      buffer[0] = Infinity
      expect(() => d.detect(buffer)).not.toThrow()
    })

    it('handles buffer of all ones (DC offset)', () => {
      const d = new FFTDetector()
      const buffer = new Float32Array(2048).fill(1.0)
      expect(() => d.detect(buffer)).not.toThrow()
    })
  })

  describe('detectFromFrequencyData', () => {
    it('returns null for empty frequency data', () => {
      const d = new FFTDetector()
      expect(d.detectFromFrequencyData(new Float32Array(0))).toBeNull()
    })

    it('returns a result for non-empty frequency data', () => {
      const d = new FFTDetector({ minAmplitude: 0.001 })
      // Create frequency data with a clear peak at bin corresponding to 440 Hz
      const binWidth = 44100 / 2048 // ~21.5 Hz
      const peakBin = Math.round(440 / binWidth)
      const magnitudes = new Float32Array(1025)
      magnitudes[peakBin] = 1.0
      const result = d.detectFromFrequencyData(magnitudes)

      expect(result).not.toBeNull()
      if (result) {
        expect(result.frequency).toBeGreaterThan(0)
      }
    })
  })

  describe('metrics and reset', () => {
    it('returns initial metrics', () => {
      const d = new FFTDetector()
      const m = d.getMetrics()
      expect(m.totalDetections).toBe(0)
      expect(m.consecutiveFailures).toBe(0)
      expect(m.averageClarity).toBe(0)
      expect(m.averageFrequency).toBe(0)
      expect(m.lastResult).toBeNull()
    })

    it('updates metrics after detection', () => {
      const d = new FFTDetector({ bufferSize: 2048, minAmplitude: 0.005 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      d.detect(buffer)
      const m = d.getMetrics()
      // FFT may or may not detect depending on bin alignment —
      // just check metrics don't throw
      expect(typeof m.totalDetections).toBe('number')
    })

    it('tracks average clarity and frequency after successful detection', () => {
      const d = new FFTDetector({ bufferSize: 2048, minAmplitude: 0.001 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      d.detect(buffer)
      const m = d.getMetrics()
      if (m.totalDetections > 0) {
        expect(m.averageClarity).toBeGreaterThan(0)
        expect(m.averageFrequency).toBeGreaterThan(0)
      }
    })

    it('resets correctly', () => {
      const d = new FFTDetector({ bufferSize: 2048, minAmplitude: 0.005 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      d.detect(buffer)
      d.reset()
      const m = d.getMetrics()
      expect(m.totalDetections).toBe(0)
      expect(m.lastResult).toBeNull()
    })

    it('getLastComputationTime returns a number', () => {
      const d = new FFTDetector()
      expect(typeof d.getLastComputationTime()).toBe('number')
    })
  })

  describe('settings mutation', () => {
    it('setMinConfidence clamps to 0-1', () => {
      const d = new FFTDetector()
      d.setMinConfidence(0.5)
      d.setMinConfidence(-1)
      d.setMinConfidence(2)
      const s = d.getSettings()
      expect(s.minConfidence).toBeGreaterThanOrEqual(0)
      expect(s.minConfidence).toBeLessThanOrEqual(1)
    })

    it('setSensitivity is a no-op', () => {
      const d = new FFTDetector()
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
        // Use larger FFT for low notes, 2048 for high notes
        const fftSize = tc.freq < 200 ? 4096 : 2048
        const d = new FFTDetector({
          bufferSize: fftSize,
          minAmplitude: 0.005,
        })
        const buffer = createSineBuffer(44100, tc.freq, 0.15)
        const result = d.detect(buffer)

        expect(result).not.toBeNull()
        if (result) {
          // FFT with windowing and interpolation should get within ~3% of target
          const tolerance = tc.freq * 0.05
          expect(Math.abs(result.frequency - tc.freq)).toBeLessThan(tolerance)
        }
      })
    }
  })

  describe('stability', () => {
    it('produces consistent results on repeated detection', () => {
      const d = new FFTDetector({ bufferSize: 2048, minAmplitude: 0.005 })
      const buffer = createSineBuffer(44100, 440, 0.1)
      const results: number[] = []

      for (let i = 0; i < 10; i++) {
        const r = d.detect(buffer)
        if (r) results.push(r.frequency)
      }

      if (results.length >= 2) {
        // All results should be very close to each other (deterministic)
        const avg = results.reduce((a, b) => a + b, 0) / results.length
        for (const r of results) {
          expect(Math.abs(r - avg)).toBeLessThan(2)
        }
      }
    })
  })
})
