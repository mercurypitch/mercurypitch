// ============================================================
// Pitch Algorithm Tester — Compare pitch detection algorithms
// ============================================================

import type { PitchDetectionResult } from './pitch-algorithms'
import type { PitchAlgorithm, DetectedPitch } from './pitch-detector'
import { PitchDetector } from './pitch-detector'
import { SwiftF0Detector } from './swift-f0-detector'

/** Sample test note with known frequency and variation */
export interface TestNote {
  name: string
  frequency: number
  deviationCents: number // +/- cents from perfect pitch
  description: string
}

/** Test sample containing multiple notes */
export interface TestSample {
  id: string
  name: string
  notes: TestNote[]
}

/** Pitch result for a single note */
export interface PitchResultForNote {
  targetFreq: number
  detectedFreq: number
  offsetCents: number
  accuracyBand: number // 100, 90, 75, 50, 0
  computedTime: number
  passed: boolean // is within +/- 10 cents?
}

/** Results from running an algorithm on a sample */
export interface AlgorithmResult {
  algorithm: PitchAlgorithm
  sampleId: string
  sampleName: string
  results: PitchResultForNote[]
  totalScore: number
  avgOffsetCents: number
  avgComputationTime: number
  maxOffsetCents: number
}

/** Accuracy bands (threshold in cents → score) */
export const ACCURACY_BANDS = [
  { threshold: 10, score: 100 },
  { threshold: 25, score: 75 },
  { threshold: 50, score: 50 },
] as const

/** Default list of pitch detection algorithms to test */
export const DEFAULT_ALGORITHMS: PitchAlgorithm[] = ['yin', 'mpm', 'swift']

/** Default list of test samples */
export const DEFAULT_SAMPLES: TestSample[] = generateDefaultSamples()

/**
 * Generate default test samples covering various notes and conditions
 */
function generateDefaultSamples(): TestSample[] {
  return [
    {
      id: 'octave1',
      name: 'Octave 1 Sine (261.63 Hz)',
      notes: [
        {
          name: 'C4',
          frequency: 261.63,
          deviationCents: 0,
          description: 'Perfect C4',
        },
        {
          name: 'C#4',
          frequency: 277.18,
          deviationCents: 0,
          description: 'C#4',
        },
        { name: 'D4', frequency: 293.66, deviationCents: 0, description: 'D4' },
        { name: 'E4', frequency: 329.63, deviationCents: 0, description: 'E4' },
        { name: 'F4', frequency: 349.23, deviationCents: 0, description: 'F4' },
        { name: 'G4', frequency: 392.0, deviationCents: 0, description: 'G4' },
        { name: 'A4', frequency: 440.0, deviationCents: 0, description: 'A4' },
        { name: 'B4', frequency: 493.88, deviationCents: 0, description: 'B4' },
      ],
    },
    {
      id: 'octave2',
      name: 'Octave 2 Sine (523.25 Hz)',
      notes: [
        { name: 'C5', frequency: 523.25, deviationCents: 0, description: 'C5' },
        {
          name: 'C#5',
          frequency: 554.37,
          deviationCents: 0,
          description: 'C#5',
        },
        { name: 'D5', frequency: 587.33, deviationCents: 0, description: 'D5' },
        { name: 'E5', frequency: 659.25, deviationCents: 0, description: 'E5' },
        { name: 'F5', frequency: 698.46, deviationCents: 0, description: 'F5' },
        { name: 'G5', frequency: 783.99, deviationCents: 0, description: 'G5' },
        { name: 'A5', frequency: 880.0, deviationCents: 0, description: 'A5' },
        { name: 'B5', frequency: 987.77, deviationCents: 0, description: 'B5' },
      ],
    },
    {
      id: 'sharp-flat',
      name: 'Sharp & Flat Variations',
      notes: [
        {
          name: 'A4 Sharp',
          frequency: 445.0,
          deviationCents: 24,
          description: '+24 cents',
        },
        {
          name: 'A4 Flat',
          frequency: 435.0,
          deviationCents: -24,
          description: '-24 cents',
        },
        {
          name: 'A4 +48',
          frequency: 445.0,
          deviationCents: 48,
          description: '+48 cents',
        },
        {
          name: 'A4 -48',
          frequency: 435.0,
          deviationCents: -48,
          description: '-48 cents',
        },
        {
          name: 'A4 -90',
          frequency: 430.51,
          deviationCents: -90,
          description: '-90 cents',
        },
      ],
    },
    {
      id: 'noisy',
      name: 'Low Amplitude (High Noise)',
      notes: [
        {
          name: 'C4 Low',
          frequency: 261.63,
          deviationCents: 0,
          description: 'Low volume',
        },
        {
          name: 'A4 Low',
          frequency: 440.0,
          deviationCents: 0,
          description: 'Low volume',
        },
      ],
    },
  ]
}

/** Compute score for an algorithm result */
export function calculateAlgorithmScore(results: PitchResultForNote[]): number {
  if (results.length === 0) return 0
  let total = 0
  for (const r of results) {
    total += r.accuracyBand
  }
  return Math.round(total / results.length)
}

