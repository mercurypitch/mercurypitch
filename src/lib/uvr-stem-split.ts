// ============================================================
// Stem split — break a session's instrumental into its parts
// ============================================================
// Second separation pass over the ALREADY-SEPARATED instrumental:
// the server (demucs-6s by default) returns drums/bass/guitar/other,
// drops the near-silent vocal and the rough piano, and reconciles the
// residual so the parts sum back to the instrumental exactly. The parts
// persist as ordinary UvrStemBlob rows keyed (sessionId, stemType), so a
// reload restores them with no extra bookkeeping.

import type { UvrStemType } from '@/db/entities'
import { deleteStemBlobs, getStemBlob, saveStemBlobDurable, } from '@/db/services/uvr-service'
import type { OutputFile } from './uvr-api'
import { buildStemSplitRequest, deleteSession, getOutputFile, pollForCompletion, processAudio, splitStemsFor, UVR_DEFAULT_MULTI_STEM_MODEL, } from './uvr-api'

/** The stems a split can add to a session (everything except the core trio). */
export type StemSplitPart = Exclude<
  UvrStemType,
  'vocal' | 'instrumental' | 'original'
>

/** Parts the default split yields, in display order. Piano is produced by
 *  the model but dropped server-side (its audio folds into `other`) — see
 *  defaultDropStems in uvr-api.ts. */
export const SPLIT_PART_STEMS: readonly StemSplitPart[] = splitStemsFor(
  UVR_DEFAULT_MULTI_STEM_MODEL,
  'instrumental',
) as StemSplitPart[]

export interface StemSplitProgress {
  phase: 'uploading' | 'processing' | 'saving'
  /** 0-100 within the current phase. */
  pct: number
}

export interface StemSplitResult {
  /** Stems that were saved to the session, in server order. */
  saved: StemSplitPart[]
  model: string
}

export class StemSplitError extends Error {}

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
  } = {},
): Promise<StemSplitResult> {
  const model = options.model ?? UVR_DEFAULT_MULTI_STEM_MODEL
  const notify = options.onProgress ?? (() => {})

  const instrumental = await getStemBlob(sessionId, 'instrumental')
  if (!instrumental) {
    throw new StemSplitError(
      'No instrumental stem is stored for this session yet.',
    )
  }

  notify({ phase: 'uploading', pct: 0 })
  const request = buildStemSplitRequest({ model })
  const file = new File([instrumental], 'instrumental.wav', {
    type: instrumental.type || 'audio/wav',
  })
  const started = await processAudio(file, request, options.signal)
  notify({ phase: 'processing', pct: 0 })

  const saved: StemSplitPart[] = []
  let completionError: unknown

  await pollForCompletion(
    started.session_id,
    (pct) => notify({ phase: 'processing', pct }),
    async (files: OutputFile[]) => {
      try {
        const wanted = new Set<string>(request.stems ?? [])
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
            started.session_id,
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

  // Best-effort server cleanup — the stems are safely in IndexedDB.
  void deleteSession(started.session_id).catch(() => {})

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
