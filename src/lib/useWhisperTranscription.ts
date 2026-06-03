/**
 * Shared Whisper transcription controller hook.
 *
 * Extracted from StemMixer.tsx and PitchTestingTab.tsx to eliminate duplication.
 * Both components had near-identical whisper init, chunked transcription,
 * deduplication, and status management.
 */

import type { Accessor, Setter } from 'solid-js'
import { createSignal } from 'solid-js'
import { loadTranscriptionFromDb, saveTranscriptionToDb, } from '@/db/services/whisper-transcription-db-service'
import { chunkAudioForWhisper, deduplicateWhisperSegments, WHISPER_CHUNK_SEC, WHISPER_OVERLAP_SEC, WHISPER_SAMPLE_RATE, } from '@/lib/transcription-alignment-utils'
import type { WhisperSegment } from '@/lib/whisper-service'
import { resampleTo16kHz, WhisperService } from '@/lib/whisper-service'

// ── Types ──────────────────────────────────────────────────────

export type WhisperStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'processing'
  | 'done'
  | 'error'

export interface WhisperTranscriptionDeps {
  /** Returns the AudioBuffer to transcribe, or null/undefined if unavailable */
  getAudioBuffer: () => AudioBuffer | null | undefined
  /** Tag for console log messages (e.g. "StemMixer", "PitchTestingTab") */
  logTag: string
  /** Session ID for persisting transcription to IndexedDB */
  sessionId?: string
  /** Optional callback fired after transcription completes with deduped segments */
  onTranscriptionComplete?: (segments: WhisperSegment[]) => void
}

export interface WhisperTranscriptionController {
  // Signals
  status: Accessor<WhisperStatus>
  setStatus: Setter<WhisperStatus>
  progress: Accessor<number>
  segments: Accessor<WhisperSegment[]>
  setSegments: Setter<WhisperSegment[]>
  elapsed: Accessor<number>

  // Actions
  initWhisper: () => void
  startTranscription: () => void
  /** Load previously cached transcription from IndexedDB */
  loadCachedTranscription: () => Promise<boolean>

  // Cleanup
  destroy: () => void
}

// ── Controller ─────────────────────────────────────────────────

