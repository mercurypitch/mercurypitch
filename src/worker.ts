import { ContainerProxy } from '@cloudflare/containers'
import type { KVNamespace } from '@cloudflare/workers-types'
import { verifyBearer } from './lib/verify-jwt'
import { handleShareRequest } from './share-handler'

export { ContainerProxy }
export { UvrContainer } from './uvr-container'

// Cloudflare Worker entry point for MercuryPitch
// Proxies /api/uvr/* to the UVR Docker container.
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
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const method = request.method

    console.log(`[worker] ${method} ${url.pathname}`)

    // Proxy UVR API requests to the Docker container
    if (url.pathname.startsWith('/api/uvr/')) {
      // Gate state-changing / expensive operations (process, delete-session)
      // behind a valid app JWT; reads (models/status/output) stay open so
      // <audio> playback and status polling keep working without auth headers.
      // Signature + expiry only (no DB lookup) — enough to stop anonymous
      // compute abuse and arbitrary session deletion.
      if (method !== 'GET' && method !== 'OPTIONS') {
        const auth = await verifyBearer(request, env.JWT_SECRET)
        if (!auth) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
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
        return new Response(
          JSON.stringify({
            error: 'Container unreachable',
            detail: err instanceof Error ? err.message : String(err),
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } },
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
