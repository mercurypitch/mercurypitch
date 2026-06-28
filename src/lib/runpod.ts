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
// It is deliberately STATELESS: the RunPod job id is encoded into the
// session id we hand back (`rp_<jobId>`), so /status, /output and /session
// calls route straight back to RunPod with no server-side session store.
//
// Everything here is pure data-mapping plus thin fetch wrappers, so the
// translation logic is unit-tested without a live endpoint (see
// src/tests/runpod.test.ts).

/** Prefix marking a session id as RunPod-backed. The remainder is the
 *  RunPod job id. */
export const RUNPOD_SESSION_PREFIX = 'rp_'

export const RUNPOD_DEFAULT_MODEL = 'UVR-MDX-NET-Inst_HQ_3'

const DEFAULT_BASE_URL = 'https://api.runpod.ai/v2'

// While a job is queued/running RunPod gives no progress %, so we report an
// estimate and let the client's time-based fallback animate the bar.
const RUNPOD_ESTIMATED_SECS = 180

const RUNPOD_TERMINAL_ERROR = new Set(['FAILED', 'CANCELLED', 'TIMED_OUT'])

// ── Config ──────────────────────────────────────────────────────

export interface RunpodConfig {
  apiKey: string
  endpointId: string
  /** Override for tests / self-hosting; defaults to RunPod's v2 API. */
  baseUrl: string
}

/** The subset of worker env this module reads. */
export interface RunpodEnvLike {
  RUNPOD_API_KEY?: string
  RUNPOD_ENDPOINT_ID?: string
  RUNPOD_BASE_URL?: string
}

/** Resolve RunPod config from env, or null when not fully configured.
 *  Null means "RunPod is off" — the worker then uses the container path. */
export function getRunpodConfig(env: RunpodEnvLike): RunpodConfig | null {
  const apiKey = env.RUNPOD_API_KEY
  const endpointId = env.RUNPOD_ENDPOINT_ID
  if (
    apiKey === undefined ||
    apiKey === '' ||
    endpointId === undefined ||
    endpointId === ''
  ) {
    return null
  }
  const baseUrl = (env.RUNPOD_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  return { apiKey, endpointId, baseUrl }
}

// ── Session id <-> job id ───────────────────────────────────────

export function isRunpodSessionId(sessionId: string): boolean {
  return sessionId.startsWith(RUNPOD_SESSION_PREFIX)
}

export function toSessionId(jobId: string): string {
  return `${RUNPOD_SESSION_PREFIX}${jobId}`
}

/** Recover the RunPod job id from a session id, or null if it isn't ours. */
export function parseJobId(sessionId: string): string | null {
  if (!sessionId.startsWith(RUNPOD_SESSION_PREFIX)) return null
  const id = sessionId.slice(RUNPOD_SESSION_PREFIX.length)
  return id === '' ? null : id
}

/** True when a request explicitly opts into the RunPod path (header or
 *  query). Process requests must opt in; follow-up calls route by the
 *  `rp_` session id instead. */
export function wantsRunpod(request: Request, url: URL): boolean {
  return (
    request.headers.get('x-uvr-provider')?.toLowerCase() === 'runpod' ||
    url.searchParams.get('provider') === 'runpod'
  )
}

// ── URLs / headers ──────────────────────────────────────────────

export function runpodEndpointUrl(cfg: RunpodConfig, path: string): string {
  return `${cfg.baseUrl}/${cfg.endpointId}${path}`
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
}

export interface BuildJobInputParams {
  filename?: string
  model?: string
  output_format?: string
  stems?: string[]
  audioBase64?: string
  audioUrl?: string
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
  if (p.audioUrl !== undefined && p.audioUrl !== '') {
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
  input: RunpodJobInput,
): Promise<RunpodRunResponse> {
  const resp = await fetch(runpodEndpointUrl(cfg, '/run'), {
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
  jobId: string,
): Promise<RunpodStatus> {
  const resp = await fetch(
    runpodEndpointUrl(cfg, `/status/${encodeURIComponent(jobId)}`),
    { headers: runpodHeaders(cfg) },
  )
  if (!resp.ok) {
    throw new Error(`RunPod status failed: ${resp.status} ${resp.statusText}`)
  }
  return (await resp.json()) as RunpodStatus
}

export async function cancelJob(
  cfg: RunpodConfig,
  jobId: string,
): Promise<void> {
  await fetch(runpodEndpointUrl(cfg, `/cancel/${encodeURIComponent(jobId)}`), {
    method: 'POST',
    headers: runpodHeaders(cfg),
  })
}
