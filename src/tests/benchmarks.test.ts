// ============================================================
// Pitch Detection Benchmarks Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  TEST_FREQUENCIES,
  TEST_INTERVALS,
  ALL_TEST_FREQUENCIES,
  errorInCents,
  errorInHz,
  generateTestWaveform,
  measureTime,
} from '../lib/pitch-algorithms/benchmarks'

describe('Test Frequencies', () => {
  it('should include C3 (130.81 Hz)', () => {
    const c3 = TEST_FREQUENCIES.find(f => f.frequency === 130.81)
    expect(c3).toBeDefined()
    expect(c3?.expectedNote).toBe('C3')
  })

  it('should include A4 (440 Hz)', () => {
    const a4 = TEST_FREQUENCIES.find(f => f.frequency === 440.0)
    expect(a4).toBeDefined()
    expect(a4?.expectedNote).toBe('A4')
  })

  it('should have multiple frequencies', () => {
    expect(TEST_FREQUENCIES.length).toBeGreaterThan(20)
  })

  it('ALL_TEST_FREQUENCIES should contain all frequencies', () => {
    const combined = [...TEST_FREQUENCIES, ...TEST_INTERVALS]
    expect(ALL_TEST_FREQUENCIES.length).toBe(combined.length)
  })
})

describe('Frequency Constants', () => {
  it('should define A4 (440 Hz) correctly', () => {
    const a4 = ALL_TEST_FREQUENCIES.find(f => f.frequency === 440.0)
    expect(a4).toBeDefined()
    expect(a4?.expectedMidi).toBe(69)
  })

  it('should include A2 (55 Hz)', () => {
    const a2 = ALL_TEST_FREQUENCIES.find(f => f.frequency === 55.0)
    expect(a2).toBeDefined()
  })

  it('should include C6 (1046.5 Hz)', () => {
    const c6 = ALL_TEST_FREQUENCIES.find(f => f.frequency === 1046.5)
    expect(c6).toBeDefined()
  })
})

describe('Error Functions', () => {
  describe('errorInCents', () => {
    it('should return 0 for perfect match', () => {
      const error = errorInCents(440, 440)
      expect(error).toBe(0)
    })

    it('should return ~200 cents for B4 (493.88) vs A4 (440)', () => {
      // B4 is ~200 cents sharp of A4
      const error = errorInCents(493.88, 440)
      expect(error).toBeGreaterThan(180)
      expect(error).toBeLessThan(220)
    })

    it('should return ~-200 cents for A4 vs B4', () => {
      const error = errorInCents(440, 493.88)
      expect(error).toBeLessThan(-180)
      expect(error).toBeGreaterThan(-220)
    })

    it('should return ~300 cents for +12 semitone (octave)', () => {
      const error = errorInCents(523.25, 440) // C5 vs A4
      expect(error).toBeGreaterThan(280)
      expect(error).toBeLessThan(320)
    })

    it('should be symmetric: error(pitch, target) = -error(target, pitch)', () => {
      const freq1 = 440
      const freq2 = 493.88

      const error1 = errorInCents(freq1, freq2)
      const error2 = errorInCents(freq2, freq1)

      expect(error1).toBeCloseTo(-error2, 1)
    })
  })

  describe('errorInHz', () => {
    it('should return 0 for perfect match', () => {
      const error = errorInHz(440, 440)
      expect(error).toBe(0)
    })

    it('should return ~53.88 Hz for B4 (493.88) vs A4 (440)', () => {
      const error = errorInHz(493.88, 440)
      expect(error).toBeCloseTo(53.88, 0)
    })

    it('should return ~53.88 Hz for A4 vs B4 (error is always positive)', () => {
      const error = errorInHz(440, 493.88)
      expect(error).toBeCloseTo(53.88, 0)
    })
  })
})

