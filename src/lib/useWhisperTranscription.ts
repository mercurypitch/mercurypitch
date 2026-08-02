/**
 * Shared Whisper transcription controller hook.
 *
 * Extracted from StemMixer.tsx and PitchTestingTab.tsx to eliminate duplication.
 * Both components had near-identical whisper init, chunked transcription,
 * deduplication, and status management.
 *
 * The chunk planning, the chunk run, per-chunk segment offsetting, and
 * hallucination detection are exported standalone so they can be unit-tested
 * without the model or the worker. Tests: src/tests/whisper-chunk-plan.test.ts
 * and src/tests/useWhisperTranscription-guard.test.ts.
 *
 * The invariant worth keeping: a run that was torn down mid-flight reports
 * `aborted`, and an aborted run is not a result — never judge it, cache it or
 * surface it as a model failure.
 */

import type { Accessor, Setter } from 'solid-js'
import { createSignal } from 'solid-js'
import { deleteTranscriptionFromDb, loadTranscriptionFromDb, saveTranscriptionToDb, } from '@/db/services/whisper-transcription-db-service'
import { deduplicateWhisperSegments, WHISPER_CHUNK_SEC, WHISPER_OVERLAP_SEC, WHISPER_SAMPLE_RATE, } from '@/lib/transcription-alignment-utils'
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
  /**
   * Optional song/session label appended to the log tag: `[logTag:label]`.
   * Read lazily at log time; when absent, logs keep the plain `[logTag]` form.
   */
  label?: string
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
  /**
   * User-displayable detail for status 'error' (null when none). Set when a
   * transcription fails outright or when the hallucination guard rejects the
   * output; cleared when a new transcription starts.
   */
  errorMessage: Accessor<string | null>

  // Actions
  initWhisper: () => void
  startTranscription: () => void
  /** Load previously cached transcription from IndexedDB */
  loadCachedTranscription: () => Promise<boolean>

  /** Language selection for Whisper transcription */
  language: Accessor<string>
  setLanguage: Setter<string>

  // Cleanup
  destroy: () => void
}

// ── Pure chunk planning ────────────────────────────────────────

export interface WhisperChunkPlanEntry {
  /** First sample of the chunk in the resampled buffer (inclusive) */
  startSample: number
  /** End of the chunk in the resampled buffer (exclusive) */
  endSample: number
  /** Absolute time of startSample in seconds — added to every segment
   *  timestamp the model returns for this chunk. */
  absoluteStartSec: number
}

/**
 * Plans overlapping chunks over a mono PCM buffer for Whisper.
 *
 * Guarantees: the union of [startSample, endSample) covers every sample of
 * the buffer exactly once per stride step (consecutive chunks overlap by
 * `overlapSec`), no chunk is empty, and a trailing window that would add no
 * new samples (its range fully covered by the previous chunk) is skipped
 * instead of being re-transcribed.
 */
export function computeWhisperChunkPlan(
  totalSamples: number,
  sampleRate: number = WHISPER_SAMPLE_RATE,
  chunkSec: number = WHISPER_CHUNK_SEC,
  overlapSec: number = WHISPER_OVERLAP_SEC,
): WhisperChunkPlanEntry[] {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('computeWhisperChunkPlan: sampleRate must be > 0')
  }
  if (
    !Number.isFinite(chunkSec) ||
    !Number.isFinite(overlapSec) ||
    overlapSec < 0 ||
    chunkSec <= overlapSec
  ) {
    throw new Error(
      'computeWhisperChunkPlan: need chunkSec > overlapSec >= 0 (got ' +
        `chunkSec=${String(chunkSec)}, overlapSec=${String(overlapSec)})`,
    )
  }
  if (!Number.isFinite(totalSamples) || totalSamples <= 0) return []

  const total = Math.floor(totalSamples)
  const chunkLen = Math.max(1, Math.round(chunkSec * sampleRate))
  const stride = Math.max(1, Math.round((chunkSec - overlapSec) * sampleRate))

  const plan: WhisperChunkPlanEntry[] = []
  let previousEnd = 0
  for (let start = 0; start < total; start += stride) {
    const end = Math.min(start + chunkLen, total)
    if (end > previousEnd) {
      plan.push({
        startSample: start,
        endSample: end,
        absoluteStartSec: start / sampleRate,
      })
      previousEnd = end
    }
    if (end >= total) break
  }
  return plan
}

