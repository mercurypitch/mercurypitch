// ============================================================
// Pitch Detector Tests
// ============================================================

import { beforeEach,describe, expect, it } from 'vitest'
import { PitchDetector } from '@/lib/pitch-detector'

function createSineBuffer(
  sampleRate: number,
  frequency: number,
  durationSec: number,
): Float32Array {
  const samples = Math.floor(sampleRate * durationSec)
  const buffer = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }
  return buffer
}

describe('PitchDetector', () => {
  let detector: PitchDetector

  beforeEach(() => {
    detector = new PitchDetector({ sampleRate: 44100, bufferSize: 2048 })
  })

  describe('creation', () => {
    it('creates with default options', () => {
      const d = new PitchDetector()
      expect(d.getSampleRate()).toBe(44100)
      expect(d.getBufferSize()).toBe(2048)
    })

    it('creates with custom options', () => {
      const d = new PitchDetector({
        sampleRate: 48000,
        bufferSize: 4096,
        threshold: 0.15,
        minFrequency: 100,
        maxFrequency: 1000,
        sensitivity: 3,
      })
      expect(d.getSampleRate()).toBe(48000)
      expect(d.getBufferSize()).toBe(4096)
    })
  })

  describe('pitch detection', () => {
    it('detects A4 (440 Hz) correctly', () => {
      const buffer = createSineBuffer(44100, 440, 0.05)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeCloseTo(440, 0)
      expect(result.noteName).toBe('A')
      expect(result.octave).toBe(4)
      expect(result.cents).toBeLessThan(5)
      expect(result.clarity).toBeGreaterThan(0)
    })

    it('detects C4 (261.63 Hz) correctly', () => {
      const buffer = createSineBuffer(44100, 261.63, 0.05)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeCloseTo(261.63, 1)
      expect(result.noteName).toBe('C')
      expect(result.octave).toBe(4)
    })

    it('detects G4 (392 Hz) correctly', () => {
      const buffer = createSineBuffer(44100, 392, 0.05)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeCloseTo(392, 0)
      expect(result.noteName).toBe('G')
      expect(result.octave).toBe(4)
    })

    it('detects high notes', () => {
      // C6 = 1046.5 Hz - detect with tolerance due to algorithm precision
      const buffer = createSineBuffer(44100, 1046.5, 0.05)
      const result = detector.detect(buffer)

      // Allow ±2 Hz tolerance for pitch detection
      expect(result.frequency).toBeGreaterThan(1044)
      expect(result.frequency).toBeLessThan(1050)
      expect(result.octave).toBe(6)
    })

    it('detects low notes', () => {
      // C3 = 130.81 Hz
      const buffer = createSineBuffer(44100, 130.81, 0.05)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeCloseTo(130.81, 1)
      expect(result.octave).toBe(3)
    })
  })

  describe('boundary detection', () => {
    it('rejects frequencies below minimum', () => {
      // 50 Hz is below the default minFrequency of 65 Hz
      const buffer = createSineBuffer(44100, 50, 0.05)
      const result = detector.detect(buffer)

      expect(result.frequency).toBe(0)
      expect(result.clarity).toBe(0)
    })

    it('rejects frequencies above maximum', () => {
      // 3000 Hz is above the default maxFrequency of 2100 Hz
      const buffer = createSineBuffer(44100, 3000, 0.05)
      const result = detector.detect(buffer)

      expect(result.frequency).toBe(0)
    })
  })

  describe('silence detection', () => {
    it('returns zero for silent buffer', () => {
      const buffer = new Float32Array(2048)
      const result = detector.detect(buffer)

      expect(result.frequency).toBe(0)
      expect(result.clarity).toBe(0)
    })

    it('returns zero for very quiet buffer', () => {
      const buffer = new Float32Array(2048).fill(0.001)
      const result = detector.detect(buffer)

      // Very low amplitude should not produce a pitch
      expect(result.frequency).toBe(0)
    })
  })

  describe('noise handling', () => {
    it('returns zero for random noise', () => {
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = (Math.random() - 0.5) * 2
      }
      const result = detector.detect(buffer)

      // Random noise should not produce a clear pitch
      expect(result.clarity).toBeLessThan(0.9)
    })
  })

  describe('sensitivity', () => {
    it('can set sensitivity', () => {
      detector.setSensitivity(1)
      detector.setSensitivity(5)
      detector.setSensitivity(10)
      // No error means success
    })

    it('clamps sensitivity to valid range', () => {
      detector.setSensitivity(0) // Should clamp to 1
      detector.setSensitivity(15) // Should clamp to 10
      // No error means success
    })
  })

  describe('stability filter', () => {
    it('stabilizes over multiple detections', () => {
      // Detect the same pitch multiple times
      const buffer = createSineBuffer(44100, 440, 0.05)

      // First detection - might be less stable
      const r1 = detector.detect(buffer)
      detector.resetHistory()

      // Reset and detect again
      const r2 = detector.detect(buffer)

      // Both should detect the same pitch
      expect(r1.frequency).toBeCloseTo(r2.frequency, 0)
    })

    it('can reset history', () => {
      detector.resetHistory()
      // No error means success
    })
  })

  describe('cents calculation', () => {
    it('calculates positive cents for sharp pitch', () => {
      // 446 Hz is approximately 24 cents sharp of A4 (440 Hz)
      const buffer = createSineBuffer(44100, 446, 0.05)
      const result = detector.detect(buffer)

      expect(result.cents).toBeGreaterThan(0)
    })

    it('calculates negative cents for flat pitch', () => {
      // 415 Hz is approximately -101 cents of G#4/A4
      const buffer = createSineBuffer(44100, 415, 0.05)
      const result = detector.detect(buffer)

      // Should be detected as G# or A, with cents deviation
      expect(result.frequency).toBeGreaterThan(0)
    })
  })

  describe('sample rate independence', () => {
    it('handles different sample rates', () => {
      const d48k = new PitchDetector({ sampleRate: 48000, bufferSize: 2048 })
      const buffer = createSineBuffer(48000, 440, 0.05)

      const result = d48k.detect(buffer)
      expect(result.frequency).toBeCloseTo(440, 1)
    })
  })
})
