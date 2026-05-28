import { describe, expect, it } from 'vitest'
import { FFTDetector } from '../fft-detector'

/** Generate a sine wave at the given frequency, sampleRate, and duration (seconds) */
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

describe('FFTDetector', () => {
  it('detects a pure sine wave at A4 (440 Hz)', () => {
    const detector = new FFTDetector({ sampleRate: 44100, bufferSize: 2048 })
    const signal = generateSine(440, 44100, 0.1, 0.5)
    const result = detector.detect(signal)
    expect(result).not.toBeNull()
    expect(result!.noteName).toBe('A4')
    expect(Math.abs(result!.frequency - 440)).toBeLessThan(2)
  })

  it('rejects pure noise — no discernible tone (clarity < minConfidence)', () => {
    // Pure white noise has no dominant spectral peak — SNR will be low
    const detector = new FFTDetector({
      sampleRate: 44100,
      bufferSize: 2048,
      minConfidence: 0.5,
      minAmplitude: 0.001,
    })
    const n = Math.floor(44100 * 0.1)
    const signal = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      signal[i] = (Math.random() * 2 - 1) * 0.3
    }
    const result = detector.detect(signal)
    expect(result).toBeNull()
  })

  it('accepts clean detection when SNR is high (clarity >= minConfidence)', () => {
    const detector = new FFTDetector({
      sampleRate: 44100,
      bufferSize: 2048,
      minConfidence: 0.3,
      minAmplitude: 0.001,
    })
    // Clean signal — peak dominates noise floor, SNR is high
    const signal = generateSine(440, 44100, 0.1, 0.5)
    const result = detector.detect(signal)
    expect(result).not.toBeNull()
    expect(result!.clarity).toBeGreaterThanOrEqual(0.3)
  })

  it('gives high confidence for quiet but clean tones (level-independence)', () => {
    const detector = new FFTDetector({
      sampleRate: 44100,
      bufferSize: 2048,
      minConfidence: 0.2,
      minAmplitude: 0.001,
    })
    // Very quiet clean sine — old pseudoClarity would score this low,
    // but SNR-based confidence scores it high because peak dominates noise floor
    const signal = generateSine(440, 44100, 0.1, 0.02)
    const result = detector.detect(signal)
    expect(result).not.toBeNull()
    expect(result!.clarity).toBeGreaterThan(0.5)
  })

  it('rejects frequencies below minFrequency', () => {
    const detector = new FFTDetector({
      sampleRate: 44100,
      bufferSize: 2048,
      minFrequency: 100,
      maxFrequency: 2100,
    })
    const signal = generateSine(55, 44100, 0.1, 0.5)
    const result = detector.detect(signal)
    expect(result).toBeNull()
  })

  it('rejects frequencies above maxFrequency', () => {
    const detector = new FFTDetector({
      sampleRate: 44100,
      bufferSize: 2048,
      minFrequency: 65,
      maxFrequency: 1000,
    })
    const signal = generateSine(1500, 44100, 0.1, 0.5)
    const result = detector.detect(signal)
    expect(result).toBeNull()
  })

  it('returns null for empty input', () => {
    const detector = new FFTDetector({ sampleRate: 44100, bufferSize: 2048 })
    const result = detector.detect(new Float32Array(0))
    expect(result).toBeNull()
  })
})
