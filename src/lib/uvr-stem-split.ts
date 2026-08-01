// ============================================================
// Stem split — break a session's instrumental into its parts
// ============================================================
// Second separation pass over the ALREADY-SEPARATED instrumental:
// the server (demucs-6s by default) returns drums/bass/guitar/piano/other,
// drops the near-silent vocal, and reconciles the residual so the parts
// sum back to the instrumental exactly. The parts persist as ordinary
// UvrStemBlob rows keyed (sessionId, stemType), so a reload restores
// them with no extra bookkeeping.

import { createSignal } from 'solid-js'
import type { UvrStemType } from '@/db/entities'
import { deleteStemBlobs, getStemBlob, saveStemBlobDurable, } from '@/db/services/uvr-service'
import { eventBus } from './event-bus'
import type { OutputFile } from './uvr-api'
import { buildStemSplitRequest, deleteSession, getOutputFile, getUvrModel, KEEP_POLLING, pollForCompletion, processAudio, splitStemsFor, TerminalPollError, UVR_DEFAULT_MULTI_STEM_MODEL, } from './uvr-api'
import { wavDurationSeconds } from './wav-meta'

/** The stems a split can add to a session (everything except the core trio). */
export type StemSplitPart = Exclude<
  UvrStemType,
  'vocal' | 'instrumental' | 'original'
>

/** Parts the default split yields, in display order. */
export const SPLIT_PART_STEMS: readonly StemSplitPart[] = splitStemsFor(
  UVR_DEFAULT_MULTI_STEM_MODEL,
  'instrumental',
) as StemSplitPart[]

/** Parts of the default split that are shipped but visibly rougher than
 *  the rest (currently piano) — the UI flags these instead of presenting
 *  them as equals. */
export const EXPERIMENTAL_PART_STEMS: readonly StemSplitPart[] = (
  getUvrModel(UVR_DEFAULT_MULTI_STEM_MODEL)?.experimentalStems ?? []
).filter((s): s is StemSplitPart =>
  (SPLIT_PART_STEMS as readonly string[]).includes(s),
)

export interface StemSplitProgress {
  phase: 'uploading' | 'processing' | 'saving'
  /** 0-100 within the current phase. */
  pct: number
}

export interface StemSplitResult {
  /** Stems that were saved to the session, in server order. */
  saved: StemSplitPart[]
  model: string
  /** Wall-clock ms of the whole split (upload -> process -> saved) — the
   *  caller records it on the session (recordUvrSplitTime). */
  elapsedMs: number
}

export class StemSplitError extends Error {
  /** True when the underlying JOB may still be fine (a download hiccup, a
   *  worker restart mid-pickup, a network blip) — the persisted resume
   *  marker must survive so a later attach can still collect the stems.
   *  False only for a definitive server verdict (job FAILED — refunded)
   *  or an unusable result. */
  readonly recoverable: boolean

  constructor(message: string, options: { recoverable?: boolean } = {}) {
    super(message)
    this.recoverable = options.recoverable ?? false
  }
}

// ── Module-level split state ─────────────────────────────────────
// The poll runs OUTSIDE any component, so navigating between views can't
// kill it, and every surface derives its "Separating… N%" UI from this
// registry instead of holding component-local state that dies on unmount.
const [activeSplits, setActiveSplits] = createSignal<
  Record<string, StemSplitProgress>
>({})

/** Reactive map of in-flight splits, keyed by app session id. */
export const activeStemSplits = activeSplits

export function isStemSplitActive(sessionId: string): boolean {
  return activeSplits()[sessionId] !== undefined
}

function reportSplit(sessionId: string, p: StemSplitProgress): void {
  setActiveSplits((prev) => ({ ...prev, [sessionId]: p }))
}

function clearSplit(sessionId: string): void {
  setActiveSplits((prev) => {
    const next = { ...prev }
    delete next[sessionId]
    return next
  })
}

/** Header-only duration of a stored WAV blob; undefined when the bytes
 *  aren't parseable OR the environment's Blob lacks the slice/arrayBuffer
 *  APIs (old WebViews, jsdom) — billing then falls back to the base
 *  factor and the server enforces its own duration rules. */
async function blobWavDuration(blob: Blob): Promise<number | undefined> {
  try {
    const head = await blob.slice(0, 4096).arrayBuffer()
    return wavDurationSeconds(head, blob.size)
  } catch {
    return undefined
  }
}

