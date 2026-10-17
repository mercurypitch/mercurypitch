// ============================================================
// Jam worker — the /api/jam/ice gate
// ============================================================
//
// TURN credentials are minted only for a room whose Durable Object reports
// a live peer, and only to a first-party caller. These drive the worker's
// own fetch with a fake room namespace and a stubbed Cloudflare mint, so
// the gate is exercised exactly as a browser would reach it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// index.ts re-exports the RPC entrypoint, which extends WorkerEntrypoint —
// absent from the test shim for cloudflare:workers — so it is stubbed here.
vi.mock('./host-verification', () => ({ JamHostVerifier: class {} }))

import worker from './index'

const MINT_URL =
  'https://rtc.live.cloudflare.com/v1/turn/keys/k/credentials/generate-ice-servers'
const MINTED = [
  { urls: ['stun:x'] },
  { urls: ['turn:y'], username: 'u', credential: 'c' },
]

class FakeRoomStub {
  body: unknown = { active: true, peers: 2 }
  async fetch(): Promise<Response> {
    return new Response(JSON.stringify(this.body), { status: 200 })
  }
}

class FakeRoomNamespace {
  readonly ids: string[] = []
  readonly stub = new FakeRoomStub()
  idFromName(roomId: string): DurableObjectId {
    this.ids.push(roomId)
    return { name: roomId } as unknown as DurableObjectId
  }
  get(): DurableObjectStub {
    return this.stub as unknown as DurableObjectStub
  }
}

let namespace: FakeRoomNamespace
let mint: ReturnType<typeof vi.fn>

function ice(query: string, origin = 'https://jam.test'): Promise<Response> {
  return worker.fetch(
    new Request(`https://jam.test/api/jam/ice${query}`, {
      method: 'POST',
      headers: { Origin: origin },
    }),
    {
      JAM_ROOM: namespace,
      TURN_KEY_ID: 'k',
      TURN_KEY_API_TOKEN: 't',
    } as never,
  )
}

async function body(
  response: Response,
): Promise<{ iceServers: unknown[]; source: string }> {
  return (await response.json()) as { iceServers: unknown[]; source: string }
}

beforeEach(() => {
  namespace = new FakeRoomNamespace()
  mint = vi.fn(
    async () =>
      new Response(JSON.stringify({ iceServers: MINTED }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', mint)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /api/jam/ice', () => {
  it('mints TURN for a room its Durable Object reports as live', async () => {
    const response = await ice('?room=ABCDEFGH')
    expect(response.status).toBe(200)
    const answer = await body(response)
    expect(answer.source).toBe('turn')
    expect(answer.iceServers).toEqual(MINTED)
    expect(namespace.ids).toEqual(['ABCDEFGH'])
    expect(mint).toHaveBeenCalledTimes(1)
    expect(String(mint.mock.calls[0]?.[0])).toBe(MINT_URL)
  })

  it('answers STUN only, and mints nothing, for a room with nobody in it', async () => {
    namespace.stub.body = { active: false, peers: 0 }
    const response = await ice('?room=ABCDEFGH')
    expect(response.status).toBe(200)
    const answer = await body(response)
    expect(answer.source).toBe('stun')
    expect(
      answer.iceServers.some((s) => JSON.stringify(s).includes('turn:')),
    ).toBe(false)
    expect(namespace.ids).toEqual(['ABCDEFGH'])
    expect(mint).not.toHaveBeenCalled()
  })

  it('answers STUN only, without touching any room, when no room is named', async () => {
    const response = await ice('')
    expect(response.status).toBe(200)
    expect((await body(response)).source).toBe('stun')
    expect(namespace.ids).toEqual([])
    expect(mint).not.toHaveBeenCalled()
  })

  it('answers STUN only, without touching any room, for a malformed room id', async () => {
    const response = await ice('?room=NOT-A-ROOM')
    expect(response.status).toBe(200)
    expect((await body(response)).source).toBe('stun')
    expect(namespace.ids).toEqual([])
    expect(mint).not.toHaveBeenCalled()
  })

  it('refuses a caller from another origin before looking at anything', async () => {
    const response = await ice('?room=ABCDEFGH', 'https://evil.test')
    expect(response.status).toBe(403)
    expect(namespace.ids).toEqual([])
    expect(mint).not.toHaveBeenCalled()
  })
})
