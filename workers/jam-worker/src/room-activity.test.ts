// ============================================================
// Jam room activity — "is anyone in this room?" RPC boundary
// ============================================================

import { describe, expect, it } from 'vitest'
import { type RoomActivityEnv, roomHasActivePeers } from './room-activity-core'

const ROOM_ID = 'ABCDEFGH'

class FakeRoomStub {
  readonly calls: { roomId: string | null; url: string }[] = []
  body: unknown = { active: true, peers: 2 }
  status = 200
  throwOnFetch = false

  async fetch(input: RequestInfo | URL): Promise<Response> {
    if (this.throwOnFetch) throw new Error('DO unreachable')
    const request = input instanceof Request ? input : new Request(input)
    this.calls.push({
      roomId: request.headers.get('X-Jam-Room-Id'),
      url: request.url,
    })
    return new Response(JSON.stringify(this.body), { status: this.status })
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

function fixture(): { env: RoomActivityEnv; namespace: FakeRoomNamespace } {
  const namespace = new FakeRoomNamespace()
  return {
    env: { JAM_ROOM: namespace as unknown as RoomActivityEnv['JAM_ROOM'] },
    namespace,
  }
}

describe('roomHasActivePeers', () => {
  it('asks exactly the named room and reports it active', async () => {
    const f = fixture()
    expect(await roomHasActivePeers(f.env, ROOM_ID)).toBe(true)
    expect(f.namespace.ids).toEqual([ROOM_ID])
    expect(f.namespace.stub.calls).toEqual([
      {
        roomId: ROOM_ID,
        url: 'https://jam-room.internal/internal/room-active',
      },
    ])
  })

  it('reports an empty room inactive', async () => {
    const f = fixture()
    f.namespace.stub.body = { active: false, peers: 0 }
    expect(await roomHasActivePeers(f.env, ROOM_ID)).toBe(false)
  })

  it.each(['NOT-A-ROOM', 'ABCDEF0I', '', 'ABCDEFGHI'])(
    'rejects malformed room id %j without touching a Durable Object',
    async (roomId) => {
      const f = fixture()
      expect(await roomHasActivePeers(f.env, roomId)).toBe(false)
      expect(f.namespace.ids).toEqual([])
    },
  )

  it('fails closed (inactive) when the DO errors or is unreachable', async () => {
    const f = fixture()
    f.namespace.stub.status = 500
    expect(await roomHasActivePeers(f.env, ROOM_ID)).toBe(false)

    const g = fixture()
    g.namespace.stub.throwOnFetch = true
    expect(await roomHasActivePeers(g.env, ROOM_ID)).toBe(false)
  })
})
