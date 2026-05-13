// ============================================================
// Vocal Separator Web Worker
// Runs ONNX inference off the main thread.
// Handles: init (load model), separate (process audio), cancel.
// ============================================================

import type * as OrtModule from 'onnxruntime-web'
import type { InferenceSession, Tensor } from 'onnxruntime-web'
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url'
import mjsUrlCpu from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'
import wasmUrlCpu from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { computeChunkRanges, overlapAdd, UVR_CHUNK_CONFIG, } from '../lib/audio-chunker'
import { getCachedModel, setCachedModel } from '../lib/model-cache'
import { stftForward, stftInverse } from '../lib/stft-engine'
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkerInitMessage {
  type: 'init'
  modelPath: string
}

export interface WorkerSeparateMessage {
  type: 'separate'
  audio: Float32Array
  sampleRate: number
  requestId: number
}

export interface WorkerCancelMessage {
  type: 'cancel'
}

export type WorkerInMessage =
  | WorkerInitMessage
  | WorkerSeparateMessage
  | WorkerCancelMessage

export interface WorkerProgressMessage {
  type: 'progress'
  pct: number
  requestId: number
}

export interface WorkerCompleteMessage {
  type: 'complete'
  requestId: number
  vocals: Float32Array
  instrumental: Float32Array
  metadata: {
    durationSec: number
    sampleRate: number
    numChunks: number
  }
}

export interface WorkerErrorMessage {
  type: 'error'
  requestId: number
  message: string
}

export interface WorkerReadyMessage {
  type: 'ready'
  provider: string
}

export type WorkerOutMessage =
  | WorkerProgressMessage
  | WorkerCompleteMessage
  | WorkerErrorMessage
  | WorkerReadyMessage

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const N_FFT = 6144 // Standard MDX FFT size
const HOP_LENGTH = 1024
const MODEL_BINS = 3072 // Model expects exactly 3072 frequency bins
const ZERO_BINS = 3 // zero first N frequency bins before ONNX

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let session: InferenceSession | null = null
let ort: typeof OrtModule | null = null
let cancelled = false
let _currentRequestId = 0

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let activeProviders: string[] = []
let currentModelPath = ''

