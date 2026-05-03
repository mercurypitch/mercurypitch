// ============================================================
// Pitch Detection Benchmarking Framework
// Compares algorithms against known test frequencies
// ============================================================

import type { IPitchDetector, PitchDetectionMetrics, PitchDetectionResult, TestFrequency, TestWaveform } from '@/types/pitch-algorithms'
import { YINDetector } from './yin-detector'

// Well-known musical frequencies with ground truth
export const TEST_FREQUENCIES: TestFrequency[] = [
  // C3 (MIDI 48)
  { frequency: 130.81, expectedNote: 'C3', expectedFreq: 130.81, expectedMidi: 48, expectedCents: 0 },
  { frequency: 261.63, expectedNote: 'C4', expectedFreq: 261.63, expectedMidi: 60, expectedCents: 0 },
  { frequency: 523.25, expectedNote: 'C5', expectedFreq: 523.25, expectedMidi: 72, expectedCents: 0 },

  // D3 (MIDI 50)
  { frequency: 146.83, expectedNote: 'D3', expectedFreq: 146.83, expectedMidi: 50, expectedCents: 0 },
  { frequency: 293.66, expectedNote: 'D4', expectedFreq: 293.66, expectedMidi: 62, expectedCents: 0 },
  { frequency: 587.33, expectedNote: 'D5', expectedFreq: 587.33, expectedMidi: 74, expectedCents: 0 },

  // E3 (MIDI 52)
  { frequency: 164.81, expectedNote: 'E3', expectedFreq: 164.81, expectedMidi: 52, expectedCents: 0 },
  { frequency: 329.63, expectedNote: 'E4', expectedFreq: 329.63, expectedMidi: 64, expectedCents: 0 },
  { frequency: 659.25, expectedNote: 'E5', expectedFreq: 659.25, expectedMidi: 76, expectedCents: 0 },

  // F3 (MIDI 53)
  { frequency: 174.61, expectedNote: 'F3', expectedFreq: 174.61, expectedMidi: 53, expectedCents: 0 },
  { frequency: 349.23, expectedNote: 'F4', expectedFreq: 349.23, expectedMidi: 65, expectedCents: 0 },
  { frequency: 698.46, expectedNote: 'F5', expectedFreq: 698.46, expectedMidi: 77, expectedCents: 0 },

  // G3 (MIDI 55)
  { frequency: 196.00, expectedNote: 'G3', expectedFreq: 196.00, expectedMidi: 55, expectedCents: 0 },
  { frequency: 392.00, expectedNote: 'G4', expectedFreq: 392.00, expectedMidi: 67, expectedCents: 0 },
  { frequency: 783.99, expectedNote: 'G5', expectedFreq: 783.99, expectedMidi: 79, expectedCents: 0 },

  // A3 (MIDI 57)
  { frequency: 220.00, expectedNote: 'A3', expectedFreq: 220.00, expectedMidi: 57, expectedCents: 0 },
  { frequency: 440.00, expectedNote: 'A4', expectedFreq: 440.00, expectedMidi: 69, expectedCents: 0 },
  { frequency: 880.00, expectedNote: 'A5', expectedFreq: 880.00, expectedMidi: 81, expectedCents: 0 },

  // B3 (MIDI 59)
  { frequency: 246.94, expectedNote: 'B3', expectedFreq: 246.94, expectedMidi: 59, expectedCents: 0 },
  { frequency: 493.88, expectedNote: 'B4', expectedFreq: 493.88, expectedMidi: 71, expectedCents: 0 },
  { frequency: 987.77, expectedNote: 'B5', expectedFreq: 987.77, expectedMidi: 83, expectedCents: 0 },

  // Lower octave
  { frequency: 55.00, expectedNote: 'A2', expectedFreq: 55.00, expectedMidi: 45, expectedCents: 0 },
  { frequency: 65.41, expectedNote: 'C2', expectedFreq: 65.41, expectedMidi: 48, expectedCents: 0 },
  { frequency: 78.39, expectedNote: 'D2', expectedFreq: 78.39, expectedMidi: 50, expectedCents: 0 },

  // Higher octave
  { frequency: 1046.50, expectedNote: 'C6', expectedFreq: 1046.50, expectedMidi: 84, expectedCents: 0 },
  { frequency: 1174.66, expectedNote: 'D6', expectedFreq: 1174.66, expectedMidi: 86, expectedCents: 0 },
  { frequency: 1318.51, expectedNote: 'E6', expectedFreq: 1318.51, expectedMidi: 88, expectedCents: 0 },
]

