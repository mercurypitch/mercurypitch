import { ContainerProxy } from '@cloudflare/containers'
import type { KVNamespace } from '@cloudflare/workers-types'
import type { RunpodConfig } from './lib/runpod'
import { base64ToBytes, buildJobInput, bytesToBase64, cancelJob, contentTypeForFilename, fetchJobStatus, findStemOutput, getRunpodConfig, isRunpodSessionId, mapStatusToResponse, parseJobId, submitJob, toSessionId, wantsRunpod, } from './lib/runpod'
import { verifyBearer } from './lib/verify-jwt'
import { handleShareRequest } from './share-handler'

export { ContainerProxy }
export { UvrContainer } from './uvr-container'

// Cloudflare Worker entry point for MercuryPitch
// Proxies /api/uvr/* to the UVR Docker container.
// Optionally dispatches /api/uvr/* to a RunPod serverless GPU endpoint when
//   RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID are set and the request opts in
//   (off by default — the container path is unchanged until configured).
// Handles /api/share/* for share link shortening (KV-backed).
// Static assets are served by Cloudflare's assets feature.

export interface Env {
  UVR_SERVICE: { getByName(name: string): unknown }
  ASSETS: { fetch(req: Request): Promise<Response> }
  SHARE_STORE: KVNamespace
  /** HMAC secret for verifying app JWTs (same value the db-worker signs with).
   *  `wrangler secret put JWT_SECRET` per env. When unset, the UVR write gate
   *  rejects all non-GET /api/uvr/* requests. */
  JWT_SECRET?: string
  /** RunPod serverless API key — `wrangler secret put RUNPOD_API_KEY`. */
  RUNPOD_API_KEY?: string
  /** RunPod serverless endpoint id — `wrangler secret put RUNPOD_ENDPOINT_ID`. */
  RUNPOD_ENDPOINT_ID?: string
  /** Optional RunPod API base override (defaults to https://api.runpod.ai/v2). */
  RUNPOD_BASE_URL?: string
}

// base64 inflates ~33%; RunPod's /run input cap is ~10 MB, so only inline
// audio up to this raw size. Larger uploads must pass an `audio_url`
// (object storage) instead — see runpod/README.md.
const RUNPOD_MAX_INLINE_BYTES = 7 * 1024 * 1024

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const method = request.method

    console.log(`[worker] ${method} ${url.pathname}`)

    // Proxy UVR API requests to the UVR backend (RunPod GPU or CPU container)
    if (url.pathname.startsWith('/api/uvr/')) {
      // Gate state-changing / expensive operations (process, delete-session)
      // behind a valid app JWT; reads (models/status/output) stay open so
      // <audio> playback and status polling keep working without auth headers.
      // Signature + expiry only (no DB lookup) — enough to stop anonymous
      // compute abuse and arbitrary session deletion.
      if (method !== 'GET' && method !== 'OPTIONS') {
        const auth = await verifyBearer(request, env.JWT_SECRET)
        if (!auth) {
          return json({ error: 'Unauthorized' }, 401)
        }
      }

      // When RunPod is configured, dispatch eligible requests to it (opted-in
      // /process, or any rp_-prefixed session id). Anything else returns null
      // and falls through to the container — default behavior is unchanged.
      const runpod = getRunpodConfig(env)
      if (runpod) {
        try {
          const handled = await handleRunpod(request, url, method, runpod)
          if (handled !== null) return handled
        } catch (err) {
          console.error('[worker] runpod error:', err)
          return json(
            {
              error: 'RunPod dispatch failed',
              detail: err instanceof Error ? err.message : String(err),
            },
            502,
          )
        }
      }

      const stripped = url.pathname.replace(/^\/api\/uvr/, '')
      console.log(`[worker] proxying /api/uvr${stripped} → container`)

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const container = env.UVR_SERVICE.getByName('uvr-instance') as any
        await container.start()
        const containerUrl = new URL(request.url)
        containerUrl.pathname = stripped
        const proxied = new Request(containerUrl.toString(), request)
        const resp = await container.fetch(proxied)
        console.log(`[worker] container responded: ${resp.status}`)
        return resp
      } catch (err) {
        console.error(`[worker] container fetch error:`, err)
        return json(
          {
            error: 'Container unreachable',
            detail: err instanceof Error ? err.message : String(err),
          },
          502,
        )
      }
    }

    // Share link shortener — /api/share/*  →  KV-backed
    if (url.pathname.startsWith('/api/share/')) {
      const shareResp = await handleShareRequest(request, env)
      if (shareResp) return shareResp
    }

    // All other requests (static assets, SPA routes) are served by the assets
    // binding. Security headers (CSP-Report-Only, X-Content-Type-Options,
    // Referrer-Policy, HSTS) are applied to asset/document responses via
    // public/_headers — the Cloudflare assets runtime serves these directly and
    // bypasses the Worker, so headers set here would not reach the browser.
    return env.ASSETS.fetch(request)
  },
}

