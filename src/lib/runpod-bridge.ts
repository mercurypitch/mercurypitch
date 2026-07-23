// ============================================================
// RunPod bridge — HTTP request/response handling
// ============================================================
// Turns the app's /api/uvr/* requests into RunPod job calls and back into
// the responses the front-end expects. Kept separate from runpod.ts (pure
// protocol mappers + fetch wrappers) so the worker stays a thin router and
// this orchestration is unit-testable with a mocked global fetch — see
// src/tests/runpod-bridge.test.ts.

import type { BridgeStatusResponse, RunpodConfig, RunpodStatus, RunpodTier, } from './runpod'
import { base64ToBytes, buildJobInput, bytesToBase64, cancelJob, classifyStemFromFilename, contentTypeForFilename, endpointFor, fetchJobStatus, findStemOutput, mapStatusToResponse, parseSession, requestedRunpodTier, resolveTier, RUNPOD_ALLOWED_MODELS, RUNPOD_DEFAULT_MODEL, submitJob, toSessionId, } from './runpod'
import type { MeteringConfig } from './uvr-metering'
import { admitUvrJob, debitForJob, refundJob } from './uvr-metering'

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
function stemDir(prefix: string, jobId: string): string {
  return `${prefix.replace(/\/+$/, '')}/${jobId}/`
}

function baseName(key: string): string {
  const i = key.lastIndexOf('/')
  return i >= 0 ? key.slice(i + 1) : key
}

/**
 * Synthesize a completed-status response from stems still in R2 when RunPod no
 * longer has the job (its result expires ~30 min; the R2 objects live ~24 h).
 * Returns null when the job's stems aren't (or are no longer) in the bucket.
 */
async function statusFromR2(
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
    .filter((f) => f.stem === 'vocal' || f.stem === 'instrumental')
  if (files.length === 0) return null
  return { session_id: sessionId, status: 'completed', progress: 100, files }
}

/**
 * Serve a stem straight from R2 by listing the job's `<prefix>/<jobId>/` folder
 * — the durable path when RunPod can't resolve the output anymore. Returns null
 * when the wanted stem isn't in the bucket.
 */
