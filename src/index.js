// Cloudflare Worker entry point for PitchPerfect
// Proxies /api/uvr/* to the UVR Docker container.
// Static assets are served by Cloudflare's assets feature.

export { UvrContainer } from './uvr-container.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Proxy UVR API requests to the Docker container
    if (url.pathname.startsWith('/api/uvr/')) {
      const id = env.UVR_SERVICE.idFromName('uvr-instance')
      const container = env.UVR_SERVICE.get(id)
      // Strip /api/uvr prefix — container routes expect /process, /status, etc.
      const containerUrl = new URL(request.url)
      containerUrl.pathname = url.pathname.replace(/^\/api\/uvr/, '')
      const proxied = new Request(containerUrl.toString(), request)
      return container.fetch(proxied)
    }

    // All other requests (static assets, SPA routes) are served by the assets binding.
    return env.ASSETS.fetch(request)
  },
}
