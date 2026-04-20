// ============================================================
// Pitch Detector — YIN algorithm implementation
// ============================================================

import type { PitchResult } from '@/types'
import { freqToNote } from './scale-data'

export interface PitchDetectorOptions {
  /** Audio sample rate (default: 44100) */
  sampleRate?: number
  /** Buffer size for analysis (default: 2048) */
  bufferSize?: number
  /** YIN confidence threshold (default: 0.10) */
  threshold?: number
  /** Minimum frequency to detect (default: 65 Hz) */
  minFrequency?: number
  /** Maximum frequency to detect (default: 2100 Hz) */
  maxFrequency?: number
  /** Sensitivity 1-12 (default: 7) */
  sensitivity?: number
  /** Minimum confidence to accept pitch (0-1, default: 0.50) */
  minConfidence?: number
  /** Minimum amplitude (RMS) threshold (0-1, default: 0.05) */
  minAmplitude?: number
}

const DEFAULT_OPTIONS: Required<PitchDetectorOptions> = {
  sampleRate: 44100,
  bufferSize: 2048,
  threshold: 0.15,
  minFrequency: 65,
  maxFrequency: 2100,
  sensitivity: 7,
  minConfidence: 0.3,
  minAmplitude: 0.02,
}

export class PitchDetector {
  private readonly sampleRate: number
  private readonly bufferSize: number
  private readonly threshold: number
  private readonly minFrequency: number
  private readonly maxFrequency: number
  private sensitivity: number
  private minConfidence: number
  private minAmplitude: number
  private readonly yinBuffer: Float32Array
  private readonly pitchHistory: number[] = []
  private readonly maxHistory = 5

  constructor(options: PitchDetectorOptions = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    this.sampleRate = opts.sampleRate
    this.bufferSize = opts.bufferSize
    this.threshold = opts.threshold
    this.minFrequency = opts.minFrequency
    this.maxFrequency = opts.maxFrequency
    this.sensitivity = opts.sensitivity
    this.minConfidence = opts.minConfidence
    this.minAmplitude = opts.minAmplitude
    this.yinBuffer = new Float32Array(Math.floor(this.bufferSize / 2))
  }

  /** Detect pitch from a time-domain buffer (e.g., AnalyserNode.getFloatTimeDomainData) */
  detect(timeDomainBuffer: Float32Array): PitchResult {
    // First check amplitude threshold
    let rms = 0
    for (let i = 0; i < timeDomainBuffer.length; i++) {
      rms += timeDomainBuffer[i] * timeDomainBuffer[i]
    }
    rms = Math.sqrt(rms / timeDomainBuffer.length)
    if (rms < this.minAmplitude) {
      return {
        frequency: 0,
        clarity: 0,
        noteName: '',
        octave: 0,
        cents: 0,
      }
    }

    const result = this.analyzeBuffer(timeDomainBuffer)

    if (
      result.confidence < this.adjustedThreshold() ||
      result.confidence < this.minConfidence
    ) {
      return {
        frequency: 0,
        clarity: 0,
        noteName: '',
        octave: 0,
        cents: 0,
      }
    }

    const { name, octave, cents } = freqToNote(result.frequency)
    return {
      frequency: result.frequency,
      clarity: result.confidence,
      noteName: name,
      octave,
      cents,
    }
  }

  /** Core YIN analysis */
  private analyzeBuffer(buffer: Float32Array): {
    frequency: number
    confidence: number
  } {
    const halfSize = Math.floor(this.bufferSize / 2)
    let runningSum = 0

    // Step 1: Difference function
    for (let tau = 0; tau < halfSize; tau++) {
      this.yinBuffer[tau] = 0
      for (let i = 0; i < halfSize; i++) {
        const delta = buffer[i] - buffer[i + tau]
        this.yinBuffer[tau] += delta * delta
      }
      runningSum += this.yinBuffer[tau]
      this.yinBuffer[tau] *= tau / runningSum
    }

    // Step 2: Cumulative mean normalized difference
    this.yinBuffer[0] = 1
    let cumulativeSum = 0
    for (let tau = 1; tau < halfSize; tau++) {
      cumulativeSum += this.yinBuffer[tau]
      this.yinBuffer[tau] *= tau / cumulativeSum
    }

    // Step 3: Absolute threshold — find first tau below threshold
    let tauEstimate = -1
    for (let tau = 2; tau < halfSize; tau++) {
      if (this.yinBuffer[tau] < this.adjustedThreshold()) {
        while (
          tau + 1 < halfSize &&
          this.yinBuffer[tau + 1] < this.yinBuffer[tau]
        ) {
          tau++
        }
        tauEstimate = tau
        break
      }
    }

    if (tauEstimate === -1) {
      return { frequency: 0, confidence: 0 }
    }

    // Step 4: Parabolic interpolation for sub-sample accuracy
    const betterTau = this.parabolicInterpolation(tauEstimate)
    const frequency = this.sampleRate / betterTau

    // Reject frequencies outside the valid range
    if (frequency < this.minFrequency || frequency > this.maxFrequency) {
      return { frequency: 0, confidence: 0 }
    }

    // Step 5: Multi-stage stability check
    const stableFreq = this.applyStabilityFilter(frequency)
    const confidence = 1 - this.yinBuffer[tauEstimate]

    return { frequency: stableFreq, confidence }
  }

  /** Parabolic interpolation around the minimum */
  private parabolicInterpolation(tau: number): number {
    if (tau <= 0 || tau >= this.yinBuffer.length - 1) return tau

    const s0 = this.yinBuffer[tau - 1]
    const s1 = this.yinBuffer[tau]
    const s2 = this.yinBuffer[tau + 1]
    const shift = (s2 - s0) / (2 * (2 * s1 - s2 - s0))

    return tau + shift
  }

  /** Apply weighted median filter with outlier rejection */
  private applyStabilityFilter(frequency: number): number {
    this.pitchHistory.push(frequency)
    if (this.pitchHistory.length > this.maxHistory) {
      this.pitchHistory.shift()
    }

    if (this.pitchHistory.length < 3) {
      return frequency
    }

    // Weighted median — weight by recency
    const sorted = [...this.pitchHistory].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]

    // Reject outliers beyond 15% deviation from median
    if (Math.abs(frequency - median) / median > 0.15) {
      return median
    }

    return frequency
  }

  /** Adjust threshold based on sensitivity (1-12) */
  private adjustedThreshold(): number {
    // sensitivity 1 → threshold 0.30 (very strict), sensitivity 12 → threshold 0.01 (very relaxed)
    return 0.30 - (this.sensitivity - 1) * 0.025
  }

  /** Get the current sample rate */
  getSampleRate(): number {
    return this.sampleRate
  }

  /** Get the current buffer size */
  getBufferSize(): number {
    return this.bufferSize
  }

  /** Set sensitivity (1-10) */
  setSensitivity(value: number): void {
    this.sensitivity = Math.max(1, Math.min(10, value))
  }

  /** Set minimum confidence threshold (0-1) */
  setMinConfidence(value: number): void {
    this.minConfidence = Math.max(0, Math.min(1, value))
  }

  /** Set minimum amplitude (RMS) threshold (0-1) */
  setMinAmplitude(value: number): void {
    // Convert 1-10 scale to 0.01-0.20 range
    this.minAmplitude = Math.max(0.01, Math.min(0.2, (value / 10) * 0.2))
  }

  /** Reset pitch history (call when sound starts) */
  resetHistory(): void {
    this.pitchHistory.length = 0
  }
}
