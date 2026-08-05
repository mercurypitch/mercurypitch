// ============================================================
// JamRoom lifecycle — protocol, hibernation, and alarm regressions
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { JamRoom } from './jam-room'
import { ROOM_OWNERSHIP_EXPIRY_KEY } from './room-ownership'
import type { JamSocketAttachment } from './signaling-intent'

class FakeSocket {
  attachment: JamSocketAttachment | Record<string, unknown> | null
  readonly closeCalls: Array<{ code?: number; reason?: string }> = []
  readonly sent: string[] = []
  readyState = 1

  constructor(
    attachment: JamSocketAttachment | Record<string, unknown> | null,
  ) {
    this.attachment = attachment
  }

  deserializeAttachment(): unknown {
    return this.attachment
  }

  serializeAttachment(attachment: unknown): void {
    this.attachment = attachment as Record<string, unknown>
  }

  send(message: string): void {
    this.sent.push(message)
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason })
    this.readyState = 3
  }
}

class FakeStorage {
  readonly values = new Map<string, unknown>()
  alarmAt: number | null = null
  deleteAllCalls = 0
  failNextDeleteAll = false
  readonly setAlarmCalls: number[] = []

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined
  }

  async put(
    keyOrEntries: string | Record<string, unknown>,
    value?: unknown,
  ): Promise<void> {
    if (typeof keyOrEntries === 'string') {
      this.values.set(keyOrEntries, value)
      return
    }
    for (const [key, entry] of Object.entries(keyOrEntries)) {
      this.values.set(key, entry)
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key)
  }

  async getAlarm(): Promise<number | null> {
    return this.alarmAt
  }

  async setAlarm(scheduledTime: number): Promise<void> {
    this.alarmAt = scheduledTime
    this.setAlarmCalls.push(scheduledTime)
  }

  async deleteAlarm(): Promise<void> {
    this.alarmAt = null
  }

  async deleteAll(): Promise<void> {
    this.deleteAllCalls++
    if (this.failNextDeleteAll) {
      this.failNextDeleteAll = false
      // KV-backed deleteAll may remove only a subset before rejecting. Model
      // the security-relevant case: the deadline is gone but the token stays.
      this.values.delete(ROOM_OWNERSHIP_EXPIRY_KEY)
      throw new Error('storage unavailable')
    }
    this.values.clear()
    this.alarmAt = null
  }
}

class FakeContext {
  readonly storage = new FakeStorage()
  sockets: FakeSocket[] = []

  getWebSockets(): WebSocket[] {
    return this.sockets as unknown as WebSocket[]
  }
}

function room(ctx: FakeContext): JamRoom {
  return new JamRoom(ctx as unknown as DurableObjectState, {} as never)
}

function socket(
  connectionIntent: JamSocketAttachment['connectionIntent'],
  peerId?: string,
): FakeSocket {
  return new FakeSocket({
    connectionIntent,
    ...(peerId === undefined ? {} : { displayName: 'Ada', peerId }),
    roomId: 'ABCDEFGH',
  })
}

function sentMessages(ws: FakeSocket): Array<Record<string, unknown>> {
  return ws.sent.map(
    (message) => JSON.parse(message) as Record<string, unknown>,
  )
}

