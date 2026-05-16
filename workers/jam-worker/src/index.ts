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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const url = new URL(request.url)

    // ── WS: Create room ───────────────────────────────────────────
    if (url.pathname === '/api/jam/rooms/new') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return respond({ error: 'WebSocket upgrade required' }, { status: 426 })
      }
      const roomId = Math.random().toString(36).substring(2, 6).toUpperCase()
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
      const roomId = Math.random().toString(36).substring(2, 6).toUpperCase()
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
