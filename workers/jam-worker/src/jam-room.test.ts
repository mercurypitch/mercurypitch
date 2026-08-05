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
