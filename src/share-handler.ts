// Share Link Shortener — handles /api/share/shorten and /api/share/s/:id
// Stores base64-encoded share payloads in KV with 60-day TTL.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

import type { Env } from './worker'

function respond(body: unknown, init?: ResponseInit): Response {
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
const MAX_PAYLOAD_BYTES = 64 * 1024 // 64 KB is ample for a share blob
const SHORTEN_RATE_MAX = 20 // max shorten calls per IP per window
const SHORTEN_RATE_WINDOW_S = 60 // window length (KV minimum TTL is 60s)

function generateShortId(): string {
  const bytes = new Uint8Array(ID_LENGTH)
  // eslint-disable-next-line no-restricted-globals
  crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < ID_LENGTH; i++) {
    id += BASE62[bytes[i] % 62]
  }
  return id
}

/**
 * Best-effort per-IP rate limit for share creation, backed by KV. KV is
 * eventually consistent so this is a soft cap (enough to stop unbounded
 * unauthenticated writes, not a hard security control). Returns false when the
 * caller is over budget.
 */
async function withinShortenRate(env: Env, ip: string): Promise<boolean> {
  const key = `rl:shorten:${ip}`
  const current = Number((await env.SHARE_STORE.get(key)) ?? '0')
  if (current >= SHORTEN_RATE_MAX) return false
  await env.SHARE_STORE.put(key, String(current + 1), {
    expirationTtl: SHORTEN_RATE_WINDOW_S,
  })
  return true
}

/**
 * Handle /api/share/* requests.
 */
export async function handleShareRequest(
  request: Request,
  env: Env,
): Promise<Response | null> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  const url = new URL(request.url)

  // POST /api/share/shorten
  if (url.pathname === '/api/share/shorten' && request.method === 'POST') {
    try {
      const body = (await request.json()) as Record<string, unknown>
      if (
        body == null ||
        typeof body.payload !== 'string' ||
        body.payload.length === 0
      ) {
        return respond({ error: 'Missing payload' }, { status: 400 })
      }
      if (new TextEncoder().encode(body.payload).length > MAX_PAYLOAD_BYTES) {
        return respond({ error: 'Payload too large' }, { status: 413 })
      }

      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
      if (!(await withinShortenRate(env, ip))) {
        return respond({ error: 'Too many requests' }, { status: 429 })
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
