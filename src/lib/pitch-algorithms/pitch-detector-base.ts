// ============================================================
// Pitch Detection Algorithm Base Interface
// ============================================================

import type { PitchAlgorithm, PitchDetectionResult, } from '@/types/pitch-algorithms'

export interface IPitchDetector {
  /** Algorithm identifier */
  readonly algorithm: PitchAlgorithm

  /** Get current settings */
  getSettings(): DetectorSettings

  /** Detect pitch from time-domain data */
  detect(timeData: Float32Array): PitchDetectionResult | null

  /** Detect pitch from frequency-domain data (optional) */
  detectFromFrequencyData(freqData: Float32Array): PitchDetectionResult | null

  /** Get name of this algorithm */
  getName(): string

  /** Get description of this algorithm */
  getDescription(): string

  /** Reset internal state (history, buffers, etc.) */
  reset(): void

  /** Get algorithm statistics/metrics */
  getMetrics(): DetectorMetrics

  /** Get computation time of last detection (ms) */
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
  status: 'idle' | 'processing' | 'ready'
  lastResult: PitchDetectionResult | null
  totalDetections: number
  consecutiveFailures: number
  averageClarity: number
  averageFrequency: number
}