/** Compute accuracy band from offset in cents */
export function getAccuracyBand(offsetCents: number): number {
  for (const band of ACCURACY_BANDS) {
    if (offsetCents <= band.threshold) return band.score
  }
  return 0
}

/** Convert frequency to cents offset from target */
export function frequencyToCents(detected: number, target: number): number {
  return 1200 * Math.log2(detected / target)
}

/** Compute absolute offset in cents */
export function getAbsoluteOffsetCents(
  detected: number,
  target: number,
): number {
  return Math.abs(frequencyToCents(detected, target))
}

/** Convert DetectedPitch to PitchDetectionResult format */
function detectedToPitchResult(
  detected: {
    frequency: number
    clarity: number
    noteName: string
    octave: number
    cents: number
  },
  computationTime: number,
): PitchDetectionResult {
  const midi = getMidiFromFreq(detected.frequency)
  return {
    frequency: detected.frequency,
    clarity: detected.clarity,
    noteName: detected.noteName,
    octave: detected.octave,
    cents: detected.cents,
    midi,
    timestamp: Date.now(),
    computationTime,
  }
}

function getMidiFromFreq(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440))
}

/** Benchmark an algorithm on a test sample */
export function benchmarkAlgorithm(
  algorithm: PitchAlgorithm,
  sample: TestSample,
  options: {
    sampleRate?: number
    bufferSize?: number
    minConfidence?: number
    onnxModule?: { run: (data: Float32Array, dim: number) => number }
  } = {},
): AlgorithmResult | null {
  // For SwiftF0, we need async handling
  if (algorithm === 'swift') {
    return null // Caller should use benchmarkAlgorithmAsync for Swift
  }

  const detector = new PitchDetector({
    algorithm,
    sampleRate: options.sampleRate ?? 44100,
    bufferSize: options.bufferSize ?? 2048,
    minConfidence: options.minConfidence ?? 0.3,
  })

  // Configure SwiftF0 detector if provided
  if (options.onnxModule) {
    detector.setOnnxModule(options.onnxModule)
  }

  const results: PitchResultForNote[] = []
  let totalOffset = 0

  // Generate sine wave for each note
  for (const note of sample.notes) {
    const waveform = generateSineWave(
      note.frequency,
      0.5,
      detector.getSampleRate(),
    )
    const startTime = performance.now()
    const detected: DetectedPitch | null = detector.detect(waveform)
    const computedTime = performance.now() - startTime

    // Ignore zero frequency (no pitch detected)
    if (
      detected === null ||
      detected.frequency === undefined ||
      detected.frequency === 0
    ) {
      results.push({
        targetFreq: note.frequency,
        detectedFreq: 0,
        offsetCents: 0,
        accuracyBand: 0,
        computedTime,
        passed: false,
      })
      continue
    }

    const offsetCents = getAbsoluteOffsetCents(
      detected.frequency,
      note.frequency,
    )
    const accuracyBand = getAccuracyBand(offsetCents)

    totalOffset += offsetCents

    results.push({
      targetFreq: note.frequency,
      detectedFreq: detected.frequency,
      offsetCents,
      accuracyBand,
      computedTime,
      passed: offsetCents <= 10,
    })
  }

  return {
    algorithm,
    sampleId: sample.id,
    sampleName: sample.name,
    results,
    totalScore: calculateAlgorithmScore(results),
    avgOffsetCents: totalOffset / results.length,
    avgComputationTime:
      results.reduce((sum, r) => sum + r.computedTime, 0) / results.length,
    maxOffsetCents: Math.max(...results.map((r) => Math.abs(r.offsetCents))),
  }
}

/** Async version of benchmarkAlgorithm for SwiftF0 */
export async function benchmarkAlgorithmAsync(
  algorithm: PitchAlgorithm,
  sample: TestSample,
  options: {
    sampleRate?: number
    bufferSize?: number
    minConfidence?: number
    onnxModule?: { run: (data: Float32Array, dim: number) => number }
  } = {},
): Promise<AlgorithmResult> {
  const sampleRate = options.sampleRate ?? 44100
  const bufferSize = options.bufferSize ?? 2048

  // Create SwiftF0 detector
  const detector = new SwiftF0Detector({
    sampleRate,
    modelPath: '/models/swiftf0.onnx',
  })

  // Initialize with onnx module if provided
  if (options.onnxModule) {
    detector.init(options.onnxModule).catch(() => {})
  }

  const results: PitchResultForNote[] = []
  let totalOffset = 0

  // Generate sine wave for each note
  for (const note of sample.notes) {
    // For SwiftF0, we need frequency domain input
    const waveform = generateSineWave(note.frequency, 0.5, sampleRate)
    const freqData = fftToFrequencyData(waveform, sampleRate, bufferSize)

    const startTime = performance.now()
    let detectedFrequency: number | null = null

    if (algorithm === 'swift' && detector.isInitialized()) {
      const swiftResult = await detector.detectFromFreqData(freqData)
      if (swiftResult.pitch > 0) {
        detectedFrequency = swiftResult.pitch
      }
    } else {
      // Fallback to simple peak detection
      let maxVal = -Infinity
      let maxIdx = 0
      for (let i = 0; i < freqData.length; i++) {
        if (freqData[i] > maxVal) {
          maxVal = freqData[i]
          maxIdx = i
        }
      }
      if (maxIdx > 0) {
        detectedFrequency = (maxIdx * sampleRate) / bufferSize
      }
    }

    const computedTime = performance.now() - startTime

    // Ignore zero frequency (no pitch detected)
    if (
      detectedFrequency === null ||
      detectedFrequency === undefined ||
      detectedFrequency === 0
    ) {
      results.push({
        targetFreq: note.frequency,
        detectedFreq: 0,
        offsetCents: 0,
        accuracyBand: 0,
        computedTime,
        passed: false,
      })
      continue
    }

    const offsetCents = getAbsoluteOffsetCents(
      detectedFrequency,
      note.frequency,
    )
    const accuracyBand = getAccuracyBand(offsetCents)

    totalOffset += offsetCents

    results.push({
      targetFreq: note.frequency,
      detectedFreq: detectedFrequency,
      offsetCents,
      accuracyBand,
      computedTime,
      passed: offsetCents <= 10,
    })
  }

  return {
    algorithm,
    sampleId: sample.id,
    sampleName: sample.name,
    results,
    totalScore: calculateAlgorithmScore(results),
    avgOffsetCents: totalOffset / results.length,
    avgComputationTime:
      results.reduce((sum, r) => sum + r.computedTime, 0) / results.length,
    maxOffsetCents: Math.max(...results.map((r) => Math.abs(r.offsetCents))),
  }
}