/**
 * Run the split for a session and persist the resulting part stems.
 *
 * Resolves when every part is durably saved; the caller re-reads the
 * session's stems afterwards. Throws StemSplitError with a user-readable
 * message on any failure. Re-running replaces previous parts.
 */
export async function runStemSplit(
  sessionId: string,
  options: {
    model?: string
    onProgress?: (p: StemSplitProgress) => void
    signal?: AbortSignal
    /** The server session (`rp_<tier>_<jobId>`) that produced this
     *  session's stems. When set, the split is requested IN PLACE on the
     *  stem the server still holds in R2 (~24 h) — no upload, no size
     *  cap. Expired stems fall back to uploading the stored blob. */
    reuseApiSessionId?: string
    /** Length of the instrumental (for long-song billing). Falls back to
     *  parsing the stored WAV's header on the upload path. */
    durationSeconds?: number
    /** Fired the moment the server accepts the job, BEFORE polling — the
     *  caller persists the server session id durably so a reload can
     *  re-attach (attachToStemSplitJob) instead of orphaning a paid job. */
    onJobStarted?: (serverSessionId: string) => void | Promise<void>
  } = {},
): Promise<StemSplitResult> {
  const model = options.model ?? UVR_DEFAULT_MULTI_STEM_MODEL
  const startedAt = Date.now()
  if (isStemSplitActive(sessionId)) {
    throw new StemSplitError('A split is already running for this song.', {
      recoverable: true,
    })
  }
  reportSplit(sessionId, { phase: 'uploading', pct: 0 })
  options.onProgress?.({ phase: 'uploading', pct: 0 })

  // Reuse-first: the server separation that made this session left its
  // stems in R2 for ~24 h — splitting THAT copy skips uploading a
  // ~60-190 MB WAV entirely (and is the only way long songs fit). A 410
  // (stem-expired) falls through to the classic upload path.
  let started: Awaited<ReturnType<typeof processAudio>> | undefined
  try {
    // Billing depends on the stem's length; a caller with no metadata
    // must not silently under-declare a long song, so fall back to
    // reading it off the stored WAV's header ourselves.
    let instrumentalBlob: Blob | null = null
    let duration = options.durationSeconds
    if (duration === undefined) {
      instrumentalBlob = await getStemBlob(sessionId, 'instrumental')
      if (instrumentalBlob !== null) {
        duration = await blobWavDuration(instrumentalBlob)
      }
    }

    if (
      options.reuseApiSessionId !== undefined &&
      options.reuseApiSessionId !== ''
    ) {
      const request = buildStemSplitRequest({
        model,
        durationSeconds: duration,
      })
      try {
        started = await processAudio(
          null,
          { ...request, reuse_session: options.reuseApiSessionId },
          options.signal,
        )
      } catch (err) {
        const status = (err as Error & { status?: number }).status
        if (status !== 410) {
          if (err instanceof Error && err.name === 'AbortError') throw err
          const detail = err instanceof Error ? err.message : String(err)
          throw new StemSplitError(
            `Splitting the instrumental failed: ${detail}`,
          )
        }
        // Expired on the server — fall through to the upload below.
      }
    }

    if (started === undefined) {
      const instrumental =
        instrumentalBlob ?? (await getStemBlob(sessionId, 'instrumental'))
      if (!instrumental) {
        throw new StemSplitError(
          'No instrumental stem is stored for this session yet.',
        )
      }
      const request = buildStemSplitRequest({
        model,
        durationSeconds: duration ?? (await blobWavDuration(instrumental)),
      })
      const file = new File([instrumental], 'instrumental.wav', {
        type: instrumental.type || 'audio/wav',
      })
      started = await processAudio(file, request, options.signal)
    }
  } catch (err) {
    clearSplit(sessionId)
    throw err
  }

  // Persist the server session id BEFORE polling: a teardown in the poll
  // window must find the job on the next load, not orphan it. Best-effort
  // — a failed write only costs resumability, not this run.
  try {
    await options.onJobStarted?.(started.session_id)
  } catch (err) {
    console.warn('[stem-split] persisting the split job id failed:', err)
  }

  const attached = await attachToStemSplitJob(sessionId, started.session_id, {
    model,
    onProgress: options.onProgress,
    signal: options.signal,
    skipActiveGuard: true,
  })
  return { ...attached, elapsedMs: Date.now() - startedAt }
}

