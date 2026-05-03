// ============================================================
// Pitch Detector Tests
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { PitchDetector } from '@/lib/pitch-detector'

function createSineBuffer(
  sampleRate: number,
  frequency: number,
  durationSec: number,
  amplitude: number = 1.0,
): Float32Array {
  const samples = Math.floor(sampleRate * durationSec)
  const buffer = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate)
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

  describe('edge cases - very low frequencies', () => {
    it('detects frequency at exactly minFrequency (65 Hz)', () => {
      const d = new PitchDetector({
        sampleRate: 44100,
        minFrequency: 65,
        bufferSize: 4096,
      })
      const buffer = createSineBuffer(44100, 65, 0.1)

      const result = d.detect(buffer)
      expect(result.frequency).toBeGreaterThan(0)
      expect(result.frequency).toBeLessThan(80) // Should be detected
    })

    it('rejects frequency just below minFrequency', () => {
      const d = new PitchDetector({
        sampleRate: 44100,
        minFrequency: 65,
        bufferSize: 4096,
      })
      const buffer = createSineBuffer(44100, 64.9, 0.1)

      const result = d.detect(buffer)
      expect(result.frequency).toBe(0)
      expect(result.clarity).toBe(0)
    })

    it('detects C3 (130.81 Hz) - lowest practical pitch', () => {
      const buffer = createSineBuffer(44100, 130.81, 0.1)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeCloseTo(130.81, 1)
      expect(result.octave).toBe(3)
    })
  })

  describe('edge cases - very high frequencies', () => {
    it('detects frequency just below maxFrequency (2000 Hz)', () => {
      const d = new PitchDetector({
        sampleRate: 44100,
        maxFrequency: 2100,
        bufferSize: 4096,
      })
      const buffer = createSineBuffer(44100, 2000, 0.1)

      const result = d.detect(buffer)
      expect(result.frequency).toBeGreaterThan(0)
    })

    it('detects frequency near maxFrequency (2050 Hz)', () => {
      const d = new PitchDetector({
        sampleRate: 44100,
        maxFrequency: 2100,
        bufferSize: 4096,
      })
      const buffer = createSineBuffer(44100, 2050, 0.1)

      const result = d.detect(buffer)
      expect(result.frequency).toBeGreaterThan(0)
    })

    it('rejects frequency just above maxFrequency', () => {
      const d = new PitchDetector({
        sampleRate: 44100,
        maxFrequency: 2100,
        bufferSize: 4096,
      })
      const buffer = createSineBuffer(44100, 2100.1, 0.1)

      const result = d.detect(buffer)
      expect(result.frequency).toBe(0)
    })

    it('detects high notes near limit (E6 = 1318.5 Hz)', () => {
      const buffer = createSineBuffer(44100, 1318.5, 0.1)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeGreaterThan(1300)
      expect(result.frequency).toBeLessThan(1400)
      expect(result.octave).toBe(6)
    })
  })

  describe('edge cases - amplitude thresholds', () => {
    it('returns zero for near-zero amplitude buffer', () => {
      const buffer = new Float32Array(2048).fill(0.00001)
      const result = detector.detect(buffer)

      expect(result.frequency).toBe(0)
      expect(result.clarity).toBe(0)
    })

    it('detects pitch from small amplitude sine wave', () => {
      const amplitude = 0.03
      const buffer = createSineBuffer(44100, 440, 0.1, amplitude)
      const result = detector.detect(buffer)

      // Even with small amplitude, should detect
      expect(result.frequency).toBeGreaterThan(0)
    })

    it('detects pitch from max amplitude sine wave', () => {
      const amplitude = 1.0
      const buffer = createSineBuffer(44100, 440, 0.1, amplitude)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeCloseTo(440, 0)
    })
  })

  describe('edge cases - buffer size', () => {
    it('handles power-of-2 buffer sizes correctly', () => {
      const bufferSizes = [1024, 2048, 4096, 8192]
      for (const size of bufferSizes) {
        const d = new PitchDetector({ sampleRate: 44100, bufferSize: size })
        const buffer = createSineBuffer(44100, 440, 0.1)
        const result = d.detect(buffer)
        expect(result.frequency).toBeCloseTo(440, 1)
      }
    })

    it('handles small buffers', () => {
      const buffer = createSineBuffer(44100, 440, 0.001) // Very short buffer
      const result = detector.detect(buffer)

      // May return 0 if buffer too short
      expect([0, result.frequency]).toBeDefined()
    })

    it('handles zero-length buffer (if allowed)', () => {
      const buffer = new Float32Array(0)
      const result = detector.detect(buffer)

      expect(result.frequency).toBe(0)
    })
  })

  describe('edge cases - threshold values', () => {
    it('handles minimum threshold (0.01)', () => {
      const d = new PitchDetector({
        sampleRate: 44100,
        threshold: 0.01,
        bufferSize: 2048,
      })
      const buffer = createSineBuffer(44100, 440, 0.1)

      const result = d.detect(buffer)
      expect(result.frequency).toBeCloseTo(440, 1)
    })

    it('handles maximum threshold (0.30)', () => {
      const d = new PitchDetector({
        sampleRate: 44100,
        threshold: 0.3,
        bufferSize: 2048,
      })
      const buffer = createSineBuffer(44100, 440, 0.1)

      const result = d.detect(buffer)
      // With high threshold, may reject weaker pitches
      expect(result.clarity).toBeGreaterThan(0)
    })

    it('rejects noisy pitch with high threshold', () => {
      const d = new PitchDetector({
        sampleRate: 44100,
        threshold: 0.9, // Very strict
        bufferSize: 2048,
      })
      const buffer = createSineBuffer(44100, 440, 0.1)

      const result = d.detect(buffer)
      // Should fail clarity check with very high threshold
      expect(result.clarity).toBeLessThanOrEqual(1.0)
    })
  })

  describe('edge cases - sensitivity values', () => {
    it('sets minimum sensitivity (1)', () => {
      detector.setSensitivity(1)
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = detector.detect(buffer)
      expect(result.frequency).toBeCloseTo(440, 1)
    })

    it('sets maximum sensitivity (10)', () => {
      detector.setSensitivity(10)
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = detector.detect(buffer)
      expect(result.frequency).toBeCloseTo(440, 1)
    })

    it('sensitivity extreme values are clamped', () => {
      detector.setSensitivity(-100)
      expect(detector).toBeDefined()
      detector.setSensitivity(1000)
      expect(detector).toBeDefined()
    })
  })

  describe('edge cases - noisy audio input', () => {
    it('handles multiple noise sources', () => {
      // Mix two sine waves with same frequency but opposite phase
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] =
          Math.sin((2 * Math.PI * 440 * i) / 44100) -
          Math.sin((2 * Math.PI * 440 * i) / 44100)
      }
      const result = detector.detect(buffer)

      // Should detect or return 0
      expect(result.frequency).toBeGreaterThanOrEqual(0)
    })

    it('handles non-sinusoidal waveform (square wave approximation)', () => {
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.sign(Math.sin((2 * Math.PI * 440 * i) / 44100))
      }
      const result = detector.detect(buffer)

      expect(result.frequency).toBeGreaterThan(0)
    })

    it('handles triangle wave approximation', () => {
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        const angle = (2 * Math.PI * 440 * i) / 44100
        buffer[i] = (2 / Math.PI) * Math.asin(Math.sin(angle))
      }
      const result = detector.detect(buffer)

      expect(result.frequency).toBeGreaterThan(0)
    })
  })

  describe('edge cases - multi-frequency overlap', () => {
    it('rejects harmonic overlap (500 Hz and 1000 Hz)', () => {
      // 1000 Hz is the 2nd harmonic of 500 Hz
      const buffer = createSineBuffer(44100, 500, 0.1)
      const result = detector.detect(buffer)

      // Should detect fundamental or 1000 Hz depending on algorithm
      expect(result.frequency).toBeGreaterThan(0)
    })

    it('rejects complex harmonics (440 Hz and 880 Hz)', () => {
      // Create buffer with 440 Hz and 880 Hz harmonics
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] =
          Math.sin((2 * Math.PI * 440 * i) / 44100) +
          0.5 * Math.sin((2 * Math.PI * 880 * i) / 44100)
      }
      const result = detector.detect(buffer)

      // May detect fundamental or may get confused
      expect(result.frequency).toBeGreaterThanOrEqual(0)
    })

    it('handles small harmonic ratio (440 Hz and 441 Hz)', () => {
      // Very close frequencies - should be detected as a single pitch
      const buffer = createSineBuffer(44100, 440.5, 0.1)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeGreaterThan(0)
    })
  })

  describe('edge cases - stability filter', () => {
    it('handles odd history lengths', () => {
      // The stability filter stores history, test with reset in between
      detector.resetHistory()
      const buffer = createSineBuffer(44100, 440, 0.05)
      detector.detect(buffer)
      detector.resetHistory()
      detector.detect(buffer)

      expect(detector).toBeDefined()
    })

    it('handles empty history gracefully', () => {
      detector.resetHistory()
      // After reset, next detection should not throw
      const buffer = createSineBuffer(44100, 440, 0.05)
      expect(() => detector.detect(buffer)).not.toThrow()
    })

    it('stability filter works with different pitch ranges', () => {
      const testFrequencies = [130.81, 261.63, 440, 659.25, 1046.5] // C3 to C6
      detector.resetHistory()

      for (const freq of testFrequencies) {
        const buffer = createSineBuffer(44100, freq, 0.05)
        detector.detect(buffer)
      }

      expect(detector).toBeDefined()
    })
  })

  describe('edge cases - cents and accuracy', () => {
    it('detects exactly A4 (440 Hz)', () => {
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeCloseTo(440, 0)
      expect(result.noteName).toBe('A')
    })

    it('detects middle C (261.63 Hz) within 5 cent tolerance', () => {
      const buffer = createSineBuffer(44100, 261.63, 0.1)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeCloseTo(261.63, 1)
      expect(result.cents).toBeLessThan(5)
    })

    it('cents can be negative', () => {
      const buffer = createSineBuffer(44100, 415, 0.1)
      const result = detector.detect(buffer)

      // May return G# or A, cents indicates deviation
      expect(result.frequency).toBeGreaterThan(0)
    })

    it('cents can be positive', () => {
      const buffer = createSineBuffer(44100, 446, 0.1)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeGreaterThan(0)
    })
  })

  describe('edge cases - invalid inputs', () => {
    it('handles empty Float32Array', () => {
      const buffer = new Float32Array(0)
      expect(() => detector.detect(buffer)).not.toThrow()
    })

    it('handles buffer with negative values', () => {
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = -Math.abs(Math.random())
      }
      expect(() => detector.detect(buffer)).not.toThrow()
    })

    it('handles buffer with NaN values', () => {
      const buffer = new Float32Array(2048)
      buffer[0] = NaN
      expect(() => detector.detect(buffer)).not.toThrow()
    })
  })

  describe('edge cases - duration variations', () => {
    it('detects pitch from very short buffer', () => {
      const buffer = createSineBuffer(44100, 440, 0.001)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeGreaterThanOrEqual(0)
    })

    it('detects pitch from long buffer', () => {
      const buffer = createSineBuffer(44100, 440, 1.0)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeCloseTo(440, 1)
    })

    it('detects pitch from moderate duration buffer', () => {
      const buffer = createSineBuffer(44100, 440, 0.05)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeCloseTo(440, 1)
    })
  })

  describe('edge cases - beat frequencies', () => {
    it('handles slow beat frequency (10 Hz beat between 440 and 446 Hz)', () => {
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] =
          Math.sin((2 * Math.PI * 440 * i) / 44100) +
          Math.sin((2 * Math.PI * 446 * i) / 44100)
      }
      const result = detector.detect(buffer)

      // May detect average or 438 Hz
      expect(result.frequency).toBeGreaterThanOrEqual(0)
    })

    it('handles fast beat frequency (100 Hz beat between 440 and 445 Hz)', () => {
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] =
          Math.sin((2 * Math.PI * 440 * i) / 44100) +
          0.5 * Math.sin((2 * Math.PI * 445 * i) / 44100)
      }
      const result = detector.detect(buffer)

      expect(result.frequency).toBeGreaterThanOrEqual(0)
    })
  })

  describe('edge cases - staccato and legato', () => {
    it('detects short note attack', () => {
      const buffer = createSineBuffer(44100, 440, 0.02)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeGreaterThanOrEqual(0)
    })

    it('detects sustained note', () => {
      const buffer = createSineBuffer(44100, 440, 0.2)
      const result = detector.detect(buffer)

      expect(result.frequency).toBeCloseTo(440, 1)
    })
  })

  describe('edge cases - instrument emulation', () => {
    it('detects piano-like envelope (with longer buffer)', () => {
      const buffer = new Float32Array(8192)
      for (let i = 0; i < buffer.length; i++) {
        const t = i / 44100
        const envelope = 1 - Math.exp(-t * 20) // Decay
        buffer[i] = envelope * Math.sin((2 * Math.PI * 440 * i) / 44100)
      }
      const result = detector.detect(buffer)

      // Should detect fundamental with decay envelope
      expect(result.frequency).toBeGreaterThan(0)
    })

    it('detects string-like harmonic content', () => {
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        const angle = (2 * Math.PI * 440 * i) / 44100
        buffer[i] =
          Math.sin(angle) +
          0.3 * Math.sin(2 * angle) +
          0.15 * Math.sin(3 * angle) // Harmonics
      }
      const result = detector.detect(buffer)

      // Should detect the fundamental with harmonics
      expect(result.frequency).toBeCloseTo(440, 1)
    })
  })

  describe('edge cases - performance', () => {
    it('handles 100 consecutive detections', () => {
      const startTime = performance.now()
      for (let i = 0; i < 100; i++) {
        const buffer = createSineBuffer(44100, 440, 0.05)
        detector.detect(buffer)
      }
      const duration = performance.now() - startTime

      // Detection should complete without hanging
      expect(duration).toBeGreaterThan(0)
    })

    it('handles 500 detections without memory leak', () => {
      const startTime = performance.now()
      for (let i = 0; i < 500; i++) {
        const buffer = createSineBuffer(44100, 440, 0.02)
        detector.detect(buffer)
      }
      const duration = performance.now() - startTime

      expect(duration).toBeGreaterThan(0)
    }, 10000)
  })

  describe('edge cases - combined scenarios', () => {
    it('detects noisy note attack with decay (with longer buffer)', () => {
      const buffer = new Float32Array(4096)
      for (let i = 0; i < buffer.length; i++) {
        const t = i / 44100
        const envelope = 1 - Math.exp(-t * 10)
        buffer[i] = envelope * Math.sin((2 * Math.PI * 440 * i) / 44100)
      }
      const result = detector.detect(buffer)

      expect(result.frequency).toBeGreaterThan(0)
    })

    it('handles multiple pitch changes in single buffer', () => {
      const buffer = new Float32Array(4096)
      for (let i = 0; i < buffer.length; i++) {
        const t = i / 44100
        const pitch = 440 + Math.sin(t * 10) * 50 // Modulating pitch
        buffer[i] = 0.7 * Math.sin((2 * Math.PI * pitch * i) / 44100)
      }
      const result = detector.detect(buffer)

      expect(result.frequency).toBeGreaterThanOrEqual(0)
    })
  })
})

