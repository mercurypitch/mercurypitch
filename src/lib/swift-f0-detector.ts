// ============================================================
// SwiftF0 Detector - ML-Based Pitch Detection (ONNX Runtime Web)
// ============================================================

import type { PitchAlgorithm } from './pitch-detector'
import ort from 'onnxruntime-web'

/** SwiftF0 pitch result */
export interface SwiftPitchResult {
  pitch: number
  probability: number
}

export interface SwiftDetectorSettings {
  /** Audio sample rate (required by SwiftF0: must be 16000 Hz) */
  sampleRate?: number
  /** ONNX model path (default: /models/swiftf0.onnx) */
  modelPath?: string
  /** Frequency bin to use (SwiftF0 requires bins 3-134, typically use 91 for A4) */
  fundamentalBin?: number
  /** Fallback frequency for zero pitch detection */
  fallbackFreq?: number
  /** Minimum probability threshold (0-1) */
  minProbability?: number
}

const DEFAULT_SETTINGS: Required<SwiftDetectorSettings> = {
  sampleRate: 16000,
  modelPath: '/models/swiftf0.onnx',
  fundamentalBin: 91, // Should correspond to A4 (440 Hz) in the model
  fallbackFreq: 0,
  minProbability: 0.1,
}

export class SwiftF0Detector {
  readonly algorithm: PitchAlgorithm = 'swift'

  private settings: Required<SwiftDetectorSettings>
  private onnxSession: any = null
  private initialized: boolean = false
  private isModelLoading: boolean = false
  private ortModule: any = null

  constructor(options: SwiftDetectorSettings = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...options }
  }

  /** Initialize the ONNX session (lazy loading) */
  async init(onnxInstance?: any): Promise<boolean> {
    if (this.initialized) return true
    if (this.isModelLoading) return false

    this.isModelLoading = true

    try {
      // If onnxInstance is provided, use it; otherwise import ort
      const ort = onnxInstance || (await import('onnxruntime-web'))

      // Validate sample rate requirement
      if (this.settings.sampleRate !== 16000) {
        console.warn(
          `[SwiftF0] SwiftF0 requires 16000 Hz sample rate, got ${this.settings.sampleRate} Hz. ` +
            `Consider using AnalyserNode with sampleRate: 16000 for accurate results.`
        )
      }

      // Create ONNX inference session
      this.onnxSession = await ort.InferenceSession.create(this.settings.modelPath, {
        executionProviders: ['wasm'],
      })

      console.log(
        `[SwiftF0] Initialized with ${this.onnxSession.numInputs} input and ${this.onnxSession.numOutputs} output tensors`
      )

      this.initialized = true
      this.isModelLoading = false
      return true
    } catch (error) {
      console.error('[SwiftF0] Failed to initialize:', error)
      this.isModelLoading = false
      return false
    }
  }

  /** Detect pitch from a frequency-domain buffer */
  async detectFromFreqData(freqData: Float32Array): Promise<SwiftPitchResult> {
    if (!this.initialized || !this.onnxSession) {
      // Try to initialize if not done yet
      const ort = await import('onnxruntime-web')
      const session = await ort.InferenceSession.create(this.settings.modelPath, {
        executionProviders: ['wasm'],
      })
      this.onnxSession = session
      this.initialized = true
    }

    if (!this.onnxSession) {
      return {
        pitch: this.settings.fallbackFreq,
        probability: 0,
      }
    }

    try {
      // SwiftF0 requires specific frequency bins
      // The model expects frequency data for bins 3 to 134 (132 bins)
      const swiftInput = freqData.slice(3, 134)

      // Create input tensor (1, 1, 1, 132) as specified in the issue
      const tensor = new ort.Tensor('float32', swiftInput, [1, 1, 1, 132])

      // Run inference
      const results = await this.onnxSession.run({ input: tensor })
      const logits = results.output.data as Float32Array

      // Find the bin with highest probability
      let maxVal = -Infinity
      let bestBin = -1

      for (let b = 0; b < logits.length; b++) {
        if (logits[b] > maxVal) {
          maxVal = logits[b]
          bestBin = b
        }
      }

      // Validate confidence
      if (maxVal < this.settings.minProbability) {
        return {
          pitch: this.settings.fallbackFreq,
          probability: 0,
        }
      }

      // Convert bin to frequency using the provided formula:
      // frequency = 46.875 * 2^((bin * (log2(2093.75/46.875)) / 199))
      // Where bin index 91 should give approximately 440 Hz (A4)
      const log2Ratio = Math.log2(2093.75 / 46.875)
      const frequency =
        bestBin > 0
          ? 46.875 * Math.pow(2, (bestBin * log2Ratio) / 199)
          : this.settings.fallbackFreq

      return {
        pitch: frequency,
        probability: maxVal,
      }
    } catch (error) {
      console.error('[SwiftF0] Detection error:', error)
      return {
        pitch: this.settings.fallbackFreq,
        probability: 0,
      }
    }
  }

  /** Detect pitch from a time-domain buffer */
  detectFromTimeData(timeData: Float32Array): SwiftPitchResult {
    // Note: SwiftF0 is designed for frequency-domain input.
    // For time-domain, we'd need to transform to frequency domain first.
    // This is a placeholder - in production use the frequency-domain path.

    // Fallback to zero pitch
    return {
      pitch: 0,
      probability: 0,
    }
  }

  getName(): string {
    return 'SwiftF0 ML'
  }

  getDescription(): string {
    return 'ML-based pitch detection using SwiftF0 model. Best for noisy environments and requires 16kHz sample rate.'
  }

  reset(): void {
    // No state to reset
  }

  isInitialized(): boolean {
    return this.initialized
  }

  getModelLoadingState(): boolean {
    return this.isModelLoading
  }

  getModelPath(): string {
    return this.settings.modelPath
  }
}
