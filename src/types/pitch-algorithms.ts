// ============================================================
// Pitch Detection Algorithm Types
// Framework for comparing and evaluating pitch detection algorithms
// ============================================================

export type PitchAlgorithm = 'yin' | 'fft' | 'autocorr' | 'mpm' | 'pyin' | 'swift' | null

export interface PitchDetectionResult {
  frequency: number
  clarity: number
  noteName: string
  octave: number
  cents: number
  midi: number
  timestamp: number
  computationTime: number
}

export interface PitchDetectionMetrics {
  name: string
  algorithm: PitchAlgorithm
  testCount: number
  passedCount: number
  failedCount: number
  avgErrorHz: number
  avgErrorCents: number
  accuracy5Cents: number
  accuracy10Cents: number
  accuracy50Cents: number
  falsePositiveRate: number
  minErrorHz: number
  maxErrorHz: number
  computationTimeAvg: number
  computationTimeMin: number
  computationTimeMax: number
  errors: PitchDetectionResult[]
}

export interface TestFrequency {
  frequency: number
  expectedNote: string
  expectedFreq: number
  expectedMidi: number
  expectedCents: number
}

export interface TestWaveform {
  timeData: Float32Array
  sampleRate: number
}

export interface BenchmarkResults {
  algorithms: PitchDetectionMetrics[]
  totalTests: number
  bestAccuracy: string
  bestSpeed: string
}

export interface IPitchDetector {
  algorithm: PitchAlgorithm
  getSettings(): DetectorSettings
  detect(timeData: Float32Array): PitchDetectionResult | null
  detectFromFrequencyData(freqData: Float32Array): PitchDetectionResult | null
  getName(): string
  getDescription(): string
  reset(): void
  getMetrics(): DetectorMetrics
  getLastComputationTime(): number
}

export interface DetectorSettings {
  sampleRate?: number
  bufferSize?: number
  threshold?: number
  minFrequency?: number
  maxFrequency?: number
  minConfidence?: number
  minAmplitude?: number
}

export interface DetectorMetrics {
  status: string
  lastResult: PitchDetectionResult | null
  totalDetections: number
  consecutiveFailures: number
  averageClarity: number
  averageFrequency: number
}

export interface DetectorMetricsDisplay {
  status: string
  frequency: number
  noteName: string
  midi: number
  cents: number
  clarity: number
  computation: string
}

export interface TimeStampedPitchSample {
  time: number
  freq: number | null
  noteName: string | null
  clarity: number
}
