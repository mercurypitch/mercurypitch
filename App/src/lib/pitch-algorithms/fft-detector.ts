// ============================================================
// FFT Detector - Frequency Domain Detection
// Simple max-amplitude frequency bin approach
// ============================================================

import type { IPitchDetector, PitchDetectionResult, PitchAlgorithm, DetectorSettings, DetectorMetrics } from '@/types/pitch-algorithms'

export class FFTDetector implements IPitchDetector {
  readonly algorithm: PitchAlgorithm = 'fft'

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

    // Convert to frequency domain
    const freqData = new Float32Array(this.settings.bufferSize / 2)
    this.computeFFT(timeData, freqData)

    // Find maximum amplitude frequency in valid range
    const result = this.findPeakFrequency(freqData)

    const computationTime = performance.now() - startTime

    if (!result) {
      this.metrics.consecutiveFailures++
      return null
    }

    this.metrics.consecutiveFailures = 0
    this.metrics.totalDetections++
    this.metrics.lastResult = result
    this.metrics.status = 'ready'

    // Keep last 50 results for averaging
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
    if (freqData.length === 0) return null

    const startTime = performance.now()
    const peak = this.findPeakFrequency(freqData)
    const computationTime = performance.now() - startTime

    if (!peak) return null

    return {
      frequency: peak.frequency,
      clarity: peak.clarity ?? 0,
      noteName: peak.noteName,
      octave: peak.octave,
      cents: peak.cents,
      midi: peak.midi,
      timestamp: Date.now(),
      computationTime,
    }
  }

  getName(): string {
    return 'FFT Max Bin'
  }

  getDescription(): string {
    return 'Simple frequency domain detection that finds the bin with maximum amplitude. Limited by frequency resolution of the FFT. Better for sustained tones than transients.'
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

  // Naive FFT implementation for demonstration
  // In production, use Web Audio API's AnalyserNode
  private computeFFT(input: Float32Array, output: Float32Array): void {
    const N = Math.floor(input.length / 2)
    const sampleRate = this.settings.sampleRate || 44100

    // Simple frequency bin calculation
    for (let i = 0; i < N; i++) {
      let real = 0
      let imag = 0

      for (let j = 0; j < input.length; j += 2) {
        const angle = (2 * Math.PI * i * j) / this.settings.bufferSize
        real += input[j] * Math.cos(angle)
        imag -= input[j] * Math.sin(angle)
      }

      // Single-sided spectrum (only positive frequencies)
      if (i === 0) {
        output[i] = real / this.settings.bufferSize
      } else if (i === Math.floor(this.settings.bufferSize / 2)) {
        // Nyquist frequency (only real part)
        output[i] = real / this.settings.bufferSize
      } else {
        output[i] = Math.sqrt(real * real + imag * imag) / this.settings.bufferSize
      }
    }
  }

  private findPeakFrequency(freqData: Float32Array): { frequency: number; clarity: number; noteName: string; octave: number; cents: number; midi: number } | null {
    const sampleRate = this.settings.sampleRate || 44100
    const bufferSize = this.settings.bufferSize
    const nyquist = sampleRate / 2

    let maxVal = -Infinity
    let maxIdx = 0

    for (let i = 0; i < freqData.length; i++) {
      if (freqData[i] > maxVal) {
        maxVal = freqData[i]
        maxIdx = i
      }
    }

    if (maxVal < this.settings.minAmplitude * 2) {
      return null
    }

    const frequency = (maxIdx * sampleRate) / bufferSize

    // Validate frequency range
    if (frequency < this.settings.minFrequency || frequency > this.settings.maxFrequency) {
      return null
    }

    // Map to musical note
    const { note, octave, cents } = this.freqToNote(frequency)

    return {
      frequency,
      clarity: maxVal,
      noteName: note,
      octave,
      cents,
      midi: this.frequencyToMidi(frequency),
    }
  }

  private normalizeSettings(options: DetectorSettings): Required<DetectorSettings> {
    return {
      sampleRate: options.sampleRate ?? 44100,
      bufferSize: options.bufferSize ?? 2048,
      threshold: options.threshold ?? 0.15,
      minFrequency: options.minFrequency ?? 65,
      maxFrequency: options.maxFrequency ?? 2100,
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
