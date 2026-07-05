// ============================================================
// RunPod bridge — HTTP request/response handling
// ============================================================
// Turns the app's /api/uvr/* requests into RunPod job calls and back into
// the responses the front-end expects. Kept separate from runpod.ts (pure
// protocol mappers + fetch wrappers) so the worker stays a thin router and
// this orchestration is unit-testable with a mocked global fetch — see
// src/tests/runpod-bridge.test.ts.

import type { RunpodConfig, RunpodTier } from './runpod'
import { base64ToBytes, buildJobInput, bytesToBase64, cancelJob, contentTypeForFilename, endpointFor, fetchJobStatus, findStemOutput, mapStatusToResponse, parseSession, requestedRunpodTier, resolveTier, RUNPOD_ALLOWED_MODELS, submitJob, toSessionId, } from './runpod'
import type { MeteringConfig } from './uvr-metering'
import { debitForJob, refundJob } from './uvr-metering'

// base64 inflates ~33%; RunPod's /run input cap is ~10 MB, so only inline
// audio up to this raw size. Larger uploads (up to RUNPOD_MAX_UPLOAD_BYTES)
// are streamed to R2 and passed to the handler by S3 key instead.
const RUNPOD_MAX_INLINE_BYTES = 7 * 1024 * 1024

// Hard upload cap for server-side separation. Files between the inline cap
// and this go through R2 (`audio_s3_key`). Mirror of the client's
// SERVER_MAX_UPLOAD_BYTES. Kept comfortably under the handler's 100 MB byte
// cap and the ~12-min duration cap.
const RUNPOD_MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/** Minimal R2 surface the bridge needs — a subset of R2Bucket, so this pure
 *  module stays testable with a plain mock. */
export interface UvrInputBucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Refuse RunPod-opted requests when RunPod is NOT configured, instead of
 * silently falling through to the CPU container. The server option is
 * GPU-only by design (the RunPod CPU tier comes later): a container
 * fallback would run paid-looking jobs slower, for free and unmetered.
 * Returns null when the request didn't opt in / isn't a RunPod session —
 * those keep flowing to the container path as before.
 */
export function rejectUnconfiguredRunpod(
  request: Request,
  url: URL,
  method: string,
): Response | null {
  const stripped = url.pathname.replace(/^\/api\/uvr/, '')
  if (
    method === 'POST' &&
    stripped === '/process' &&
    requestedRunpodTier(request, url) !== null
  ) {
    return json(
      {
        error:
          'Server processing is not available right now. Use Browser mode instead.',
      },
      503,
    )
  }
  // Follow-ups for rp_* sessions cannot be served without config either.
  const m = stripped.match(/^\/(?:status|output|session)\/([^/]+)/)
  if (m && parseSession(m[1]) !== null) {
    return json({ error: 'Server processing is not available right now.' }, 503)
  }
  return null
}

/**
 * Bridge the app's /api/uvr/* contract to RunPod's serverless job API.
 * Returns a Response when it owns the request, or null to fall through to
 * the container path. Stateless: the tier + RunPod job id are carried in the
 * session id (`rp_<tier>_<jobId>`), so no session store is needed.
 */