// ── Parts decision — what to do with a 'completed' listing ───────
// A "completed" status is not always a final verdict: the worker's R2
// recovery fallback (runpod-bridge statusFromR2) synthesizes one from
// whatever stem files have landed in the bucket, which mid-upload lists
// only some of the parts — or none that classify as parts at all. Pure
// and separate from the poll loop so the three outcomes are testable.

/** How long consecutive part-less "completed" listings are treated as
 *  still-processing before the split gives up (recoverably). Covers the
 *  handler's stem-upload window and a RunPod status blip; a genuinely
 *  empty result then surfaces as a retryable error, not a dead session. */
export const EMPTY_SPLIT_LISTING_PATIENCE_MS = 90_000

export type SplitPartsDecision =
  | { action: 'save'; parts: OutputFile[] }
  | { action: 'wait' }
  | { action: 'give-up'; returned: string[] }

/**
 * Decide how to treat the files of a 'completed' split status.
 *
 * - Any file matching a wanted part stem → save what came back (a subset,
 *   e.g. 5 of 6, is accepted rather than all-or-nothing — every consumer
 *   hydrates parts individually, so a missing one just isn't offered).
 * - No matching parts yet → 'wait' (treat as still-processing) until the
 *   patience window since the first empty listing runs out, then
 *   'give-up' with the stem names that WERE returned for the error text.
 *
 * `emptySince` is the caller-held timestamp of the first part-less listing
 * in the current streak (null when the last status was usable/alive); the
 * returned value is the next state to hold.
 */
export function decideSplitParts(args: {
  files: readonly OutputFile[]
  wanted: readonly string[]
  emptySince: number | null
  now: number
  patienceMs?: number
}): { decision: SplitPartsDecision; emptySince: number | null } {
  const wantedSet = new Set(args.wanted)
  const parts = args.files.filter((f) => wantedSet.has(f.stem))
  if (parts.length > 0) {
    return { decision: { action: 'save', parts }, emptySince: null }
  }
  const since = args.emptySince ?? args.now
  const patience = args.patienceMs ?? EMPTY_SPLIT_LISTING_PATIENCE_MS
  if (args.now - since >= patience) {
    const returned = [...new Set(args.files.map((f) => f.stem))]
    return { decision: { action: 'give-up', returned }, emptySince: null }
  }
  return { decision: { action: 'wait' }, emptySince: since }
}

/**
 * Poll a running split job and persist its parts — the second half of
 * runStemSplit, callable on its own to RE-ATTACH after a reload (the
 * split job id is persisted on the session record). Owns the progress
 * registry entry for the session and clears it when the job settles.
 */