async function loadModel(modelPath: string): Promise<void> {
  currentModelPath = modelPath
  // Try IndexedDB cache first
  let buffer = await getCachedModel(modelPath)

  if (!buffer) {
    // Fetch from server
    const resp = await fetch(modelPath)
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch model: ${resp.status} ${resp.statusText}`,
      )
    }
    buffer = await resp.arrayBuffer()
    // Cache for next time
    try {
      await setCachedModel(modelPath, buffer)
    } catch {
      // IndexedDB may be unavailable — non-fatal
    }
  }

  if (!ort) {
    ort = await import('onnxruntime-web')
    ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4
    ort.env.wasm.wasmPaths = {
      'ort-wasm-simd-threaded.jsep.wasm': wasmUrl,
      'ort-wasm-simd-threaded.jsep.mjs': mjsUrl,
      'ort-wasm-simd-threaded.wasm': wasmUrlCpu,
      'ort-wasm-simd-threaded.mjs': mjsUrlCpu,
    } as Record<string, string>
  }

  // If activeProviders is already set to wasm (due to fallback), don't reset it
  if (activeProviders.length === 0 || activeProviders[0] !== 'wasm') {
    activeProviders = []
    // Linux Firefox has insufficient WebGPU memory limits for this model (~300MB).
    // Uncapped errors ("Not enough memory left") produce garbage output without
    // throwing, so the normal WebGPU→WASM fallback never triggers.
    // Windows/macOS Firefox handles WebGPU correctly.
    //
    // Android/mobile WebGPU (especially Mali GPUs) also produces garbage ONNX
    // inference output without throwing — same class of silent corruption.
    // Skip WebGPU on all mobile browsers and use WASM unconditionally.
    const isLinuxFirefox =
      /Firefox/i.test(navigator.userAgent) &&
      /Linux/i.test(navigator.platform || navigator.userAgent)
    const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (!isLinuxFirefox && !isMobile) {
      try {
        if ('gpu' in navigator) {
          activeProviders.push('webgpu')
        }
      } catch {
        // WebGPU not available
      }
    }
    activeProviders.push('wasm')
  }

  session = await ort.InferenceSession.create(buffer, {
    executionProviders: activeProviders,
    freeDimensionOverrides: {
      batch_size: 1, // Prevent WebGPU from allocating excessive memory for dynamic batch dimensions
    },
  })
}

function processStftForModel(
  stftData: Float32Array,
  nFreq: number,
  nFrames: number,
): Float32Array {
  // Zero the first ZERO_BINS frequency bins
  for (let frame = 0; frame < nFrames; frame++) {
    for (let f = 0; f < ZERO_BINS && f < nFreq; f++) {
      const idx = frame * nFreq * 2 + f * 2
      stftData[idx] = 0 // real
      stftData[idx + 1] = 0 // imag
    }
  }
  return stftData
}

function createModelInput(
  stftData: Float32Array,
  nFreq: number,
  nFrames: number,
): Float32Array {
  // Model expects [1, 4, MODEL_BINS, nFrames] where 4 = stereo × (real+imag)
  // PyTorch STFT concatenation is typically torch.cat([X.real, X.imag], dim=1)
  // For stereo (C=2), this yields: [Left_Real, Right_Real, Left_Imag, Right_Imag]
  // We produce mono → duplicate for left/right channels
  const totalBins = MODEL_BINS * nFrames
  const output = new Float32Array(4 * totalBins)

  // Channel 0: Left Real
  // Channel 1: Right Real
  // Channel 2: Left Imag
  // Channel 3: Right Imag
  for (let frame = 0; frame < nFrames; frame++) {
    for (let f = 0; f < MODEL_BINS; f++) {
      const srcIdx = frame * nFreq * 2 + f * 2
      const dstBase = f * nFrames + frame
      const real = stftData[srcIdx]
      const imag = stftData[srcIdx + 1]
      output[0 * totalBins + dstBase] = real // Left Real
      output[1 * totalBins + dstBase] = real // Right Real
      output[2 * totalBins + dstBase] = imag // Left Imag
      output[3 * totalBins + dstBase] = imag // Right Imag
    }
  }
  return output
}

async function runInference(
  stftData: Float32Array,
  nFreq: number,
  nFrames: number,
): Promise<Float32Array> {
  if (!ort || !session) throw new Error('Model not initialized')

  const inputData = createModelInput(stftData, nFreq, nFrames)
  const tensor = new ort.Tensor('float32', inputData, [
    1,
    4,
    MODEL_BINS,
    nFrames,
  ])

  const feeds: Record<string, Tensor> = {}
  // The ONNX model has a single input — use the first input name
  const inputName = session.inputNames[0]
  if (!inputName) throw new Error('Model has no inputs')
  feeds[inputName] = tensor

  try {
    const results = await session.run(feeds)
    const outputName = session.outputNames[0]
    if (!outputName) throw new Error('Model has no outputs')
    const output = results[outputName]
    return new Float32Array(output.data as Float32Array)
  } catch (err) {
    if (activeProviders.includes('webgpu')) {
      console.warn('WebGPU inference failed, falling back to wasm...', err)
      activeProviders = ['wasm']
      throw new Error('WEBGPU_CRASH')
    }
    console.error('ONNX inference failed:', err)
    throw err
  }
}

function modelOutputToStft(
  modelOutput: Float32Array,
  nFreq: number,
  nFrames: number,
): Float32Array {
  // Model outputs [1, 4, MODEL_BINS, nFrames] mapped as [Left_R, Right_R, Left_I, Right_I]
  // Average both stereo channels for mono reconstruction.
  const totalBins = MODEL_BINS * nFrames
  const result = new Float32Array(nFreq * nFrames * 2)

  for (let frame = 0; frame < nFrames; frame++) {
    for (let f = 0; f < MODEL_BINS; f++) {
      const srcBase = f * nFrames + frame
      const dstIdx = frame * nFreq * 2 + f * 2
      result[dstIdx] =
        (modelOutput[0 * totalBins + srcBase] +
          modelOutput[1 * totalBins + srcBase]) /
        2
      result[dstIdx + 1] =
        (modelOutput[2 * totalBins + srcBase] +
          modelOutput[3 * totalBins + srcBase]) /
        2
    }
  }
  return result
}

function subtractStft(
  originalStft: Float32Array,
  instrStft: Float32Array,
): { instrumental: Float32Array; vocal: Float32Array } {
  // The model output IS the instrumental stem. Vocal = Original - Instrumental
  // in the complex STFT domain. This avoids the phase artifacts that occur
  // when subtracting after separate iSTFT round-trips.
  const len = originalStft.length
  const instrumental = new Float32Array(len)
  const vocal = new Float32Array(len)

  for (let i = 0; i < len; i += 2) {
    const origR = originalStft[i]
    const origI = originalStft[i + 1]
    const instrR = instrStft[i]
    const instrI = instrStft[i + 1]

    instrumental[i] = instrR
    instrumental[i + 1] = instrI
    vocal[i] = origR - instrR
    vocal[i + 1] = origI - instrI
  }

  return { instrumental, vocal }
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

async function processChunk(
  audioChunk: Float32Array,
): Promise<{ instrumental: Float32Array; vocals: Float32Array }> {
  // STFT → save copy → zero bins → ONNX → instrument STFT → subtract → iSTFT both
  const stft = stftForward(audioChunk, N_FFT, HOP_LENGTH)
  const originalStft = new Float32Array(stft.data)
  processStftForModel(stft.data, stft.nFreq, stft.nFrames)
  const modelOutput = await runInference(stft.data, stft.nFreq, stft.nFrames)
  const instrStft = modelOutputToStft(modelOutput, stft.nFreq, stft.nFrames)

  const { instrumental, vocal: vocals } = subtractStft(originalStft, instrStft)

  const stftParams = {
    nFreq: stft.nFreq,
    nFrames: stft.nFrames,
    nFft: N_FFT,
    hopLength: HOP_LENGTH,
  }
  return {
    instrumental: stftInverse({ data: instrumental, ...stftParams }),
    vocals: stftInverse({ data: vocals, ...stftParams }),
  }
}

async function separate(
  audio: Float32Array,
  sampleRate: number,
  requestId: number,
): Promise<void> {
  cancelled = false

  // Compute chunk ranges
  const ranges = computeChunkRanges(audio.length, UVR_CHUNK_CONFIG)
  const numChunks = ranges.length

  // Pad audio so chunks cover the full length
  const totalPadded =
    (numChunks - 1) * UVR_CHUNK_CONFIG.genSize + UVR_CHUNK_CONFIG.chunkSize
  const padded = new Float32Array(totalPadded)
  padded.set(audio)

  const instrChunks: Float32Array[] = []
  const vocalChunks: Float32Array[] = []

  for (let ci = 0; ci < numChunks; ci++) {
    if (cancelled) {
      postMessage({
        type: 'error',
        requestId,
        message: 'Cancelled',
      } satisfies WorkerOutMessage)
      return
    }

    const { start, end } = ranges[ci]
    const chunk = padded.slice(start, end)

    try {
      const { instrumental, vocals } = await processChunk(chunk)
      instrChunks.push(instrumental)
      vocalChunks.push(vocals)
    } catch (err) {
      if (err instanceof Error && err.message === 'WEBGPU_CRASH') {
        // Fallback to wasm and retry the chunk
        await loadModel(currentModelPath)
        const { instrumental, vocals } = await processChunk(chunk)
        instrChunks.push(instrumental)
        vocalChunks.push(vocals)
      } else {
        throw err
      }
    }

    const pct = Math.round(((ci + 1) / numChunks) * 100)
    postMessage({ type: 'progress', pct, requestId } satisfies WorkerOutMessage)
  }

  // Overlap-add all chunks
  const instrumental = overlapAdd(instrChunks, audio.length, UVR_CHUNK_CONFIG)
  const vocals = overlapAdd(vocalChunks, audio.length, UVR_CHUNK_CONFIG)

  // Transfer buffers to main thread (zero-copy)
  const vocalsBuf = vocals.buffer
  const instrBuf = instrumental.buffer

  postMessage(
    {
      type: 'complete',
      requestId,
      vocals: new Float32Array(vocalsBuf),
      instrumental: new Float32Array(instrBuf),
      metadata: {
        durationSec: audio.length / sampleRate,
        sampleRate,
        numChunks,
      },
    } satisfies WorkerOutMessage,
    // Transfer ownership of the buffers
    [vocalsBuf, instrBuf],
  )
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data

  switch (msg.type) {
    case 'init': {
      try {
        await loadModel(msg.modelPath)
        postMessage({
          type: 'ready',
          provider: activeProviders[0],
        } satisfies WorkerOutMessage)
      } catch (err) {
        postMessage({
          type: 'error',
          requestId: -1,
          message: `Init failed: ${err instanceof Error ? err.message : String(err)}`,
        } satisfies WorkerOutMessage)
      }
      break
    }

    case 'separate': {
      _currentRequestId = msg.requestId
      try {
        await separate(msg.audio, msg.sampleRate, msg.requestId)
      } catch (err) {
        postMessage({
          type: 'error',
          requestId: msg.requestId,
          message: err instanceof Error ? err.message : String(err),
        } satisfies WorkerOutMessage)
      }
      break
    }

    case 'cancel': {
      cancelled = true
      break
    }
  }
}
