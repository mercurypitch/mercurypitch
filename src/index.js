import { ContainerProxy } from '@cloudflare/containers'
export { ContainerProxy }
export { UvrContainer } from './uvr-container.js'

// Cloudflare Worker entry point for MercuryPitch
// Proxies /api/uvr/* to the UVR Docker container.
// Static assets are served by Cloudflare's assets feature.

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const method = request.method

    console.log(`[worker] ${method} ${url.pathname}`)

    // Proxy UVR API requests to the Docker container
    if (url.pathname.startsWith('/api/uvr/')) {
      const stripped = url.pathname.replace(/^\/api\/uvr/, '')
      console.log(`[worker] proxying /api/uvr${stripped} → container`)

      try {
        const container = env.UVR_SERVICE.getByName('uvr-instance')
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

    // All other requests (static assets, SPA routes) are served by the assets binding.
    return env.ASSETS.fetch(request)
  },
}
