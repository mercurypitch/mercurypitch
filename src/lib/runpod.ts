// ============================================================
// RunPod bridge — translate the app's /api/uvr/* contract to/from
// RunPod's serverless job API.
// ============================================================
// The front-end (src/lib/uvr-api.ts) speaks one contract: POST /process
// returns a session id, GET /status/{id} polls, GET /output/{id}/{path}
// fetches stems. This module lets the Cloudflare worker satisfy that
// contract by dispatching to a RunPod serverless endpoint instead of the
// CPU container — the GPU "fast / quality" path from the go-to-market plan.
//
// It is deliberately STATELESS: the tier + RunPod job id are encoded into
// the session id we hand back (`rp_<tier>_<jobId>`), so /status, /output and
// /session calls route straight back to the right endpoint with no
// server-side session store.
//
// Two tiers map to two RunPod endpoints: `gpu` (fast, the paid anchor) and
// `cpu` (cheaper, slower). GPU is the default when a request opts into
// server-side rendering; CPU is opt-in via `runpod-cpu`.
//
// Everything here is pure data-mapping plus thin fetch wrappers, so the
// translation logic is unit-tested without a live endpoint (see
// src/tests/runpod.test.ts).

/** Prefix marking a session id as RunPod-backed. */
export const RUNPOD_SESSION_PREFIX = 'rp_'

/** Registry quality tiers the handler accepts (see runpod/handler.py
 *  MODEL_REGISTRY — that copy is the source of truth). The legacy MDX
 *  weights filename stays accepted for older clients. */
export const RUNPOD_ALLOWED_MODELS = [
  'roformer',
  'mdx',
  'karaoke',
  'ensemble',
  'UVR-MDX-NET-Inst_HQ_3',
] as const

export const RUNPOD_DEFAULT_MODEL = 'roformer'

const DEFAULT_BASE_URL = 'https://api.runpod.ai/v2'

// While a job is queued/running RunPod gives no progress %, so we report an
// estimate and let the client's time-based fallback animate the bar.
const RUNPOD_ESTIMATED_SECS = 180

const RUNPOD_TERMINAL_ERROR = new Set(['FAILED', 'CANCELLED', 'TIMED_OUT'])

/** Server-side separation tiers, each backed by its own RunPod endpoint. */
export type RunpodTier = 'gpu' | 'cpu'

// ── Config ──────────────────────────────────────────────────────

export interface RunpodConfig {
  apiKey: string
  /** Endpoint id per tier; a tier is unavailable when its id is absent. */
  endpoints: { gpu?: string; cpu?: string }
  /** Tier used when a request opts in without naming one (GPU when present). */
  defaultTier: RunpodTier
  /** Override for tests / self-hosting; defaults to RunPod's v2 API. */
  baseUrl: string
}

/** The subset of worker env this module reads. */
export interface RunpodEnvLike {
  RUNPOD_API_KEY?: string
  /** GPU endpoint. `RUNPOD_ENDPOINT_ID` is accepted as a legacy alias. */
  RUNPOD_ENDPOINT_ID_GPU?: string
  RUNPOD_ENDPOINT_ID?: string
  /** CPU endpoint (cheaper, slower). */
  RUNPOD_ENDPOINT_ID_CPU?: string
  RUNPOD_BASE_URL?: string
}

function firstNonEmpty(...vals: (string | undefined)[]): string | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== '') return v
  }
  return undefined
}

/** Resolve RunPod config from env, or null when not fully configured.
 *  Null means "RunPod is off" — the worker then uses the container path.
 *  Requires an API key and at least one tier endpoint. */