/**
 * Copies one planned chunk out of the resampled buffer. Uses slice (a copy,
 * not a subarray view) on purpose: postMessage structured-clones the view's
 * entire underlying ArrayBuffer, so a view over the full song would clone
 * the whole buffer for every chunk.
 */
export function sliceWhisperChunk(
  audioData: Float32Array,
  entry: WhisperChunkPlanEntry,
): Float32Array {
  return audioData.slice(entry.startSample, entry.endSample)
}

// ── Pure segment post-processing ───────────────────────────────

/**
 * Shifts a chunk's model-relative segment timestamps to absolute song time.
 *
 * Defensive against the raw worker payload: entries without string text or a
 * finite start are dropped, and a missing/null end timestamp (the library
 * emits [start, null] for a truncated final segment) clamps to the start
 * instead of coercing null to 0, which used to invert the segment.
 */
export function offsetWhisperSegments(
  chunkSegments: readonly unknown[] | null | undefined,
  absoluteStartSec: number,
): WhisperSegment[] {
  if (chunkSegments == null) return []
  const out: WhisperSegment[] = []
  for (const raw of chunkSegments) {
    if (typeof raw !== 'object' || raw === null) continue
    const seg = raw as { text?: unknown; timestamp?: unknown }
    if (typeof seg.text !== 'string') continue
    if (!Array.isArray(seg.timestamp)) continue
    const start: unknown = seg.timestamp[0]
    if (typeof start !== 'number' || !Number.isFinite(start)) continue
    const rawEnd: unknown = seg.timestamp[1]
    const end =
      typeof rawEnd === 'number' && Number.isFinite(rawEnd) && rawEnd >= start
        ? rawEnd
        : start
    out.push({
      text: seg.text,
      timestamp: [start + absoluteStartSec, end + absoluteStartSec],
    })
  }
  return out
}

// ── Chunk run ──────────────────────────────────────────────────

/** The subset of WhisperService the chunk runner needs. */
export interface WhisperChunkTranscriber {
  transcribe: (
    audio: Float32Array,
    language: string,
  ) => Promise<{ chunks?: readonly unknown[] }>
}

export interface WhisperChunkRunOptions {
  plan: readonly WhisperChunkPlanEntry[]
  audioData: Float32Array
  language: string
  /**
   * Re-read before every chunk. Returning null is how a caller aborts a run
   * already in flight — its service was destroyed, or the run was superseded.
   */
  getTranscriber: () => WhisperChunkTranscriber | null
  /** Progress through the plan, 0-100, before each chunk starts. */
  onProgress?: (percent: number) => void
  /** Log sinks; the caller supplies its own tag. */
  log?: (message: string) => void
  logError?: (message: string, error: unknown) => void
}

export interface WhisperChunkRunOutcome {
  /** Segments from every chunk that succeeded, in absolute song time. */
  segments: WhisperSegment[]
  successes: number
  failures: number
  /**
   * The run was torn down mid-flight. `segments` is then a truncated prefix of
   * the song rather than a transcription of it, and callers must discard it
   * whole: a two-chunk prefix of an eighteen-chunk song reads to the
   * hallucination guard exactly like model junk, so treating it as a result
   * reports a failure that never happened. An abort is not a result.
   */
  aborted: boolean
}

/**
 * Transcribes a chunk plan, chunk by chunk, and reports how it ended.
 *
 * A failed chunk is survivable — its window is simply missing from the merged
 * segments. A torn-down run is not: the outcome says `aborted` and everything
 * in it is scrap.
 */
