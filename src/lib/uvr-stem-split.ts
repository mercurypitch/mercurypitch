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
import { buildStemSplitRequest, deleteSession, getOutputFile, getUvrModel, pollForCompletion, processAudio, splitStemsFor, UVR_DEFAULT_MULTI_STEM_MODEL, } from './uvr-api'
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

export class StemSplitError extends Error {}

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
    throw new StemSplitError('A split is already running for this song.')
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
    throw new StemSplitError('A split is already running for this song.')
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

  try {
    await pollForCompletion(
      serverSessionId,
      (pct) => notify({ phase: 'processing', pct }),
      async (files: OutputFile[]) => {
        try {
          const wanted = new Set<string>(splitStemsFor(model, 'instrumental'))
          const parts = files.filter((f) => wanted.has(f.stem))
          if (parts.length === 0) {
            throw new StemSplitError('The split produced no part stems.')
          }
          let done = 0
          for (const part of parts) {
            if (options.signal?.aborted === true) {
              throw new DOMException('Stem split aborted', 'AbortError')
            }
            notify({
              phase: 'saving',
              pct: Math.round((done / parts.length) * 100),
            })
            const resp = await getOutputFile(
              serverSessionId,
              part.filename,
              options.signal,
            )
            if (!resp.ok) {
              throw new StemSplitError(
                `Downloading the ${part.stem} stem failed (HTTP ${resp.status}).`,
              )
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
              throw new StemSplitError(`Saving the ${part.stem} stem failed.`)
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
      throw new StemSplitError(`Splitting the instrumental failed: ${detail}`)
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
