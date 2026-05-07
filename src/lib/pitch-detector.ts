// ============================================================
// Pitch Detector — YIN + McLeod Pitch Method (MPM)
// ============================================================

import type { DetectorMetrics, DetectorSettings, PitchDetectionResult, } from '@/types/pitch-algorithms'
import { freqToNote } from './scale-data'
import type { SwiftF0Detector } from './swift-f0-detector'

/** Supported pitch detection algorithms */
export type PitchAlgorithm = 'yin' | 'mpm' | 'swift'

/** Internal pitch detection result (partial PitchResult) */
export interface DetectedPitch {
  frequency: number
  clarity: number
  noteName: string
  octave: number
  cents: number
  computationTime?: number
  midi?: number
  timestamp?: number
}

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
  /** Pitch detection algorithm (default: 'yin') */
  algorithm?: PitchAlgorithm
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
  algorithm: 'yin',
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
  private algorithm: PitchAlgorithm
  private readonly yinBuffer: Float32Array
  private readonly pitchHistory: number[] = []
  private readonly maxHistory = 5
  private detectStartTime: number = 0
  private swiftDetector: SwiftF0Detector | null = null
  private onnxModule: {
    run: (data: Float32Array, dim: number) => number
  } | null = null
  private initialized: boolean = false

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
    this.algorithm = opts.algorithm
    this.yinBuffer = new Float32Array(Math.floor(this.bufferSize / 2))
  }

  /** Initialize SwiftF0 detector (async, called once when algorithm is set to 'swift') */
  async initializeSwiftDetector(): Promise<boolean> {
    // Only initialize if using Swift and not already initialized
    if (this.algorithm !== 'swift' || this.swiftDetector)
      return this.swiftDetector?.isInitialized() ?? false

    try {
      const { SwiftF0Detector } = await import('./swift-f0-detector')
      this.swiftDetector = new SwiftF0Detector({
        sampleRate: 16000,
        modelPath: '/models/swiftf0.onnx',
        fallbackFreq: 0,
        minProbability: 0.05,
      })
      this.initialized =
        this.onnxModule !== null
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await this.swiftDetector.init(this.onnxModule as any)
          : false
      return this.initialized
    } catch (error) {
      console.warn('[PitchDetector] SwiftF0 initialization failed:', error)
      // Don't throw - allow fallback to yin/mpm
      return false
    }
  }

  /** Get the SwiftF0 detector instance */
  getSwiftDetector(): SwiftF0Detector | null {
    return this.swiftDetector
  }

  /** Set ONNX module for SwiftF0 (useful for testing without actual ONNX) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setOnnxModule(ort: any): void {
    this.onnxModule = ort
    if (this.swiftDetector) {
      this.swiftDetector.init(ort).catch(() => {})
    }
  }

  /** Detect pitch from a time-domain buffer (e.g., AnalyserNode.getFloatTimeDomainData) */
  detect(timeDomainBuffer: Float32Array): DetectedPitch {
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

    this.detectStartTime = performance.now()

    // For SwiftF0, we need frequency-domain input
    if (this.algorithm === 'swift') {
      // Convert time-domain to frequency-domain using FFT approximation
      const freqData = this.fftToFrequencyData(timeDomainBuffer)
      // Always use DSP fallback for synchronous detection
      return this.detectFromFreqDataFallback(freqData)
    }

    // Dispatch to YIN or MPM
    const result =
      this.algorithm === 'mpm'
        ? this.analyzeMPM(timeDomainBuffer)
        : this.analyzeYIN(timeDomainBuffer)

    // Confidence gate — YIN uses adjustedThreshold() as a minimum;
    // MPM confidence is the NSDF peak value (0–1) so only minConfidence
    // applies.
    const confFloor =
      this.algorithm === 'mpm'
        ? this.minConfidence
        : Math.max(this.adjustedThreshold(), this.minConfidence)

    if (result.confidence < confFloor) {
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

  /** Detect pitch from a frequency-domain buffer (for SwiftF0).
   *  Pass optional timeData for SwiftF0 ML model (requires raw audio). */
  async detectFromFreqData(
    freqData: Float32Array,
    timeData?: Float32Array,
  ): Promise<DetectedPitch> {
    // Initialize Swift detector if needed
    await this.initializeSwiftDetector()

    if (this.algorithm === 'swift' && this.swiftDetector !== null) {
      // SwiftF0 model expects raw audio — use timeData if provided
      const input = timeData ?? freqData
      const swiftResult = await this.swiftDetector.detect(input)

      // Convert Swift result to DetectedPitch format
      if (
        swiftResult.pitch > 0 &&
        swiftResult.probability >= this.minConfidence
      ) {
        const { name, octave, cents } = freqToNote(swiftResult.pitch)
        const midi = this.getMidiFromFreq(swiftResult.pitch)
        return {
          frequency: swiftResult.pitch,
          clarity: swiftResult.probability,
          noteName: name,
          octave,
          cents,
          midi,
          timestamp: Date.now(),
        }
      }
    }

    // Fallback to YIN or MPM
    return this.detectFromFreqDataFallback(freqData)
  }

  /** Detect pitch from freqData using DSP algorithm (fallback for SwiftF0) */
  private detectFromFreqDataFallback(freqData: Float32Array): DetectedPitch {
    // For freq-domain input, use a simple peak detection algorithm
    // This is a fallback when SwiftF0 is not available or not working

    let maxVal = -Infinity
    let maxIdx = 0
    const bufferSize = freqData.length

    for (let i = 0; i < bufferSize; i++) {
      if (freqData[i] > maxVal) {
        maxVal = freqData[i]
        maxIdx = i
      }
    }

    if (maxVal < this.minAmplitude * 10) {
      return {
        frequency: 0,
        clarity: 0,
        noteName: '',
        octave: 0,
        cents: 0,
      }
    }

    const frequency = (maxIdx * this.sampleRate) / (this.bufferSize / 2)

    if (frequency < this.minFrequency || frequency > this.maxFrequency) {
      return {
        frequency: 0,
        clarity: 0,
        noteName: '',
        octave: 0,
        cents: 0,
      }
    }

    const { name, octave, cents } = freqToNote(frequency)
    const midi = this.getMidiFromFreq(frequency)
    return {
      frequency,
      clarity: maxVal / 255, // normalize for fallback
      noteName: name,
      octave,
      cents,
      midi,
      timestamp: Date.now(),
    }
  }

  /** Simple FFT approximation for frequency-domain conversion */
  private fftToFrequencyData(timeDomainBuffer: Float32Array): Float32Array {
    const N = Math.floor(timeDomainBuffer.length / 2)
    const freqData = new Float32Array(N)
    const _sampleRate = this.sampleRate

    for (let i = 0; i < N; i++) {
      let real = 0
      let imag = 0

      for (let j = 0; j < timeDomainBuffer.length; j += 2) {
        const angle = (2 * Math.PI * i * j) / this.bufferSize
        real += timeDomainBuffer[j] * Math.cos(angle)
        imag -= timeDomainBuffer[j] * Math.sin(angle)
      }

      // Single-sided spectrum
      if (i === 0) {
        freqData[i] = real / this.bufferSize
      } else if (i === Math.floor(this.bufferSize / 2)) {
        freqData[i] = real / this.bufferSize
      } else {
        freqData[i] = Math.sqrt(real * real + imag * imag) / this.bufferSize
      }
    }

    return freqData
  }

  /** Detect pitch using SwiftF0 algorithm */
  private async detectSwift(timeData: Float32Array): Promise<DetectedPitch> {
    await this.initializeSwiftDetector()

    if (this.swiftDetector !== null && this.swiftDetector.isInitialized()) {
      const swiftResult = await this.swiftDetector.detect(timeData)

      if (
        swiftResult.pitch > 0 &&
        swiftResult.probability >= this.minConfidence
      ) {
        const { name, octave, cents } = freqToNote(swiftResult.pitch)
        return {
          frequency: swiftResult.pitch,
          clarity: swiftResult.probability,
          noteName: name,
          octave,
          cents,
        }
      }
    }

    // Fallback to peak detection if SwiftF0 fails
    return this.detectFromFreqDataFallback(timeData)
  }

  // ── YIN Algorithm ─────────────────────────────────────────────

  /** Core YIN analysis */
  private analyzeYIN(buffer: Float32Array): {
    frequency: number
    confidence: number
  } {
    const halfSize = Math.floor(this.bufferSize / 2)

    // Step 1: Difference function (raw, no normalization)
    for (let tau = 0; tau < halfSize; tau++) {
      this.yinBuffer[tau] = 0
      for (let i = 0; i < halfSize; i++) {
        const delta = buffer[i] - buffer[i + tau]
        this.yinBuffer[tau] += delta * delta
      }
    }

    // Step 2: Cumulative mean normalized difference
    this.yinBuffer[0] = 1
    let cumulativeSum = 0
    for (let tau = 1; tau < halfSize; tau++) {
      cumulativeSum += this.yinBuffer[tau]
      this.yinBuffer[tau] *= tau / cumulativeSum
    }

    // Step 3: Absolute threshold — find first tau below threshold
    const threshold = this.adjustedThreshold()
    let tauEstimate = -1
    for (let tau = 2; tau < halfSize; tau++) {
      if (this.yinBuffer[tau] < threshold) {
        // Descend into the valley to find the local minimum
        while (
          tau + 1 < halfSize &&
          this.yinBuffer[tau + 1] < this.yinBuffer[tau]
        ) {
          tau++
        }
        // Also skip past any flat bottom
        while (
          tau + 1 < halfSize &&
          this.yinBuffer[tau + 1] === this.yinBuffer[tau]
        ) {
          tau++
        }
        // Verify local minimum: neighbors should be >= current value
        const isMinimum =
          (tau <= 2 || this.yinBuffer[tau - 1] >= this.yinBuffer[tau]) &&
          (tau + 1 >= halfSize ||
            this.yinBuffer[tau + 1] >= this.yinBuffer[tau])
        if (isMinimum) {
          tauEstimate = tau
          break
        }
        // Not a true minimum — keep scanning
      }
    }

    if (tauEstimate === -1) {
      return { frequency: 0, confidence: 0 }
    }

    // Octave error correction: check if tau/2 (one octave up) is also a
    // valid period candidate. If the higher-octave dip is below threshold
    // and comparable in depth, prefer it — this avoids sub-harmonic errors
    // where YIN locks onto 2× the actual period.
    const octaveTau = Math.round(tauEstimate / 2)
    if (
      octaveTau >= 2 &&
      this.yinBuffer[octaveTau] < threshold * 1.5 &&
      this.yinBuffer[octaveTau] < this.yinBuffer[tauEstimate] * 1.8
    ) {
      // Verify it's a local minimum
      const isOctaveMin =
        this.yinBuffer[octaveTau - 1] >= this.yinBuffer[octaveTau] &&
        (octaveTau + 1 >= halfSize ||
          this.yinBuffer[octaveTau + 1] >= this.yinBuffer[octaveTau])
      if (isOctaveMin) {
        tauEstimate = octaveTau
      }
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
    // Confidence: depth of the dip at the winning tau. A value near 0
    // means a very deep dip (high confidence); near 1 means barely below
    // threshold (low confidence).
    const confidence = 1 - this.yinBuffer[tauEstimate]

    return { frequency: stableFreq, confidence }
  }

  // ── McLeod Pitch Method (MPM) ─────────────────────────────────
  //
  // Based on Philip McLeod's "A Smarter Way to Find Pitch" (2005).
  // Uses the Normalized Square Difference Function (NSDF) which
  // produces peaks in the range [-1, 1], making confidence
  // estimation natural. Peak picking uses positive-going zero
  // crossings to avoid octave errors.

  /** Core MPM analysis */
  private analyzeMPM(buffer: Float32Array): {
    frequency: number
    confidence: number
  } {
    const halfSize = Math.floor(this.bufferSize / 2)
    const nsdf = this.yinBuffer // reuse the buffer

    // Step 1: Compute NSDF (Normalized Square Difference Function)
    //
    // NSDF(τ) = 2 * r(τ) / (m(τ))
    // where r(τ) = autocorrelation at lag τ
    //       m(τ) = sum of squares normalization term
    //
    // We compute both terms with the correct shrinking window per
    // McLeod's paper: for lag τ, only sum over i = 0 .. (N-1-τ).
    const N = buffer.length
    for (let tau = 0; tau < halfSize; tau++) {
      let acf = 0 // autocorrelation
      let m = 0 // normalization
      const windowLen = N - tau
      for (let i = 0; i < windowLen; i++) {
        acf += buffer[i] * buffer[i + tau]
        m += buffer[i] * buffer[i] + buffer[i + tau] * buffer[i + tau]
      }
      nsdf[tau] = m > 0 ? (2 * acf) / m : 0
    }

    // Step 2: Find key maxima using positive-going zero crossings.
    // We collect the highest peak in each "positive lobe" of the NSDF.
    // This is the core MPM innovation that avoids octave errors.
    //
    // CRITICAL: The NSDF always starts near 1.0 at τ=0 and stays
    // positive for the first few lags. This initial region is NOT a
    // meaningful pitch period — we must skip past it by waiting for
    // the NSDF to go negative at least once before collecting peaks.
    const maxPositions: number[] = []
    const maxValues: number[] = []
    let inPositiveRegion = false
    let currentMaxPos = 0
    let currentMaxVal = 0
    let seenNegative = false

    for (let tau = 1; tau < halfSize; tau++) {
      if (nsdf[tau] < 0) {
        seenNegative = true
      }
      // Only start collecting peaks after the first zero crossing
      if (!seenNegative) continue

      if (nsdf[tau] > 0 && !inPositiveRegion) {
        // Entering a positive lobe
        inPositiveRegion = true
        currentMaxPos = tau
        currentMaxVal = nsdf[tau]
      } else if (inPositiveRegion) {
        if (nsdf[tau] > currentMaxVal) {
          currentMaxPos = tau
          currentMaxVal = nsdf[tau]
        }
        if (nsdf[tau] <= 0) {
          // Leaving the positive lobe — record the peak
          maxPositions.push(currentMaxPos)
          maxValues.push(currentMaxVal)
          inPositiveRegion = false
        }
      }
    }

    // Capture the last lobe if we ended in one
    if (inPositiveRegion) {
      maxPositions.push(currentMaxPos)
      maxValues.push(currentMaxVal)
    }

    if (maxPositions.length === 0) {
      return { frequency: 0, confidence: 0 }
    }

    // Step 3: Pick the first peak that is above a proportion of the
    // global maximum. This selects the fundamental, not a harmonic.
    const globalMax = Math.max(...maxValues)
    const pickThreshold = globalMax * this.mpmPickThreshold()

    let bestTau = maxPositions[0]
    let bestVal = maxValues[0]
    for (let i = 0; i < maxPositions.length; i++) {
      if (maxValues[i] >= pickThreshold) {
        bestTau = maxPositions[i]
        bestVal = maxValues[i]
        break
      }
    }

    // Step 4: Parabolic interpolation around the chosen peak
    const betterTau = this.parabolicInterpolationMax(bestTau, nsdf)
    const frequency = this.sampleRate / betterTau

    // Reject frequencies outside the valid range
    if (frequency < this.minFrequency || frequency > this.maxFrequency) {
      return { frequency: 0, confidence: 0 }
    }

    // Step 5: Stability filter
    const stableFreq = this.applyStabilityFilter(frequency)

    // NSDF peak value directly represents confidence (0-1 range)
    const confidence = Math.max(0, Math.min(1, bestVal))

    return { frequency: stableFreq, confidence }
  }

  /** Parabolic interpolation around a MAXIMUM (for MPM/NSDF peaks) */
  private parabolicInterpolationMax(tau: number, buf: Float32Array): number {
    if (tau <= 0 || tau >= buf.length - 1) return tau

    const s0 = buf[tau - 1]
    const s1 = buf[tau]
    const s2 = buf[tau + 1]
    const denom = 2 * (2 * s1 - s2 - s0)
    if (Math.abs(denom) < 1e-10) return tau
    const shift = (s0 - s2) / denom

    return tau + shift
  }

  /** MPM pick threshold — maps sensitivity to how aggressively we
   *  pick the first peak vs waiting for a stronger one.
   *  Higher sensitivity → lower threshold → picks earlier (more
   *  responsive). Range: 0.5 (strict) to 0.9 (relaxed). */
  private mpmPickThreshold(): number {
    return 0.9 - (this.sensitivity - 1) * 0.04
  }

  // ── Shared utilities ──────────────────────────────────────────

  /** Parabolic interpolation around a MINIMUM (for YIN) */
  private parabolicInterpolation(tau: number): number {
    if (tau <= 0 || tau >= this.yinBuffer.length - 1) return tau

    const s0 = this.yinBuffer[tau - 1]
    const s1 = this.yinBuffer[tau]
    const s2 = this.yinBuffer[tau + 1]
    const shift = (s2 - s0) / (2 * (2 * s1 - s2 - s0))

    return tau + shift
  }

  /** Apply weighted median filter with outlier rejection.
   *  Detects real note changes by looking for consecutive consistent
   *  readings at a new frequency — this avoids rejecting legitimate
   *  note transitions (e.g., P5 = 50% jump) as outliers. */
  private applyStabilityFilter(frequency: number): number {
    this.pitchHistory.push(frequency)
    if (this.pitchHistory.length > this.maxHistory) {
      this.pitchHistory.shift()
    }

    if (this.pitchHistory.length < 3) {
      return frequency
    }

    // Note-change detection: if the last two readings are consistent
    // with each other (< 5% apart) but far from the older history
    // (> 15% from its median), treat it as a confirmed note change.
    const len = this.pitchHistory.length
    const secondNewest = this.pitchHistory[len - 2]!
    const newest = this.pitchHistory[len - 1]!
    const lastTwoConsistent =
      Math.abs(newest - secondNewest) / Math.min(newest, secondNewest) < 0.05

    if (lastTwoConsistent && len >= 4) {
      const oldValues = this.pitchHistory.slice(0, -2)
      const oldSorted = [...oldValues].sort((a, b) => a - b)
      const oldMedian = oldSorted[Math.floor(oldSorted.length / 2)]!
      if (Math.abs(newest - oldMedian) / oldMedian > 0.15) {
        // Confirmed note change — flush history to new frequency
        this.pitchHistory = [newest, secondNewest]
        return frequency
      }
    }

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
    return 0.3 - (this.sensitivity - 1) * 0.025
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

  /** Set the pitch detection algorithm at runtime */
  setAlgorithm(algo: PitchAlgorithm): void {
    this.algorithm = algo
    this.resetHistory()
  }

  /** Get the current algorithm */
  getAlgorithm(): PitchAlgorithm {
    return this.algorithm
  }

  /** Reset pitch history (call when sound starts) */
  resetHistory(): void {
    this.pitchHistory.length = 0
  }

  /** Get settings for display (basic implementation) */
  getSettings(): DetectorSettings {
    return {
      sampleRate: this.sampleRate,
      bufferSize: this.bufferSize,
      threshold: this.threshold,
      minFrequency: this.minFrequency,
      maxFrequency: this.maxFrequency,
      minConfidence: this.minConfidence,
      minAmplitude: this.minAmplitude,
    }
  }

  /** Detect from frequency domain (basic implementation) */
  detectFromFrequencyData(freqData: Float32Array): PitchDetectionResult | null {
    const result = this.detectFromFreqDataFallback(freqData)
    if (result.midi === undefined) {
      return null
    }
    return {
      frequency: result.frequency,
      clarity: result.clarity,
      noteName: result.noteName,
      octave: result.octave,
      cents: result.cents,
      midi: result.midi as number,
      timestamp: result.timestamp,
      computationTime: 0,
    } as PitchDetectionResult
  }

  /** Get algorithm name */
  getName(): string {
    return this.algorithm.charAt(0).toUpperCase() + this.algorithm.slice(1)
  }

  /** Get description */
  getDescription(): string {
    const descriptions: Record<string, string> = {
      yin: 'YIN algorithm using difference function and cumulative mean normalization',
      mpm: 'McLeod Pitch Method using NSDF and positive-going zero crossings',
      swift: 'ML-based pitch detection using SwiftF0 ONNX model',
    }
    return descriptions[this.algorithm] || 'Custom pitch detection'
  }

  /** Get metrics (basic implementation) */
  getMetrics(): DetectorMetrics {
    return {
      status: this.pitchHistory.length > 0 ? 'detection-active' : 'ready',
      lastResult: null,
      totalDetections: this.pitchHistory.length,
      consecutiveFailures: 0,
      averageClarity: 0,
      averageFrequency: 0,
    }
  }

  /** Get last computation time */
  getLastComputationTime(): number {
    return 0
  }

  /** Compute MIDI note from frequency */
  private getMidiFromFreq(freq: number): number {
    return Math.round(69 + 12 * Math.log2(freq / 440))
  }
}
