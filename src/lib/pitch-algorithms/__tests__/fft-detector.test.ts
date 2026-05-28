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

  it('rejects low-confidence detection when pseudoClarity < minConfidence', () => {
    // Use a high minConfidence threshold so low-amplitude signals are rejected
    const detector = new FFTDetector({
      sampleRate: 44100,
      bufferSize: 2048,
      minConfidence: 0.8,
      minAmplitude: 0.001,
    })
    // Low amplitude produces low pseudoClarity — should be rejected
    const signal = generateSine(440, 44100, 0.1, 0.01)
    const result = detector.detect(signal)
    expect(result).toBeNull()
  })

  it('accepts strong detection when pseudoClarity >= minConfidence', () => {
    const detector = new FFTDetector({
      sampleRate: 44100,
      bufferSize: 2048,
      minConfidence: 0.3,
      minAmplitude: 0.001,
    })
    const signal = generateSine(440, 44100, 0.1, 0.5)
    const result = detector.detect(signal)
    expect(result).not.toBeNull()
    expect(result!.clarity).toBeGreaterThanOrEqual(0.3)
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
