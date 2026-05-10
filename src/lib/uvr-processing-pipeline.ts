// ============================================================
// UVR Processing Pipeline — Unified abstraction over:
//   • Server mode  → upload → poll /status → download stems
//   • Local mode   → VocalSeparator (ONNX in Web Worker)
// ============================================================

import type { UvrProcessingMode, UvrSession } from '@/stores/app-store'
import { getAllUvrSessions, saveAllUvrSessions, setUvrSessionApiId, updateUvrSessionProgress } from '@/stores/app-store'
import { computeChunkRanges, UVR_CHUNK_CONFIG } from './audio-chunker'
import type { OutputFile } from './uvr-api'
import { pollForCompletion, processAudio, deleteSession } from './uvr-api'
import { MODEL_PATH } from './uvr-model-config'
import { VocalSeparator } from './vocal-separator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessingCallbacks {
  onProgress: (pct: number) => void
  onComplete: (result: ProcessingResult) => void
  onError: (message: string) => void
}

export interface ProcessingResult {
  outputs: UvrSession['outputs']
  stemMeta: Record<string, { duration?: number; size?: number }>
}

// ---------------------------------------------------------------------------
// Singleton separator (lazy init)
// ---------------------------------------------------------------------------

let separator: VocalSeparator | null = null

async function getSeparator(): Promise<VocalSeparator> {
  if (separator !== null && separator.isReady()) return separator
  separator = new VocalSeparator()
  await separator.initialize(MODEL_PATH)
  return separator
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function float32ToWavBlob(audio: Float32Array, sampleRate: number): Blob {
  const bitsPerSample = 16
  const byteRate = sampleRate * (bitsPerSample / 8)
  const blockAlign = bitsPerSample / 8
  const dataSize = audio.length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < audio.length; i++) {
    const s = Math.max(-1, Math.min(1, audio[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

async function processLocal(
  file: File,
  sessionId: string,
  callbacks: ProcessingCallbacks,
): Promise<void> {
  const startTime = Date.now()
  const sep = await getSeparator()

  // Decode audio
  const ctx = new AudioContext()
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await ctx.decodeAudioData(await file.arrayBuffer())
  } finally {
    ctx.close()
  }

  // Mono mixdown
  const audio = new Float32Array(audioBuffer.length)
  if (audioBuffer.numberOfChannels > 1) {
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const chData = audioBuffer.getChannelData(ch)
      for (let i = 0; i < audioBuffer.length; i++) audio[i] += chData[i]
    }
    const scale = 1 / audioBuffer.numberOfChannels
    for (let i = 0; i < audio.length; i++) audio[i] *= scale
  } else {
    audio.set(audioBuffer.getChannelData(0))
  }

  // Store chunk count for UI
  const numChunks = computeChunkRanges(audio.length, UVR_CHUNK_CONFIG).length
  const sessions = getAllUvrSessions()
  const s = sessions.find((x) => x.sessionId === sessionId)
  if (s) {
    s.numChunks = numChunks
    saveAllUvrSessions(sessions)
  }

  sep.onProgress = (pct) => {
    const elapsed = Date.now() - startTime
    updateUvrSessionProgress(sessionId, pct, elapsed)
    callbacks.onProgress(pct)
  }

  const result = await sep.separate(audio, audioBuffer.sampleRate)

  const vocalBlob = float32ToWavBlob(result.vocals, result.sampleRate)
  const instrBlob = float32ToWavBlob(result.instrumental, result.sampleRate)

  callbacks.onComplete({
    outputs: {
      vocal: URL.createObjectURL(vocalBlob),
      instrumental: URL.createObjectURL(instrBlob),
    },
    stemMeta: {
      vocal: { duration: result.durationSec, size: vocalBlob.size },
      instrumental: { duration: result.durationSec, size: instrBlob.size },
    },
  })
}

// ---------------------------------------------------------------------------
// Server helpers
// ---------------------------------------------------------------------------

async function processServer(
  file: File,
  sessionId: string,
  callbacks: ProcessingCallbacks,
): Promise<void> {
  const response = await processAudio(file)

  if (response.status !== 'processing') {
    throw new Error('Failed to start processing')
  }

  setUvrSessionApiId(sessionId, response.session_id)

  const startTime = Date.now()

  await pollForCompletion(
    response.session_id,
    (progress, indeterminate) => {
      const elapsed = Date.now() - startTime
      updateUvrSessionProgress(sessionId, progress, elapsed, indeterminate)
      callbacks.onProgress(progress)
    },
    (files: OutputFile[]) => {
      const outputs: UvrSession['outputs'] = {}
      const meta: Record<string, { duration?: number; size?: number }> = {}

      for (const f of files) {
        if (f.stem === 'vocal') {
          outputs.vocal = f.path
          meta.vocal = { duration: f.duration, size: f.size }
        } else if (f.stem === 'instrumental') {
          outputs.instrumental = f.path
          meta.instrumental = { duration: f.duration, size: f.size }
        }
      }

      callbacks.onComplete({ outputs, stemMeta: meta })
    },
    callbacks.onError,
    1000,
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function preInitModel(): Promise<void> {
  await getSeparator()
}

export async function runUvrPipeline(
  file: File,
  sessionId: string,
  mode: UvrProcessingMode,
  callbacks: ProcessingCallbacks,
): Promise<void> {
  if (mode === 'local') {
    await processLocal(file, sessionId, callbacks)
  } else {
    await processServer(file, sessionId, callbacks)
  }
}

export function cancelUvrPipeline(mode: UvrProcessingMode, apiSessionId?: string): void {
  if (mode === 'local') {
    separator?.cancel()
  } else if (apiSessionId) {
    // Server mode cancellation: delete the session on the backend
    deleteSession(apiSessionId).catch((err) => {
      console.warn('Failed to delete server session on cancel:', err)
    })
  }
}

export function destroyPipeline(): void {
  if (separator) {
    separator.destroy()
    separator = null
  }
}
