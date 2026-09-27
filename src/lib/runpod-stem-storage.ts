// ============================================================
// RunPod stems in R2: where a job's stems live and how they are served
// ============================================================
// The handler uploads a job's stems to R2 under `<prefix>/<jobId>/`. These
// helpers read them back: a completed status synthesized from the stems
// still there once RunPod has forgotten the job, a stem served straight from
// the bucket, and a stem handed over as bytes for the native app. Split out
// of runpod-bridge.ts, which routes the requests; see
// src/tests/runpod-bridge.test.ts for the tests.

import type { BridgeStatusResponse } from './runpod'
import { classifyStemFromFilename, contentTypeForFilename, RUNPOD_STEM_NAMES, } from './runpod'

/** Minimal R2 surface the bridge needs — a subset of R2Bucket, so this pure
 *  module stays testable with a plain mock. `put` stages large inputs; `list` +
 *  `get` power the durable stem-recovery fallback (serve stems straight from R2
 *  for the ~24 h the objects live, after RunPod has forgotten the job at ~30
 *  min). The binding is named UVR_INPUT_BUCKET but is the same bucket the
 *  handler uploads stems to. */
export interface UvrInputBucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  list(options?: {
    prefix?: string
    limit?: number
  }): Promise<{ objects: { key: string; size: number }[] }>
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>
}

/** The R2 object key prefix the handler wrote a job's stems under, ending in a
 *  slash so a list scopes to exactly one job's stems. */
export function stemDir(prefix: string, jobId: string): string {
  return `${prefix.replace(/\/+$/, '')}/${jobId}/`
}

export function baseName(key: string): string {
  const i = key.lastIndexOf('/')
  return i >= 0 ? key.slice(i + 1) : key
}

/**
 * Synthesize a completed-status response from stems still in R2 when RunPod no
 * longer has the job (its result expires ~30 min; the R2 objects live ~24 h).
 * Returns null when the job's stems aren't (or are no longer) in the bucket.
 */
export async function statusFromR2(
  bucket: UvrInputBucket,
  prefix: string,
  sessionId: string,
  jobId: string,
): Promise<BridgeStatusResponse | null> {
  const listed = await bucket.list({ prefix: stemDir(prefix, jobId) })
  const files = (listed.objects ?? [])
    .map((o) => {
      const name = baseName(o.key)
      const stem = classifyStemFromFilename(name)
      return {
        stem,
        filename: name,
        // Same shape mapStatusToResponse emits, so the client re-fetches each
        // stem through /output (which serves it from R2 below).
        path: `/api/uvr/output/${sessionId}/${encodeURIComponent(stem)}`,
        size: o.size,
      }
    })
    // Any classified stem counts: split jobs leave drums/bass/guitar/piano/
    // other here, and limiting recovery to vocal+instrumental silently broke
    // re-attaching to a finished split after a reload.
    .filter((f) => (RUNPOD_STEM_NAMES as readonly string[]).includes(f.stem))
  if (files.length === 0) return null
  return { session_id: sessionId, status: 'completed', progress: 100, files }
}

/**
 * Serve a stem straight from R2 by listing the job's `<prefix>/<jobId>/` folder
 * — the durable path when RunPod can't resolve the output anymore. Returns null
 * when the wanted stem isn't in the bucket.
 */
export async function serveStemFromR2(
  bucket: UvrInputBucket,
  prefix: string,
  jobId: string,
  wanted: string,
): Promise<Response | null> {
  const listed = await bucket.list({ prefix: stemDir(prefix, jobId) })
  const objs = listed.objects ?? []
  const needle = wanted.toLowerCase()
  const match =
    objs.find((o) => classifyStemFromFilename(baseName(o.key)) === needle) ??
    objs.find((o) => baseName(o.key).toLowerCase() === needle)
  if (match === undefined) return null
  const obj = await bucket.get(match.key)
  if (obj === null) return null
  return new Response(obj.body, {
    headers: { 'Content-Type': contentTypeForFilename(match.key) },
  })
}

/** A stored stem as bytes rather than a redirect: from R2 through the
 *  binding when the bucket has it (no storage origin involved at all), else
 *  fetched from its URL here and streamed on. */
export async function inlineStem(
  bucket: UvrInputBucket | null,
  stemPrefix: string,
  jobId: string,
  wanted: string,
  stem: { url: string; filename: string },
): Promise<Response> {
  if (bucket !== null) {
    const fromR2 = await serveStemFromR2(
      bucket,
      stemPrefix,
      jobId,
      wanted,
    ).catch(() => null)
    if (fromR2 !== null) return fromR2
  }
  const stored = await fetch(stem.url).catch(() => null)
  if (stored === null || !stored.ok || stored.body === null) {
    return new Response(
      JSON.stringify({ error: 'The separated song could not be fetched' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return new Response(stored.body, {
    headers: {
      'Content-Type': contentTypeForFilename(stem.filename),
    },
  })
}
