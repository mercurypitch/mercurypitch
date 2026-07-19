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
 * Max upload size for SERVER (cloud GPU) processing. Files up to 7 MB are
 * inlined as base64 in the RunPod job; larger ones (up to this cap) are
 * streamed via R2 (`audio_s3_key`) by the worker. Mirror of the worker's
 * RUNPOD_MAX_UPLOAD_BYTES — keep the two in sync. Local (on-device)
 * processing has no transport limit and keeps the 100 MB default.
 */
export const SERVER_MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/** Local/on-device processing upload cap (in-browser model; no transport). */
export const LOCAL_MAX_UPLOAD_BYTES = 100 * 1024 * 1024

/**
 * Processing request parameters
 */
export interface ProcessRequest {
  model?: string
  output_format?: string
  stems?: string[]
  cpu_profile?: 'high' | 'mid' | 'low'
  /** Server-tier opt-in (X-UVR-Provider): 'runpod' = GPU (default server
   *  tier), 'runpod-cpu' = cheaper tier. When RunPod isn't configured on the
   *  worker, the request falls through to the container path unchanged. */
  provider?: 'runpod' | 'runpod-cpu'
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
export const UVR_MODELS = [
  {
    name: 'roformer',
    display: 'Studio (BS-RoFormer)',
    quality: 'Highest',
    speed: 'Medium',
    description: 'Cleanest vocals and instrumental — the default.',
  },
  {
    name: 'mdx',
    display: 'Fast (MDX-Net)',
    quality: 'Good',
    speed: 'Fast',
    description: 'The previous default; quicker, slightly more bleed.',
  },
  {
    name: 'karaoke',
    display: 'Karaoke (keep backing vocals)',
    quality: 'High',
    speed: 'Medium',
    description: 'Removes only the lead vocal; harmonies stay in the mix.',
  },
  {
    name: 'ensemble',
    display: 'Ensemble (two models)',
    quality: 'Maximum',
    speed: 'Slow',
    description: 'Blends two top models per stem; roughly twice the time.',
  },
]

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
  file: File,
  options: ProcessRequest = DEFAULT_PROCESS_REQUEST,
): Promise<ProcessResponse> {
  const formData = new FormData()
  formData.append('file', file)

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

  const headers: Record<string, string> = { ...authHeaders() }
  if (options.provider !== undefined) {
    headers['X-UVR-Provider'] = options.provider
  }

  const response = await fetch(`${API_BASE}/process`, {
    method: 'POST',
    headers,
    body: formData,
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
    throw new Error(
      message ||
        `The processing server could not be reached (HTTP ${response.status}). Please try again in a moment.`,
    )
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

        // Use server progress if available
        if (status.progress != null) {
          onProgress(status.progress, estimateExceeded, phase)
        } else {
          // Fallback: caller's duration-based estimate, else the server's
          // estimated_total_secs, else a flat default.
          const totalSecs = estimatedSecs ?? status.estimated_total_secs ?? 120
          const estimatedMs = Math.max(totalSecs * 1000, 10000)
          const pct = (elapsed / estimatedMs) * 100

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
