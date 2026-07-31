// ============================================================
// UVR API Client - Frontend Integration
// ============================================================

import { z } from 'zod/v4'
import { getAuthToken } from '@/db/services/user-service'

const API_BASE = '/api/uvr'

/** Per-request cap for a status poll. Without it, a socket left half-open by an
 *  iOS app-switch (frozen page → resumed with a dead connection) never settles,
 *  and the whole setTimeout poll chain stalls on that one hung fetch — the
 *  "stuck on Waiting for a GPU worker forever" bug. On timeout we abort and let
 *  the poll retry. */
const STATUS_FETCH_TIMEOUT_MS = 15_000
/** Stem downloads are larger (a few MB over an R2 redirect); give them room. */
const OUTPUT_FETCH_TIMEOUT_MS = 60_000

/** fetch() with an AbortController timeout. Composes with a caller-supplied
 *  signal (either aborting wins). Throws AbortError on timeout. */
async function fetchWithTimeout(
  input: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  // AbortSignal.any keeps the caller's signal wired for the WHOLE response
  // lifetime — including the body read after headers arrive (the internal
  // timer only bounds time-to-headers and is cleared once fetch resolves).
  const signal = init?.signal
    ? AbortSignal.any([init.signal, ctrl.signal])
    : ctrl.signal
  try {
    return await fetch(input, { ...init, signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Authorization header for state-changing UVR calls. The production worker
 * gates non-GET /api/uvr/* behind a valid app JWT (see src/worker.ts); GET
 * reads stay open. An anonymous token is available after startup (ensureAuth),
 * so this is populated for every user, signed-in or not.
 */
function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token !== null && token !== ''
    ? { Authorization: `Bearer ${token}` }
    : {}
}

/**
 * Max upload size for SERVER (cloud GPU) processing of SOURCE songs. Files
 * up to 7 MB are inlined as base64 in the RunPod job; larger ones are
 * streamed via R2 (`audio_s3_key`) by the worker. The worker's own cap
 * (RUNPOD_MAX_UPLOAD_BYTES) is deliberately higher, 95 MB: a stem split
 * re-uploads the instrumental as uncompressed WAV, which blows past any
 * sensible compressed-source limit. This 50 MB gate is UX for the upload
 * queue only. Local (on-device) processing has no transport limit and
 * keeps the 100 MB default.
 */
export const SERVER_MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/** Local/on-device processing upload cap (in-browser model; no transport). */
export const LOCAL_MAX_UPLOAD_BYTES = 100 * 1024 * 1024

/**
 * Every stem the server registry can produce. Widen this (and the server
 * MODEL_REGISTRY) rather than adding a parallel union somewhere — nothing
 * in the app should assume a two-stem world.
 */
export const UVR_STEM_NAMES = [
  'vocal',
  'instrumental',
  'drums',
  'bass',
  'guitar',
  'piano',
  'other',
] as const

export type UvrStemName = (typeof UVR_STEM_NAMES)[number]

/**
 * Processing request parameters
 */
export interface ProcessRequest {
  model?: string
  output_format?: string
  stems?: string[]
  cpu_profile?: 'high' | 'mid' | 'low'
  /** What the submitted audio IS. 'original' (a full mix) is the default;
   *  'instrumental' marks a second pass over a stem an earlier job
   *  produced, which makes the server drop the near-silent vocal output
   *  and reconcile the residual so the stems sum back to the input. */
  source_stem?: 'original' | UvrStemName
  /** Stems to discard server-side. Defaults to ['vocal'] when
   *  source_stem is 'instrumental', [] otherwise. */
  drop_stems?: UvrStemName[]
  /** Force residual reconciliation on/off. Defaults to on for a
   *  second pass, off for a full mix (where it would fold the vocal
   *  into the residual). */
  reconcile_residual?: boolean
  /** Stem that absorbs the residual. Defaults to 'other'. */
  residual_stem?: UvrStemName
  /** Server-tier opt-in (X-UVR-Provider): 'runpod' = GPU (default server
   *  tier), 'runpod-cpu' = cheaper tier. The worker rejects unconfigured or
   *  headerless server processing instead of using unmetered compute. */
  provider?: 'runpod' | 'runpod-cpu'
  /** Song length (X-UVR-Duration-Seconds) — prices the long-song
   *  surcharge into the quote/debit. The RunPod handler verifies it
   *  against the probed duration, so under-declaring gets the job
   *  rejected (and refunded), never under-billed. */
  duration_seconds?: number
  /** Second-pass reuse: the `rp_<tier>_<jobId>` session whose R2 stems
   *  should be split IN PLACE — the worker resolves the object key and no
   *  audio is uploaded at all. 410 (`stem-expired`) means the ~24 h R2
   *  window has passed and the caller must re-upload the stored blob. */
  reuse_session?: string
}

// ── Long-song pricing (client mirror) ─────────────────────────────
// MIRROR of billing-core.ts (UVR_BASE_MINUTES / UVR_SURCHARGE_BLOCK_MINUTES
// / uvrLengthFactor) for cost display only — the db-worker computes the
// authoritative amount, and the handler verifies the declared length.

export const UVR_BASE_MINUTES = 12
export const UVR_SURCHARGE_BLOCK_MINUTES = 6

/** 1 within the included window, +1 per started block past it — an
 *  18.0-min song pays 2× the model cost. */
export function uvrLengthFactor(durationSeconds?: number): number {
  if (
    durationSeconds === undefined ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return 1
  }
  const overage = durationSeconds - UVR_BASE_MINUTES * 60
  if (overage <= 0) return 1
  return 1 + Math.ceil(overage / (UVR_SURCHARGE_BLOCK_MINUTES * 60))
}

// Default processing options. `model` is a server-side registry name
// (see runpod/handler.py MODEL_REGISTRY), not a weights filename:
// roformer = BS-RoFormer, the high-quality default.
export const DEFAULT_PROCESS_REQUEST: ProcessRequest = {
  model: 'roformer',
  output_format: 'WAV',
  stems: ['vocal', 'instrumental'],
  cpu_profile: 'high',
}

/**
 * Response after starting processing
 */
export interface ProcessResponse {
  session_id: string
  status: string
  message: string
  model: string
  output_format: string
}

/**
 * Status response with processing info
 */
export interface ProcessStatusResponse {
  session_id: string
  status: 'processing' | 'completed' | 'not_started' | 'error'
  progress?: number
  estimated_total_secs?: number
  cpu_profile?: string
  message?: string
  files: OutputFile[]
  error?: string
}

/**
 * Processed output file info
 */
export interface OutputFile {
  stem: string
  filename: string
  path: string
  size?: number
  duration?: number
}

// ── Zod schemas for API response validation ─────────────────────

/** Optional field that also tolerates explicit JSON `null`. The RunPod
 *  bridge OMITS absent keys, but the FastAPI container (pydantic
 *  Optional[...] fields) serializes them as `null` — both mean "absent"
 *  in this contract, so normalize null to undefined. */
const nullishOptional = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((v) => v ?? undefined)

const OutputFileSchema = z.object({
  stem: z.string(),
  filename: z.string(),
  path: z.string(),
  size: nullishOptional(z.number()),
  duration: nullishOptional(z.number()),
})

const ProcessResponseSchema = z.object({
  session_id: z.string(),
  status: z.string(),
  message: z.string(),
  model: z.string(),
  output_format: z.string(),
})

const ProcessStatusResponseSchema = z.object({
  session_id: z.string(),
  status: z.enum(['processing', 'completed', 'not_started', 'error']),
  progress: nullishOptional(z.number()),
  estimated_total_secs: nullishOptional(z.number()),
  cpu_profile: nullishOptional(z.string()),
  message: nullishOptional(z.string()),
  files: z.array(OutputFileSchema),
  error: nullishOptional(z.string()),
})

const ModelsResponseSchema = z.object({
  models: z.array(z.string()),
})

const StatusMessageSchema = z.object({
  status: z.string(),
  message: z.string(),
})

const HealthCheckSchema = z.object({
  status: z.string(),
  version: z.string(),
})

/**
 * Server-side separation quality tiers (registry names resolved by the
 * server — see runpod/handler.py MODEL_REGISTRY). Descriptions are the
 * user-facing story for a future quality selector.
 */
export interface UvrModelInfo {
  name: string
  display: string
  quality: string
  speed: string
  description: string
  /** Stems this model produces — mirrors MODEL_REGISTRY[...].stems on the
   *  server. UI reads this instead of assuming vocal + instrumental. */
  stems: readonly UvrStemName[]
  /** True for the multi-stem tiers that break a mix (or an instrumental)
   *  into its parts, rather than splitting vocal from everything else. */
  multiStem?: boolean
  /** Stems that work but are visibly rougher than the rest — surfaced to
   *  the user rather than quietly shipped as equals. A quality LABEL only;
   *  whether a stem ships at all is `defaultDropStems`. */
  experimentalStems?: readonly UvrStemName[]
  /** Stems this model emits that we discard by default. Deliberately
   *  separate from `experimentalStems`: turning a stem on later means
   *  removing it here while it stays labelled rough, which is the whole
   *  migration path. Only safe alongside residual reconciliation — a
   *  dropped stem's audio is folded into the residual, not lost. */
  defaultDropStems?: readonly UvrStemName[]
}

export const UVR_MODELS: readonly UvrModelInfo[] = [
  {
    name: 'roformer',
    display: 'Studio (BS-RoFormer)',
    quality: 'Highest',
    speed: 'Medium',
    description: 'Cleanest vocals and instrumental — the default.',
    stems: ['vocal', 'instrumental'],
  },
  {
    name: 'mdx',
    display: 'Fast (MDX-Net)',
    quality: 'Good',
    speed: 'Fast',
    description: 'The previous default; quicker, slightly more bleed.',
    stems: ['vocal', 'instrumental'],
  },
  {
    name: 'karaoke',
    display: 'Karaoke (keep backing vocals)',
    quality: 'High',
    speed: 'Medium',
    description: 'Removes only the lead vocal; harmonies stay in the mix.',
    stems: ['vocal', 'instrumental'],
  },
  {
    name: 'ensemble',
    display: 'Ensemble (two models)',
    quality: 'Maximum',
    speed: 'Slow',
    description: 'Blends two top models per stem; roughly twice the time.',
    stems: ['vocal', 'instrumental'],
  },
  {
    name: 'demucs',
    display: 'Parts — Fast (Demucs)',
    quality: 'Good',
    speed: 'Medium',
    description: 'Splits the music into drums, bass and everything else.',
    stems: ['vocal', 'drums', 'bass', 'other'],
    multiStem: true,
  },
  {
    name: 'demucs-ft',
    display: 'Parts — Studio (Demucs fine-tuned)',
    quality: 'Highest',
    speed: 'Slow',
    description:
      'Best drums and bass separation; four models blended, so ~4x the time.',
    stems: ['vocal', 'drums', 'bass', 'other'],
    multiStem: true,
  },
  {
    name: 'demucs-6s',
    display: 'Parts — Drums, bass, guitar & piano',
    quality: 'Good',
    speed: 'Slow',
    description:
      'Splits the music into drums, bass, guitar, piano and everything else.',
    stems: ['vocal', 'drums', 'bass', 'guitar', 'piano', 'other'],
    multiStem: true,
    // Piano ships (it rides on the same compute as guitar) but stays
    // labelled rough — it bleeds noticeably more than the other parts.
    // To pull it again, add `defaultDropStems: ['piano']`: the residual
    // pass folds its audio back into `other`, nothing is lost.
    experimentalStems: ['piano'],
  },
]

/** The multi-stem tiers, for a "split this further" picker. */
export const UVR_MULTI_STEM_MODELS = UVR_MODELS.filter(
  (m) => m.multiStem === true,
)

/** Default model for splitting an instrumental into its parts. The 6-stem
 *  model because guitar and piano are only available there. */
export const UVR_DEFAULT_MULTI_STEM_MODEL = 'demucs-6s'

export const getUvrModel = (name: string): UvrModelInfo | undefined =>
  UVR_MODELS.find((m) => m.name === name)

/**
 * The stems a split with this model actually yields — what it produces,
 * minus the source stem and anything dropped by default. This is what a
 * "you'll get: …" UI should list, and it stays correct when a stem is
 * later switched on.
 */
export function splitStemsFor(
  modelName: string = UVR_DEFAULT_MULTI_STEM_MODEL,
  sourceStem: UvrStemName = 'instrumental',
): UvrStemName[] {
  const model = getUvrModel(modelName)
  if (!model) return []
  const dropped = new Set<UvrStemName>([
    'vocal',
    sourceStem,
    ...(model.defaultDropStems ?? []),
  ])
  return model.stems.filter((s) => !dropped.has(s))
}

export interface StemSplitOptions {
  /** Registry model; defaults to UVR_DEFAULT_MULTI_STEM_MODEL. */
  model?: string
  /** The stem being split. Defaults to 'instrumental'. */
  sourceStem?: UvrStemName
  /** Override what to discard. Defaults to 'vocal' plus the model's
   *  `defaultDropStems` — pass [] to keep everything the model emits. */
  dropStems?: readonly UvrStemName[]
  /** Stem that absorbs the residual. Defaults to 'other'. */
  residualStem?: UvrStemName
  outputFormat?: string
  /** Server tier. Defaults to 'runpod' (GPU): a split is always a server
   *  job, and the worker 400s any /process request that names no tier.
   *  The local FastAPI container simply ignores the header. */
  provider?: 'runpod' | 'runpod-cpu'
  /** Length of the stem being split — bills the long-song surcharge on
   *  the second pass too (the handler verifies it like any declared
   *  duration). */
  durationSeconds?: number
}

/**
 * Build the request for a second pass that splits an existing stem into
 * its parts. Reconciliation is always on here: dropped stems are folded
 * into the residual rather than lost, and the kept stems sum back to the
 * stem that was fed in, so muting every part silences the whole.
 *
 * Throws if the residual stem is itself dropped — that combination would
 * silently discard everything the model failed to place.
 */
export function buildStemSplitRequest(
  options: StemSplitOptions = {},
): ProcessRequest {
  const modelName = options.model ?? UVR_DEFAULT_MULTI_STEM_MODEL
  const model = getUvrModel(modelName)
  if (!model) throw new Error(`Unknown UVR model: ${modelName}`)
  if (model.multiStem !== true) {
    throw new Error(`${modelName} does not produce multiple stems`)
  }

  const sourceStem = options.sourceStem ?? 'instrumental'
  const residualStem = options.residualStem ?? 'other'
  const dropStems = [
    ...new Set<UvrStemName>(
      options.dropStems ?? ['vocal', ...(model.defaultDropStems ?? [])],
    ),
  ]

  if (dropStems.includes(residualStem)) {
    throw new Error(
      `residual stem '${residualStem}' cannot also be dropped — it is what ` +
        `absorbs the dropped stems' audio`,
    )
  }

  // An explicit drop list must also shrink the request — asking the server
  // for a stem it was told to drop would download a file that never exists.
  const dropped = new Set<UvrStemName>(dropStems)
  return {
    model: modelName,
    output_format: options.outputFormat ?? 'WAV',
    stems: splitStemsFor(modelName, sourceStem).filter((s) => !dropped.has(s)),
    source_stem: sourceStem,
    drop_stems: dropStems,
    reconcile_residual: true,
    residual_stem: residualStem,
    provider: options.provider ?? 'runpod',
    ...(options.durationSeconds !== undefined && options.durationSeconds > 0
      ? { duration_seconds: options.durationSeconds }
      : {}),
  }
}

/**
 * List available UVR models
 */
export async function listModels(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/models`)
  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.statusText}`)
  }
  const data = ModelsResponseSchema.parse(await response.json())
  return data.models
}

/**
 * Start processing an audio file
 */
export async function processAudio(
  /** Null ONLY with `options.reuse_session` — the worker then splits the
   *  stem it already holds in R2 instead of receiving an upload. */
  file: File | null,
  options: ProcessRequest = DEFAULT_PROCESS_REQUEST,
  signal?: AbortSignal,
): Promise<ProcessResponse> {
  const formData = new FormData()
  if (file !== null) formData.append('file', file)
  if (options.reuse_session !== undefined) {
    formData.append('reuse_session', options.reuse_session)
  }

  if (options.model !== undefined) {
    formData.append('model', options.model)
  }
  if (options.output_format !== undefined) {
    formData.append('output_format', options.output_format)
  }
  if (options.stems) {
    formData.append('stems', JSON.stringify(options.stems))
  }
  if (options.cpu_profile) {
    formData.append('cpu_profile', options.cpu_profile)
  }
  // Second-pass fields. Omitted entirely for a normal full-mix job so the
  // server applies its own defaults (and older servers ignore them).
  if (options.source_stem !== undefined) {
    formData.append('source_stem', options.source_stem)
  }
  if (options.drop_stems !== undefined) {
    formData.append('drop_stems', JSON.stringify(options.drop_stems))
  }
  if (options.reconcile_residual !== undefined) {
    formData.append('reconcile_residual', String(options.reconcile_residual))
  }
  if (options.residual_stem !== undefined) {
    formData.append('residual_stem', options.residual_stem)
  }

  const headers: Record<string, string> = { ...authHeaders() }
  if (options.provider !== undefined) {
    headers['X-UVR-Provider'] = options.provider
  }
  if (options.duration_seconds !== undefined && options.duration_seconds > 0) {
    // Header, not form field: the worker admits/quotes (incl. the
    // long-song surcharge) before buffering the multipart body.
    headers['X-UVR-Duration-Seconds'] = String(
      Math.round(options.duration_seconds),
    )
  }
  if (options.model !== undefined) {
    // The worker admits/quotes the job before buffering the multipart body.
    // Repeating the model in a header lets it do that safely; the bridge
    // rejects a form/header mismatch before dispatch.
    headers['X-UVR-Model'] = options.model
  }

  const response = await fetch(`${API_BASE}/process`, {
    method: 'POST',
    headers,
    body: formData,
    signal,
  })

  if (!response.ok) {
    const raw = await response.text()
    // A misroute can answer with a whole HTML page (e.g. in local dev the
    // vite proxy target port is occupied by some other service, which 404s
    // in HTML). Never surface raw markup as the error, and cap plain-text
    // bodies to something a human can read in a toast.
    let message = raw.trimStart().startsWith('<')
      ? `The processing server gave an unexpected response (HTTP ${response.status}). If you are running locally, check that the UVR container is up and the proxy port matches.`
      : raw.slice(0, 300)
    try {
      const parsed = JSON.parse(raw) as {
        error?: string
        required?: number
        balance?: number
      }
      if (parsed.error !== undefined && parsed.error !== '') {
        message = parsed.error
      }
      // Auth/metering refusals become something a singer can act on
      // (UvrPanel upgrades these to action toasts linking to Account).
      if (response.status === 401) {
        message =
          'Sign in to use cloud GPU processing — open Settings, under Account.'
      }
      if (response.status === 402) {
        const need =
          parsed.required !== undefined
            ? ` — this song needs ${parsed.required} credit${parsed.required === 1 ? '' : 's'}`
            : ''
        const have =
          parsed.balance !== undefined ? `, you have ${parsed.balance}` : ''
        message = `Not enough credits${need}${have}. Get credits in Settings, under Account.`
      }
    } catch {
      /* non-JSON error body — keep the raw text */
    }
    // HTTP/2 has no statusText and gateway-level failures can have an empty
    // body — always name the status code so the user (and our logs) see
    // something actionable instead of a bare "Failed to process audio:".
    const error = new Error(
      message ||
        `The processing server could not be reached (HTTP ${response.status}). Please try again in a moment.`,
    ) as Error & { status?: number }
    // Callers branch on specific refusals (410 stem-expired → fall back to
    // uploading the stored blob) without parsing message strings.
    error.status = response.status
    throw error
  }

  return ProcessResponseSchema.parse(await response.json())
}

/**
 * Get processing status for a session
 */
export async function getProcessStatus(
  sessionId: string,
  signal?: AbortSignal,
): Promise<ProcessStatusResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/status/${sessionId}`,
    STATUS_FETCH_TIMEOUT_MS,
    signal ? { signal } : undefined,
  )
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.statusText}`)
  }
  return ProcessStatusResponseSchema.parse(await response.json())
}

