// ============================================================
// Jam host verification — Durable Object routing boundaries
// ============================================================

import { describe, expect, it } from 'vitest'
import { type HostVerificationEnv, verifyRoomHost, } from './host-verification-core'

const ROOM_ID = 'ABCDEFGH'
const OWNER_TOKEN = '00000000-0000-4000-8000-000000000001'

interface StubCall {
  body: unknown
  roomId: string | null
  url: string
}

class FakeRoomStub {
  readonly calls: StubCall[] = []
  status = 204

  async fetch(input: RequestInfo | URL): Promise<Response> {
    const request = input instanceof Request ? input : new Request(input)
    this.calls.push({
      body: JSON.parse(await request.text()),
      roomId: request.headers.get('X-Jam-Room-Id'),
      url: request.url,
    })
    return new Response(null, { status: this.status })
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

function fixture(): {
  env: HostVerificationEnv
  namespace: FakeRoomNamespace
} {
  const namespace = new FakeRoomNamespace()
  return {
    env: {
      JAM_ROOM: namespace as unknown as HostVerificationEnv['JAM_ROOM'],
    },
    namespace,
  }
}

describe('Jam host verification RPC core', () => {
  it('forwards owner proof to exactly the named room Durable Object', async () => {
    const f = fixture()

    const verified = await verifyRoomHost(f.env, ROOM_ID, OWNER_TOKEN)

    expect(verified).toBe(true)
    expect(f.namespace.ids).toEqual([ROOM_ID])
    expect(f.namespace.stub.calls).toEqual([
      {
        body: { ownerToken: OWNER_TOKEN },
        roomId: ROOM_ID,
        url: 'https://jam-room.internal/internal/verify-host',
      },
    ])
  })

  it('fails closed when the room Durable Object rejects the owner token', async () => {
    const f = fixture()
    f.namespace.stub.status = 403

    const verified = await verifyRoomHost(f.env, ROOM_ID, OWNER_TOKEN)

    expect(verified).toBe(false)
    expect(f.namespace.ids).toEqual([ROOM_ID])
  })

  it.each(['NOT-A-ROOM', 'ABCDEF0I', '', 'ABCDEFGHI'])(
    'rejects malformed room id %j without instantiating a Durable Object',
    async (roomId) => {
      const f = fixture()

      const verified = await verifyRoomHost(f.env, roomId, OWNER_TOKEN)

      expect(verified).toBe(false)
      expect(f.namespace.ids).toEqual([])
    },
  )

  it('rejects empty or oversized owner proof before Durable Object access', async () => {
    const f = fixture()

    expect(await verifyRoomHost(f.env, ROOM_ID, '')).toBe(false)
    expect(await verifyRoomHost(f.env, ROOM_ID, 'x'.repeat(129))).toBe(false)
    expect(f.namespace.ids).toEqual([])
  })
})