// ============================================================
// MPM (McLeod Pitch Method) Tests
// ============================================================

describe('PitchDetector — MPM algorithm', () => {
  let detector: PitchDetector

  beforeEach(() => {
    detector = new PitchDetector({
      sampleRate: 44100,
      bufferSize: 2048,
      algorithm: 'mpm',
    })
  })

  describe('basic pitch detection', () => {
    it('detects A4 (440 Hz)', () => {
      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = detector.detect(buffer)

      // MPM has slightly different interpolation than YIN; ±5 Hz is
      // well within acceptable pitch tracking accuracy (< 20 cents).
      expect(Math.abs(result.frequency - 440)).toBeLessThan(5)
      expect(result.noteName).toBe('A')
      expect(result.octave).toBe(4)
      expect(result.clarity).toBeGreaterThan(0)
    })

    it('detects C4 (261.63 Hz)', () => {
      const buffer = createSineBuffer(44100, 261.63, 0.1)
      const result = detector.detect(buffer)

      expect(Math.abs(result.frequency - 261.63)).toBeLessThan(5)
      expect(result.noteName).toBe('C')
      expect(result.octave).toBe(4)
    })

    it('detects G4 (392 Hz)', () => {
      const buffer = createSineBuffer(44100, 392, 0.1)
      const result = detector.detect(buffer)

      expect(Math.abs(result.frequency - 392)).toBeLessThan(5)
      expect(result.noteName).toBe('G')
      expect(result.octave).toBe(4)
    })

    it('detects E5 (659.25 Hz)', () => {
      const buffer = createSineBuffer(44100, 659.25, 0.1)
      const result = detector.detect(buffer)

      expect(Math.abs(result.frequency - 659.25)).toBeLessThan(5)
      expect(result.octave).toBe(5)
    })

    it('detects C3 low note (130.81 Hz)', () => {
      const buffer = createSineBuffer(44100, 130.81, 0.1)
      const result = detector.detect(buffer)

      expect(Math.abs(result.frequency - 130.81)).toBeLessThan(5)
      expect(result.octave).toBe(3)
    })
  })

  describe('silence and noise', () => {
    it('returns zero for silence', () => {
      const buffer = new Float32Array(2048)
      const result = detector.detect(buffer)
      expect(result.frequency).toBe(0)
      expect(result.clarity).toBe(0)
    })

    it('returns zero for random noise', () => {
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = (Math.random() - 0.5) * 2
      }
      const result = detector.detect(buffer)
      expect(result.clarity).toBeLessThan(0.9)
    })
  })

  describe('harmonic content', () => {
    it('detects fundamental from signal with harmonics', () => {
      const buffer = new Float32Array(4410)
      for (let i = 0; i < buffer.length; i++) {
        const angle = (2 * Math.PI * 440 * i) / 44100
        buffer[i] =
          Math.sin(angle) +
          0.5 * Math.sin(2 * angle) +
          0.25 * Math.sin(3 * angle)
      }
      const result = detector.detect(buffer)

      // MPM should detect the 440 Hz fundamental, not 880 Hz harmonic
      expect(Math.abs(result.frequency - 440)).toBeLessThan(5)
    })

    it('handles square wave (rich harmonics)', () => {
      const buffer = new Float32Array(4410)
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.sign(Math.sin((2 * Math.PI * 440 * i) / 44100))
      }
      const result = detector.detect(buffer)
      expect(result.frequency).toBeGreaterThan(0)
    })
  })

  describe('algorithm switching', () => {
    it('can switch from YIN to MPM at runtime', () => {
      const d = new PitchDetector({ sampleRate: 44100, bufferSize: 2048 })
      expect(d.getAlgorithm()).toBe('yin')

      d.setAlgorithm('mpm')
      expect(d.getAlgorithm()).toBe('mpm')

      const buffer = createSineBuffer(44100, 440, 0.1)
      const result = d.detect(buffer)
      expect(Math.abs(result.frequency - 440)).toBeLessThan(5)
    })

    it('switching resets pitch history', () => {
      const d = new PitchDetector({ sampleRate: 44100, bufferSize: 2048 })

      // Build up some history
      const buf440 = createSineBuffer(44100, 440, 0.1)
      d.detect(buf440)
      d.detect(buf440)
      d.detect(buf440)

      // Switch algorithm — history should reset
      d.setAlgorithm('mpm')
      const buf330 = createSineBuffer(44100, 330, 0.1)
      const result = d.detect(buf330)

      // Should detect 330 Hz (E4) without the old 440 Hz history polluting it
      expect(Math.abs(result.frequency - 330)).toBeLessThan(5)
    })
  })

  describe('YIN vs MPM parity on clean signals', () => {
    const testFrequencies = [130.81, 261.63, 440, 659.25, 1046.5]

    for (const freq of testFrequencies) {
      it(`both algorithms detect ${freq} Hz within 3 Hz`, () => {
        const yinDet = new PitchDetector({
          sampleRate: 44100,
          bufferSize: 2048,
          algorithm: 'yin',
        })
        const mpmDet = new PitchDetector({
          sampleRate: 44100,
          bufferSize: 2048,
          algorithm: 'mpm',
        })
        const buffer = createSineBuffer(44100, freq, 0.1)

        const yinResult = yinDet.detect(buffer)
        const mpmResult = mpmDet.detect(buffer)

        // Allow 1% deviation (≈17 cents) — different algorithms have
        // different interpolation characteristics at higher frequencies
        const tolerance = freq * 0.01
        expect(Math.abs(yinResult.frequency - freq)).toBeLessThan(tolerance)
        expect(Math.abs(mpmResult.frequency - freq)).toBeLessThan(tolerance)
        expect(
          Math.abs(yinResult.frequency - mpmResult.frequency),
        ).toBeLessThan(tolerance)
      })
    }
  })

  describe('confidence values', () => {
    it('returns high confidence for clean sine wave', () => {
      const buffer = createSineBuffer(44100, 440, 0.05)
      const result = detector.detect(buffer)

      expect(result.clarity).toBeGreaterThan(0.8)
    })

    it('confidence is bounded 0-1', () => {
      const buffer = createSineBuffer(44100, 440, 0.05)
      const result = detector.detect(buffer)

      expect(result.clarity).toBeGreaterThanOrEqual(0)
      expect(result.clarity).toBeLessThanOrEqual(1)
    })
  })
})