async function serveStemFromR2(
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

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
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
  /** R2 bucket for staging inputs too big to inline (>7 MB) AND for the durable
   *  stem-recovery fallback (serve stems from R2 after RunPod forgets the job);
   *  null = both are unavailable. */
  bucket: UvrInputBucket | null = null,
  /** Object-key prefix the handler wrote this env's stems under ("runpod" in
   *  prod, "runpod-dev" on dev). Used to locate a job's stems in R2. */
  stemPrefix = 'runpod',
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
    // RunPod retains a job's result only ~30 min. Past that it 404s (throws) or
    // returns an unknown state — but the stems live in R2 for ~24 h, so we can
    // still recover a job whose client polling was lost to a reload / app-switch.
    let status: RunpodStatus | null = null
    try {
      status = await fetchJobStatus(cfg, endpointId, parsed.jobId)
    } catch (err) {
      console.warn(
        `[runpod] ${sessionId} status unreadable (${err instanceof Error ? err.message : String(err)}) — trying R2`,
      )
    }
    if (status !== null) {
      const mapped = mapStatusToResponse(sessionId, status)
      const state = (status.status ?? '').toUpperCase()
      // A job that ends in error never delivered — undo its debit. refundJob is
      // idempotent per jobRef, so repeated error polls can't double-refund.
      // CANCELLED is excluded: only our own DELETE route cancels jobs, and it
      // already decides whether the cancel is refundable — refunding here too
      // would let a mid-processing cancel claw the credit back via polling.
      if (mapped.status === 'error') {
        console.error(
          `[runpod] ${sessionId} failed: ${mapped.error ?? 'unknown'} (runpod status ${status.status ?? '?'})`,
        )
        if (meter !== null && state !== 'CANCELLED') {
          await refundJob(meter, sessionId)
        }
        return json(mapped)
      }
      // Trust RunPod's own live/terminal answers; only an unknown/empty state
      // (the job has been GC'd) falls through to the R2 recovery below.
      if (
        mapped.status === 'completed' ||
        state === 'IN_QUEUE' ||
        state === 'IN_PROGRESS'
      ) {
        return json(mapped)
      }
    }
    // RunPod couldn't resolve the job. If its stems are still in R2, report it
    // completed so the client fetches them (no re-run, no re-charge).
    if (bucket !== null) {
      const recovered = await statusFromR2(
        bucket,
        stemPrefix,
        sessionId,
        parsed.jobId,
      ).catch(() => null)
      if (recovered !== null) {
        console.log(
          `[runpod] ${sessionId} recovered from R2 (${recovered.files.length} stem(s))`,
        )
        return json(recovered)
      }
    }
    // No live job and no stems in R2. If RunPod gave a definitive not-found
    // (threw → status null), the result has expired — surface a terminal,
    // actionable error. Otherwise keep the client polling (its 30-min wall
    // clock bounds it) rather than killing a job over a transient blip.
    if (status === null) {
      return json({
        session_id: sessionId,
        status: 'error',
        files: [],
        error:
          'Your separated stems have expired. Please separate the song again.',
      } satisfies BridgeStatusResponse)
    }
    return json(mapStatusToResponse(sessionId, status))
  }

  if (route === 'output' && method === 'GET') {
    return serveRunpodOutput(
      cfg,
      endpointId,
      sessionId,
      parsed.jobId,
      rest,
      bucket,
      stemPrefix,
    )
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
  const modelHeader = request.headers.get('X-UVR-Model')
  const declaredModel =
    modelHeader !== null && modelHeader.trim() !== ''
      ? modelHeader.trim()
      : RUNPOD_DEFAULT_MODEL
  if (!(RUNPOD_ALLOWED_MODELS as readonly string[]).includes(declaredModel)) {
    return json(
      {
        error: `Unknown model (use one of: ${RUNPOD_ALLOWED_MODELS.join(', ')})`,
      },
      400,
    )
  }

  // Reject an obviously oversized multipart request before formData() buffers
  // it. Allow bounded room for multipart headers and the small option fields.
  const contentLength = Number(request.headers.get('Content-Length'))
  const maxMultipartBytes = RUNPOD_MAX_UPLOAD_BYTES + 512 * 1024
  if (Number.isFinite(contentLength) && contentLength > maxMultipartBytes) {
    return json(
      {
        error: `File too large (max ${RUNPOD_MAX_UPLOAD_BYTES / (1024 * 1024)} MB for server processing).`,
      },
      413,
    )
  }

  // Protect paid dispatch before consuming/buffering the multipart body. The
  // declared model is repeated in the form and checked below, so a caller
  // cannot quote a cheap model here and submit a more expensive one later.
  if (meter !== null) {
    const admission = await admitUvrJob(
      meter,
      request.headers.get('Authorization'),
      tier,
      declaredModel,
    )
    if (!admission.allowed) {
      const status = admission.status ?? 503
      const headers: Record<string, string> = {}
      if (admission.retryAfter !== undefined) {
        headers['Retry-After'] = String(admission.retryAfter)
      }
      return json(
        {
          error:
            admission.error ?? 'Server processing protection is unavailable',
          required: admission.required,
          balance: admission.balance,
        },
        status,
        headers,
      )
    }
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return json({ error: 'No file provided' }, 400)
  }

  const model = coerceFormString(form.get('model'))
  const effectiveModel = model ?? RUNPOD_DEFAULT_MODEL
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
  if (effectiveModel !== declaredModel) {
    return json(
      { error: 'The declared processing model does not match the upload.' },
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
      // input.model is always set (buildJobInput defaults it), so the debit
      // is priced for the model that actually runs.
      input.model,
    )
    if (!verdict.allowed) {
      await cancelJob(cfg, endpointId, res.id)
      // A transport failure can hide a successful debit response. The refund
      // endpoint is idempotent and safely no-ops when no debit exists, so this
      // best-effort compensation prevents a cancelled job from remaining
      // charged when the response was lost after the ledger commit.
      await refundJob(meter, sessionId)
      console.warn(
        `[runpod] ${sessionId} cancelled: debit refused (balance ${verdict.balance ?? '?'}, required ${verdict.required ?? '?'})`,
      )
      return json(
        {
          error: verdict.error ?? 'Server processing billing is unavailable',
          required: verdict.required,
          balance: verdict.balance,
        },
        verdict.status ?? 503,
        verdict.retryAfter !== undefined
          ? { 'Retry-After': String(verdict.retryAfter) }
          : {},
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

/** Serve a finished stem: from RunPod's job result while it lasts (redirect to
 *  the storage URL, or stream inline base64), else straight from R2 for the
 *  ~24 h the stem objects live after RunPod has forgotten the job. */
async function serveRunpodOutput(
  cfg: RunpodConfig,
  endpointId: string,
  sessionId: string,
  jobId: string,
  rest: string | undefined,
  bucket: UvrInputBucket | null,
  stemPrefix: string,
): Promise<Response> {
  const wanted = decodeStemKey(rest, sessionId)

  // Preferred path: RunPod still has the job → use the URL/bytes it returned.
  let status: RunpodStatus | null = null
  try {
    status = await fetchJobStatus(cfg, endpointId, jobId)
  } catch {
    /* RunPod forgot the job — fall through to R2 below. */
  }
  if (status !== null && (status.status ?? '').toUpperCase() === 'COMPLETED') {
    const stem = findStemOutput(status.output, wanted)
    if (stem !== null) {
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
    }
  }

  // Durable fallback: the stem bytes outlive RunPod's job record in R2.
  if (bucket !== null) {
    const fromR2 = await serveStemFromR2(
      bucket,
      stemPrefix,
      jobId,
      wanted,
    ).catch(() => null)
    if (fromR2 !== null) return fromR2
  }

  return json({ error: 'Output not ready' }, 404)
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