export function useWhisperTranscription(
  deps: WhisperTranscriptionDeps,
): WhisperTranscriptionController {
  const [status, setStatus] = createSignal<WhisperStatus>('idle')
  const [progress, setProgress] = createSignal(0)
  const [segments, setSegments] = createSignal<WhisperSegment[]>([])
  const [elapsed, setElapsed] = createSignal(-1)

  let serviceRef: WhisperService | null = null
  let transcribing = false
  let timer: ReturnType<typeof setInterval> | null = null

  const tag = deps.logTag

  // ── Init ───────────────────────────────────────────────────

  const initWhisper = () => {
    if (serviceRef != null) return
    setStatus('loading')
    serviceRef = new WhisperService()
    // Forward status changes from the service, but NOT while actively
    // transcribing -- the worker fires 'ready' after each chunk completes,
    // which would overwrite our 'processing' status and confuse the UI.
    serviceRef.onStatusChange = (s: string) => {
      if (!transcribing) {
        setStatus(s as WhisperStatus)
      }
    }
    serviceRef.onProgressChange = (p: number) => {
      setProgress(p)
    }
    serviceRef
      .init()
      .then(() => {
        setStatus('ready')
      })
      .catch((err) => {
        console.error(`[${tag}] Whisper init failed:`, err)
        setStatus('error')
      })
  }

  // ── Transcription ──────────────────────────────────────────

  const startTranscription = () => {
    const buffer = deps.getAudioBuffer()
    const currentStatus = status()

    // Diagnostic logging so silent failures are visible
    console.log(
      `[${tag}] startTranscription called: status=${currentStatus}, buffer=${buffer != null ? 'yes' : 'no'}, transcribing=${String(transcribing)}, serviceRef=${serviceRef != null ? 'yes' : 'no'}`,
    )

    if (buffer == null) {
      console.warn(`[${tag}] startTranscription: no audio buffer available`)
      return
    }
    if (transcribing) {
      console.warn(`[${tag}] startTranscription: already transcribing`)
      return
    }
    if (serviceRef == null) {
      console.warn(
        `[${tag}] startTranscription: whisper service not initialized`,
      )
      return
    }
    // Allow transcription from 'ready' or 'done' (re-transcription)
    if (currentStatus !== 'ready' && currentStatus !== 'done') {
      console.warn(
        `[${tag}] startTranscription: whisper not ready (status=${currentStatus})`,
      )
      return
    }

    transcribing = true
    setStatus('processing')
    setElapsed(0)
    timer = setInterval(() => {
      setElapsed((n) => n + 1)
    }, 1000)

    resampleTo16kHz(buffer)
      .then(async (audioData) => {
        const audioChunks = chunkAudioForWhisper(audioData)
        console.log(
          `[${tag}] Resampled to ${String(audioData.length)} samples, split into ${String(audioChunks.length)} chunks`,
        )

        const merged: WhisperSegment[] = []
        let successes = 0
        let failures = 0
        for (let ci = 0; ci < audioChunks.length; ci++) {
          if (serviceRef == null || !transcribing) {
            console.log(
              `[${tag}] Transcription aborted (service destroyed or stopped)`,
            )
            break
          }

          const timeBase = ci * (WHISPER_CHUNK_SEC - WHISPER_OVERLAP_SEC)
          try {
            const result = await serviceRef.transcribe(audioChunks[ci])
            successes++
            for (const seg of result.chunks) {
              merged.push({
                text: seg.text,
                timestamp: [
                  seg.timestamp[0] + timeBase,
                  seg.timestamp[1] + timeBase,
                ],
              })
            }
          } catch (chunkErr) {
            failures++
            console.error(
              `[${tag}] Chunk ${String(ci + 1)}/${String(audioChunks.length)} failed:`,
              chunkErr,
            )
          }
        }
        console.log(
          `[${tag}] Chunk transcription: ${String(successes)}/${String(audioChunks.length)} chunks succeeded, ${String(failures)} failed`,
        )

        const deduped = deduplicateWhisperSegments(merged)
        setSegments(deduped)
        setStatus('done')

        // Persist to IndexedDB
        if (deps.sessionId != null && deps.sessionId !== '') {
          void saveTranscriptionToDb(deps.sessionId, deduped)
        }

        const wordCount = deduped.reduce(
          (c, s) => c + s.text.split(/\s+/).filter(Boolean).length,
          0,
        )
        console.log(
          `[${tag}] Whisper transcription complete: ${String(deduped.length)} segments, ~${String(wordCount)} words (audio: ${(audioData.length / WHISPER_SAMPLE_RATE).toFixed(1)}s)`,
          deduped.slice(0, 5).map((s) => ({ text: s.text, t: s.timestamp })),
        )

        deps.onTranscriptionComplete?.(deduped)
      })
      .catch((err) => {
        console.error(`[${tag}] Whisper transcription failed:`, err)
        setStatus('error')
      })
      .finally(() => {
        transcribing = false
        if (timer !== null) {
          clearInterval(timer)
          timer = null
        }
        setElapsed(-1)
      })
  }

  // ── Load cached transcription from IndexedDB ─────────────

  const loadCachedTranscription = async (): Promise<boolean> => {
    if (deps.sessionId == null || deps.sessionId === '') return false
    try {
      const cached = await loadTranscriptionFromDb(deps.sessionId)
      if (cached != null && cached.length > 0) {
        setSegments(cached)
        setStatus('done')
        console.log(
          `[${tag}] Loaded cached transcription: ${String(cached.length)} segments`,
        )
        deps.onTranscriptionComplete?.(cached)
        return true
      }
    } catch (err) {
      console.warn(`[${tag}] Failed to load cached transcription:`, err)
    }
    return false
  }

  // ── Cleanup ────────────────────────────────────────────────

  const destroy = () => {
    serviceRef?.destroy()
    serviceRef = null
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  return {
    status,
    setStatus,
    progress,
    segments,
    setSegments,
    elapsed,
    initWhisper,
    startTranscription,
    loadCachedTranscription,
    destroy,
  }
}
