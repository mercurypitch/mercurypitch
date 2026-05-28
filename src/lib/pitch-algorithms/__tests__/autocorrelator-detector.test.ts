import { describe, expect, it } from 'vitest'
import { AutocorrelatorDetector } from '../autocorrelator-detector'

function generateSine(
  freq: number,
  sampleRate: number,
  durationSec: number,
  amplitude: number,
): Float32Array {
  const n = Math.floor(sampleRate * durationSec)
  const data = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    data[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate)
  }
  return data
}

describe('AutocorrelatorDetector', () => {
  it('uses the standardized 65–2100 Hz default range (was 60–2000)', () => {
    const detector = new AutocorrelatorDetector()
    const settings = detector.getSettings()
    expect(settings.minFrequency).toBe(65)
    expect(settings.maxFrequency).toBe(2100)
  })

  it('detects a pure sine wave at A4 (440 Hz)', () => {
    const detector = new AutocorrelatorDetector({
      sampleRate: 44100,
      bufferSize: 1024,
    })
    const signal = generateSine(440, 44100, 0.1, 0.5)
    const result = detector.detect(signal)
    expect(result).not.toBeNull()
    expect(result!.noteName).toBe('A4')
    expect(Math.abs(result!.frequency - 440)).toBeLessThan(5)
  })

  it('never reports frequencies outside [65, 2100] Hz', () => {
    // Test a range of signals — any returned frequency must be within range
    const detector = new AutocorrelatorDetector({
      sampleRate: 44100,
      bufferSize: 1024,
      minFrequency: 65,
      maxFrequency: 2100,
    })
    const testFreqs = [55, 100, 300, 600, 1000, 1500, 2500, 4000]
    for (const freq of testFreqs) {
      const signal = generateSine(freq, 44100, 0.1, 0.5)
      const result = detector.detect(signal)
      if (result !== null) {
        expect(result.frequency).toBeGreaterThanOrEqual(65)
        expect(result.frequency).toBeLessThanOrEqual(2100)
      }
    }
  })

  it('returns null for silence (zero energy)', () => {
    const detector = new AutocorrelatorDetector({
      sampleRate: 44100,
      bufferSize: 1024,
    })
    const signal = new Float32Array(4410)
    const result = detector.detect(signal)
    expect(result).toBeNull()
  })

  it('default minConfidence is 0.3 (matches other detectors)', () => {
    const detector = new AutocorrelatorDetector()
    expect(detector.getSettings().minConfidence).toBe(0.3)
  })

  it('returns null for empty input', () => {
    const detector = new AutocorrelatorDetector({
      sampleRate: 44100,
      bufferSize: 1024,
    })
    const result = detector.detect(new Float32Array(0))
    expect(result).toBeNull()
  })
})
