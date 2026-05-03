// Cloudflare Worker entry point for PitchPerfect
// Serves the built static files from App/dist/

export default {
  async fetch(request) {
    const url = new URL(request.url)

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
