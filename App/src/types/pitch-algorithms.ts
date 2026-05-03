// ============================================================
// Pitch Detection Algorithm Types
// Framework for comparing and evaluating pitch detection algorithms
// ============================================================

export type PitchAlgorithm = 'yin' | 'fft' | 'autocorr' | 'pyin' | null

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
