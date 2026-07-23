import { ContainerProxy } from '@cloudflare/containers'
import type { KVNamespace, R2Bucket } from '@cloudflare/workers-types'
import { getRunpodConfig, requestedRunpodTier } from './lib/runpod'
import type { UvrInputBucket } from './lib/runpod-bridge'
import { handleRunpodRequest, rejectUnconfiguredRunpod, } from './lib/runpod-bridge'
import { getMeteringConfig } from './lib/uvr-metering'
import { verifyBearer } from './lib/verify-jwt'
import { handleShareRequest } from './share-handler'

export { ContainerProxy }
export { UvrContainer } from './uvr-container'

// Cloudflare Worker entry point for MercuryPitch
// Routes new paid processing to RunPod and keeps legacy container sessions
// readable. A process request must explicitly select RunPod so it cannot fall
// through to unmetered compute.
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
  /** GPU-tier endpoint id (fast, the paid anchor; the default tier). */
  RUNPOD_ENDPOINT_ID_GPU?: string
  /** Legacy alias for the GPU endpoint id. */
  RUNPOD_ENDPOINT_ID?: string
  /** CPU-tier endpoint id (cheaper, slower; opt-in via `runpod-cpu`). */
  RUNPOD_ENDPOINT_ID_CPU?: string
  /** Optional RunPod API base override (defaults to https://api.runpod.ai/v2). */
  RUNPOD_BASE_URL?: string
  /** db-worker base URL — required for RunPod admission, rate limits, and
   *  credit metering (debit on accept, refund on failure). Per-env var in
   *  wrangler.jsonc; new paid jobs fail closed while it is unset. */
  DB_API_URL?: string
  /** Shared secret for service-to-service billing refunds; the SAME value
   *  is set on the db-worker. `wrangler secret put BILLING_SERVICE_KEY`.
   *  Refunds are skipped while unset. */
  BILLING_SERVICE_KEY?: string
  /** R2 bucket for staging server-separation inputs too big to inline
   *  (>7 MB). Same bucket the handler reads via S3 creds. Per-env binding in
   *  wrangler.jsonc; when absent the large-file path is unavailable. */
  UVR_INPUT_BUCKET?: R2Bucket
}

// Paths that serve the Voice Mirror entry (mirror.html): the canonical path
// plus the SEO alias landings. Keep in sync with the dev-server rewrite in
// vite.config.ts.
const MIRROR_PATHS = new Set([
  '/mirror',
  '/vocal-range-test',
  '/tone-deaf-test',
])

// Paths that serve the Karaoke Night entry (karaoke.html). Keep in sync with
// vite.config.ts (dev rewrite) and mirrorAliasFilesPlugin (real alias files —
// Cloudflare's SPA fallback answers browser navigations before this worker,
// so the emitted karaoke-night.html is what actually serves ad clicks).
const KARAOKE_PATHS = new Set(['/karaoke-night', '/karaoke'])

