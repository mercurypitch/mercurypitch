// ============================================================
// YIN Detector - YIN Algorithm Implementation
// Ported from existing PitchDetector with interface compliance
// ============================================================

import type { PitchDetectorOptions } from '@/lib/pitch-detector'
import { PitchDetector } from '@/lib/pitch-detector'
import type { DetectorMetrics, DetectorSettings, IPitchDetector, PitchAlgorithm, PitchDetectionResult, } from '@/types/pitch-algorithms'

export class YINDetector implements IPitchDetector {
  readonly algorithm: PitchAlgorithm = 'yin'

  private yinDetector: PitchDetector
  private settings: Required<PitchDetectorOptions>
  private metrics: DetectorMetrics

  constructor(options: DetectorSettings = {}) {
    this.settings = this.normalizeSettings(options)
    this.yinDetector = new PitchDetector(this.settings)

    this.metrics = {
      status: 'ready',
      lastResult: null,
      totalDetections: 0,
      consecutiveFailures: 0,
      averageClarity: 0,
      averageFrequency: 0,
    }
  }

  getSettings(): DetectorSettings {
    return {
      sampleRate: this.settings.sampleRate,
      bufferSize: this.settings.bufferSize,
      threshold: this.settings.threshold,
      minFrequency: this.settings.minFrequency,
      maxFrequency: this.settings.maxFrequency,
      minConfidence: this.settings.minConfidence,
      minAmplitude: this.settings.minAmplitude,
    }
  }

  detect(timeData: Float32Array): PitchDetectionResult | null {
    const startTime = performance.now()

    // Use time-domain data
    const result = this.yinDetector.detect(timeData)

    const computationTime = performance.now() - startTime

    if (!result.noteName || result.frequency === 0) {
      this.metrics.consecutiveFailures++
      return null
    }

    this.metrics.consecutiveFailures = 0
    this.metrics.totalDetections++
    this.metrics.lastResult = {
      frequency: result.frequency,
      clarity: result.clarity,
      noteName: result.noteName,
      octave: result.octave,
      cents: result.cents,
      midi: this.frequencyToMidi(result.frequency),
      timestamp: Date.now(),
      computationTime: 0,
    }
    this.metrics.status = 'ready'

    return {
      frequency: result.frequency,
      clarity: result.clarity,
      noteName: result.noteName,
      octave: result.octave,
      cents: result.cents,
      midi: this.frequencyToMidi(result.frequency),
      timestamp: Date.now(),
      computationTime,
    }
  }

  detectFromFrequencyData(
    _freqData: Float32Array,
  ): PitchDetectionResult | null {
    // YIN requires time-domain data
    return null
  }

  getName(): string {
    return 'YIN Algorithm'
  }

  getDescription(): string {
    return `YIN (Young's Independent Normalisation) pitch detection. Uses difference function, cumulative mean normalisation, and parabolic interpolation for sub-sample accuracy. Has sensitivity setting that adjusts the threshold (range: 0.30 → 0.01 as sensitivity goes 1 → 12).`
  }

  reset(): void {
    this.yinDetector.resetHistory()
    this.metrics = {
      status: 'ready',
      lastResult: null,
      totalDetections: 0,
      consecutiveFailures: 0,
      averageClarity: 0,
      averageFrequency: 0,
    }
  }

  getMetrics(): DetectorMetrics {
    return { ...this.metrics }
  }

  getLastComputationTime(): number {
    return this.metrics.lastResult?.computationTime ?? 0
  }

  setSensitivity(value: number): void {
    this.yinDetector.setSensitivity(value)
  }

  setMinConfidence(value: number): void {
    this.yinDetector.setMinConfidence(value)
  }

  private normalizeSettings(
    options: DetectorSettings,
  ): Required<PitchDetectorOptions> {
    return {
      sampleRate: options.sampleRate ?? 44100,
      bufferSize: options.bufferSize ?? 2048,
      threshold: options.threshold ?? 0.15,
      minFrequency: options.minFrequency ?? 65,
      maxFrequency: options.maxFrequency ?? 2100,
      sensitivity: 7, // Default YIN sensitivity
      minConfidence: options.minConfidence ?? 0.3,
      minAmplitude: options.minAmplitude ?? 0.02,
      algorithm: 'yin',
    }
  }

  private frequencyToMidi(freq: number): number {
    return 12 * Math.log2(freq / 440) + 69
  }
}