export async function runWhisperChunkPlan(
  options: WhisperChunkRunOptions,
): Promise<WhisperChunkRunOutcome> {
  const { plan, audioData, language, getTranscriber } = options
  const segments: WhisperSegment[] = []
  let successes = 0
  let failures = 0

  for (let ci = 0; ci < plan.length; ci++) {
    const transcriber = getTranscriber()
    if (transcriber == null) {
      options.log?.('Transcription aborted (service destroyed or stopped)')
      return { segments, successes, failures, aborted: true }
    }

    const entry = plan[ci]
    options.log?.(
      `Transcribing chunk ${String(ci + 1)}/${String(plan.length)} (${entry.absoluteStartSec.toFixed(1)}s-${(entry.endSample / WHISPER_SAMPLE_RATE).toFixed(1)}s)...`,
    )
    options.onProgress?.(Math.round((ci / plan.length) * 100))

    try {
      const result = await transcriber.transcribe(
        sliceWhisperChunk(audioData, entry),
        language,
      )
      successes++
      segments.push(
        ...offsetWhisperSegments(result.chunks, entry.absoluteStartSec),
      )
    } catch (chunkErr) {
      failures++
      options.logError?.(
        `Chunk ${String(ci + 1)}/${String(plan.length)} failed:`,
        chunkErr,
      )
    }
  }

  return { segments, successes, failures, aborted: false }
}

// ── Pure hallucination detection ───────────────────────────────

/** Minimum segments before the hallucination heuristics may fire. */
export const WHISPER_HALLUCINATION_MIN_SEGMENTS = 8
/** Detected when more than this share of segments have identical text. */
export const WHISPER_HALLUCINATION_DOMINANT_RATIO = 0.6
/** Detected when the median segment duration falls below this (seconds). */
export const WHISPER_HALLUCINATION_MIN_MEDIAN_SEC = 0.1

/** User-facing message surfaced through errorMessage() on detection. */
export const WHISPER_HALLUCINATION_USER_MESSAGE =
  'Transcription produced repeated placeholder text — the audio may be silent for Whisper or the model failed; try again or use LRC.'

export interface WhisperHallucinationCheck {
  detected: boolean
  reason: 'repeated-text' | 'degenerate-durations' | null
  segmentCount: number
  /** Most common normalized segment text ('' when there are no segments) */
  dominantText: string
  /** Share (0..1) of segments whose normalized text equals dominantText */
  dominantRatio: number
  medianDurationSec: number
}