export async function handleRunpodRequest(
  request: Request,
  url: URL,
  method: string,
  cfg: RunpodConfig,
  /** Credit metering (debit on accept, refund on failure/cancel); null = off. */
  meter: MeteringConfig | null = null,
  /** R2 bucket for staging inputs too big to inline (>7 MB); null = the
   *  large-file path is unavailable (falls back to the inline-cap error). */
  bucket: UvrInputBucket | null = null,
): Promise<Response | null> {
  const stripped = url.pathname.replace(/^\/api\/uvr/, '')
  const match = stripped.match(
    /^\/(process|status|output|session)(?:\/([^/]+))?(?:\/(.*))?$/,
  )
  if (!match) return null
  const route = match[1]
  const sessionId = match[2]
  const rest = match[3]

  // POST /process — only when the caller explicitly opts into RunPod. The
  // tier comes from the opt-in (gpu by default, cpu via `runpod-cpu`).
  if (route === 'process' && method === 'POST') {
    const requested = requestedRunpodTier(request, url)
    if (requested === null) return null
    const tier = resolveTier(cfg, requested)
    const endpointId = endpointFor(cfg, tier)
    if (endpointId === null) return null
    return startRunpodJob(request, cfg, endpointId, tier, meter, bucket)
  }

  // Follow-up calls route to RunPod by the rp_<tier>_ session id, so
  // container-origin (UUID) sessions are never intercepted here.
  if (sessionId === undefined) return null
  const parsed = parseSession(sessionId)
  if (parsed === null) return null
  const endpointId = endpointFor(cfg, parsed.tier)
  if (endpointId === null) {
    return json({ error: `RunPod ${parsed.tier} tier not configured` }, 404)
  }

  if (route === 'status' && method === 'GET') {
    const status = await fetchJobStatus(cfg, endpointId, parsed.jobId)
    const mapped = mapStatusToResponse(sessionId, status)
    // A job that ends in error never delivered — undo its debit. refundJob
    // is idempotent per jobRef, so repeated error polls can't double-refund.
    // CANCELLED is excluded: only our own DELETE route cancels jobs, and it
    // already decides whether the cancel is refundable — refunding here too
    // would let a mid-processing cancel claw the credit back via polling.
    if (mapped.status === 'error') {
      console.error(
        `[runpod] ${sessionId} failed: ${mapped.error ?? 'unknown'} (runpod status ${status.status ?? '?'})`,
      )
      const state = (status.status ?? '').toUpperCase()
      if (meter !== null && state !== 'CANCELLED') {
        await refundJob(meter, sessionId)
      }
    }
    return json(mapped)
  }

  if (route === 'output' && method === 'GET') {
    return serveRunpodOutput(cfg, endpointId, sessionId, parsed.jobId, rest)
  }

  if (route === 'session' && method === 'DELETE') {
    if (meter !== null) {
      // Refund only a cancel that cost us nothing: the job was still
      // IN_QUEUE (no worker picked it up, zero GPU spend). Cancelling a
      // RUNNING job keeps the debit — the GPU time is already paid for, and
      // refunding it would let users burn our GPU money for free by
      // cancelling near the end. Genuine failures are refunded by the
      // status route, and deleting a finished session is routine cleanup.
      // If the pre-cancel status can't be read, assume it was running.
      let preState = 'UNKNOWN'
      try {
        const pre = await fetchJobStatus(cfg, endpointId, parsed.jobId)
        preState = (pre.status ?? 'UNKNOWN').toUpperCase()
      } catch {
        /* transport error — keep the debit; the ledger allows manual fixes */
      }
      await cancelJob(cfg, endpointId, parsed.jobId)
      const refundable = preState === 'IN_QUEUE'
      console.log(
        `[runpod] ${sessionId} cancelled (was ${preState}${refundable ? ', refunding' : ', keeping debit'})`,
      )
      if (refundable) {
        await refundJob(meter, sessionId)
      }
    } else {
      await cancelJob(cfg, endpointId, parsed.jobId)
      console.log(`[runpod] ${sessionId} cancelled`)
    }
    return json({
      status: 'success',
      message: `Session ${sessionId} cancelled`,
    })
  }

  return null
}

/** Submit the uploaded audio to a tier's RunPod endpoint and return a
 *  process response whose session id encodes the tier. */