// Paths that serve the Glass entry (glass.html). UNLIKE mirror/karaoke these
// are NOT emitted as alias files: wrangler's `assets.run_worker_first` lists
// the aliases, so browser navigations reach this worker first and the rewrite
// below actually serves them. /glass itself is absent from run_worker_first —
// Cloudflare's html_handling maps it to glass.html at the asset layer. Keep in
// sync with vite.config.ts (GLASS_PATHS) and wrangler.jsonc.
const GLASS_PATHS = new Set([
  '/glass',
  '/break-glass-with-your-voice',
  '/high-note-test',
  '/shatter',
])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function serveStaticAsset(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request)
  const { pathname } = new URL(request.url)
  const contentType = response.headers.get('Content-Type') ?? ''

  // In SPA mode the asset binding returns index.html for unknown paths. That
  // is correct for navigations, but a stale hashed chunk must be a real 404:
  // serving HTML with status 200 makes browsers report an opaque JavaScript
  // MIME error and can cache the shell under the chunk URL.
  if (
    pathname.startsWith('/assets/') &&
    contentType.toLowerCase().includes('text/html')
  ) {
    return new Response(request.method === 'HEAD' ? null : 'Asset not found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  return response
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

      // New processing is RunPod-only and must always pass the paid admission
      // gate below. A missing/unknown provider used to fall through to the
      // unmetered container, letting any app JWT bypass credits and rate limits.
      const isProcessRequest =
        method === 'POST' && url.pathname === '/api/uvr/process'
      const requestedTier = isProcessRequest
        ? requestedRunpodTier(request, url)
        : null
      if (isProcessRequest && requestedTier === null) {
        return json(
          {
            error:
              'Choose Server mode for cloud processing or Browser mode for on-device processing.',
          },
          400,
        )
      }

      // When RunPod is configured, dispatch eligible requests to it (opted-in
      // /process, or any rp_-prefixed session id). Legacy container session
      // reads still fall through below.
      const runpod = getRunpodConfig(env)
      if (runpod) {
        const meter = getMeteringConfig(env)
        // A configured GPU without its billing/admission service is an unsafe
        // state: accepting jobs would bypass both credits and rate limits.
        // Refuse new RunPod work, while keeping status/output reads available
        // so already-paid jobs remain recoverable.
        if (isProcessRequest && requestedTier !== null && meter === null) {
          return json(
            {
              error:
                'Server processing protection is unavailable. Use Browser mode instead.',
            },
            503,
          )
        }
        try {
          const handled = await handleRunpodRequest(
            request,
            url,
            method,
            runpod,
            meter,
            // R2Bucket's overloaded put() doesn't structurally match the
            // bridge's minimal interface; the runtime shape is compatible.
            (env.UVR_INPUT_BUCKET ?? null) as UvrInputBucket | null,
          )
          if (handled !== null) return handled
          // A valid process request can still be unhandled when the selected
          // tier has no endpoint. Never let that configuration gap fall
          // through to the legacy, unmetered container.
          if (isProcessRequest) {
            return json(
              {
                error:
                  'The selected server processing tier is not available right now. Use Browser mode instead.',
              },
              503,
            )
          }
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
      } else {
        // Server mode is GPU-only: a RunPod-opted request must never fall
        // through to the CPU container (slower, unmetered — free paid-looking
        // jobs). Without RunPod configured it gets a clear 503 instead.
        const rejected = rejectUnconfiguredRunpod(request, url, method)
        if (rejected !== null) return rejected
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

    // Unmatched /api/* must 404 as JSON, not fall through to the SPA shell
    // below — with not_found_handling=single-page-application the asset binding
    // returns index.html for any unknown path, which would be wrong for an API.
    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404)
    }

    // Voice Mirror — the standalone entry (mirror.html) is served for its
    // path on the main domain, the SEO alias landings, and the root of the
    // mirror.* subdomain. Hashed /assets/* requests fall through untouched.
    const isMirrorPath =
      MIRROR_PATHS.has(url.pathname) ||
      (url.hostname.startsWith('mirror.') && url.pathname === '/')
    if (isMirrorPath && method === 'GET') {
      const mirrorUrl = new URL(request.url)
      mirrorUrl.pathname = '/mirror.html'
      return env.ASSETS.fetch(new Request(mirrorUrl.toString(), request))
    }

    // Karaoke Night — same standalone-entry treatment as the mirror.
    if (KARAOKE_PATHS.has(url.pathname) && method === 'GET') {
      const karaokeUrl = new URL(request.url)
      karaokeUrl.pathname = '/karaoke.html'
      return env.ASSETS.fetch(new Request(karaokeUrl.toString(), request))
    }

    // Glass — alias paths serve glass.html content with the URL preserved
    // (canonical <link> in glass.html points at /glass, so search engines
    // consolidate). These fire for real navigations because the aliases are
    // in assets.run_worker_first (wrangler.jsonc) — no byte-copied HTML.
    if (GLASS_PATHS.has(url.pathname) && method === 'GET') {
      const glassUrl = new URL(request.url)
      glassUrl.pathname = '/glass.html'
      return env.ASSETS.fetch(new Request(glassUrl.toString(), request))
    }

    // All other requests (static assets, SPA routes) are served by the assets
    // binding. Security headers (CSP-Report-Only, X-Content-Type-Options,
    // Referrer-Policy, HSTS) are applied to asset/document responses via
    // public/_headers — the Cloudflare assets runtime serves these directly and
    // bypasses the Worker, so headers set here would not reach the browser.
    return serveStaticAsset(request, env)
  },
}
