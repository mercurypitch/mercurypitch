// ============================================================
// SwiftF0 Adapter — Adapter to make SwiftF0Detector conform
// to the IPitchDetector interface used by PitchTestingTab
// ============================================================

import { freqToNote } from '../scale-data'
import { SwiftF0Detector } from '../swift-f0-detector'
import type { SwiftPitchResult } from '../swift-f0-detector'
import type {
  DetectorMetrics,
  DetectorSettings,
  IPitchDetector,
  PitchAlgorithm,
  PitchDetectionResult,
} from '@/types/pitch-algorithms'

const SWIFTF0_SAMPLE_RATE = 16000

function hashBuffer(buf: Float32Array): string {
  let h = 0
  const n = Math.min(buf.length, 64)
  for (let i = 0; i < n; i++) {
    h = ((h << 5) - h + (buf[i]! * 1000) | 0) >>> 0
  }
  return String(h)
}

/** Linear resample to 16kHz for SwiftF0 model compatibility */
function resampleTo16k(data: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === SWIFTF0_SAMPLE_RATE) return data
  const ratio = inputSampleRate / SWIFTF0_SAMPLE_RATE
  const outLen = Math.floor(data.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio
    const srcFloor = Math.floor(srcIdx)
    const frac = srcIdx - srcFloor
    const a = data[srcFloor] ?? 0
    const b = data[srcFloor + 1] ?? a
    out[i] = a + (b - a) * frac
  }
  return out
}

export class SwiftF0Adapter implements IPitchDetector {
  readonly algorithm: PitchAlgorithm = 'swift'

  private detector: SwiftF0Detector
  private lastResult: PitchDetectionResult | null = null
  private cache = new Map<string, PitchDetectionResult>()
  private pendingDetect: Promise<SwiftPitchResult> | null = null
  private settings: DetectorSettings = {
    sampleRate: SWIFTF0_SAMPLE_RATE,
    minConfidence: 0.1,
  }
  private inputSampleRate = 44100

  private totalDetections = 0
  private consecutiveFailures = 0
  private averageClarity = 0
  private lastComputationTime = 0

  constructor(detector?: SwiftF0Detector) {
    this.detector = detector ?? new SwiftF0Detector({ sampleRate: SWIFTF0_SAMPLE_RATE })
    this.detector.init().then((ok) => {
      if (!ok) console.warn('[SwiftF0Adapter] Failed to initialize ONNX model')
    })
  }

  getSettings(): DetectorSettings {
    return { ...this.settings }
  }

  setSensitivity(_v: number): void {}
  setMinConfidence(v: number): void {
    this.settings.minConfidence = v
  }

  private prepareInput(timeData: Float32Array): Float32Array {
    return resampleTo16k(timeData, this.inputSampleRate)
  }

  /** Synchronous detect — returns last known result (or null if none yet). Fires async detection in background. */
  detect(timeData: Float32Array): PitchDetectionResult | null {
    const key = hashBuffer(timeData)
    const cached = this.cache.get(key)
    if (cached) return cached

    const input = this.prepareInput(timeData)
    const startTime = performance.now()
    this.pendingDetect = this.detector.detect(input)
    this.pendingDetect.then((swiftResult) => {
      this.lastComputationTime = performance.now() - startTime
      if (swiftResult.pitch > 0 && swiftResult.probability >= (this.settings.minConfidence ?? 0.1)) {
        const noteInfo = freqToNote(swiftResult.pitch)
        const result: PitchDetectionResult = {
          frequency: swiftResult.pitch,
          clarity: swiftResult.probability,
          noteName: noteInfo.name,
          octave: noteInfo.octave,
          cents: noteInfo.cents,
          midi: noteInfo.midi,
          timestamp: Date.now(),
          computationTime: this.lastComputationTime,
        }
        this.lastResult = result
        this.cache.set(key, result)
        this.totalDetections++
        this.consecutiveFailures = 0
        this.averageClarity = (this.averageClarity * (this.totalDetections - 1) + swiftResult.probability) / this.totalDetections
      } else {
        this.consecutiveFailures++
      }
    })

    return this.lastResult
  }

  /** Async detect — awaits fresh SwiftF0 ONNX inference */
  async detectAsync(timeData: Float32Array): Promise<PitchDetectionResult | null> {
    const key = hashBuffer(timeData)
    const cached = this.cache.get(key)
    if (cached) return cached

    const input = this.prepareInput(timeData)
    const startTime = performance.now()
    const swiftResult = await this.detector.detect(input)
    this.lastComputationTime = performance.now() - startTime

    if (swiftResult.pitch > 0 && swiftResult.probability >= (this.settings.minConfidence ?? 0.1)) {
      const noteInfo = freqToNote(swiftResult.pitch)
      const result: PitchDetectionResult = {
        frequency: swiftResult.pitch,
        clarity: swiftResult.probability,
        noteName: noteInfo.name,
        octave: noteInfo.octave,
        cents: noteInfo.cents,
        midi: noteInfo.midi,
        timestamp: Date.now(),
        computationTime: this.lastComputationTime,
      }
      this.lastResult = result
      this.cache.set(key, result)
      this.totalDetections++
      this.consecutiveFailures = 0
      this.averageClarity = (this.averageClarity * (this.totalDetections - 1) + swiftResult.probability) / this.totalDetections
      return result
    }

    this.consecutiveFailures++
    return null
  }

  detectFromFrequencyData(_freqData: Float32Array): PitchDetectionResult | null {
    return this.lastResult
  }

  getName(): string {
    return 'SwiftF0 ML'
  }

  getDescription(): string {
    return 'ML-based pitch detection using SwiftF0 ONNX model'
  }

  reset(): void {
    this.detector.reset()
    this.lastResult = null
    this.pendingDetect = null
  }

  getMetrics(): DetectorMetrics {
    return {
      status: this.detector.isInitialized() ? 'ok' : 'initializing',
      lastResult: this.lastResult,
      totalDetections: this.totalDetections,
      consecutiveFailures: this.consecutiveFailures,
      averageClarity: this.averageClarity,
      averageFrequency: this.lastResult?.frequency ?? 0,
    }
  }

  getLastComputationTime(): number {
    return this.lastComputationTime
  }
}