describe('JamRoom signaling and ownership lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects create-room on an existing-room join socket', async () => {
    const ctx = new FakeContext()
    const ws = socket('join')
    ctx.sockets = [ws]

    await room(ctx).webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ type: 'create-room', displayName: 'Attacker' }),
    )

    expect(ctx.storage.values.has('ownerToken')).toBe(false)
    expect(ws.closeCalls).toEqual([
      { code: 1008, reason: 'Invalid signaling sequence' },
    ])
    expect(sentMessages(ws)).toContainEqual({
      type: 'error',
      message: 'Invalid signaling sequence',
    })
  })

  it('accepts one create handshake and rejects ownership replacement', async () => {
    const ctx = new FakeContext()
    const ws = socket('create')
    ctx.sockets = [ws]
    const instance = room(ctx)

    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ type: 'create-room', displayName: 'Ada' }),
    )
    const originalToken = ctx.storage.values.get('ownerToken')
    expect(typeof originalToken).toBe('string')
    expect(ws.attachment).toMatchObject({
      connectionIntent: 'established',
      displayName: 'Ada',
      roomId: 'ABCDEFGH',
    })

    ws.readyState = 1
    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ type: 'create-room', displayName: 'Attacker' }),
    )

    expect(ctx.storage.values.get('ownerToken')).toBe(originalToken)
    expect(ws.closeCalls.at(-1)).toEqual({
      code: 1008,
      reason: 'Invalid signaling sequence',
    })
  })

  it('restores host authority when the owner reconnects inside the grace period', async () => {
    const ctx = new FakeContext()
    const creator = socket('create')
    ctx.sockets = [creator]
    const instance = room(ctx)

    await instance.webSocketMessage(
      creator as unknown as WebSocket,
      JSON.stringify({ type: 'create-room', displayName: 'Ada' }),
    )
    const ownerToken = sentMessages(creator).find(
      (message) => message.type === 'room-created',
    )?.ownerToken
    expect(typeof ownerToken).toBe('string')

    await instance.webSocketClose(creator as unknown as WebSocket)
    expect(ctx.storage.values.has(ROOM_OWNERSHIP_EXPIRY_KEY)).toBe(true)

    const reconnectingOwner = socket('join')
    ctx.sockets = [reconnectingOwner]
    await instance.webSocketMessage(
      reconnectingOwner as unknown as WebSocket,
      JSON.stringify({
        type: 'join-room',
        displayName: 'Ada',
        ownerToken,
      }),
    )

    expect(sentMessages(reconnectingOwner)).toContainEqual(
      expect.objectContaining({ type: 'room-joined', isHost: true }),
    )
    expect(ctx.storage.values.has(ROOM_OWNERSHIP_EXPIRY_KEY)).toBe(false)

    const response = await instance.fetch(
      new Request('https://jam-room.internal/internal/verify-host', {
        method: 'POST',
        headers: { 'X-Jam-Room-Id': 'ABCDEFGH' },
        body: JSON.stringify({ ownerToken }),
      }),
    )
    expect(response.status).toBe(204)
  })

  it('demotes an overlapping host reconnect before hibernation', async () => {
    const ctx = new FakeContext()
    const creator = socket('create')
    ctx.sockets = [creator]
    const instance = room(ctx)

    await instance.webSocketMessage(
      creator as unknown as WebSocket,
      JSON.stringify({ type: 'create-room', displayName: 'Ada' }),
    )
    const ownerToken = sentMessages(creator).find(
      (message) => message.type === 'room-created',
    )?.ownerToken
    expect(typeof ownerToken).toBe('string')

    const reconnectingOwner = socket('join')
    ctx.sockets = [creator, reconnectingOwner]
    await instance.webSocketMessage(
      reconnectingOwner as unknown as WebSocket,
      JSON.stringify({
        type: 'join-room',
        displayName: 'Ada',
        ownerToken,
      }),
    )

    expect(creator.attachment).toMatchObject({ isHost: false })
    expect(reconnectingOwner.attachment).toMatchObject({ isHost: true })

    // A fresh instance models hibernation. The superseded socket must not
    // regain authority from its persisted attachment.
    creator.sent.length = 0
    reconnectingOwner.sent.length = 0
    const rehydrated = room(ctx)
    await rehydrated.webSocketMessage(
      creator as unknown as WebSocket,
      JSON.stringify({ type: 'set-background', backgroundId: 'aurora-stage' }),
    )
    expect(sentMessages(creator)).toContainEqual({
      type: 'error',
      message: 'Only the host can change the room',
    })

    await rehydrated.webSocketMessage(
      reconnectingOwner as unknown as WebSocket,
      JSON.stringify({ type: 'set-background', backgroundId: 'aurora-stage' }),
    )
    expect(ctx.storage.values.get('roomBackground')).toEqual({
      backgroundId: 'aurora-stage',
      revision: 1,
    })
  })

  it('fails closed when legacy host attachments conflict after hibernation', async () => {
    const ctx = new FakeContext()
    const first = new FakeSocket({
      connectionIntent: 'established',
      displayName: 'Ada',
      isHost: true,
      peerId: 'first-host-peer',
      roomId: 'ABCDEFGH',
    })
    const second = new FakeSocket({
      connectionIntent: 'established',
      displayName: 'Ada',
      isHost: true,
      peerId: 'second-host-peer',
      roomId: 'ABCDEFGH',
    })
    ctx.sockets = [first, second]
    ctx.storage.values.set('ownerToken', 'owner-token')
    ctx.storage.values.set('ownerName', 'Ada')
    const rehydrated = room(ctx)

    for (const candidate of [first, second]) {
      await rehydrated.webSocketMessage(
        candidate as unknown as WebSocket,
        JSON.stringify({
          type: 'set-background',
          backgroundId: 'aurora-stage',
        }),
      )
      expect(sentMessages(candidate)).toContainEqual({
        type: 'error',
        message: 'Only the host can change the room',
      })
    }
    expect(first.attachment).toMatchObject({ isHost: false })
    expect(second.attachment).toMatchObject({ isHost: false })
    expect(sentMessages(first)).toContainEqual({
      type: 'host-changed',
      hostPeerId: null,
    })
    expect(sentMessages(second)).toContainEqual({
      type: 'host-changed',
      hostPeerId: null,
    })
    expect(ctx.storage.values.has('roomBackground')).toBe(false)
  })

  it('lets only the host persist and broadcast a room background', async () => {
    const ctx = new FakeContext()
    const creator = socket('create')
    const guest = socket('join')
    ctx.sockets = [creator, guest]
    const instance = room(ctx)

    await instance.webSocketMessage(
      creator as unknown as WebSocket,
      JSON.stringify({ type: 'create-room', displayName: 'Ada' }),
    )
    await instance.webSocketMessage(
      guest as unknown as WebSocket,
      JSON.stringify({ type: 'join-room', displayName: 'Grace' }),
    )

    creator.sent.length = 0
    guest.sent.length = 0
    await instance.webSocketMessage(
      guest as unknown as WebSocket,
      JSON.stringify({ type: 'set-background', backgroundId: 'aurora-stage' }),
    )

    expect(sentMessages(guest)).toContainEqual({
      type: 'error',
      message: 'Only the host can change the room',
    })
    expect(ctx.storage.values.has('roomBackground')).toBe(false)

    guest.sent.length = 0
    await instance.webSocketMessage(
      creator as unknown as WebSocket,
      JSON.stringify({ type: 'set-background', backgroundId: 'aurora-stage' }),
    )

    expect(ctx.storage.values.get('roomBackground')).toEqual({
      backgroundId: 'aurora-stage',
      revision: 1,
    })
    expect(sentMessages(creator)).toContainEqual(
      expect.objectContaining({
        type: 'background-changed',
        backgroundId: 'aurora-stage',
        revision: 1,
      }),
    )
    expect(sentMessages(guest)).toContainEqual(
      expect.objectContaining({
        type: 'background-changed',
        backgroundId: 'aurora-stage',
        revision: 1,
      }),
    )
  })

  it('hydrates the selected background for a later joiner', async () => {
    const ctx = new FakeContext()
    const host = new FakeSocket({
      connectionIntent: 'established',
      displayName: 'Ada',
      isHost: true,
      peerId: 'host-peer',
      roomId: 'ABCDEFGH',
    })
    const guest = socket('join')
    ctx.sockets = [host, guest]
    ctx.storage.values.set('ownerToken', 'owner-token')
    ctx.storage.values.set('ownerName', 'Ada')
    ctx.storage.values.set('roomBackground', {
      backgroundId: 'golden-hour-stage',
      revision: 4,
    })

    await room(ctx).webSocketMessage(
      guest as unknown as WebSocket,
      JSON.stringify({ type: 'join-room', displayName: 'Grace' }),
    )

    expect(sentMessages(guest)).toContainEqual(
      expect.objectContaining({
        type: 'room-joined',
        background: {
          backgroundId: 'golden-hour-stage',
          revision: 4,
        },
      }),
    )
  })

  it('does not leak an expired room background into a warm room adoption', async () => {
    const ctx = new FakeContext()
    const creator = socket('create')
    ctx.sockets = [creator]
    const instance = room(ctx)

    await instance.webSocketMessage(
      creator as unknown as WebSocket,
      JSON.stringify({ type: 'create-room', displayName: 'Ada' }),
    )
    await instance.webSocketMessage(
      creator as unknown as WebSocket,
      JSON.stringify({
        type: 'set-background',
        backgroundId: 'golden-hour-stage',
      }),
    )
    await instance.webSocketClose(creator as unknown as WebSocket)
    await instance.alarm()

    const adopter = socket('join')
    ctx.sockets = [adopter]
    await instance.webSocketMessage(
      adopter as unknown as WebSocket,
      JSON.stringify({ type: 'join-room', displayName: 'Grace' }),
    )

    const joined = sentMessages(adopter).find(
      (message) => message.type === 'room-joined',
    )
    expect(joined).toBeDefined()
    expect(joined).not.toHaveProperty('background')
    expect(ctx.storage.values.has('roomBackground')).toBe(false)
  })

  it('rejects malformed room background ids', async () => {
    const ctx = new FakeContext()
    const creator = socket('create')
    ctx.sockets = [creator]
    const instance = room(ctx)

    await instance.webSocketMessage(
      creator as unknown as WebSocket,
      JSON.stringify({ type: 'create-room', displayName: 'Ada' }),
    )
    creator.sent.length = 0

    await instance.webSocketMessage(
      creator as unknown as WebSocket,
      JSON.stringify({ type: 'set-background', backgroundId: '../private' }),
    )

    expect(sentMessages(creator)).toContainEqual({
      type: 'error',
      message: 'Invalid room background',
    })
    expect(ctx.storage.values.has('roomBackground')).toBe(false)
  })

  it('fails a create-route id collision instead of replacing a live owner', async () => {
    const ctx = new FakeContext()
    const creator = socket('create')
    ctx.sockets = [socket('established', 'existing-host'), creator]
    ctx.storage.values.set('ownerToken', 'existing-owner-token')
    ctx.storage.values.set('ownerName', 'Existing host')

    await room(ctx).webSocketMessage(
      creator as unknown as WebSocket,
      JSON.stringify({ type: 'create-room', displayName: 'New host' }),
    )

    expect(ctx.storage.values.get('ownerToken')).toBe('existing-owner-token')
    expect(creator.closeCalls).toEqual([
      { code: 1008, reason: 'Room id already exists' },
    ])
  })

  it('rejects and purges a cold legacy owner proof without a deadline', async () => {
    const ctx = new FakeContext()
    ctx.storage.values.set('ownerToken', 'legacy-token')
    ctx.storage.values.set('ownerName', 'Former host')

    const response = await room(ctx).fetch(
      new Request('https://jam-room.internal/internal/verify-host', {
        method: 'POST',
        headers: { 'X-Jam-Room-Id': 'ABCDEFGH' },
        body: JSON.stringify({ ownerToken: 'legacy-token' }),
      }),
    )

    expect(response.status).toBe(403)
    expect(ctx.storage.deleteAllCalls).toBe(1)
    expect(ctx.storage.values.size).toBe(0)
  })

  it('keeps a legacy owner proof while an attached peer proves the room is live', async () => {
    const ctx = new FakeContext()
    const ws = new FakeSocket({
      displayName: 'Ada',
      peerId: 'host-peer',
      roomId: 'ABCDEFGH',
    })
    ctx.sockets = [ws]
    ctx.storage.values.set('ownerToken', 'live-token')
    ctx.storage.values.set('ownerName', 'Ada')

    const response = await room(ctx).fetch(
      new Request('https://jam-room.internal/internal/verify-host', {
        method: 'POST',
        headers: { 'X-Jam-Room-Id': 'ABCDEFGH' },
        body: JSON.stringify({ ownerToken: 'live-token' }),
      }),
    )

    expect(response.status).toBe(204)
    expect(ctx.storage.deleteAllCalls).toBe(0)
  })

  it('marks a leaving socket departed so eviction cannot resurrect it', async () => {
    const ctx = new FakeContext()
    // Pre-boundary attachments had peer metadata but no connection intent.
    const ws = new FakeSocket({
      displayName: 'Ada',
      peerId: 'host-peer',
      roomId: 'ABCDEFGH',
    })
    ctx.sockets = [ws]
    ctx.storage.values.set('ownerToken', 'owner-token')
    ctx.storage.values.set('ownerName', 'Ada')

    await room(ctx).webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ type: 'leave-room' }),
    )

    expect(ws.attachment).toEqual({
      connectionIntent: 'departed',
      roomId: 'ABCDEFGH',
    })
    expect(ws.closeCalls).toEqual([{ code: 1000, reason: 'Left room' }])
    expect(ctx.storage.values.has(ROOM_OWNERSHIP_EXPIRY_KEY)).toBe(true)

    // Simulate eviction while the platform still reports the socket. The
    // persisted departed attachment, rather than in-memory maps, is decisive.
    await room(ctx).alarm()

    expect(ctx.storage.deleteAllCalls).toBe(1)
    expect(ctx.storage.values.size).toBe(0)
  })

  it('cancels a stale alarm dispatch when an established peer is attached', async () => {
    const ctx = new FakeContext()
    ctx.sockets = [socket('established', 'host-peer')]
    ctx.storage.values.set('ownerToken', 'owner-token')
    ctx.storage.values.set(ROOM_OWNERSHIP_EXPIRY_KEY, 1)
    ctx.storage.alarmAt = 1

    await room(ctx).alarm()

    expect(ctx.storage.deleteAllCalls).toBe(0)
    expect(ctx.storage.values.has(ROOM_OWNERSHIP_EXPIRY_KEY)).toBe(false)
    expect(ctx.storage.alarmAt).toBeNull()
  })

  it('keeps a retry alarm when expired storage deletion fails', async () => {
    const ctx = new FakeContext()
    ctx.storage.values.set('ownerToken', 'owner-token')
    ctx.storage.values.set(ROOM_OWNERSHIP_EXPIRY_KEY, 1)
    ctx.storage.alarmAt = 1
    ctx.storage.failNextDeleteAll = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const before = Date.now()

    await room(ctx).alarm()

    expect(ctx.storage.deleteAllCalls).toBe(1)
    expect(ctx.storage.setAlarmCalls.at(-1)).toBeGreaterThanOrEqual(
      before + 60_000,
    )
  })

  it('never treats a cleanup retry alarm as a proof deadline after partial deletion', async () => {
    const ctx = new FakeContext()
    ctx.storage.values.set('ownerToken', 'expired-owner-token')
    ctx.storage.values.set('ownerName', 'Former host')
    ctx.storage.values.set(ROOM_OWNERSHIP_EXPIRY_KEY, 1)
    ctx.storage.alarmAt = 1
    ctx.storage.failNextDeleteAll = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await room(ctx).alarm()
    expect(ctx.storage.values.has(ROOM_OWNERSHIP_EXPIRY_KEY)).toBe(false)
    expect(ctx.storage.values.get('ownerToken')).toBe('expired-owner-token')
    expect(ctx.storage.alarmAt).toBeGreaterThan(Date.now())

    // A fresh instance arrives before the retry alarm. The alarm schedules
    // cleanup only; it must not make the leftover token valid again.
    const response = await room(ctx).fetch(
      new Request('https://jam-room.internal/internal/verify-host', {
        method: 'POST',
        headers: { 'X-Jam-Room-Id': 'ABCDEFGH' },
        body: JSON.stringify({ ownerToken: 'expired-owner-token' }),
      }),
    )

    expect(response.status).toBe(403)
    expect(ctx.storage.deleteAllCalls).toBe(2)
    expect(ctx.storage.values.size).toBe(0)
  })
})
