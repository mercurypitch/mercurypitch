// ============================================================
// UVR Processing Pipeline — Unified abstraction over:
//   • Server mode  → upload → poll /status → download stems
//   • Local mode   → VocalSeparator (ONNX in Web Worker)
// ============================================================

import { saveStemBlobDurable } from '@/db/services/uvr-service'
import type { UvrProcessingMode, UvrSession } from '@/stores/app-store'
import { clearUvrSessionApiId, getAllUvrSessions, saveAllUvrSessions, setFinalizingUvrSession, setUvrModelError, setUvrModelStatus, setUvrSessionApiIdDurable, setUvrSessionProvider, updateUvrSessionProgress, uvrForceWebGpu, } from '@/stores/app-store'
import { computeChunkRanges, UVR_CHUNK_CONFIG } from './audio-chunker'
import { UVR_MODEL_PATH } from './defaults'
import type { OutputFile } from './uvr-api'
import { DEFAULT_PROCESS_REQUEST, deleteSession, getOutputFile, pollForCompletion, processAudio, TerminalPollError, } from './uvr-api'
import { VocalSeparator } from './vocal-separator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessingCallbacks {
  onProgress: (pct: number) => void
  // May be async — the pipeline awaits it so the whole run (including the
  // caller's durable session-record write) finishes before it resolves.
  onComplete: (result: ProcessingResult) => void | Promise<void>
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
  // Capture a local reference. setUvrModelStatus() below is a store write that
  // can synchronously run reactive effects (e.g. UvrPanel's server-mode
  // cleanup effect), and one of those may call destroyPipeline() → null the
  // module-level `separator`. Dereferencing the module var after the write
  // would then crash ("can't access property initialize, <sep> is null"), so
  // everything past this point uses the stable local `sep`.
  let sep = separator
  if (sep === null) {
    sep = new VocalSeparator()
    separator = sep
  }

  // If already ready or currently processing, return as is.
  if (sep.status === 'ready' || sep.status === 'processing') {
    return sep
  }

  // If idle, error, or already initializing, call initialize().
  // VocalSeparator.initialize handles waiting for the promise if already initializing.
  setUvrModelStatus('loading')
  setUvrModelError('')

  try {
    const forceWebGpu = uvrForceWebGpu()
    await sep.initialize(UVR_MODEL_PATH, forceWebGpu)
    setUvrModelStatus('ready')
    return sep
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
  signal?: AbortSignal,
): Promise<void> {
  const startTime = Date.now()
  const sep = await getSeparator()
  if (signal?.aborted ?? false) {
    throw new DOMException('Processing cancelled', 'AbortError')
  }

  // Decode audio
  const ctx = new AudioContext()
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await ctx.decodeAudioData(await file.arrayBuffer())
  } finally {
    ctx.close()
  }
  if (signal?.aborted ?? false) {
    throw new DOMException('Processing cancelled', 'AbortError')
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

  // Stems are separated — persist them durably BEFORE reporting complete, so a
  // reload can never leave a "completed" session with no local audio.
  setFinalizingUvrSession(sessionId)
  const [vocalRes, instrRes] = await Promise.all([
    saveStemBlobDurable(
      sessionId,
      'vocal',
      vocalBlob,
      `${file.name}_vocal.wav`,
    ),
    saveStemBlobDurable(
      sessionId,
      'instrumental',
      instrBlob,
      `${file.name}_instrumental.wav`,
    ),
  ])
  if (!vocalRes.ok && !instrRes.ok) {
    callbacks.onError(
      vocalRes.quotaExceeded || instrRes.quotaExceeded
        ? 'Storage is full — free up space and try again.'
        : 'Could not save the separated stems. Please try again.',
    )
    return
  }

  await callbacks.onComplete({
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

// Duration-scaled ETA per model, plus fixed overhead. Divisors from the
// 2026-07-06 11-song RTX-4090 measurements (handler wall vs song length):
// RoFormer ran ~10-16x realtime, MDX ~7-9x — 8 and 7 keep a safety margin
// so the bar under-promises rather than stalls at 95%. Keys match the
// server model registry (runpod/handler.py); unknown models use the
// roformer profile.
const SERVER_ETA_PROFILES: Record<
  string,
  { realtimeDivisor: number; capSecs: number }
> = {
  mdx: { realtimeDivisor: 7, capSecs: 240 },
  roformer: { realtimeDivisor: 8, capSecs: 300 },
  karaoke: { realtimeDivisor: 8, capSecs: 300 },
  ensemble: { realtimeDivisor: 4, capSecs: 480 },
}

// Jobs currently being polled (keyed by the RunPod apiSessionId → last tick
// timestamp), so an auto-resume on load and a foreground/online re-kick can't
// run two poll loops against the same job at once. Entries EXPIRE when the
// loop stops ticking (a hung await, a killed timer chain): otherwise a dead
// loop would block every re-kick forever and the session would sit at "still
// separating" until a full page reload — the exact stuck state this guards
// against. Cleared when the poll settles.
const activeServerPolls = new Map<string, number>()
const POLL_LIVENESS_MS = 120_000

function renewServerPoll(apiSessionId: string): void {
  activeServerPolls.set(apiSessionId, Date.now())
}

/** Whether a LIVE poll loop is already running for this RunPod job. A loop
 *  that hasn't ticked for POLL_LIVENESS_MS is treated as dead so a
 *  foreground/online re-kick can take the job over. */
export function isServerPollActive(apiSessionId: string): boolean {
  const lastTick = activeServerPolls.get(apiSessionId)
  if (lastTick === undefined) return false
  if (Date.now() - lastTick > POLL_LIVENESS_MS) {
    activeServerPolls.delete(apiSessionId)
    return false
  }
  return true
}

/**
 * Poll a submitted RunPod job to completion, then download + durably persist
 * its stems. Shared by a fresh submit (processServer) and a reload/foreground
 * re-attach (resumeServerSession) — the re-attach path is what makes a job that
 * finished while the client was backgrounded recoverable for free, instead of
 * orphaned and re-charged.
 */
async function pollAndPersistServer(
  sessionId: string,
  apiSessionId: string,
  callbacks: ProcessingCallbacks,
  estimatedSecs?: number,
  signal?: AbortSignal,
): Promise<void> {
  if (isServerPollActive(apiSessionId)) return
  renewServerPoll(apiSessionId)

  const startTime = Date.now()

  try {
    await pollForCompletion(
      apiSessionId,
      (progress, indeterminate, phase) => {
        renewServerPoll(apiSessionId)
        const elapsed = Date.now() - startTime
        updateUvrSessionProgress(
          sessionId,
          progress,
          elapsed,
          indeterminate,
          phase,
        )
        callbacks.onProgress(progress)
      },
      async (files: OutputFile[]) => {
        // The completed status arrives without a progress tick, and the stem
        // downloads below can legitimately run toward their 120s deadlines —
        // renew ownership here so a foreground re-kick can't start a second
        // download pass mid-way.
        renewServerPoll(apiSessionId)
        const outputs: UvrSession['outputs'] = {}
        const meta: Record<string, { duration?: number; size?: number }> = {}

        // Stems live on the server only temporarily — its output / presigned R2
        // link expire within hours — so download + persist each durably BEFORE
        // reporting complete. The local blob is what the mixer re-hydrates from
        // on every load; the server URL is a same-session fallback that will 404
        // later, so we only keep it when the durable save fails.
        setFinalizingUvrSession(sessionId)
        let savedPlayable = false
        let quotaHit = false
        await Promise.all(
          files.map(async (f) => {
            if (f.stem !== 'vocal' && f.stem !== 'instrumental') return
            meta[f.stem] = { duration: f.duration, size: f.size }
            // Hard-bound the WHOLE download (headers + multi-MB body read) —
            // a stalled connection here would otherwise hang the poll promise
            // forever, freezing the session at "finalizing" until a reload.
            const ctrl = new AbortController()
            const deadline = setTimeout(() => ctrl.abort(), 120_000)
            try {
              const resp = await getOutputFile(
                apiSessionId,
                f.path,
                ctrl.signal,
              )
              const blob = await resp.blob()
              renewServerPoll(apiSessionId)
              const res = await saveStemBlobDurable(
                sessionId,
                f.stem,
                blob,
                f.filename,
              )
              if (res.ok) {
                savedPlayable = true
                outputs[f.stem] = URL.createObjectURL(blob)
              } else {
                if (res.quotaExceeded) quotaHit = true
                outputs[f.stem] = f.path
              }
            } catch (err) {
              console.error('[uvr] stem download/persist failed:', f.stem, err)
              outputs[f.stem] = f.path
            } finally {
              clearTimeout(deadline)
            }
          }),
        )

        if (!savedPlayable) {
          // Nothing durable landed — don't report a false "completed" that will
          // 404 once the server URL expires.
          callbacks.onError(
            quotaHit
              ? 'Storage is full — free up space and try again.'
              : 'Could not save the separated stems locally. Please try again.',
          )
          return
        }

        await callbacks.onComplete({ outputs, stemMeta: meta })
      },
      callbacks.onError,
      1000,
      signal,
      estimatedSecs,
    )
  } catch (err) {
    // Server-confirmed dead job (failed / expired, or a completion-handler
    // throw): drop its RunPod id so the recovery UI stops offering a hopeless
    // re-attach. Transient/network rejections keep the id — the job may still
    // be alive and recover on the next foreground/online re-kick.
    if (err instanceof TerminalPollError) clearUvrSessionApiId(sessionId)
    throw err
  } finally {
    activeServerPolls.delete(apiSessionId)
  }
}

async function processServer(
  file: File,
  sessionId: string,
  callbacks: ProcessingCallbacks,
  model?: string,
  signal?: AbortSignal,
): Promise<void> {
  // Server mode targets the metered RunPod GPU tier. The worker rejects an
  // unconfigured tier instead of falling through to unmetered container work.
  const requestedModel = model ?? DEFAULT_PROCESS_REQUEST.model ?? 'roformer'
  const eta =
    SERVER_ETA_PROFILES[requestedModel] ?? SERVER_ETA_PROFILES.roformer
  const durationSecs = await audioDurationSecs(file)
  if (signal?.aborted ?? false) {
    throw new DOMException('Processing cancelled', 'AbortError')
  }
  const estimatedSecs =
    durationSecs !== null
      ? Math.min(
          eta.capSecs,
          Math.max(30, 20 + durationSecs / eta.realtimeDivisor),
        )
      : undefined

  const response = await processAudio(
    file,
    {
      ...DEFAULT_PROCESS_REQUEST,
      model: requestedModel,
      provider: 'runpod',
    },
    signal,
  )

  if (response.status !== 'processing') {
    throw new Error('Failed to start processing')
  }

  // Persist the RunPod job id DURABLY before polling. A full-page teardown (a
  // reload, or navigating to the standalone /karaoke entry via location.assign)
  // in the window before the first progress tick would otherwise lose the id,
  // stranding the job as unrecoverable and forcing a re-billed fresh
  // separation. Awaited so recovery is guaranteed once the job is submitted.
  await setUvrSessionApiIdDurable(sessionId, response.session_id)
  if (signal?.aborted ?? false) {
    await deleteSession(response.session_id).catch(() => undefined)
    clearUvrSessionApiId(sessionId)
    throw new DOMException('Processing cancelled', 'AbortError')
  }

  await pollAndPersistServer(
    sessionId,
    response.session_id,
    callbacks,
    estimatedSecs,
    signal,
  )
}

/**
 * Re-attach to an in-flight (or just-finished) RunPod job by its persisted
 * apiSessionId — no new job, no new debit. Used on load and on foreground to
 * recover a server separation whose client polling was lost to an iOS
 * app-switch or a page reload. Resolves once the job completes (stems
 * downloaded + persisted) or errors; a no-op if the job is already being
 * polled.
 */
export async function resumeServerSession(
  sessionId: string,
  apiSessionId: string,
  callbacks: ProcessingCallbacks,
): Promise<void> {
  // Liveness-aware (NOT a bare .has): a poll loop that stopped ticking must
  // not block the re-attach — that was the stuck-until-reload state.
  if (isServerPollActive(apiSessionId)) return
  await pollAndPersistServer(sessionId, apiSessionId, callbacks)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function preInitModel(): Promise<void> {
  await getSeparator()
}

export interface UvrPipelineOptions {
  /** Server-mode quality tier (registry name: 'roformer' | 'mdx' |
   *  'karaoke' | 'ensemble'). Omitted = the default request's model.
   *  Ignored in local mode (the on-device separator is MDX-only). */
  model?: string
  /** Cancels model preparation, upload, or polling for queue-owned runs. */
  signal?: AbortSignal
}

export async function runUvrPipeline(
  file: File,
  sessionId: string,
  mode: UvrProcessingMode,
  callbacks: ProcessingCallbacks,
  options: UvrPipelineOptions = {},
): Promise<void> {
  if (mode === 'local') {
    await processLocal(file, sessionId, callbacks, options.signal)
  } else {
    await processServer(
      file,
      sessionId,
      callbacks,
      options.model,
      options.signal,
    )
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
