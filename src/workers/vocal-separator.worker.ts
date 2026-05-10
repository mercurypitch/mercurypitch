// ============================================================
// Vocal Separator Web Worker
// Runs ONNX inference off the main thread.
// Handles: init (load model), separate (process audio), cancel.
// ============================================================

import type { InferenceSession, Tensor } from 'onnxruntime-web'
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
let ort: typeof import('onnxruntime-web') | null = null
let cancelled = false
let currentRequestId = 0

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
  }

  // If activeProviders is already set to wasm (due to fallback), don't reset it
  if (activeProviders.length === 0 || activeProviders[0] !== 'wasm') {
    activeProviders = []
    // Prefer WebGPU if available
    try {
      if ('gpu' in navigator) {
        activeProviders.push('webgpu')
      }
    } catch {
      // WebGPU not available
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
  // We take the left channel only (Channel 0 for Real, Channel 2 for Imag)
  // and re-interleave into complex format
  const totalBins = MODEL_BINS * nFrames
  const result = new Float32Array(nFreq * nFrames * 2)

  for (let frame = 0; frame < nFrames; frame++) {
    for (let f = 0; f < MODEL_BINS; f++) {
      const srcBase = f * nFrames + frame
      const dstIdx = frame * nFreq * 2 + f * 2
      result[dstIdx] = modelOutput[0 * totalBins + srcBase] // Left Real
      result[dstIdx + 1] = modelOutput[2 * totalBins + srcBase] // Left Imag
    }
    // The Nyquist bin (f = 3072) remains 0.0 in the result since the model didn't predict it
  }
  return result
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

async function processChunk(audioChunk: Float32Array): Promise<Float32Array> {
  // STFT → zero bins → ONNX → iSTFT
  const stft = stftForward(audioChunk, N_FFT, HOP_LENGTH)
  processStftForModel(stft.data, stft.nFreq, stft.nFrames)
  const modelOutput = await runInference(stft.data, stft.nFreq, stft.nFrames)
  const outputStft = modelOutputToStft(modelOutput, stft.nFreq, stft.nFrames)
  return stftInverse({
    data: outputStft,
    nFreq: stft.nFreq,
    nFrames: stft.nFrames,
    nFft: N_FFT,
    hopLength: HOP_LENGTH,
  })
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

  const chunkOutputs: Float32Array[] = []

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
      const output = await processChunk(chunk)
      chunkOutputs.push(output)
    } catch (err) {
      if (err instanceof Error && err.message === 'WEBGPU_CRASH') {
        // Fallback to wasm and retry the chunk
        await loadModel(currentModelPath)
        const output = await processChunk(chunk)
        chunkOutputs.push(output)
      } else {
        throw err
      }
    }

    const pct = Math.round(((ci + 1) / numChunks) * 100)
    postMessage({ type: 'progress', pct, requestId } satisfies WorkerOutMessage)
  }

  // Overlap-add all chunks
  const instrumental = overlapAdd(chunkOutputs, audio.length, UVR_CHUNK_CONFIG)

  // Secondary stem via time-domain subtraction
  const compensate = 1.0
  const vocals = new Float32Array(audio.length)
  for (let i = 0; i < audio.length; i++) {
    vocals[i] = audio[i] - instrumental[i] * compensate
  }

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
        postMessage({ type: 'ready' } satisfies WorkerOutMessage)
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
      currentRequestId = msg.requestId
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
