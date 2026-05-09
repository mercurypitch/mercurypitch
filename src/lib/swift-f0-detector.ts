// ============================================================
// SwiftF0 Detector - ML-Based Pitch Detection (ONNX Runtime Web)
// ============================================================
//
// The SwiftF0 model (model.onnx) takes raw 16kHz mono audio and
// outputs per-frame pitch (Hz) + confidence via built-in STFT +
// CNN layers. No manual FFT needed — just feed it the waveform.

import type ort from 'onnxruntime-web'
import type { PitchAlgorithm } from './pitch-detector'

/** SwiftF0 pitch result (aggregated from per-frame outputs) */
export interface SwiftPitchResult {
  pitch: number
  probability: number
}

export interface SwiftDetectorSettings {
  /** Audio sample rate (SwiftF0 requires 16000 Hz) */
  sampleRate?: number
  /** ONNX model path (default: /models/swiftf0.onnx) */
  modelPath?: string
  /** Fallback frequency for zero pitch detection */
  fallbackFreq?: number
  /** Minimum probability threshold (0-1) */
  minProbability?: number
}

/** Shape of the ONNX session's run method */
type OnnxSession = {
  run: (
    inputs: Record<string, unknown>,
  ) => Promise<Record<string, { data: Float32Array; dims: number[] }>>
}

/** Mock ONNX module for testing without actual ONNX Runtime */
export interface MockOnnxModule {
  create: (
    path: string,
    options: { executionProviders: string[] },
  ) => Promise<{
    run: (
      inputs: Record<string, unknown>,
    ) => Promise<Record<string, { data: Float32Array; dims: number[] }>>
  }>
}

const DEFAULT_SETTINGS: Required<SwiftDetectorSettings> = {
  sampleRate: 16000,
  modelPath: '/models/swiftf0.onnx',
  fallbackFreq: 0,
  minProbability: 0.1,
}

export class SwiftF0Detector {
  readonly algorithm: PitchAlgorithm = 'swift'

  private settings: Required<SwiftDetectorSettings>
  private onnxSession: OnnxSession | null = null
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
      if (onnxModule) {
        this.ortModule = onnxModule
      } else {
        this.ortModule = (await import('onnxruntime-web')) as typeof ort
        // Configure WASM path — in dev mode Vite doesn't copy the WASM
        // to its dep cache, so we point ORT at the public/ directory.
        ;(this.ortModule as typeof ort).env.wasm.wasmPaths = '/'
      }

      if (this.settings.sampleRate !== 16000) {
        console.warn(
          `[SwiftF0] SwiftF0 requires 16000 Hz sample rate, got ${this.settings.sampleRate} Hz. ` +
            `Consider using AnalyserNode with sampleRate: 16000 for accurate results.`,
        )
      }

      if (this.ortModule === null) {
        throw new Error('ortModule is null')
      }

      let session
      const isMock =
        'create' in (this.ortModule as unknown as { create: unknown })

      if (!isMock) {
        session = await (this.ortModule as typeof ort).InferenceSession.create(
          this.settings.modelPath,
          { executionProviders: ['wasm'] },
        )
      } else {
        session = await (this.ortModule as MockOnnxModule).create(
          this.settings.modelPath,
          { executionProviders: ['wasm'] },
        )
      }

      this.onnxSession = {
        run: session.run.bind(session) as OnnxSession['run'],
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

  /**
   * Detect pitch from raw time-domain audio.
   * The model expects 16kHz mono float32 samples.
   * Returns a single pitch value aggregated from per-frame outputs.
   */
  async detect(timeData: Float32Array): Promise<SwiftPitchResult> {
    if (!this.initialized || this.onnxSession === null) {
      await this.init()
      if (this.onnxSession === null) {
        return { pitch: this.settings.fallbackFreq, probability: 0 }
      }
    }

    if (this.onnxSession === null) {
      return { pitch: this.settings.fallbackFreq, probability: 0 }
    }

    try {
      // Create input tensor: [1, N] raw audio
      const tensor = new (this.ortModule as typeof ort).Tensor(
        'float32',
        timeData,
        [1, timeData.length],
      )

      const result = await this.onnxSession.run({ input_audio: tensor })

      const pitchHz = result.pitch_hz?.data
      const confidence = result.confidence?.data

      if (
        pitchHz === undefined ||
        confidence === undefined ||
        pitchHz.length === 0
      ) {
        return { pitch: this.settings.fallbackFreq, probability: 0 }
      }

      // Aggregate per-frame results: confidence-weighted average
      let weightedSum = 0
      let totalConf = 0
      let maxConf = 0

      for (let i = 0; i < pitchHz.length; i++) {
        const p = pitchHz[i]!
        const c = confidence[i]!
        if (c > maxConf) maxConf = c
        if (c >= this.settings.minProbability && p > 0) {
          weightedSum += p * c
          totalConf += c
        }
      }

      if (totalConf <= 0 || weightedSum <= 0) {
        return { pitch: this.settings.fallbackFreq, probability: 0 }
      }

      return {
        pitch: weightedSum / totalConf,
        probability: maxConf,
      }
    } catch (error) {
      console.error('[SwiftF0] Detection error:', error)
      return { pitch: this.settings.fallbackFreq, probability: 0 }
    }
  }

  /** Backward-compat: detect from raw time-domain audio (same as detect) */
  async detectFromFreqData(timeData: Float32Array): Promise<SwiftPitchResult> {
    return this.detect(timeData)
  }

  getName(): string {
    return 'SwiftF0 ML'
  }

  getDescription(): string {
    return 'ML-based pitch detection using SwiftF0 model. Best for noisy environments and requires 16kHz sample rate.'
  }

  reset(): void {}

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
