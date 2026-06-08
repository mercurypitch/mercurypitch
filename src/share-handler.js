// Share Link Shortener — handles /api/share/shorten and /api/share/s/:id
// Stores base64-encoded share payloads in KV with 60-day TTL.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

function respond(body, init) {
  const headers = { ...CORS, ...(init?.headers ?? {}) }
  const status = init?.status ?? 200
  if (body === null) return new Response(null, { ...init, headers, status })
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...headers },
    status,
  })
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const ID_LENGTH = 10
const SIXTY_DAYS = 60 * 24 * 60 * 60

function generateShortId() {
  const bytes = new Uint8Array(ID_LENGTH)
  crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < ID_LENGTH; i++) {
    id += BASE62[bytes[i] % 62]
  }
  return id
}

/**
 * Handle /api/share/* requests.
 * @param {Request} request
 * @param {{ SHARE_STORE: KVNamespace }} env
 * @returns {Promise<Response | null>} Response if handled, null otherwise.
 */
export async function handleShareRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  const url = new URL(request.url)

  // POST /api/share/shorten
  if (url.pathname === '/api/share/shorten' && request.method === 'POST') {
    try {
      const body = await request.json()
      if (
        !body ||
        typeof body.payload !== 'string' ||
        body.payload.length === 0
      ) {
        return respond({ error: 'Missing payload' }, { status: 400 })
      }

      let id = generateShortId()
      while ((await env.SHARE_STORE.get(id)) !== null) {
        id = generateShortId()
      }

      await env.SHARE_STORE.put(id, body.payload, {
        expirationTtl: SIXTY_DAYS,
      })

      return respond({ id })
    } catch {
      return respond({ error: 'Invalid JSON body' }, { status: 400 })
    }
  }

  // GET /api/share/s/:id
  const getMatch = url.pathname.match(/^\/api\/share\/s\/([a-zA-Z0-9]+)$/)
  if (getMatch && request.method === 'GET') {
    const payload = await env.SHARE_STORE.get(getMatch[1])
    if (payload === null) {
      return respond({ error: 'Not found' }, { status: 404 })
    }
    return respond({ payload })
  }

  return null
}