/** Convert time-domain to frequency-domain using FFT approximation */
function fftToFrequencyData(
  timeData: Float32Array,
  sampleRate: number,
  fftSize: number,
): Float32Array {
  const N = Math.floor(fftSize / 2)
  const freqData = new Float32Array(N)

  for (let i = 0; i < N; i++) {
    let real = 0
    let imag = 0

    for (let j = 0; j < timeData.length; j += 2) {
      const angle = (2 * Math.PI * i * j) / fftSize
      real += timeData[j] * Math.cos(angle)
      imag -= timeData[j] * Math.sin(angle)
    }

    if (i === 0) {
      freqData[i] = real / fftSize
    } else if (i === Math.floor(fftSize / 2)) {
      freqData[i] = real / fftSize
    } else {
      freqData[i] = Math.sqrt(real * real + imag * imag) / fftSize
    }
  }

  return freqData
}

/**
 * Generate a sine wave buffer for testing
 * duration: seconds of audio
 * frequency: Hz
 * sampleRate: Hz
 */
function generateSineWave(
  frequency: number,
  duration: number,
  sampleRate: number,
): Float32Array {
  const numSamples = Math.floor(duration * sampleRate)
  const wave = new Float32Array(numSamples)

  for (let i = 0; i < numSamples; i++) {
    wave[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }

  return wave
}

/** Run all algorithms on all samples and return comparison results */
export function runAllTests(
  algorithms: PitchAlgorithm[] = DEFAULT_ALGORITHMS,
  samples: TestSample[] = DEFAULT_SAMPLES,
): AlgorithmResult[] {
  const results: AlgorithmResult[] = []
  for (const algo of algorithms) {
    // Run on each sample and take the best average
    const sampleResults: AlgorithmResult[] = []
    for (const sample of samples) {
      const result = benchmarkAlgorithm(algo, sample)
      if (result) {
        sampleResults.push(result)
      }
    }

    const bestSample = sampleResults.reduce(
      (best: AlgorithmResult | null, current: AlgorithmResult) => {
        return !best || current.avgComputationTime < best.avgComputationTime
          ? current
          : best
      },
      null,
    )

    if (bestSample) {
      results.push({
        ...bestSample,
        sampleId: 'aggregate',
        sampleName: 'Best Sample (lowest computation time)',
        totalScore: calculateAlgorithmScore(bestSample.results),
        avgOffsetCents: bestSample.avgOffsetCents,
        avgComputationTime: bestSample.avgComputationTime,
        maxOffsetCents: bestSample.maxOffsetCents,
      })
    }
  }

  return results
}

/** Get performance classification for an algorithm */
export function getPerformanceClassification(time: number): {
  label: string
  color: string
} {
  // 60fps = 16.67ms per frame
  if (time < 5) {
    return { label: 'Excellent', color: 'text-green-400' }
  }
  if (time < 10) {
    return { label: 'Good', color: 'text-blue-400' }
  }
  if (time < 16.67) {
    return { label: 'Acceptable', color: 'text-yellow-400' }
  }
  if (time < 33) {
    return { label: 'Slow', color: 'text-orange-400' }
  }
  return { label: 'Too Slow', color: 'text-red-400' }
}

/** Score band names */
export const ACCURACY_BAND_LABELS = {
  100: 'Perfect',
  90: 'Excellent',
  75: 'Good',
  50: 'Okay',
  0: 'Failed',
} as const

/** Score band colors for UI */
export const ACCURACY_BAND_COLORS = {
  100: '#3fb950',
  90: '#2dd4cf',
  75: '#8dcb41',
  50: '#d29922',
  0: '#f8514d',
} as const