/**
 * Get output file
 */
export async function getOutputFile(
  sessionId: string,
  path: string,
  /** Outer abort — lets callers bound the BODY read too (the internal
   *  timeout only covers time-to-headers; reading a multi-MB stem on a
   *  stalled connection would otherwise hang forever). */
  signal?: AbortSignal,
): Promise<Response> {
  return fetchWithTimeout(
    `${API_BASE}/output/${sessionId}/${encodeURIComponent(path)}`,
    OUTPUT_FETCH_TIMEOUT_MS,
    signal ? { signal } : undefined,
  )
}

/**
 * Delete a processing session
 */
export async function deleteSession(
  sessionId: string,
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/session/${sessionId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!response.ok) {
    throw new Error(`Failed to delete session: ${response.statusText}`)
  }
  return StatusMessageSchema.parse(await response.json())
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{
  status: string
  version: string
}> {
  const response = await fetch(`${API_BASE}/health`)
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`)
  }
  return HealthCheckSchema.parse(await response.json())
}
/** Rejection from pollForCompletion for a server-CONFIRMED dead job — a failed
 *  or expired separation, or a completion handler that threw. Distinct from a
 *  transient network rejection so callers can drop a job's `apiSessionId` (kill
 *  its recovery affordances) only when re-attaching is genuinely hopeless. */
export class TerminalPollError extends Error {
  readonly terminal = true
  constructor(message: string) {
    super(message)
    this.name = 'TerminalPollError'
  }
}

/**
 * Poll for processing completion with timeout and abort support
 */
export async function pollForCompletion(
  sessionId: string,
  onProgress: (
    progress: number,
    indeterminate?: boolean,
    phase?: 'queued' | 'processing',
  ) => void,
  onComplete: (files: OutputFile[]) => void | Promise<void>,
  onError: (error: string) => void,
  intervalMs: number = 1000,
  signal?: AbortSignal,
  /** Client-side estimate (secs) for the time-based progress fallback —
   *  beats the server's flat default when the song duration is known. */
  estimatedSecs?: number,
): Promise<void> {
  const startTime = Date.now()
  const maxTimeMs = 30 * 60 * 1000 // 30 minutes absolute max
  // Once the job is confirmed reachable, keep polling through transient status
  // failures (a per-request timeout, an offline blip, a 5xx) for this long
  // before giving up — a single hiccup (e.g. an iOS app-switch leaving a dead
  // socket) must not kill a separation the server is still happily running. A
  // hard failure on the very first poll still surfaces immediately.
  const failGraceMs = 90_000
  let estimateExceeded = false
  let hadSuccess = false
  let lastOkAt = startTime
  // The duration-based progress estimate must only measure time spent
  // actually PROCESSING. A cold start can sit IN_QUEUE for minutes; counting
  // that burned the whole estimate, pinned the bar at 95% "still separating"
  // before the GPU even started, and kept it frozen there through the real
  // run (a reload "fixed" it only because the clock restarted).
  let processingSince: number | null = null

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (signal?.aborted ?? false) {
        reject(new DOMException('Polling aborted', 'AbortError'))
        return
      }

      const elapsed = Date.now() - startTime
      if (elapsed > maxTimeMs) {
        const timeoutErr = 'Processing timed out after 30 minutes'
        onError(timeoutErr)
        reject(new Error(timeoutErr))
        return
      }

      try {
        const status = await getProcessStatus(sessionId, signal)
        hadSuccess = true
        lastOkAt = Date.now()

        if (status.status === 'completed') {
          // Await so callers can persist stems to IndexedDB before the session
          // is marked complete — otherwise completion can race a page reload
          // and leave a "completed" session with no durable local audio. Its
          // own try/catch: a completion-handler throw is TERMINAL, not a
          // transient network blip the outer catch would otherwise retry.
          try {
            await onComplete(status.files)
          } catch (completionErr) {
            const msg =
              completionErr instanceof Error
                ? completionErr.message
                : 'Failed to finalize the separation'
            onError(msg)
            reject(new TerminalPollError(msg))
            return
          }
          resolve()
          return
        }

        if (status.status === 'error') {
          const msg = status.error ?? 'Processing failed'
          onError(msg)
          reject(new TerminalPollError(msg))
          return
        }

        if (status.status === 'not_started') {
          const errMsg =
            'Processing server restarted unexpectedly. Please retry.'
          onError(errMsg)
          reject(new TerminalPollError(errMsg))
          return
        }

        // 'Queued' means no worker has picked the job up yet (cold start /
        // image pull) — surface that instead of pretending to estimate.
        const phase: 'queued' | 'processing' =
          status.message === 'Queued' ? 'queued' : 'processing'
        if (phase === 'processing' && processingSince === null) {
          processingSince = Date.now()
        }

        // Use server progress if available
        if (status.progress != null) {
          onProgress(status.progress, estimateExceeded, phase)
        } else if (phase === 'queued') {
          // Nothing is running yet — hold at 0/indeterminate under the
          // "warming up" copy instead of burning the estimate on queue time.
          onProgress(0, true, phase)
        } else {
          // Fallback: caller's duration-based estimate, else the server's
          // estimated_total_secs, else a flat default — measured from the
          // moment the job actually started processing.
          const totalSecs = estimatedSecs ?? status.estimated_total_secs ?? 120
          const estimatedMs = Math.max(totalSecs * 1000, 10000)
          const processingElapsed = Date.now() - (processingSince ?? startTime)
          const pct = (processingElapsed / estimatedMs) * 100

          if (pct >= 95 && !estimateExceeded) {
            estimateExceeded = true
            onProgress(95, true, phase)
          } else if (estimateExceeded) {
            onProgress(95, true, phase)
          } else {
            onProgress(Math.min(95, pct), false, phase)
          }
        }

        setTimeout(() => {
          void poll()
        }, intervalMs)
      } catch (error) {
        // A real cancel (the caller's signal) is terminal.
        if (signal?.aborted ?? false) {
          reject(new DOMException('Polling aborted', 'AbortError'))
          return
        }
        // Otherwise this is a transient failure — a status-fetch timeout (the
        // classic iOS resume-with-a-dead-socket case), an offline blip, a 5xx.
        // Once the job has been reached at least once, keep polling until the
        // grace window since the last good status is exhausted; the job is very
        // likely still running server-side. A first-poll failure surfaces now.
        if (hadSuccess && Date.now() - lastOkAt <= failGraceMs) {
          setTimeout(
            () => {
              void poll()
            },
            Math.max(intervalMs, 2000),
          )
          return
        }
        onError(error instanceof Error ? error.message : 'Unknown error')
        reject(error)
      }
    }

    poll()
  })
}

/**
 * Convert file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
