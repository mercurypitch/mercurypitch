// ============================================================
// SwiftF0 Detector - ML-Based Pitch Detection (ONNX Runtime Web)
// ============================================================
//
// The SwiftF0 model (model.onnx) takes raw 16kHz mono audio and
// outputs per-frame pitch (Hz) + confidence via built-in STFT +
// CNN layers. No manual FFT needed — just feed it the waveform.

import type ort from 'onnxruntime-web'
import { configureWasmPaths, getValidatedWasmBase } from './defaults'
import type { PitchAlgorithm } from './pitch-detector'

/** SwiftF0 pitch result (aggregated from per-frame outputs) */
export interface SwiftPitchResult {
  pitch: number
  probability: number
}

/**
 * The rate the model's STFT geometry is defined at. Audio at any other rate
 * has to be resampled, not merely relabelled: feeding 8 kHz audio through and
 * telling the model it is 16 kHz reports every pitch an octave low.
 */
export const SWIFTF0_SAMPLE_RATE = 16000

/**
 * Linear resample. Lossy near Nyquist and adequate here — every caller is
 * moving material that carries nothing close to it, and the model's band tops
 * out around 2 kHz regardless.
 */
export function resampleLinear(
  data: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate || fromRate <= 0 || toRate <= 0) return data
  const ratio = fromRate / toRate
  const length = Math.floor(data.length / ratio)
  const out = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    const source = index * ratio
    const floor = Math.floor(source)
    const first = data[floor] ?? 0
    const second = data[floor + 1] ?? first
    out[index] = first + (second - first) * (source - floor)
  }
  return out
}

/**
 * The model's per-frame output over a whole buffer — what `detect` throws away.
 *
 * `detect` answers "what note is being played right now", so it collapses the
 * frames into one confidence-weighted average. Transcription needs the
 * opposite: the frames ARE the answer, and averaging them turns a melody into
 * its mean frequency.
 *
 * Times are explicit rather than implied by a hop, because the track is
 * assembled from overlapping chunks and a uniform grid across the seams would
 * be a claim rather than a measurement.
 */
export interface SwiftPitchTrack {
  /** Frame centres in seconds, ascending. */
  timeSeconds: Float32Array
  /** Fundamental per frame in Hz; 0 where the model reported none. */
  pitchHz: Float32Array
  /** Confidence per frame, 0..1. */
  confidence: Float32Array
  /** Seconds between frames, derived from the model's own output. */
  hopSeconds: number
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
        const validatedBase = await getValidatedWasmBase()
        const ortActual = this.ortModule as typeof ort
        configureWasmPaths(ortActual, validatedBase)

        session = await ortActual.InferenceSession.create(
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

  /**
   * Every frame the model produces for a whole buffer, at any input rate.
   *
   * Run in chunks: a five-minute stem is eight million samples, and the STFT
   * the model opens with would allocate hundreds of megabytes before the first
   * convolution. Chunks overlap and the overlap is discarded from interior
   * edges, because a CNN has a receptive field and its outermost frames are
   * looking at padding rather than audio.
   */
  async detectTrack(
    samples: Float32Array,
    sampleRate: number,
    options: {
      chunkSeconds?: number
      overlapSeconds?: number
      signal?: AbortSignal
      onProgress?: (fraction: number) => void
    } = {},
  ): Promise<SwiftPitchTrack> {
    const empty: SwiftPitchTrack = {
      timeSeconds: new Float32Array(0),
      pitchHz: new Float32Array(0),
      confidence: new Float32Array(0),
      hopSeconds: 0,
    }
    if (!this.initialized) await this.init()
    if (this.onnxSession === null || this.ortModule === null) return empty

    const audio = resampleLinear(samples, sampleRate, SWIFTF0_SAMPLE_RATE)
    if (audio.length === 0) return empty

    const chunkSamples = Math.max(
      SWIFTF0_SAMPLE_RATE,
      Math.round((options.chunkSeconds ?? 10) * SWIFTF0_SAMPLE_RATE),
    )
    const overlapSamples = Math.max(
      0,
      Math.round((options.overlapSeconds ?? 0.25) * SWIFTF0_SAMPLE_RATE),
    )
    const strideSamples = Math.max(1, chunkSamples - 2 * overlapSamples)

    const times: number[] = []
    const pitches: number[] = []
    const clarities: number[] = []
    // Derived from the model's own output rather than hard-coded: a hop
    // constant copied from a spec is a claim about a file we do not control.
    let hopSamples = 0

    for (let start = 0; start < audio.length; start += strideSamples) {
      if (options.signal?.aborted === true) {
        throw new DOMException('Pitch tracking cancelled', 'AbortError')
      }
      const end = Math.min(audio.length, start + chunkSamples)
      const chunk = audio.subarray(start, end)
      // Too short to carry a window; the previous chunk's overlap covered it.
      if (chunk.length < SWIFTF0_SAMPLE_RATE / 8) break

      const tensor = new (this.ortModule as typeof ort).Tensor(
        'float32',
        chunk,
        [1, chunk.length],
      )
      const result = await this.onnxSession.run({ input_audio: tensor })
      const chunkPitch = result.pitch_hz?.data
      const chunkConfidence = result.confidence?.data
      if (
        chunkPitch === undefined ||
        chunkConfidence === undefined ||
        chunkPitch.length === 0
      ) {
        break
      }

      if (hopSamples === 0) {
        hopSamples = Math.max(1, Math.round(chunk.length / chunkPitch.length))
      }

      // Interior edges are trimmed; the buffer's true ends are not, since
      // nothing else will ever cover them.
      const trimFrames = Math.round(overlapSamples / hopSamples)
      const from = start === 0 ? 0 : trimFrames
      const to =
        end >= audio.length
          ? chunkPitch.length
          : Math.max(from, chunkPitch.length - trimFrames)

      for (let frame = from; frame < to; frame += 1) {
        times.push((start + frame * hopSamples) / SWIFTF0_SAMPLE_RATE)
        pitches.push(chunkPitch[frame] ?? 0)
        clarities.push(chunkConfidence[frame] ?? 0)
      }

      options.onProgress?.(Math.min(1, end / audio.length))
      // Yield so a long stem cannot freeze whatever thread this is on.
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (end >= audio.length) break
    }

    options.onProgress?.(1)
    return {
      timeSeconds: Float32Array.from(times),
      pitchHz: Float32Array.from(pitches),
      confidence: Float32Array.from(clarities),
      hopSeconds: hopSamples / SWIFTF0_SAMPLE_RATE,
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
