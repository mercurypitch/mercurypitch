// ============================================================
// Vocal Separator Web Worker
// Runs ONNX inference off the main thread.
// Handles: init (load model), separate (process audio), cancel.
// ============================================================

import type { InferenceSession, Tensor } from 'onnxruntime-web'
import { stftForward, stftInverse } from '../lib/stft-engine'
import { getCachedModel, setCachedModel } from '../lib/model-cache'
import { computeChunkRanges, overlapAdd, UVR_CHUNK_CONFIG } from '../lib/audio-chunker'

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

export type WorkerInMessage = WorkerInitMessage | WorkerSeparateMessage | WorkerCancelMessage

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

const N_FFT = 6142 // produces nFreq = N_FFT/2+1 = 3072 matching model input dim
const HOP_LENGTH = 1024
const ZERO_BINS = 3             // zero first N frequency bins before ONNX

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

async function loadModel(modelPath: string): Promise<void> {
  // Try IndexedDB cache first
  let buffer = await getCachedModel(modelPath)

  if (!buffer) {
    // Fetch from server
    const resp = await fetch(modelPath)
    if (!resp.ok) {
      throw new Error(`Failed to fetch model: ${resp.status} ${resp.statusText}`)
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
  }

  const executionProviders: string[] = []
  // Prefer WebGPU if available
  try {
    if ('gpu' in navigator) {
      executionProviders.push('webgpu')
    }
  } catch {
    // WebGPU not available
  }
  executionProviders.push('wasm')

  session = await ort.InferenceSession.create(buffer, {
    executionProviders,
  })
}

function processStftForModel(stftData: Float32Array, nFreq: number, nFrames: number): Float32Array {
  // Zero the first ZERO_BINS frequency bins
  for (let frame = 0; frame < nFrames; frame++) {
    for (let f = 0; f < ZERO_BINS && f < nFreq; f++) {
      const idx = frame * nFreq * 2 + f * 2
      stftData[idx] = 0       // real
      stftData[idx + 1] = 0   // imag
    }
  }
  return stftData
}

function createModelInput(
  stftData: Float32Array,
  nFreq: number,
  nFrames: number,
): Float32Array {
  // Model expects [1, 4, nFreq, nFrames] where 4 = stereo × (real+imag)
  // We produce mono → duplicate for left/right channels
  const totalBins = nFreq * nFrames
  const output = new Float32Array(4 * totalBins)

  // Channel 0 (left, real): copy real part
  // Channel 1 (left, imag): copy imag part
  // Channel 2 (right, real): copy real part (mono → stereo)
  // Channel 3 (right, imag): copy imag part (mono → stereo)
  for (let frame = 0; frame < nFrames; frame++) {
    for (let f = 0; f < nFreq; f++) {
      const srcIdx = frame * nFreq * 2 + f * 2
      const dstBase = frame * nFreq + f
      const real = stftData[srcIdx]
      const imag = stftData[srcIdx + 1]
      output[0 * totalBins + dstBase] = real
      output[1 * totalBins + dstBase] = imag
      output[2 * totalBins + dstBase] = real
      output[3 * totalBins + dstBase] = imag
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
  const tensor = new ort.Tensor('float32', inputData, [1, 4, nFreq, nFrames])

  const feeds: Record<string, Tensor> = {}
  // The ONNX model has a single input — use the first input name
  const inputName = session.inputNames[0]
  if (!inputName) throw new Error('Model has no inputs')
  feeds[inputName] = tensor

  const results = await session.run(feeds)
  const outputName = session.outputNames[0]
  if (!outputName) throw new Error('Model has no outputs')
  const output = results[outputName]

  return new Float32Array(output.data as Float32Array)
}

function modelOutputToStft(
  modelOutput: Float32Array,
  nFreq: number,
  nFrames: number,
): Float32Array {
  // Model outputs [1, 4, nFreq, nFrames] — we take left channel only (first 2 of 4)
  // and re-interleave into complex format
  const totalBins = nFreq * nFrames
  const result = new Float32Array(nFreq * nFrames * 2)

  for (let frame = 0; frame < nFrames; frame++) {
    for (let f = 0; f < nFreq; f++) {
      const srcBase = frame * nFreq + f
      const dstIdx = frame * nFreq * 2 + f * 2
      result[dstIdx] = modelOutput[0 * totalBins + srcBase]     // real
      result[dstIdx + 1] = modelOutput[1 * totalBins + srcBase] // imag
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

async function processChunk(
  audioChunk: Float32Array,
): Promise<Float32Array> {
  // STFT → zero bins → ONNX → iSTFT
  const stft = stftForward(audioChunk, N_FFT, HOP_LENGTH)
  processStftForModel(stft.data, stft.nFreq, stft.nFrames)
  const modelOutput = await runInference(stft.data, stft.nFreq, stft.nFrames)
  const outputStft = modelOutputToStft(modelOutput, stft.nFreq, stft.nFrames)
  return stftInverse({ data: outputStft, nFreq: stft.nFreq, nFrames: stft.nFrames, nFft: N_FFT, hopLength: HOP_LENGTH })
}

async function separate(audio: Float32Array, sampleRate: number, requestId: number): Promise<void> {
  cancelled = false

  // Compute chunk ranges
  const ranges = computeChunkRanges(audio.length, UVR_CHUNK_CONFIG)
  const numChunks = ranges.length

  // Pad audio so chunks cover the full length
  const totalPadded = (numChunks - 1) * UVR_CHUNK_CONFIG.genSize + UVR_CHUNK_CONFIG.chunkSize
  const padded = new Float32Array(totalPadded)
  padded.set(audio)

  const chunkOutputs: Float32Array[] = []

  for (let ci = 0; ci < numChunks; ci++) {
    if (cancelled) {
      postMessage({ type: 'error', requestId, message: 'Cancelled' } satisfies WorkerOutMessage)
      return
    }

    const { start, end } = ranges[ci]
    const chunk = padded.slice(start, end)

    const output = await processChunk(chunk)
    chunkOutputs.push(output)

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