export function getRunpodConfig(env: RunpodEnvLike): RunpodConfig | null {
  const apiKey = env.RUNPOD_API_KEY
  if (apiKey === undefined || apiKey === '') return null

  const gpu = firstNonEmpty(env.RUNPOD_ENDPOINT_ID_GPU, env.RUNPOD_ENDPOINT_ID)
  const cpu = firstNonEmpty(env.RUNPOD_ENDPOINT_ID_CPU)
  if (gpu === undefined && cpu === undefined) return null

  const endpoints: { gpu?: string; cpu?: string } = {}
  if (gpu !== undefined) endpoints.gpu = gpu
  if (cpu !== undefined) endpoints.cpu = cpu

  const baseUrl = (env.RUNPOD_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  // GPU is the default tier when configured (faster; the paid anchor).
  const defaultTier: RunpodTier = gpu !== undefined ? 'gpu' : 'cpu'
  return { apiKey, endpoints, defaultTier, baseUrl }
}

/** Endpoint id for a tier, or null when that tier isn't configured. */
export function endpointFor(
  cfg: RunpodConfig,
  tier: RunpodTier,
): string | null {
  const id = cfg.endpoints[tier]
  return id !== undefined && id !== '' ? id : null
}

/** Pick the tier to actually use: the requested one when configured,
 *  otherwise fall back to the default tier. */
export function resolveTier(
  cfg: RunpodConfig,
  requested: RunpodTier,
): RunpodTier {
  return endpointFor(cfg, requested) !== null ? requested : cfg.defaultTier
}

// ── Session id <-> {tier, job id} ───────────────────────────────

export function isRunpodSessionId(sessionId: string): boolean {
  return sessionId.startsWith(RUNPOD_SESSION_PREFIX)
}

export function toSessionId(tier: RunpodTier, jobId: string): string {
  return `${RUNPOD_SESSION_PREFIX}${tier}_${jobId}`
}

/** Recover {tier, jobId} from a session id, or null if it isn't ours. */
export function parseSession(
  sessionId: string,
): { tier: RunpodTier; jobId: string } | null {
  const m = sessionId.match(/^rp_(gpu|cpu)_(.+)$/)
  if (!m) return null
  return { tier: m[1] as RunpodTier, jobId: m[2] }
}

/** The tier a request opts into, or null when it doesn't want RunPod.
 *  `runpod` / `runpod-gpu` → gpu, `runpod-cpu` → cpu. Process requests must
 *  opt in; follow-up calls route by the `rp_<tier>_` session id instead. */
export function requestedRunpodTier(
  request: Request,
  url: URL,
): RunpodTier | null {
  const raw = (
    request.headers.get('x-uvr-provider') ??
    url.searchParams.get('provider') ??
    ''
  ).toLowerCase()
  if (raw === 'runpod' || raw === 'runpod-gpu') return 'gpu'
  if (raw === 'runpod-cpu') return 'cpu'
  return null
}

// ── URLs / headers ──────────────────────────────────────────────

export function runpodEndpointUrl(
  cfg: RunpodConfig,
  endpointId: string,
  path: string,
): string {
  return `${cfg.baseUrl}/${endpointId}${path}`
}

export function runpodHeaders(cfg: RunpodConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json',
  }
}

// ── Job input ───────────────────────────────────────────────────

export interface RunpodJobInput {
  filename: string
  model: string
  output_format: string
  stems: string[]
  audio_base64?: string
  audio_url?: string
  /** R2 object key for inputs too big to inline (>7 MB). The handler
   *  downloads it from S3_BUCKET with its own credentials — no public URL. */
  audio_s3_key?: string
}

export interface BuildJobInputParams {
  filename?: string
  model?: string
  output_format?: string
  stems?: string[]
  audioBase64?: string
  audioUrl?: string
  audioS3Key?: string
}

export function buildJobInput(p: BuildJobInputParams): RunpodJobInput {
  const input: RunpodJobInput = {
    filename: p.filename ?? 'input',
    model: p.model ?? RUNPOD_DEFAULT_MODEL,
    // FLAC keeps the JSON payload small (vs WAV) when stems round-trip as
    // base64; lossless so quality is unaffected.
    output_format: (p.output_format ?? 'FLAC').toUpperCase(),
    stems: p.stems ?? ['vocal', 'instrumental'],
  }
  // Precedence: an R2 key (big file) or a caller URL both avoid inlining;
  // base64 is the small-file fast path.
  if (p.audioS3Key !== undefined && p.audioS3Key !== '') {
    input.audio_s3_key = p.audioS3Key
  } else if (p.audioUrl !== undefined && p.audioUrl !== '') {
    input.audio_url = p.audioUrl
  } else if (p.audioBase64 !== undefined && p.audioBase64 !== '') {
    input.audio_base64 = p.audioBase64
  }
  return input
}

// ── RunPod responses ────────────────────────────────────────────

export interface RunpodStemOutput {
  stem: string
  filename: string
  url?: string
  data_base64?: string
  size?: number
  duration?: number
}

export interface RunpodHandlerOutput {
  stems?: RunpodStemOutput[]
  error?: string
  timings?: Record<string, number>
  cost?: { gpu_usd_per_hr?: number; billed_secs?: number; usd?: number }
}

export interface RunpodStatus {
  id?: string
  status?: string
  output?: RunpodHandlerOutput
  error?: string
}

export interface RunpodRunResponse {
  id?: string
  status?: string
  error?: string
}

// ── Status mapping (RunPod -> app contract) ─────────────────────

/** A stem file as the app's UVR client expects it. */
export interface BridgeOutputFile {
  stem: string
  filename: string
  path: string
  size?: number
  duration?: number
}

