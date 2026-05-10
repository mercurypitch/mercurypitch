// Cloudflare Worker entry point for PitchPerfect
// Serves static files and proxies /api/uvr/* to the UVR container

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Proxy UVR API requests to the Docker container
    if (url.pathname.startsWith('/api/uvr/')) {
      const id = env.UVR_SERVICE.idFromName('uvr-instance')
      const container = env.UVR_SERVICE.get(id)
      // Strip /api/uvr prefix — container routes expect /process, /status, etc.
      const containerUrl = new URL(request.url)
      containerUrl.pathname = url.pathname.replace('/api/uvr', '')
      const proxied = new Request(containerUrl.toString(), request)
      return await container.fetch(proxied)
    }

    // Serve index.html (the built SPA)
    if (url.pathname === '/') {
      return new Response(await Deno.readTextFile('./dist/index.html'), {
        headers: {
          'content-type': 'text/html',
          'cache-control': 'public, max-age=86400',
        },
      })
    }

    // Serve static assets
    const assetPath = './dist' + url.pathname
    try {
      const content = await Deno.readTextFile(assetPath)
      const ext = url.pathname.split('.').pop() || ''
      const contentTypes = {
        js: 'application/javascript',
        css: 'text/css',
        png: 'image/png',
        jpg: 'image/jpeg',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
      }
      return new Response(content, {
        headers: {
          'content-type': contentTypes[ext] || 'text/plain',
          'cache-control': 'public, max-age=31536000',
        },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  },
}