function normalizeSegmentText(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Flags the degenerate output Whisper produces on silent/garbage input: many
 * near-identical segments (e.g. " idea." repeated hundreds of times) or a
 * segment list whose median duration is far below any real word (~20ms
 * spans). Both heuristics require WHISPER_HALLUCINATION_MIN_SEGMENTS so
 * short legitimate results never trip the guard.
 */
export function detectWhisperHallucination(
  segments: readonly WhisperSegment[],
): WhisperHallucinationCheck {
  const segmentCount = segments.length
  const counts = new Map<string, number>()
  const durations: number[] = []
  for (const segment of segments) {
    const key = normalizeSegmentText(segment.text)
    counts.set(key, (counts.get(key) ?? 0) + 1)
    durations.push(Math.max(0, segment.timestamp[1] - segment.timestamp[0]))
  }

  let dominantText = ''
  let dominantCount = 0
  for (const [key, count] of counts) {
    if (count > dominantCount) {
      dominantText = key
      dominantCount = count
    }
  }
  const dominantRatio = segmentCount === 0 ? 0 : dominantCount / segmentCount

  durations.sort((a, b) => a - b)
  const mid = Math.floor(durations.length / 2)
  let medianDurationSec = 0
  if (durations.length > 0) {
    medianDurationSec =
      durations.length % 2 === 1
        ? durations[mid]
        : (durations[mid - 1] + durations[mid]) / 2
  }

  let reason: WhisperHallucinationCheck['reason'] = null
  if (segmentCount >= WHISPER_HALLUCINATION_MIN_SEGMENTS) {
    if (dominantRatio > WHISPER_HALLUCINATION_DOMINANT_RATIO) {
      reason = 'repeated-text'
    } else if (medianDurationSec < WHISPER_HALLUCINATION_MIN_MEDIAN_SEC) {
      reason = 'degenerate-durations'
    }
  }

  return {
    detected: reason !== null,
    reason,
    segmentCount,
    dominantText,
    dominantRatio,
    medianDurationSec,
  }
}

// ── Controller ─────────────────────────────────────────────────

export function useWhisperTranscription(
  deps: WhisperTranscriptionDeps,
): WhisperTranscriptionController {
  const [status, setStatus] = createSignal<WhisperStatus>('idle')
  const [progress, setProgress] = createSignal(0)
  const [segments, setSegments] = createSignal<WhisperSegment[]>([])
  const [elapsed, setElapsed] = createSignal(-1)
  const [language, setLanguage] = createSignal('en')
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)

  let serviceRef: WhisperService | null = null
  let transcribing = false
  let timer: ReturnType<typeof setInterval> | null = null

  /** Log prefix: `logTag` or `logTag:label` — label is read lazily so it can
   *  be wired after hook creation. */
  const tag = (): string => {
    const label = deps.label
    if (label == null || label.trim() === '') return deps.logTag
    return `${deps.logTag}:${label.trim()}`
  }

  // ── Init ───────────────────────────────────────────────────

  // A transcription requested before the service finished (or started)
  // initializing — consumed once init lands. Lets callers simply ask to
  // transcribe: hosts that skip the eager model download (the karaoke
  // performance stage) pay it on the first explicit request instead of
  // silently doing nothing.
  let pendingStart = false

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
        if (pendingStart) {
          pendingStart = false
          startTranscription()
        }
      })
      .catch((err) => {
        console.error(`[${tag()}] Whisper init failed:`, err)
        pendingStart = false
        setErrorMessage(
          'Whisper failed to load. Check your connection and try again.',
        )
        setStatus('error')
      })
  }

  // ── Transcription ──────────────────────────────────────────

  const startTranscription = () => {
    const buffer = deps.getAudioBuffer()
    const currentStatus = status()

    // Diagnostic logging so silent failures are visible
    console.log(
      `[${tag()}] startTranscription called: status=${currentStatus}, buffer=${buffer != null ? 'yes' : 'no'}, transcribing=${String(transcribing)}, serviceRef=${serviceRef != null ? 'yes' : 'no'}`,
    )

    if (buffer == null) {
      console.warn(`[${tag()}] startTranscription: no audio buffer available`)
      return
    }
    if (transcribing) {
      console.warn(`[${tag()}] startTranscription: already transcribing`)
      return
    }
    if (currentStatus === 'error' && serviceRef != null) {
      // A failed init (network hiccup, blocked model fetch) is retryable on
      // an explicit request — discard the dead service and re-init below.
      console.log(`[${tag()}] startTranscription: retrying after failed init`)
      serviceRef.destroy()
      serviceRef = null
    }
    if (serviceRef == null) {
      // Self-initialize on demand and queue this request — init's completion
      // re-invokes startTranscription.
      console.log(
        `[${tag()}] startTranscription: initializing whisper service on demand`,
      )
      pendingStart = true
      initWhisper()
      return
    }
    if (currentStatus === 'loading') {
      // Init already in flight (e.g. eager init still downloading the
      // model) — queue and let it fire when ready.
      pendingStart = true
      return
    }
    // Allow transcription from 'ready' or 'done' (re-transcription)
    if (currentStatus !== 'ready' && currentStatus !== 'done') {
      console.warn(
        `[${tag()}] startTranscription: whisper not ready (status=${currentStatus})`,
      )
      return
    }

    transcribing = true
    setErrorMessage(null)
    setStatus('processing')
    setElapsed(0)
    timer = setInterval(() => {
      setElapsed((n) => n + 1)
    }, 1000)

    const selectedLanguage = language()

    resampleTo16kHz(buffer)
      .then(async (audioData) => {
        const plan = computeWhisperChunkPlan(audioData.length)
        console.log(
          `[${tag()}] Resampled to ${String(audioData.length)} samples, split into ${String(plan.length)} chunks`,
        )

        const run = await runWhisperChunkPlan({
          plan,
          audioData,
          language: selectedLanguage,
          // destroy() nulls serviceRef — that is how an unmount stops a run
          // that is already in flight.
          getTranscriber: () => (transcribing ? serviceRef : null),
          onProgress: (percent) => {
            setProgress(percent)
          },
          log: (message) => {
            console.log(`[${tag()}] ${message}`)
          },
          logError: (message, error) => {
            console.error(`[${tag()}] ${message}`, error)
          },
        })
        console.log(
          `[${tag()}] Chunk transcription: ${String(run.successes)}/${String(plan.length)} chunks succeeded, ${String(run.failures)} failed`,
        )

        // An abort is not a result: the run holds a truncated prefix of the
        // song, and judging it would purge this session's cached
        // transcription and report a model failure that never happened.
        // Leave the cache, the segments and the status alone.
        if (run.aborted) {
          console.log(
            `[${tag()}] Discarding partial result of an aborted run (${String(run.successes)}/${String(plan.length)} chunks) -- cache untouched`,
          )
          return
        }

        setProgress(100)

        if (plan.length > 0 && run.successes === 0) {
          console.error(
            `[${tag()}] Whisper transcription failed: every chunk errored`,
          )
          setErrorMessage(
            'Whisper transcription failed for every chunk. Try again or use LRC lyrics instead.',
          )
          setStatus('error')
          return
        }

        const deduped = deduplicateWhisperSegments(run.segments)

        // Guard against the Whisper failure mode where every chunk "succeeds"
        // but decodes to the same placeholder text with ~20ms spans (silent
        // or garbage-fed audio, or a broken model/dtype). Reporting that as
        // success poisons alignment and the cache.
        const hallucination = detectWhisperHallucination(deduped)
        if (hallucination.detected) {
          console.warn(
            `[${tag()}] Whisper hallucination detected (${hallucination.reason ?? 'unknown'}): ${String(hallucination.segmentCount)} segments, dominant text ${JSON.stringify(hallucination.dominantText)} at ${(hallucination.dominantRatio * 100).toFixed(0)}%, median duration ${hallucination.medianDurationSec.toFixed(3)}s -- discarding result`,
          )
          setSegments([])
          // A cached copy of an earlier junk run would resurrect on reload.
          if (deps.sessionId != null && deps.sessionId !== '') {
            void deleteTranscriptionFromDb(deps.sessionId)
          }
          setErrorMessage(WHISPER_HALLUCINATION_USER_MESSAGE)
          setStatus('error')
          return
        }

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
          `[${tag()}] Whisper transcription complete: ${String(deduped.length)} segments, ~${String(wordCount)} words (audio: ${(audioData.length / WHISPER_SAMPLE_RATE).toFixed(1)}s)`,
          deduped.slice(0, 5).map((s) => ({ text: s.text, t: s.timestamp })),
        )

        deps.onTranscriptionComplete?.(deduped)
      })
      .catch((err) => {
        console.error(`[${tag()}] Whisper transcription failed:`, err)
        setErrorMessage(
          'Whisper transcription failed. Try again or use LRC lyrics instead.',
        )
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
        // Junk persisted by a run that predates the hallucination guard must
        // not resurrect as a "cached transcription" — purge and miss.
        const hallucination = detectWhisperHallucination(cached)
        if (hallucination.detected) {
          console.warn(
            `[${tag()}] Cached transcription looks hallucinated (${hallucination.reason ?? 'unknown'}, ${String(hallucination.segmentCount)} segments) -- discarding cache`,
          )
          void deleteTranscriptionFromDb(deps.sessionId)
          return false
        }
        setSegments(cached)
        setStatus('done')
        console.log(
          `[${tag()}] Loaded cached transcription: ${String(cached.length)} segments`,
        )
        deps.onTranscriptionComplete?.(cached)
        return true
      }
    } catch (err) {
      console.warn(`[${tag()}] Failed to load cached transcription:`, err)
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
    errorMessage,
    language,
    setLanguage,
    initWhisper,
    startTranscription,
    loadCachedTranscription,
    destroy,
  }
}
