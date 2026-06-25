// ── Jam Signaling Worker ─────────────────────────────────────────────
// WebSocket upgrade router → Durable Object signaling relay.
//
// Endpoints:
//   WS  /api/jam/rooms/new          — Create a new jam room
//   WS  /api/jam/rooms/:id/signal   — Join existing room for signaling
//   POST /api/jam/rooms             — REST: create room (non-WS)
//   GET  /api/jam/rooms/:id         — REST: room info

import type { JamRoom } from './jam-room'
export { JamRoom } from './jam-room'

interface Env {
  JAM_ROOM: DurableObjectNamespace<JamRoom>
  /**
   * Optional comma-separated Origin allowlist for WebSocket upgrades and room
   * creation (e.g. "https://mercurypitch.com"). When unset, all origins are
   * allowed — this preserves the current behaviour for local dev. Set it per
   * environment in wrangler.jsonc to reject cross-site connections.
   */
  ALLOWED_ORIGINS?: string
}

/**
 * Gate WebSocket upgrades / room creation by Origin. Permissive by default
 * (no allowlist configured) so local development is unaffected; once
 * ALLOWED_ORIGINS is set, only those exact origins may connect.
 */
function isOriginAllowed(request: Request, env: Env): boolean {
  const allow = env.ALLOWED_ORIGINS?.trim()
  if (!allow) return true
  const origin = request.headers.get('Origin')
  if (!origin) return false
  return allow.split(',').some((o) => o.trim() === origin)
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

function respond(body: object | null, init?: ResponseInit): Response {
  const headers = { ...CORS, ...(init?.headers as Record<string, string>) }
  const status = init?.status ?? 200
  if (body === null) return new Response(null, { ...init, headers, status })
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...headers },
    status,
  })
}

/**
 * Generate a room id. Cryptographically random (not Math.random) over an
 * unambiguous alphabet — 32^8 ≈ 1.1e12 space, so room ids can't be enumerated.
 */
function newRoomId(): string {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let id = ''
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length]
  return id
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    // Gate the security-relevant endpoints (WebSocket signaling upgrades and
    // room creation) by Origin. These always carry an Origin header from a
    // browser; the read-only GET room-info path is left ungated because a
    // same-origin GET may legitimately omit Origin.
    const isWsUpgrade = request.headers.get('Upgrade') === 'websocket'
    if ((isWsUpgrade || request.method === 'POST') && !isOriginAllowed(request, env)) {
      return respond({ error: 'Origin not allowed' }, { status: 403 })
    }

    const url = new URL(request.url)

    // ── WS: Create room ───────────────────────────────────────────
    if (url.pathname === '/api/jam/rooms/new') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return respond({ error: 'WebSocket upgrade required' }, { status: 426 })
      }
      const roomId = newRoomId()
      const doId = env.JAM_ROOM.idFromName(roomId)
      const stub = env.JAM_ROOM.get(doId)

      const headers = new Headers(request.headers)
      headers.set('X-Jam-Room-Id', roomId)
      return stub.fetch(new Request(request, { headers }))
    }

    // ── WS: Join room ─────────────────────────────────────────────
    const sigMatch = url.pathname.match(/^\/api\/jam\/rooms\/(.+)\/signal$/)
    if (sigMatch) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return respond({ error: 'WebSocket upgrade required' }, { status: 426 })
      }
      const roomId = sigMatch[1]
      const doId = env.JAM_ROOM.idFromName(roomId)
      const stub = env.JAM_ROOM.get(doId)

      const headers = new Headers(request.headers)
      headers.set('X-Jam-Room-Id', roomId)
      return stub.fetch(new Request(request, { headers }))
    }

    // ── REST: Create room ─────────────────────────────────────────
    if (url.pathname === '/api/jam/rooms' && request.method === 'POST') {
      const roomId = newRoomId()
      env.JAM_ROOM.idFromName(roomId) // initialize DO
      return respond({ roomId })
    }

    // ── REST: Room info ───────────────────────────────────────────
    const infoMatch = url.pathname.match(/^\/api\/jam\/rooms\/(.+)$/)
    if (infoMatch && request.method === 'GET') {
      return respond({ roomId: infoMatch[1], exists: true })
    }

    return respond({ error: 'Not found' }, { status: 404 })
  },
}