// Test intervals (fractions of semitone)
export const TEST_INTERVALS: TestFrequency[] = [
  { frequency: 261.63 * Math.pow(2, 1/12), expectedNote: 'C#4', expectedFreq: 277.18, expectedMidi: 61, expectedCents: 100 },
  { frequency: 261.63 * Math.pow(2, 2/12), expectedNote: 'D4', expectedFreq: 293.66, expectedMidi: 62, expectedCents: 200 },
  { frequency: 261.63 * Math.pow(2, 4/12), expectedNote: 'E4', expectedFreq: 329.63, expectedMidi: 64, expectedCents: 400 },
  { frequency: 261.63 * Math.pow(2, 5/12), expectedNote: 'F4', expectedFreq: 349.23, expectedMidi: 65, expectedCents: 500 },
  { frequency: 261.63 * Math.pow(2, 7/12), expectedNote: 'G4', expectedFreq: 392.00, expectedMidi: 67, expectedCents: 700 },
  { frequency: 261.63 * Math.pow(2, 11/12), expectedNote: 'B4', expectedFreq: 493.88, expectedMidi: 71, expectedCents: 1100 },
]

// All test frequencies combined
export const ALL_TEST_FREQUENCIES: TestFrequency[] = [
  ...TEST_FREQUENCIES,
  ...TEST_INTERVALS,
]

export interface BenchmarkOptions {
  detectors: IPitchDetector[]
  sampleRate?: number
  bufferSize?: number
  includeIntervals?: boolean
}

export interface BenchmarkResult {
  metrics: PitchDetectionMetrics[]
  totalTests: number
  bestAccuracy: PitchDetectionMetrics
  bestSpeed: PitchDetectionMetrics
}

/**
 * Generates a synthetic test waveform with a specific frequency
 */
export function generateTestWaveform(freq: number, durationSec: number = 0.2, sampleRate: number = 44100): Float32Array {
  const samples = Math.floor(durationSec * sampleRate)
  const buffer = new Float32Array(samples)

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate
    // Sine wave with slight decay at start
    const amplitude = t < 0.01 ? t / 0.01 : 1
    buffer[i] = Math.sin(2 * Math.PI * freq * t) * amplitude
  }

  return buffer
}

/**
 * Measure execution time of a function
 */
export function measureTime<T>(fn: () => T): { result: T; time: number } {
  const start = performance.now()
  const result = fn()
  return { result, time: performance.now() - start }
}

/**
 * Calculate absolute error in cents between detected and expected frequencies
 */
export function errorInCents(detected: number, expected: number): number {
  return 1200 * Math.log2(detected / expected)
}

/**
 * Calculate absolute error in Hz
 */
export function errorInHz(detected: number, expected: number): number {
  return Math.abs(detected - expected)
}

/**
 * Run benchmark on all detectors with the test frequencies
 */
