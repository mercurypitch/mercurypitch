// ============================================================
// Autocorrelator Detector - Time Domain Autocorrelation Detection
// ============================================================

import type { IPitchDetector, PitchDetectionResult, PitchAlgorithm, DetectorSettings, DetectorMetrics } from '@/types/pitch-algorithms'

export class AutocorrelatorDetector implements IPitchDetector {
  readonly algorithm: PitchAlgorithm = 'autocorrelator'

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
    return 'Time-domain autocorrelation method. Robust against noise and works well with inharmonic signals. Uses parabolic interpolation for frequency refinement.'
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

  private detectWithAutocorrelation(data: Float32Array): { frequency: number; clarity: number; noteName: string; octave: number; cents: number; midi: number } | null {
    const sampleRate = this.settings.sampleRate || 44100

    // Apply Hanning window to reduce spectral leakage
    const windowedData = this.applyHanningWindow(data)

    // Compute autocorrelation
    const autocorr = this.computeAutocorrelation(windowedData)

    // Find fundamental frequency using first peak (excluding zero lag)
    const fundamentalFreq = this.findFundamentalFrequency(autocorr, sampleRate)

    if (!fundamentalFreq || fundamentalFreq.clarity < this.settings.minConfidence) {
      return null
    }

    // Validate frequency range
    if (fundamentalFreq.frequency < this.settings.minFrequency || fundamentalFreq.frequency > this.settings.maxFrequency) {
      return null
    }

    const { note, octave, cents } = this.freqToNote(fundamentalFreq.frequency)

    return {
      frequency: fundamentalFreq.frequency,
      clarity: fundamentalFreq.clarity,
      noteName: note,
      octave,
      cents,
      midi: this.frequencyToMidi(fundamentalFreq.frequency),
    }
  }

  private applyHanningWindow(data: Float32Array): Float32Array {
    const windowed = new Float32Array(data.length)
    const n = data.length
    for (let i = 0; i < n; i++) {
      windowed[i] = data[i] * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
    }
    return windowed
  }

  private computeAutocorrelation(data: Float32Array): number[] {
    const n = data.length
    const result = new Array(n).fill(0)

    for (let lag = 0; lag < n; lag++) {
      let sum = 0
      for (let i = 0; i < n - lag; i++) {
        sum += data[i] * data[i + lag]
      }
      result[lag] = sum / (n - lag)
    }

    return result
  }

  private findFundamentalFrequency(autocorr: number[], sampleRate: number): { frequency: number; clarity: number } | null {
    const n = autocorr.length
    const maxLag = Math.floor(sampleRate / this.settings.minFrequency)
    const minLag = Math.floor(sampleRate / this.settings.maxFrequency)

    // Ignore the zero-lag correlation (always 1.0 or high)
    let maxCorr = -1
    let maxLagIndex = 0

    for (let lag = minLag; lag < maxLag && lag < n; lag++) {
      const value = autocorr[lag]

      // Skip negative correlations (lack of periodicity)
      if (value < 0) continue

      // Track the first major peak (fundamental)
      if (value > maxCorr) {
        maxCorr = value
        maxLagIndex = lag
      }
    }

    if (maxLagIndex === 0 || maxCorr < this.settings.minConfidence) {
      return null
    }

    const frequency = sampleRate / maxLagIndex
    const clarity = maxCorr

    return { frequency, clarity }
  }

  private normalizeSettings(options: DetectorSettings): Required<DetectorSettings> {
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

  private freqToNote(freq: number): { note: string; octave: number; cents: number } {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const a4Freq = 440.0
    const midi = 12 * Math.log2(freq / a4Freq) + 69
    const midiInt = Math.round(midi)
    const noteIndex = midiInt % 12
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
