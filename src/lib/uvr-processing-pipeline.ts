// ============================================================
// UVR Processing Pipeline — Unified abstraction over:
//   • Server mode  → upload → poll /status → download stems
//   • Local mode   → VocalSeparator (ONNX in Web Worker)
// ============================================================

import { saveStemBlob } from '@/db/services/uvr-service'
import type { UvrProcessingMode, UvrSession } from '@/stores/app-store'
import { getAllUvrSessions, saveAllUvrSessions, setUvrModelError, setUvrModelStatus, setUvrSessionApiId, setUvrSessionProvider, updateUvrSessionProgress, uvrForceWebGpu, } from '@/stores/app-store'
import { computeChunkRanges, UVR_CHUNK_CONFIG } from './audio-chunker'
import { UVR_MODEL_PATH } from './defaults'
import type { OutputFile } from './uvr-api'
import { DEFAULT_PROCESS_REQUEST, deleteSession, getOutputFile, pollForCompletion, processAudio, } from './uvr-api'
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
  if (separator === null) {
    separator = new VocalSeparator()
  }

  // If already ready or currently processing, return as is.
  if (separator.status === 'ready' || separator.status === 'processing') {
    return separator
  }

  // If idle, error, or already initializing, call initialize().
  // VocalSeparator.initialize handles waiting for the promise if already initializing.
  setUvrModelStatus('loading')
  setUvrModelError('')

  try {
    const forceWebGpu = uvrForceWebGpu()
    await separator.initialize(UVR_MODEL_PATH, forceWebGpu)
    setUvrModelStatus('ready')
    return separator
  } catch (err) {
    setUvrModelStatus('error')
    const msg = err instanceof Error ? err.message : String(err)
    setUvrModelError(msg)
    throw err
  }
}

export function getActiveProvider(): string | null {
  return separator?.provider ?? null
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

  if (
    sep.provider !== undefined &&
    sep.provider !== null &&
    sep.provider !== ''
  )
    setUvrSessionProvider(sessionId, sep.provider)

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

  // Persist stems to IndexedDB — must complete before onComplete so that
  // auto-fingerprint extraction can read the vocal blob immediately.
  await Promise.all([
    saveStemBlob(sessionId, 'vocal', vocalBlob, `${file.name}_vocal.wav`),
    saveStemBlob(
      sessionId,
      'instrumental',
      instrBlob,
      `${file.name}_instrumental.wav`,
    ),
  ]).catch(() => {})

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

  if (
    sep.provider !== undefined &&
    sep.provider !== null &&
    sep.provider !== ''
  ) {
    setUvrSessionProvider(sessionId, sep.provider)
  }
}

// ---------------------------------------------------------------------------
// Server helpers
// ---------------------------------------------------------------------------

/** Song duration via an off-DOM audio element — cheap metadata-only load.
 *  null when the browser can't parse the container (fall back to defaults). */
function audioDurationSecs(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    let settled = false
    const done = (v: number | null) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      resolve(v)
    }
    audio.onloadedmetadata = () =>
      done(Number.isFinite(audio.duration) ? audio.duration : null)
    audio.onerror = () => done(null)
    setTimeout(() => done(null), 3000)
    audio.src = url
  })
}

async function processServer(
  file: File,
  sessionId: string,
  callbacks: ProcessingCallbacks,
): Promise<void> {
  // Server mode targets the RunPod GPU tier; when RunPod isn't configured
  // on the worker the request falls through to the CPU container, so the
  // opt-in header is always safe to send.
  // Duration-scaled progress estimate: separation runs ~7-8x realtime on
  // the GPU tier plus fixed overhead, so a 3-min song is ~45s and an 8-min
  // song ~90s — far better than a flat guess for the progress bar + ETA.
  const durationSecs = await audioDurationSecs(file)
  const estimatedSecs =
    durationSecs !== null
      ? Math.min(240, Math.max(30, 20 + durationSecs / 7))
      : undefined

  const response = await processAudio(file, {
    ...DEFAULT_PROCESS_REQUEST,
    provider: 'runpod',
  })

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

      const apiSessionId = response.session_id

      for (const f of files) {
        if (f.stem === 'vocal') {
          outputs.vocal = f.path
          meta.vocal = { duration: f.duration, size: f.size }
        } else if (f.stem === 'instrumental') {
          outputs.instrumental = f.path
          meta.instrumental = { duration: f.duration, size: f.size }
        }

        // Download and persist stem to IndexedDB (non-blocking)
        void (async () => {
          try {
            const resp = await getOutputFile(apiSessionId, f.path)
            const blob = await resp.blob()
            await saveStemBlob(
              sessionId,
              f.stem as 'vocal' | 'instrumental',
              blob,
              f.filename,
            )
          } catch {
            /* non-critical */
          }
        })()
      }

      callbacks.onComplete({ outputs, stemMeta: meta })
    },
    callbacks.onError,
    1000,
    undefined,
    estimatedSecs,
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

export function cancelUvrPipeline(
  mode: UvrProcessingMode,
  apiSessionId?: string,
): void {
  if (mode === 'local') {
    separator?.cancel()
  } else if (apiSessionId !== undefined && apiSessionId !== '') {
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
    setUvrModelStatus('unloaded')
    setUvrModelError('')
  }
}