describe('generateTestWaveform', () => {
  it('should generate wave of correct length', () => {
    const waveform = generateTestWaveform(440, 0.1, 44100)
    const expectedSamples = Math.floor(0.1 * 44100) // 4410
    expect(waveform.length).toBe(expectedSamples)
  })

  it('should generate 1-second waveform with correct length', () => {
    const waveform = generateTestWaveform(440, 1.0, 44100)
    const expectedSamples = Math.floor(1.0 * 44100)
    expect(waveform.length).toBe(expectedSamples)
  })

  it('should handle 0.01 second duration', () => {
    const waveform = generateTestWaveform(440, 0.01, 44100)
    const expectedSamples = Math.floor(0.01 * 44100)
    expect(waveform.length).toBe(expectedSamples)
  })

  it('should handle different sample rates', () => {
    const waveform441 = generateTestWaveform(440, 0.1, 44100)
    const waveform480 = generateTestWaveform(440, 0.1, 48000)

    expect(waveform441.length).toBe(4410)
    expect(waveform480.length).toBe(4800)
  })

  it('should have amplitude near 1 for sustained tones', () => {
    const waveform = generateTestWaveform(440, 0.5, 44100)
    const maxAmp = Math.max(...waveform)
    expect(maxAmp).toBeGreaterThan(0.9)
  })

  it('should handle different frequencies', () => {
    const waveform440 = generateTestWaveform(440, 0.1, 44100)
    const waveform880 = generateTestWaveform(880, 0.1, 44100)

    // 880Hz wave should have roughly the same duration in samples
    expect(waveform440.length).toBeCloseTo(waveform880.length, 0)
  })
})

describe('measureTime', () => {
  it('should measure time for synchronous function', () => {
    const { result, time } = measureTime(() => {
      let sum = 0
      for (let i = 0; i < 10000; i++) {
        sum += i
      }
      return sum
    })

    expect(result).toBeGreaterThanOrEqual(0)
    expect(time).toBeGreaterThanOrEqual(0)
    expect(time).toBeLessThan(1000) // Should complete in <1 second
  })

  it('should measure time for empty function', () => {
    const { time } = measureTime(() => {})
    expect(time).toBeGreaterThanOrEqual(0)
  })

  it('should throw error for throwing functions (no error handling)', () => {
    expect(() => {
      measureTime(() => {
        throw new Error('Test error')
      })
    }).toThrow('Test error')
  })
})

describe('Test Frequency Structure', () => {
  it('should have expected properties on test frequencies', () => {
    const testFreq = TEST_FREQUENCIES[0]
    expect(testFreq).toBeDefined()
    expect(testFreq.frequency).toBeTypeOf('number')
    expect(testFreq.expectedFreq).toBeTypeOf('number')
    expect(testFreq.expectedMidi).toBeTypeOf('number')
    expect(testFreq.expectedCents).toBeTypeOf('number')
    expect(testFreq.frequency).toBeGreaterThan(0)
  })

  it('should have consistent cents for perfect matches', () => {
    TEST_FREQUENCIES.forEach(freq => {
      if (freq.expectedCents === 0) {
        const error = Math.abs(freq.frequency - freq.expectedFreq)
        expect(error).toBeLessThan(0.01) // Should be nearly equal
      }
    })
  })
})

describe('Boundary Cases', () => {
  it('should handle very low frequency', () => {
    const waveform = generateTestWaveform(55, 0.1, 44100)
    const expectedSamples = Math.floor(0.1 * 44100)
    expect(waveform.length).toBe(expectedSamples)
    expect(waveform[0]).toBeCloseTo(0, 1)
  })

  it('should handle very high frequency', () => {
    const waveform = generateTestWaveform(2000, 0.05, 44100)
    const expectedSamples = Math.floor(0.05 * 44100)
    expect(waveform.length).toBe(expectedSamples)
  })

  it('should handle zero deviation in cents', () => {
    const error = errorInCents(261.63, 261.63)
    expect(error).toBe(0)
  })
})

describe('Test Intervals', () => {
  it('should have interval test cases', () => {
    expect(TEST_INTERVALS.length).toBeGreaterThan(0)
  })

  it('should have multiple interval types', () => {
    expect(TEST_INTERVALS.length).toBeGreaterThanOrEqual(6)
  })
})