export function runBenchmarks(options: BenchmarkOptions): BenchmarkResult {
  const totalTests = options.includeIntervals
    ? ALL_TEST_FREQUENCIES.length
    : TEST_FREQUENCIES.length

  const results: PitchDetectionMetrics[] = []

  for (const detector of options.detectors) {
    const errors: PitchDetectionResult[] = []
    let totalErrorHz = 0
    let totalErrorCents = 0
    let passed5Cents = 0
    let passed10Cents = 0
    let passed50Cents = 0
    let minErrorHz = Infinity
    let maxErrorHz = -Infinity
    let totalCompTime = 0
    let totalClarity = 0

    const testSet = options.includeIntervals ? ALL_TEST_FREQUENCIES : TEST_FREQUENCIES

    for (const test of testSet) {
      const waveform = generateTestWaveform(test.frequency, 0.5, options.sampleRate ?? 44100)

      const { result, time } = measureTime(() => detector.detect(waveform))

      if (result) {
        const errorHz = errorInHz(result.frequency, test.expectedFreq)
        const errorCents = Math.abs(errorInCents(result.frequency, test.expectedFreq))

        errors.push(result)
        totalErrorHz += errorHz
        totalErrorCents += errorCents
        totalCompTime += result.computationTime
        totalClarity += result.clarity ?? 0

        if (errorCents <= 5) passed5Cents++
        if (errorCents <= 10) passed10Cents++
        if (errorCents <= 50) passed50Cents++

        if (errorHz > 0 && errorHz < minErrorHz) minErrorHz = errorHz
        if (errorHz > 0 && errorHz > maxErrorHz) maxErrorHz = errorHz
      }
    }

    const avgErrorHz = errors.length > 0 ? totalErrorHz / errors.length : 0
    const avgErrorCents = errors.length > 0 ? totalErrorCents / errors.length : 0
    const avgClarity = errors.length > 0 ? totalClarity / errors.length : 0
    const avgCompTime = errors.length > 0 ? totalCompTime / errors.length : 0

    const failedCount = totalTests - errors.length
    const passedCount = errors.length

    results.push({
      name: detector.getName(),
      algorithm: detector.algorithm,
      testCount: totalTests,
      passedCount,
      failedCount,
      avgErrorHz,
      avgErrorCents,
      accuracy5Cents: totalTests > 0 ? (passed5Cents / totalTests) * 100 : 0,
      accuracy10Cents: totalTests > 0 ? (passed10Cents / totalTests) * 100 : 0,
      accuracy50Cents: totalTests > 0 ? (passed50Cents / totalTests) * 100 : 0,
      falsePositiveRate: failedCount / Math.max(totalTests, 1),
      minErrorHz,
      maxErrorHz,
      computationTimeAvg: avgCompTime,
      computationTimeMin: errors.length > 0 ? Math.min(...errors.map(e => e.computationTime)) : 0,
      computationTimeMax: errors.length > 0 ? Math.max(...errors.map(e => e.computationTime)) : 0,
      errors,
    })
  }

  // Find best accuracy (based on 10-cent threshold)
  const bestAccuracy = results.reduce((best, current) =>
    current.accuracy10Cents > best.accuracy10Cents ? current : best
  , results[0] || { accuracy10Cents: 0 } as any)

  // Find best speed (lowest computation time)
  const bestSpeed = results.reduce((best, current) =>
    current.computationTimeAvg < best.computationTimeAvg ? current : best
  , results[0] || { computationTimeAvg: Infinity } as any)

  return {
    metrics: results,
    totalTests,
    bestAccuracy,
    bestSpeed,
  }
}

/**
 * Get summary of algorithm performance
 */
export function generateSummary(metrics: PitchDetectionMetrics): string {
  return `
**${metrics.name} (${metrics.algorithm})**
- Tests: ${metrics.testCount}
- Passed: ${metrics.passedCount}/${metrics.testCount} (${metrics.accuracy10Cents.toFixed(1)}% within 10 cents)
- Accuracy 5 cents: ${metrics.accuracy5Cents.toFixed(1)}%
- Avg error: ${metrics.avgErrorHz.toFixed(2)} Hz (${metrics.avgErrorCents.toFixed(2)} cents)
- False positive rate: ${(metrics.falsePositiveRate * 100).toFixed(2)}%
- Avg computation time: ${metrics.computationTimeAvg.toFixed(2)}ms
  `.trim()
}
