// ============================================================
// FFT Detector - Frequency Domain Detection
// Uses real Cooley-Tukey radix-2 FFT with parabolic interpolation
// ============================================================

import type { DetectorMetrics, DetectorSettings, IPitchDetector, PitchAlgorithm, PitchDetectionResult, } from '@/types/pitch-algorithms'

export class FFTDetector implements IPitchDetector {
  readonly algorithm: PitchAlgorithm = 'fft'

  private settings: Required<DetectorSettings>
  private metrics: DetectorMetrics
  private history: PitchDetectionResult[] = []
  private cosTable: Float64Array | null = null
  private sinTable: Float64Array | null = null
  private tableBits = 0

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

    const bufSize = this.settings.bufferSize
    const result = this.detectPitch(timeData, bufSize)

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
    return 'Frequency domain detection using Cooley-Tukey FFT with parabolic interpolation. Good for sustained tones. Resolution: ~0.1 Hz with interpolation.'
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
    // FFT has no sensitivity concept; no-op
  }

  setMinConfidence(value: number): void {
    this.settings.minConfidence = Math.max(0, Math.min(1, value))
  }

  private detectPitch(
    input: Float32Array,
    fftSize: number,
  ): PitchDetectionResult | null {
    const sampleRate = this.settings.sampleRate || 44100

    // Take fftSize samples from the input, applying Hann window
    const windowed = new Float64Array(fftSize)
    for (let i = 0; i < fftSize && i < input.length; i++) {
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
      windowed[i] = input[i] * hann
    }

    // Compute real FFT → magnitude spectrum
    const real = new Float64Array(fftSize)
    const imag = new Float64Array(fftSize)
    this.realFFT(windowed, real, imag)

    // Build magnitude spectrum (first N/2+1 bins)
    const halfSize = fftSize / 2
    const magnitudes = new Float32Array(halfSize + 1)
    for (let i = 0; i <= halfSize; i++) {
      const re = real[i]
      const im = imag[i]
      magnitudes[i] = Math.sqrt(re * re + im * im) / fftSize
    }

    return this.findPeakFrequency(magnitudes)
  }

  /**
   * Real FFT via complex FFT with conjugate-symmetric packing.
   * Places real parts in even indices, imaginary in odd indices.
   */
  /**
   * In-place Cooley-Tukey radix-2 FFT on complex interleaved data.
   * data.length = 2 * n (real, imag pairs).
   */
  private complexFFT(data: Float64Array, n: number, inverse: boolean): void {
    // Bit-reversal permutation
    const bits = Math.log2(n)
    for (let i = 0; i < n; i++) {
      let rev = 0
      let val = i
      for (let b = 0; b < bits; b++) {
        rev = (rev << 1) | (val & 1)
        val >>= 1
      }
      if (rev > i) {
        const ri = i * 2
        const rr = rev * 2
        let tmp = data[ri]
        data[ri] = data[rr]
        data[rr] = tmp
        tmp = data[ri + 1]
        data[ri + 1] = data[rr + 1]
        data[rr + 1] = tmp
      }
    }

    // Cooley-Tukey butterflies
    const sign = inverse ? 1 : -1
    for (let step = 2; step <= n; step <<= 1) {
      const halfStep = step / 2
      const angle = (sign * Math.PI) / halfStep
      const wRe = Math.cos(angle)
      const wIm = Math.sin(angle)

      for (let block = 0; block < n; block += step) {
        let twRe = 1
        let twIm = 0

        for (let k = 0; k < halfStep; k++) {
          const evenR = data[(block + k) * 2]
          const evenI = data[(block + k) * 2 + 1]
          const oddR = data[(block + k + halfStep) * 2]
          const oddI = data[(block + k + halfStep) * 2 + 1]

          const tRe = oddR * twRe - oddI * twIm
          const tIm = oddR * twIm + oddI * twRe

          data[(block + k) * 2] = evenR + tRe
          data[(block + k) * 2 + 1] = evenI + tIm
          data[(block + k + halfStep) * 2] = evenR - tRe
          data[(block + k + halfStep) * 2 + 1] = evenI - tIm

          // Next twiddle factor
          const nextTwRe = twRe * wRe - twIm * wIm
          const nextTwIm = twRe * wIm + twIm * wRe
          twRe = nextTwRe
          twIm = nextTwIm
        }
      }
    }
  }

  /**
   * Real FFT: packs N real samples into N/2 complex, runs complex FFT,
   * then unpacks to get the full spectrum.
   */
  private realFFT(
    real: Float64Array,
    outReal: Float64Array,
    outImag: Float64Array,
  ): void {
    const n = real.length
    const halfN = n / 2

    // Pack real data into complex array (interleaved real, imag)
    const data = new Float64Array(n)
    for (let i = 0; i < halfN; i++) {
      data[i * 2] = real[i * 2]
      data[i * 2 + 1] = real[i * 2 + 1]
    }

    // Run complex FFT on half-size
    this.complexFFT(data, halfN, false)

    // Unpack using conjugate symmetry
    outReal[0] = data[0] + data[1]
    outImag[0] = 0
    outReal[halfN] = data[0] - data[1]
    outImag[halfN] = 0

    for (let k = 1; k < halfN; k++) {
      const nk = halfN - k
      const reEven = (data[k * 2] + data[nk * 2]) * 0.5
      const imEven = (data[k * 2 + 1] - data[nk * 2 + 1]) * 0.5

      const angle = (Math.PI * k) / halfN
      const cosVal = Math.cos(angle)
      const sinVal = Math.sin(angle)

      const reOdd = (data[k * 2 + 1] + data[nk * 2 + 1]) * 0.5
      const imOdd = (data[nk * 2] - data[k * 2]) * 0.5

      const twRe = reOdd * cosVal - imOdd * sinVal
      const twIm = reOdd * sinVal + imOdd * cosVal

      outReal[k] = reEven + twRe
      outImag[k] = imEven + twIm
      outReal[n - k] = reEven - twRe
      outImag[n - k] = -imEven + twIm
    }
  }

  private findPeakFrequency(magnitudes: Float32Array): PitchDetectionResult | null {
    const sampleRate = this.settings.sampleRate || 44100
    const fftSize = (magnitudes.length - 1) * 2
    const binWidth = sampleRate / fftSize

    const minBin = Math.floor(this.settings.minFrequency / binWidth)
    const maxBin = Math.min(
      magnitudes.length - 2,
      Math.ceil(this.settings.maxFrequency / binWidth),
    )

    let maxVal = -Infinity
    let maxIdx = minBin

    for (let i = minBin; i <= maxBin; i++) {
      if (magnitudes[i] > maxVal) {
        maxVal = magnitudes[i]
        maxIdx = i
      }
    }

    // Amplitude threshold check
    if (maxVal < this.settings.minAmplitude * 2) {
      return null
    }

    // Parabolic interpolation for sub-bin accuracy
    let frequency: number
    if (maxIdx > minBin && maxIdx < maxBin) {
      const alpha = magnitudes[maxIdx - 1]
      const beta = magnitudes[maxIdx]
      const gamma = magnitudes[maxIdx + 1]
      const denom = alpha - 2 * beta + gamma
      if (Math.abs(denom) > 1e-12) {
        const delta = (alpha - gamma) / (2 * denom)
        frequency = (maxIdx + delta) * binWidth
      } else {
        frequency = maxIdx * binWidth
      }
    } else {
      frequency = maxIdx * binWidth
    }

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
      clarity: maxVal,
      noteName,
      octave,
      cents,
      midi: Math.round(midi),
      timestamp: Date.now(),
      computationTime: 0,
    }
  }

  private normalizeSettings(
    options: DetectorSettings,
  ): Required<DetectorSettings> {
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