/**
 * Bridge the app's /api/uvr/* contract to RunPod's serverless job API.
 * Returns a Response when it owns the request, or null to fall through to
 * the container path. Stateless: the RunPod job id is carried in the
 * session id (`rp_<jobId>`), so no session store is needed.
 */
async function handleRunpod(
  request: Request,
  url: URL,
  method: string,
  cfg: RunpodConfig,
): Promise<Response | null> {
  const stripped = url.pathname.replace(/^\/api\/uvr/, '')
  const match = stripped.match(
    /^\/(process|status|output|session)(?:\/([^/]+))?(?:\/(.*))?$/,
  )
  if (!match) return null
  const route = match[1]
  const sessionId = match[2]
  const rest = match[3]

  // POST /process — only when the caller explicitly opts into RunPod.
  if (route === 'process' && method === 'POST') {
    if (!wantsRunpod(request, url)) return null
    return startRunpodJob(request, cfg)
  }

  // Follow-up calls route to RunPod purely by the rp_ session id, so
  // container-origin (UUID) sessions are never intercepted here.
  if (sessionId === undefined || !isRunpodSessionId(sessionId)) return null
  const jobId = parseJobId(sessionId)
  if (jobId === null) return null

  if (route === 'status' && method === 'GET') {
    const status = await fetchJobStatus(cfg, jobId)
    return json(mapStatusToResponse(sessionId, status))
  }

  if (route === 'output' && method === 'GET') {
    return serveRunpodOutput(cfg, sessionId, jobId, rest)
  }

  if (route === 'session' && method === 'DELETE') {
    await cancelJob(cfg, jobId)
    return json({
      status: 'success',
      message: `Session ${sessionId} cancelled`,
    })
  }

  return null
}

/** Submit the uploaded audio to RunPod and return a process response. */
async function startRunpodJob(
  request: Request,
  cfg: RunpodConfig,
): Promise<Response> {
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return json({ error: 'No file provided' }, 400)
  }

  const model = asString(form.get('model'))
  const outputFormat = asString(form.get('output_format'))
  const audioUrl = asString(form.get('audio_url'))
  const stems = parseStems(form.get('stems'))

  let audioBase64: string | undefined
  if (audioUrl === undefined) {
    if (file.size > RUNPOD_MAX_INLINE_BYTES) {
      return json(
        {
          error:
            'File too large for inline RunPod upload; provide an audio_url ' +
            '(object storage) instead.',
        },
        413,
      )
    }
    audioBase64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()))
  }

  const input = buildJobInput({
    filename: file.name,
    model,
    output_format: outputFormat,
    stems,
    audioUrl,
    audioBase64,
  })

  const res = await submitJob(cfg, input)
  if (res.id === undefined || res.id === '') {
    return json({ error: res.error ?? 'RunPod did not return a job id' }, 502)
  }

  return json({
    session_id: toSessionId(res.id),
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
  sessionId: string,
  jobId: string,
  rest: string | undefined,
): Promise<Response> {
  const status = await fetchJobStatus(cfg, jobId)
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
    const blob = new Blob([body], {
      type: contentTypeForFilename(stem.filename),
    })
    return new Response(blob)
  }
  return json({ error: 'Stem has no payload' }, 404)
}

/** The client double-prefixes the output path (it stores the full
 *  /api/uvr/output/... path and re-requests it). Strip any such prefix so
 *  we recover the bare stem key the worker emitted. */
function decodeStemKey(rest: string | undefined, sessionId: string): string {
  const raw = decodeURIComponent(rest ?? '')
  const marker = `/api/uvr/output/${sessionId}/`
  const idx = raw.indexOf(marker)
  return idx >= 0 ? raw.slice(idx + marker.length) : raw
}

function asString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function parseStems(value: FormDataEntryValue | null): string[] | undefined {
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
