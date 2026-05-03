// ============================================================
// SwiftF0 Detector - ML-Based Pitch Detection (ONNX Runtime Web)
// ============================================================

import type ort from 'onnxruntime-web'
import type { PitchAlgorithm } from './pitch-detector'

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

/** Mock ONNX module for testing without actual ONNX Runtime */
export interface MockOnnxModule {
  create: (
    path: string,
    options: { executionProviders: string[] },
  ) => Promise<{
    run: (
      inputs: Record<string, unknown>,
    ) => Promise<{ output: { data: Float32Array } }>
  }>
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
  private onnxSession: {
    run: (
      inputs: Record<string, unknown>,
    ) => Promise<{ output: { data: Float32Array } }>
  } | null = null
  private initialized: boolean = false
  private isModelLoading: boolean = false
  private ortModule: typeof ort | MockOnnxModule | null = null

  constructor(options: SwiftDetectorSettings = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...options }
  }

  /** Initialize the ONNX session (lazy loading) */
  async init(
    onnxModule?: typeof ort | MockOnnxModule | null,
  ): Promise<boolean> {
    if (this.initialized) return true
    if (this.isModelLoading) return false

    this.isModelLoading = true

    try {
      // If onnxModule is provided (for testing), use it; otherwise import ort
      if (onnxModule) {
        this.ortModule = onnxModule
      } else {
        this.ortModule = (await import('onnxruntime-web')) as typeof ort
      }

      // Validate sample rate requirement
      if (this.settings.sampleRate !== 16000) {
        console.warn(
          `[SwiftF0] SwiftF0 requires 16000 Hz sample rate, got ${this.settings.sampleRate} Hz. ` +
            `Consider using AnalyserNode with sampleRate: 16000 for accurate results.`,
        )
      }

      // Validate ortModule is available
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!this.ortModule) {
        throw new Error('ortModule is null')
      }

      // Create ONNX inference session
      let session
      // Check if it's the real ONNX Runtime module or mock
      const isMock =
        'create' in (this.ortModule as unknown as { create: unknown })

      if (!isMock) {
        session = await (this.ortModule as typeof ort).InferenceSession.create(
          this.settings.modelPath,
          {
            executionProviders: ['wasm'],
          },
        )
      } else {
        // Mock module
        session = await (this.ortModule as MockOnnxModule).create(
          this.settings.modelPath,
          {
            executionProviders: ['wasm'],
          },
        )
      }

      // Set up session run method
      this.onnxSession = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        run: session.run.bind(session) as any,
      }

      console.log('[SwiftF0] Initialized')

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
      await this.init()
      if (!this.onnxSession) {
        return {
          pitch: this.settings.fallbackFreq,
          probability: 0,
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
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

      // Create input tensor (1, 1, 1, 132)
      const tensor = new (this.ortModule as typeof ort).Tensor(
        'float32',
        swiftInput,
        [1, 1, 1, 132],
      )

      // Run inference
      const sessionResult = await this.onnxSession.run({ input: tensor })
      const logits = sessionResult.output.data

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
  detectFromTimeData(_timeData: Float32Array): SwiftPitchResult {
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
