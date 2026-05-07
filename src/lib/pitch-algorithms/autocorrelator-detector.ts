// ============================================================
// Autocorrelator Detector - Time Domain Autocorrelation Detection
// Uses parabolic interpolation for sub-sample lag accuracy.
// ============================================================

import type { DetectorMetrics, DetectorSettings, IPitchDetector, PitchAlgorithm, PitchDetectionResult, } from '@/types/pitch-algorithms'

export class AutocorrelatorDetector implements IPitchDetector {
  readonly algorithm: PitchAlgorithm = 'autocorr'

  private settings: Required<DetectorSettings>
  private metrics: DetectorMetrics
  private history: PitchDetectionResult[] = []

  constructor(options: DetectorSettings = {}) {
    this.settings = this.normalizeSettings(options)
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
    if (timeData.length === 0) return null

    const startTime = performance.now()

    const result = this.detectWithAutocorrelation(timeData)

    const computationTime = performance.now() - startTime

    if (!result) {
      this.metrics.consecutiveFailures++
      return null
    }

    this.metrics.consecutiveFailures = 0
    this.metrics.totalDetections++
    this.metrics.lastResult = result
    this.metrics.status = 'ready'

    this.history.push(result)
    if (this.history.length > 50) this.history.shift()

    return {
      frequency: result.frequency,
      clarity: result.clarity ?? 0,
      noteName: result.noteName,
      octave: result.octave,
      cents: result.cents,
      midi: result.midi,
      timestamp: Date.now(),
      computationTime,
    }
  }

  detectFromFrequencyData(freqData: Float32Array): PitchDetectionResult | null {
    return this.detect(freqData)
  }

  getName(): string {
    return 'Autocorrelation'
  }

  getDescription(): string {
    return 'Time-domain autocorrelation method with parabolic interpolation. Robust against noise and works well with inharmonic signals.'
  }

  reset(): void {
    this.history = []
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

  setSensitivity(_value: number): void {
    // Autocorrelation has no sensitivity concept; no-op
  }

  setMinConfidence(value: number): void {
    this.settings.minConfidence = Math.max(0, Math.min(1, value))
  }

  private detectWithAutocorrelation(data: Float32Array): PitchDetectionResult | null {
    const sampleRate = this.settings.sampleRate || 44100
    const n = data.length

    // Apply Hanning window to reduce spectral leakage
    const windowed = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      windowed[i] =
        data[i] * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
    }

    // Compute zero-lag energy for normalization
    let r0 = 0
    for (let i = 0; i < n; i++) {
      r0 += windowed[i] * windowed[i]
    }

    if (r0 < 1e-12) return null

    // Only compute lags in the search range (not all 22049 lags)
    const minLag = Math.max(1, Math.floor(sampleRate / this.settings.maxFrequency))
    const maxLag = Math.min(n - 1, Math.floor(sampleRate / this.settings.minFrequency))

    // Evaluate each candidate lag directly without storing the full array
    let bestLag = 0
    let bestCorr = -Infinity

    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0
      for (let i = 0; i < n - lag; i++) {
        sum += windowed[i] * windowed[i + lag]
      }
      const corr = sum / r0

      if (corr > bestCorr) {
        bestCorr = corr
        bestLag = lag
      }
    }

    if (bestLag === 0 || bestCorr < this.settings.minConfidence) {
      return null
    }

    // Parabolic interpolation for sub-sample lag accuracy.
    // This fixes the integer-lag resolution problem where high-frequency
    // notes (small lags) have coarse frequency steps (~24 Hz per lag).
    let refinedLag = bestLag
    if (bestLag > minLag && bestLag < maxLag) {
      const cPrev = this.lagCorrelation(windowed, bestLag - 1, r0, n)
      const cPeak = bestCorr
      const cNext = this.lagCorrelation(windowed, bestLag + 1, r0, n)

      const denom = 2 * (cPrev - 2 * cPeak + cNext)
      if (Math.abs(denom) > 1e-12) {
        refinedLag = bestLag + (cPrev - cNext) / denom
      }
    }

    const frequency = sampleRate / refinedLag

    // Validate frequency range
    if (
      frequency < this.settings.minFrequency ||
      frequency > this.settings.maxFrequency
    ) {
      return null
    }

    const { note, octave, cents } = this.freqToNote(frequency)
    const midi = this.frequencyToMidi(frequency)
    const noteName = note + String(octave)

    return {
      frequency,
      clarity: bestCorr,
      noteName,
      octave,
      cents,
      midi: Math.round(midi),
      timestamp: Date.now(),
      computationTime: 0,
    }
  }

  /** Compute normalized correlation at a single lag value. */
  private lagCorrelation(
    windowed: Float64Array,
    lag: number,
    r0: number,
    n: number,
  ): number {
    let sum = 0
    for (let i = 0; i < n - lag; i++) {
      sum += windowed[i] * windowed[i + lag]
    }
    return sum / r0
  }

  private normalizeSettings(
    options: DetectorSettings,
  ): Required<DetectorSettings> {
    return {
      sampleRate: options.sampleRate ?? 44100,
      bufferSize: options.bufferSize ?? 2048,
      threshold: options.threshold ?? 0.1,
      minFrequency: options.minFrequency ?? 60,
      maxFrequency: options.maxFrequency ?? 2000,
      minConfidence: options.minConfidence ?? 0.3,
      minAmplitude: options.minAmplitude ?? 0.02,
    }
  }

  private freqToNote(freq: number): {
    note: string
    octave: number
    cents: number
  } {
    const noteNames = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ]
    const a4Freq = 440.0
    const midi = 12 * Math.log2(freq / a4Freq) + 69
    const midiInt = Math.round(midi)
    const noteIndex = ((midiInt % 12) + 12) % 12
    const octave = Math.floor(midiInt / 12) - 1
    const cents = 1200 * Math.log2(freq / this.midiToFreq(midiInt))

    return {
      note: noteNames[noteIndex],
      octave,
      cents: Math.round(cents * 10) / 10,
    }
  }

  private frequencyToMidi(freq: number): number {
    return 12 * Math.log2(freq / 440) + 69
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12)
  }
}