export async function attachToStemSplitJob(
  sessionId: string,
  serverSessionId: string,
  options: {
    model?: string
    onProgress?: (p: StemSplitProgress) => void
    signal?: AbortSignal
    /** runStemSplit already holds the registry entry for this session —
     *  it alone may skip the double-attach guard. */
    skipActiveGuard?: boolean
  } = {},
): Promise<Omit<StemSplitResult, 'elapsedMs'>> {
  const model = options.model ?? UVR_DEFAULT_MULTI_STEM_MODEL
  if (options.skipActiveGuard !== true && isStemSplitActive(sessionId)) {
    throw new StemSplitError('A split is already running for this song.', {
      recoverable: true,
    })
  }
  // Server progress can jitter backwards at the start of a job (queued vs
  // processing snapshots race each other) — clamp so the UI only ever
  // moves forward within a phase.
  const raw = options.onProgress ?? (() => {})
  let last: StemSplitProgress = { phase: 'processing', pct: -1 }
  const notify = (p: StemSplitProgress) => {
    const pct = p.phase === last.phase ? Math.max(last.pct, p.pct) : p.pct
    last = { phase: p.phase, pct }
    reportSplit(sessionId, last)
    raw(last)
  }
  notify({ phase: 'processing', pct: 0 })

  const saved: StemSplitPart[] = []
  let completionError: unknown
  const wanted = splitStemsFor(model, 'instrumental')
  // First part-less "completed" listing of the current streak — reset
  // whenever the server reports the job alive again (a progress tick),
  // so a RunPod retry that re-queues the job restarts the patience clock.
  let emptySince: number | null = null

  try {
    await pollForCompletion(
      serverSessionId,
      (pct) => {
        emptySince = null
        notify({ phase: 'processing', pct })
      },
      async (files: OutputFile[]) => {
        try {
          const verdict = decideSplitParts({
            files,
            wanted,
            emptySince,
            now: Date.now(),
          })
          emptySince = verdict.emptySince
          if (verdict.decision.action === 'wait') {
            // Nothing usable listed yet while the job may still be
            // uploading (or the status was an R2 mid-upload snapshot) —
            // treat as still-processing rather than a failure.
            return KEEP_POLLING
          }
          if (verdict.decision.action === 'give-up') {
            const returned = verdict.decision.returned
            throw new StemSplitError(
              returned.length > 0
                ? `The split finished without part stems — the server returned: ${returned.join(', ')}. Please try the split again.`
                : 'The split finished without part stems. Please try the split again.',
              // The job is done and its output is wrong — but re-running
              // the split is perfectly viable, so keep the marker/retry
              // affordances instead of declaring the session dead.
              { recoverable: true },
            )
          }
          const parts = verdict.decision.parts
          let done = 0
          for (const part of parts) {
            if (options.signal?.aborted === true) {
              throw new DOMException('Stem split aborted', 'AbortError')
            }
            notify({
              phase: 'saving',
              pct: Math.round((done / parts.length) * 100),
            })
            // A worker restart or network blip mid-pickup must not kill
            // the whole completion — retry each file a couple of times.
            let resp: Response | null = null
            for (let attempt = 0; ; attempt++) {
              try {
                const r = await getOutputFile(
                  serverSessionId,
                  part.filename,
                  options.signal,
                )
                if (r.ok) {
                  resp = r
                  break
                }
                if (attempt >= 2) {
                  throw new StemSplitError(
                    `Downloading the ${part.stem} stem failed (HTTP ${r.status}).`,
                    { recoverable: true },
                  )
                }
              } catch (fetchErr) {
                if (
                  fetchErr instanceof StemSplitError ||
                  (fetchErr instanceof Error && fetchErr.name === 'AbortError')
                ) {
                  throw fetchErr
                }
                if (attempt >= 2) {
                  throw new StemSplitError(
                    `Downloading the ${part.stem} stem failed.`,
                    { recoverable: true },
                  )
                }
              }
              await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
            }
            const blob = await resp.blob()
            // Replace-then-save so a re-run never leaves two rows for a part
            // (getStemBlobUrl would still pick the newest, but the old blob
            // would sit in IndexedDB for ever).
            await deleteStemBlobs(sessionId, part.stem as UvrStemType)
            const write = await saveStemBlobDurable(
              sessionId,
              part.stem as UvrStemType,
              blob,
              part.filename,
              { derivedFrom: 'instrumental', producedBy: model },
            )
            if (!write.ok) {
              throw new StemSplitError(`Saving the ${part.stem} stem failed.`, {
                recoverable: true,
              })
            }
            saved.push(part.stem as StemSplitPart)
            done++
          }
          notify({ phase: 'saving', pct: 100 })
        } catch (err) {
          // pollForCompletion wraps onComplete failures in its own error;
          // keep the original so the caller sees the real cause.
          completionError = err
          throw err
        }
      },
      () => {
        /* onError: pollForCompletion also rejects — handled below. */
      },
      1000,
      options.signal,
    ).catch((err: unknown) => {
      if (completionError !== undefined) throw completionError
      if (err instanceof Error && err.name === 'AbortError') throw err
      const detail = err instanceof Error ? err.message : String(err)
      throw new StemSplitError(`Splitting the instrumental failed: ${detail}`, {
        // Only a server-reported verdict (job FAILED — auto-refunded)
        // means the job is truly dead. Poll/network trouble is not a
        // verdict: the stems may be sitting in R2 waiting to be fetched.
        recoverable: !(err instanceof TerminalPollError),
      })
    })
  } finally {
    clearSplit(sessionId)
  }

  // Whichever surface is mounted refreshes its part cards off this — the
  // completion no longer depends on the launching component being alive.
  eventBus.dispatch('uvr:parts-updated', { sessionId })

  // Best-effort server cleanup — the stems are safely in IndexedDB.
  void deleteSession(serverSessionId).catch(() => {})

  return { saved, model }
}

/** Display metadata for part stems, aligned with the vocal/instrumental
 *  rows in the results viewer. */
export const PART_STEM_DISPLAY: Record<
  StemSplitPart,
  { label: string; color: string }
> = {
  drums: { label: 'Drums', color: '#ef4444' },
  bass: { label: 'Bass', color: '#8b5cf6' },
  guitar: { label: 'Guitar', color: '#22c55e' },
  piano: { label: 'Piano', color: '#eab308' },
  other: { label: 'Other', color: '#94a3b8' },
}