async function startRunpodJob(
  request: Request,
  cfg: RunpodConfig,
  endpointId: string,
  tier: RunpodTier,
  meter: MeteringConfig | null,
  bucket: UvrInputBucket | null,
): Promise<Response> {
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return json({ error: 'No file provided' }, 400)
  }

  const model = coerceFormString(form.get('model'))
  // Allowlist before spending anything: an unknown model would only fail
  // inside the (billable) RunPod job, and an open passthrough would let a
  // crafted request make the worker download arbitrary weights on our GPU
  // time. Absent model = handler default; unknown = loud 400.
  if (
    model !== undefined &&
    !(RUNPOD_ALLOWED_MODELS as readonly string[]).includes(model)
  ) {
    return json(
      {
        error: `Unknown model (use one of: ${RUNPOD_ALLOWED_MODELS.join(', ')})`,
      },
      400,
    )
  }
  const outputFormat = coerceFormString(form.get('output_format'))
  const audioUrl = coerceFormString(form.get('audio_url'))
  const stems = parseStems(form.get('stems'))

  // Hard cap first, whatever the transport.
  if (audioUrl === undefined && file.size > RUNPOD_MAX_UPLOAD_BYTES) {
    return json(
      {
        error: `File too large (max ${RUNPOD_MAX_UPLOAD_BYTES / (1024 * 1024)} MB for server processing).`,
      },
      413,
    )
  }

  // Three input transports, cheapest first:
  //   ≤7 MB  → inline base64 in the job payload (no R2 round-trip)
  //   >7 MB  → stream to R2 under `input/`, pass the key (handler downloads
  //            it with its own S3 creds — no public URL)
  //   audioUrl provided by the caller → pass through untouched
  let audioBase64: string | undefined
  let audioS3Key: string | undefined
  let via = 'audio_url'
  if (audioUrl === undefined) {
    if (file.size <= RUNPOD_MAX_INLINE_BYTES) {
      audioBase64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()))
      via = 'inline'
    } else if (bucket !== null) {
      audioS3Key = `input/${globalThis.crypto.randomUUID()}${extFromName(file.name)}`
      await bucket.put(audioS3Key, file.stream(), {
        httpMetadata: { contentType: file.type || 'audio/mpeg' },
      })
      via = 's3'
    } else {
      // >7 MB but no bucket wired → the large-file path is unavailable.
      return json(
        { error: 'Large-file server processing is not available right now.' },
        503,
      )
    }
  }

  const input = buildJobInput({
    filename: file.name,
    model,
    output_format: outputFormat,
    stems,
    audioUrl,
    audioBase64,
    audioS3Key,
  })

  // One breadcrumb per dispatch: the session id logged on accept is the
  // correlation key across worker logs, RunPod's console and the credit
  // ledger's jobRef.
  const sizeMb = (file.size / 1_000_000).toFixed(1)
  const res = await submitJob(cfg, endpointId, input)
  if (res.id === undefined || res.id === '') {
    console.error(
      `[runpod] submit failed (tier=${tier} file="${file.name}" ${sizeMb}MB ${via}): ${res.error ?? 'no job id'}`,
    )
    return json({ error: res.error ?? 'RunPod did not return a job id' }, 502)
  }
  const sessionId = toSessionId(tier, res.id)
  console.log(
    `[runpod] ${sessionId} accepted: "${file.name}" ${sizeMb}MB ${via} tier=${tier}`,
  )

  // Debit on acceptance (premium.md): the session id is the job's ledger
  // idempotency ref, so it can only exist after submit. If the user can't
  // pay, kill the just-started job rather than run it for free.
  if (meter !== null) {
    const verdict = await debitForJob(
      meter,
      request.headers.get('Authorization'),
      tier,
      sessionId,
    )
    if (!verdict.allowed) {
      await cancelJob(cfg, endpointId, res.id)
      console.warn(
        `[runpod] ${sessionId} cancelled: debit refused (balance ${verdict.balance ?? '?'}, required ${verdict.required ?? '?'})`,
      )
      return json(
        {
          error: verdict.error ?? 'Insufficient credits',
          required: verdict.required,
          balance: verdict.balance,
        },
        402,
      )
    }
  }

  return json({
    session_id: sessionId,
    status: 'processing',
    message: 'Processing started',
    model: input.model,
    output_format: input.output_format,
  })
}

/** Serve a finished stem: redirect to its storage URL, or stream inline
 *  base64 when the handler returned the bytes directly. */
async function serveRunpodOutput(
  cfg: RunpodConfig,
  endpointId: string,
  sessionId: string,
  jobId: string,
  rest: string | undefined,
): Promise<Response> {
  const status = await fetchJobStatus(cfg, endpointId, jobId)
  if ((status.status ?? '').toUpperCase() !== 'COMPLETED') {
    return json({ error: 'Output not ready' }, 404)
  }
  const wanted = decodeStemKey(rest, sessionId)
  const stem = findStemOutput(status.output, wanted)
  if (stem === null) {
    return json({ error: 'Stem not found' }, 404)
  }
  if (stem.url !== undefined && stem.url !== '') {
    return Response.redirect(stem.url, 302)
  }
  if (stem.data_base64 !== undefined && stem.data_base64 !== '') {
    const bytes = base64ToBytes(stem.data_base64)
    // Copy into a plain ArrayBuffer so the body type matches — the DOM lib
    // rejects a view backed by the generic ArrayBufferLike.
    const body = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(body).set(bytes)
    return new Response(body, {
      headers: { 'Content-Type': contentTypeForFilename(stem.filename) },
    })
  }
  return json({ error: 'Stem has no payload' }, 404)
}

/** The client double-prefixes the output path (it stores the full
 *  /api/uvr/output/... path and re-requests it). Strip any such prefix so
 *  we recover the bare stem key the worker emitted. */
export function decodeStemKey(
  rest: string | undefined,
  sessionId: string,
): string {
  const raw = decodeURIComponent(rest ?? '')
  const marker = `/api/uvr/output/${sessionId}/`
  const idx = raw.indexOf(marker)
  return idx >= 0 ? raw.slice(idx + marker.length) : raw
}

/** A non-empty string form field, or undefined. */
export function coerceFormString(
  value: FormDataEntryValue | null,
): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** A safe, lowercased file extension (with dot) from an untrusted filename,
 *  or '.mp3' when there isn't a sane one. Used for the R2 input key. */
export function extFromName(name: string): string {
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : ''
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '.mp3'
}

/** Parse the `stems` field — a JSON array of strings — or undefined. */
export function parseStems(
  value: FormDataEntryValue | null,
): string[] | undefined {
  if (typeof value !== 'string' || value === '') return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
      return parsed
    }
  } catch {
    /* fall through */
  }
  return undefined
}