/** Matches the shape of uvr-api.ts ProcessStatusResponse so the client's
 *  zod schema validates it unchanged. */
export interface BridgeStatusResponse {
  session_id: string
  status: 'processing' | 'completed' | 'not_started' | 'error'
  progress?: number
  estimated_total_secs?: number
  files: BridgeOutputFile[]
  message?: string
  error?: string
}

/** Map a RunPod /status payload to the app's status contract. */
export function mapStatusToResponse(
  sessionId: string,
  rp: RunpodStatus,
): BridgeStatusResponse {
  const state = (rp.status ?? '').toUpperCase()

  if (state === 'COMPLETED') {
    const out = rp.output
    if (out?.error !== undefined && out.error !== '') {
      return {
        session_id: sessionId,
        status: 'error',
        files: [],
        error: out.error,
      }
    }
    const stems = out?.stems ?? []
    if (stems.length === 0) {
      // Completed but produced nothing — surface it instead of returning a
      // silent empty success the client would treat as "done, no stems".
      return {
        session_id: sessionId,
        status: 'error',
        files: [],
        error: 'RunPod job completed without output stems',
      }
    }
    const files: BridgeOutputFile[] = stems.map((s) => ({
      stem: s.stem,
      filename: s.filename,
      // Resolved by the worker's /output route (redirect to the stem URL,
      // or stream the inline base64) — keeps the app's existing contract.
      path: `/api/uvr/output/${sessionId}/${encodeURIComponent(s.stem)}`,
      size: s.size,
      duration: s.duration,
    }))
    return { session_id: sessionId, status: 'completed', progress: 100, files }
  }

  if (RUNPOD_TERMINAL_ERROR.has(state)) {
    return {
      session_id: sessionId,
      status: 'error',
      files: [],
      error: rp.error ?? rp.output?.error ?? `Job ${state.toLowerCase()}`,
    }
  }

  // IN_QUEUE / IN_PROGRESS / unknown — still working.
  return {
    session_id: sessionId,
    status: 'processing',
    estimated_total_secs: RUNPOD_ESTIMATED_SECS,
    files: [],
    message: state === 'IN_QUEUE' ? 'Queued' : 'Processing',
  }
}

/** Find a produced stem by stem type ("vocal") or exact filename. */
export function findStemOutput(
  out: RunpodHandlerOutput | undefined,
  stemOrName: string,
): RunpodStemOutput | null {
  const stems = out?.stems ?? []
  const needle = stemOrName.toLowerCase()
  return (
    stems.find((s) => s.stem.toLowerCase() === needle) ??
    stems.find((s) => s.filename.toLowerCase() === needle) ??
    null
  )
}

export function contentTypeForFilename(filename: string): string {
  const dot = filename.lastIndexOf('.')
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : ''
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.flac') return 'audio/flac'
  return 'audio/wav'
}

/** Decode a base64 stem payload to bytes for streaming back to the client. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Encode bytes as base64 for the audio_base64 job input. Chunked so a
 *  multi-MB upload doesn't blow the argument limit of String.fromCharCode. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return globalThis.btoa(binary)
}

// ── Fetch wrappers ──────────────────────────────────────────────

export async function submitJob(
  cfg: RunpodConfig,
  endpointId: string,
  input: RunpodJobInput,
): Promise<RunpodRunResponse> {
  const resp = await fetch(runpodEndpointUrl(cfg, endpointId, '/run'), {
    method: 'POST',
    headers: runpodHeaders(cfg),
    body: JSON.stringify({ input }),
  })
  if (!resp.ok) {
    throw new Error(`RunPod submit failed: ${resp.status} ${resp.statusText}`)
  }
  return (await resp.json()) as RunpodRunResponse
}

export async function fetchJobStatus(
  cfg: RunpodConfig,
  endpointId: string,
  jobId: string,
): Promise<RunpodStatus> {
  const resp = await fetch(
    runpodEndpointUrl(cfg, endpointId, `/status/${encodeURIComponent(jobId)}`),
    { headers: runpodHeaders(cfg) },
  )
  if (!resp.ok) {
    throw new Error(`RunPod status failed: ${resp.status} ${resp.statusText}`)
  }
  return (await resp.json()) as RunpodStatus
}

export async function cancelJob(
  cfg: RunpodConfig,
  endpointId: string,
  jobId: string,
): Promise<void> {
  await fetch(
    runpodEndpointUrl(cfg, endpointId, `/cancel/${encodeURIComponent(jobId)}`),
    {
      method: 'POST',
      headers: runpodHeaders(cfg),
    },
  )
}
