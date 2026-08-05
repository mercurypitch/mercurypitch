// ── JamRoom Durable Object ──────────────────────────────────────────
// Manages room state and relays signaling messages between peers.
// Uses WebSocket Hibernation API for efficient resource usage.

import { DurableObject } from 'cloudflare:workers'
import { cancelRoomOwnershipExpiry, createRoomOwnershipState, expireRoomOwnership, roomOwnershipMustExpire, ROOM_OWNERSHIP_EXPIRY_KEY, scheduleRoomOwnershipExpiry, } from './room-ownership'
import { connectionAllowsMessage, JAM_CONNECTION_INTENT_HEADER, JAM_ROOM_ID_HEADER, type JamSocketAttachment, parseInitialConnectionIntent, } from './signaling-intent'

interface PeerInfo {
  id: string
  displayName: string
  ws: WebSocket
}

const MAX_PEERS = 12 // occupancy cap per room (bounds an unauthenticated channel)
const MSG_RATE_LIMIT = 120 // max messages per window, per connection
const MSG_RATE_WINDOW_MS = 1000
const ROOM_BACKGROUND_KEY = 'roomBackground'
const JAM_BACKGROUND_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

interface RoomBackgroundState {
  backgroundId: string
  revision: number
}

/**
 * Constant-time string comparison. Used for the secret ownerToken so the
 * host check does not short-circuit on the first differing byte (a `===`
 * compare leaks, via timing, how many leading bytes a guess got right).
 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ (bb[i] ?? 0)
  return diff === 0
}

interface JamEnv {
  JAM_ROOM: DurableObjectNamespace
}

export class JamRoom extends DurableObject<JamEnv> {
  private peers: Map<string, PeerInfo> = new Map()
  private wsToPeerId: WeakMap<WebSocket, string> = new WeakMap()
  private roomId = ''
  private readonly ownership = createRoomOwnershipState()
  private ownershipHydrated = false
  private background: RoomBackgroundState | null = null
  private backgroundHydrated = false
  private isHydrated = false
  private msgRate: WeakMap<WebSocket, { windowStart: number; count: number }> =
    new WeakMap()

  private hydrate(): void {
    if (this.isHydrated) return
    this.isHydrated = true
    this.peers.clear()
    this.wsToPeerId = new WeakMap()
    let hydratedHostPeerId: string | null = null
    let hasConflictingHostAttachments = false
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const attachment =
          ws.deserializeAttachment() as JamSocketAttachment | null
        if (!this.roomId && attachment?.roomId) {
          this.roomId = attachment.roomId
        }
        if (
          attachment &&
          attachment.peerId &&
          attachment.connectionIntent !== 'departed'
        ) {
          this.peers.set(attachment.peerId, {
            id: attachment.peerId,
            displayName: attachment.displayName || '',
            ws,
          })
          this.wsToPeerId.set(ws, attachment.peerId)
          if (attachment.isHost === true) {
            if (hydratedHostPeerId === null) {
              hydratedHostPeerId = attachment.peerId
            } else if (hydratedHostPeerId !== attachment.peerId) {
              hasConflictingHostAttachments = true
            }
          }
        }
      } catch {
        // ignore
      }
    }
    // Older workers could leave two overlapping owner reconnect sockets marked
    // as host. Never pick one by WebSocket iteration order after hibernation.
    // Demote every persisted copy and reconcile the already-open clients too;
    // a fresh owner-token reconnect will establish one authoritative host.
    if (hasConflictingHostAttachments) {
      for (const peer of this.peers.values()) {
        const attachment = this.readAttachment(peer.ws)
        if (attachment?.isHost !== true) continue
        peer.ws.serializeAttachment({
          ...attachment,
          isHost: false,
        } satisfies JamSocketAttachment)
      }
      this.broadcast({ type: 'host-changed', hostPeerId: null })
    }
    this.ownership.ownerId = hasConflictingHostAttachments
      ? null
      : hydratedHostPeerId
  }

  // ── WebSocket upgrade ────────────────────────────────────────────

  override async fetch(request: Request): Promise<Response> {
    this.hydrate()
    this.roomId = request.headers.get(JAM_ROOM_ID_HEADER) || ''

    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/internal/verify-host') {
      let body: unknown
      try {
        const text = await request.text()
        if (text.length > 256) throw new Error('body too large')
        body = JSON.parse(text)
      } catch {
        return new Response(null, {
          status: 400,
          headers: { 'Cache-Control': 'private, no-store' },
        })
      }
      const ownerToken =
        typeof body === 'object' &&
        body !== null &&
        typeof (body as { ownerToken?: unknown }).ownerToken === 'string'
          ? (body as { ownerToken: string }).ownerToken
          : ''
      const verified = await this.hasOwnerToken(ownerToken)
      return new Response(null, {
        status: verified ? 204 : 403,
        headers: { 'Cache-Control': 'private, no-store' },
      })
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket upgrade required', { status: 426 })
    }
    const connectionIntent = parseInitialConnectionIntent(
      request.headers.get(JAM_CONNECTION_INTENT_HEADER),
    )
    if (connectionIntent === null || this.roomId === '') {
      return new Response('Invalid signaling route', { status: 400 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({
      connectionIntent,
      roomId: this.roomId,
    } satisfies JamSocketAttachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  // ── WebSocket message handler ─────────────────────────────────────

  override async webSocketMessage(
    ws: WebSocket,
    message: string,
  ): Promise<void> {
    this.hydrate()

    // Cheap per-connection flood guard: drop messages above the budget so a
    // single peer can't amplify a flood via relay/broadcast. The ceiling is
    // generous enough not to trip normal WebRTC signaling bursts.
    const now = Date.now()
    const rate = this.msgRate.get(ws)
    if (rate === undefined || now - rate.windowStart >= MSG_RATE_WINDOW_MS) {
      this.msgRate.set(ws, { windowStart: now, count: 1 })
    } else {
      rate.count++
      if (rate.count > MSG_RATE_LIMIT) return
    }

    let msg: { type: string; [k: string]: unknown }
    try {
      const parsed = JSON.parse(message) as unknown
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof (parsed as { type?: unknown }).type !== 'string'
      ) {
        return
      }
      msg = parsed as { type: string; [k: string]: unknown }
    } catch {
      return
    }

    const attachment = this.readAttachment(ws)
    if (
      !connectionAllowsMessage(attachment?.connectionIntent ?? null, msg.type)
    ) {
      this.rejectSocket(ws, 'Invalid signaling sequence')
      return
    }

    switch (msg.type) {
      case 'create-room':
        await this.handleCreateRoom(
          ws,
          msg as { type: string; displayName: string },
        )
        break
      case 'join-room':
        await this.handleJoinRoom(
          ws,
          msg as {
            type: string
            roomId: string
            displayName: string
            ownerToken?: string
          },
        )
        break
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.relayToPeer(ws, msg as { type: string; target?: string })
        break
      case 'set-background':
        await this.handleSetBackground(ws, msg.backgroundId)
        break
      case 'leave-room':
        await this.handleLeave(ws)
        break
    }
  }

  // ── WebSocket close / error ───────────────────────────────────────

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.hydrate()
    const peerId = this.wsToPeerId.get(ws)
    if (peerId) {
      const peer = this.peers.get(peerId)
      console.log(
        `[JamRoom ${this.roomId}] ${peer?.displayName || 'Anonymous'} disconnected (${peerId}). Remaining peers: ${this.peers.size - 1}`,
      )
      this.peers.delete(peerId)
      this.wsToPeerId.delete(ws)
      this.broadcast({ type: 'peer-left', peerId }, peerId)
      if (this.ownership.ownerId === peerId) {
        this.ownership.ownerId = null
        this.broadcast({ type: 'host-changed', hostPeerId: null }, peerId)
      }
    }
    await this.checkEmpty()
  }

  override webSocketError(_ws: WebSocket, _error: unknown): void {
    // webSocketClose fires after this, cleanup is handled there
  }

  // ── Room lifecycle ────────────────────────────────────────────────

  private async hydrateOwnership(): Promise<void> {
    if (this.ownershipHydrated || this.ownership.expired) return
    const [ownerToken, ownerName, storedExpiresAt] = await Promise.all([
      this.ctx.storage.get<string>('ownerToken'),
      this.ctx.storage.get<string>('ownerName'),
      this.ctx.storage.get<number>(ROOM_OWNERSHIP_EXPIRY_KEY),
    ])
    this.ownership.ownerToken = ownerToken ?? null
    this.ownership.ownerName = ownerName ?? null
    this.ownership.expiresAt =
      typeof storedExpiresAt === 'number' && Number.isFinite(storedExpiresAt)
        ? storedExpiresAt
        : null
    this.ownershipHydrated = true
  }

  private async hydrateBackground(): Promise<void> {
    if (this.backgroundHydrated) return
    const stored =
      await this.ctx.storage.get<RoomBackgroundState>(ROOM_BACKGROUND_KEY)
    this.background =
      stored !== undefined &&
      typeof stored.backgroundId === 'string' &&
      JAM_BACKGROUND_ID_RE.test(stored.backgroundId) &&
      Number.isSafeInteger(stored.revision) &&
      stored.revision > 0
        ? stored
        : null
    this.backgroundHydrated = true
  }

  private async expireOwnership(): Promise<void> {
    await expireRoomOwnership(this.ownership, () =>
      this.ctx.storage.deleteAll(),
    )
    // deleteAll also removes the persisted background. Keep the warm object in
    // lockstep so a newly adopted room cannot inherit the previous room's art.
    this.background = null
    this.backgroundHydrated = true
  }

  private async expireOverdueOwnership(nowMs = Date.now()): Promise<boolean> {
    await this.hydrateOwnership()
    if (!roomOwnershipMustExpire(this.ownership, this.peers.size, nowMs)) {
      return false
    }
    if (!this.ownership.expired) await this.expireOwnership()
    return true
  }

  private async hasOwnerToken(candidate: string): Promise<boolean> {
    if (candidate === '' || candidate.length > 128) return false
    try {
      if (await this.expireOverdueOwnership()) return false
    } catch (error: unknown) {
      // The persisted deadline still rejects this token after a cold start.
      // Retry physical cleanup with an alarm rather than weakening the proof.
      console.error(
        `[JamRoom ${this.roomId}] failed to purge expired host proof: ${String(error)}`,
      )
      await this.ctx.storage.setAlarm(Date.now() + 60_000)
      return false
    }
    return (
      this.ownership.ownerToken !== null &&
      timingSafeEqual(candidate, this.ownership.ownerToken)
    )
  }

  private async handleCreateRoom(
    ws: WebSocket,
    msg: { displayName: string },
  ): Promise<void> {
    const expired = await this.expireOverdueOwnership()
    if (
      !expired &&
      (this.ownership.ownerToken !== null || this.peers.size !== 0)
    ) {
      // A random room-id collision must fail instead of replacing the owner.
      this.rejectSocket(ws, 'Room id already exists')
      return
    }

    const peerId = crypto.randomUUID()
    const ownerToken = crypto.randomUUID()

    await this.cancelDelete()
    this.ownership.ownerId = peerId
    this.ownership.ownerName = msg.displayName
    this.ownership.ownerToken = ownerToken
    this.ownership.expired = false
    this.ownershipHydrated = true
    await this.ctx.storage.put({
      ownerName: msg.displayName,
      ownerToken,
    })

    ws.serializeAttachment({
      connectionIntent: 'established',
      peerId,
      displayName: msg.displayName,
      isHost: true,
      roomId: this.roomId,
    } satisfies JamSocketAttachment)
    this.peers.set(peerId, { id: peerId, displayName: msg.displayName, ws })
    this.wsToPeerId.set(ws, peerId)

    console.log(
      `[JamRoom ${this.roomId}] Room created by ${msg.displayName || 'Anonymous'} (${peerId})`,
    )

    // ownerToken is the secret that proves host on reconnect — returned once,
    // and never derived from the (publicly broadcast) display name.
    this.send(ws, {
      type: 'room-created',
      roomId: this.roomId,
      peerId,
      isHost: true,
      hostPeerId: peerId,
      ownerToken,
    })
  }

  private async handleJoinRoom(
    ws: WebSocket,
    msg: { displayName: string; ownerToken?: string },
  ): Promise<void> {
    // Cap occupancy to bound the cost of an unauthenticated channel.
    if (this.peers.size >= MAX_PEERS) {
      this.send(ws, { type: 'error', message: 'Room is full' })
      try {
        ws.close(1008, 'Room is full')
      } catch {
        // already closing
      }
      return
    }

    // Enforce the persisted deadline before cancelling it. Clearing the alarm
    // first would let a stale owner token resurrect itself on a late join.
    await this.hydrateOwnership()
    if (roomOwnershipMustExpire(this.ownership, this.peers.size)) {
      await this.expireOwnership()
    }

    const peerId = crypto.randomUUID()

    const existing = Array.from(this.peers.values()).map((p) => ({
      id: p.id,
      displayName: p.displayName,
    }))
    // Host is proven by the secret ownerToken issued at creation — NOT by the
    // (publicly broadcast) display name, which any peer can read and replay.
    // Load it from storage in case the DO hibernated and lost in-memory state.
    await this.hydrateOwnership()
    // An ownerless room adopts its first joiner. The DO deletes its storage
    // five minutes after the last peer leaves, so a host walking back into
    // their own room later finds a blank object -- without this they would
    // sit in it with no transport, no mode and no way to get them back.
    // Not a hole: a room with no stored owner has no one to impersonate,
    // and an occupied room always reloads its token from storage above.
    let freshToken: string | null = null
    if (this.ownership.ownerToken === null && this.peers.size === 0) {
      freshToken = crypto.randomUUID()
      this.ownership.ownerToken = freshToken
      this.ownership.ownerName = msg.displayName
      this.ownership.expired = false
      this.ownershipHydrated = true
      await this.ctx.storage.put({
        ownerName: msg.displayName,
        ownerToken: freshToken,
      })
      console.log(
        `[JamRoom ${this.roomId}] ownerless room adopted by ${msg.displayName || 'Anonymous'} (${peerId})`,
      )
    }

    const isHost =
      freshToken !== null ||
      (typeof msg.ownerToken === 'string' &&
        (await this.hasOwnerToken(msg.ownerToken)))
    if (isHost) {
      this.demoteOtherHostSockets(peerId)
      this.ownership.ownerId = peerId
    }

    // Validate a reconnecting owner's proof before clearing the persisted
    // deadline. Once this socket is established, the room is live again and
    // both expiry mechanisms can be cancelled safely.
    ws.serializeAttachment({
      connectionIntent: 'established',
      peerId,
      displayName: msg.displayName,
      isHost,
      roomId: this.roomId,
    } satisfies JamSocketAttachment)
    this.peers.set(peerId, { id: peerId, displayName: msg.displayName, ws })
    this.wsToPeerId.set(ws, peerId)
    await this.cancelDelete()

    console.log(
      `[JamRoom ${this.roomId}] host check: incoming="${msg.displayName}" isHost=${isHost}`,
    )
    await this.hydrateBackground()
    this.send(ws, {
      type: 'room-joined',
      roomId: this.roomId,
      peerId,
      isHost,
      peers: existing,
      hostPeerId: this.ownership.ownerId,
      // Only when this join created the ownership -- otherwise the joiner
      // already holds the secret, and it is never handed out again.
      ...(freshToken === null ? {} : { ownerToken: freshToken }),
      ...(this.background === null ? {} : { background: this.background }),
    })

    if (isHost) {
      this.broadcast({ type: 'host-changed', hostPeerId: peerId }, peerId)
    }

    console.log(
      `[JamRoom ${this.roomId}] ${msg.displayName || 'Anonymous'} joined (${peerId}). Total peers: ${this.peers.size}`,
    )

    this.broadcast(
      { type: 'peer-joined', peerId, displayName: msg.displayName },
      peerId,
    )
  }

  private async handleLeave(ws: WebSocket): Promise<void> {
    const peerId = this.wsToPeerId.get(ws)
    if (peerId) {
      const peer = this.peers.get(peerId)
      console.log(
        `[JamRoom ${this.roomId}] ${peer?.displayName || 'Anonymous'} left (${peerId}). Remaining peers: ${this.peers.size - 1}`,
      )
      this.peers.delete(peerId)
      this.wsToPeerId.delete(ws)
      this.broadcast({ type: 'peer-left', peerId }, peerId)
      if (this.ownership.ownerId === peerId) {
        this.ownership.ownerId = null
        this.broadcast({ type: 'host-changed', hostPeerId: null }, peerId)
      }
    }
    ws.serializeAttachment({
      connectionIntent: 'departed',
      roomId: this.roomId,
    } satisfies JamSocketAttachment)
    try {
      ws.close(1000, 'Left room')
    } catch {
      // already closing
    }
    await this.checkEmpty()
  }

  private async handleSetBackground(
    ws: WebSocket,
    candidate: unknown,
  ): Promise<void> {
    const attachment = this.readAttachment(ws)
    if (
      attachment?.connectionIntent !== 'established' ||
      attachment.isHost !== true ||
      attachment.peerId === undefined ||
      attachment.peerId !== this.ownership.ownerId
    ) {
      this.send(ws, {
        type: 'error',
        message: 'Only the host can change the room',
      })
      return
    }
    if (
      typeof candidate !== 'string' ||
      candidate.length > 64 ||
      !JAM_BACKGROUND_ID_RE.test(candidate)
    ) {
      this.send(ws, { type: 'error', message: 'Invalid room background' })
      return
    }

    await this.hydrateBackground()
    const next: RoomBackgroundState = {
      backgroundId: candidate,
      revision: (this.background?.revision ?? 0) + 1,
    }
    await this.ctx.storage.put(ROOM_BACKGROUND_KEY, next)
    this.background = next
    this.backgroundHydrated = true
    this.broadcast({
      type: 'background-changed',
      ...next,
      hostPeerId: attachment.peerId,
    })
  }

  private readAttachment(ws: WebSocket): JamSocketAttachment | null {
    try {
      const attachment =
        ws.deserializeAttachment() as Partial<JamSocketAttachment> | null
      if (!attachment || typeof attachment.roomId !== 'string') return null
      // WebSockets accepted before this boundary shipped have peer metadata
      // but no intent. They are already established and may finish normally.
      if (attachment.peerId && attachment.connectionIntent === undefined) {
        return {
          ...attachment,
          connectionIntent: 'established',
          roomId: attachment.roomId,
        }
      }
      if (attachment.connectionIntent === undefined) return null
      return attachment as JamSocketAttachment
    } catch {
      return null
    }
  }

  /** Keep hibernated socket attachments aligned with the current host. */
  private demoteOtherHostSockets(nextHostPeerId: string): void {
    for (const peer of this.peers.values()) {
      if (peer.id === nextHostPeerId) continue
      const attachment = this.readAttachment(peer.ws)
      if (attachment?.isHost !== true) continue
      peer.ws.serializeAttachment({
        ...attachment,
        isHost: false,
      } satisfies JamSocketAttachment)
    }
  }

  private rejectSocket(ws: WebSocket, message: string): void {
    this.send(ws, { type: 'error', message })
    try {
      ws.close(1008, message)
    } catch {
      // already closing
    }
  }

  // ── Message relay ─────────────────────────────────────────────────

  private relayToPeer(
    sender: WebSocket,
    msg: { type: string; target?: string },
  ): void {
    if (!msg.target) return
    const peer = this.peers.get(msg.target)
    if (peer?.ws.readyState !== 1) return
    const senderId = this.wsToPeerId.get(sender)
    const enriched = { ...msg, from: senderId ?? '' }
    try {
      peer.ws.send(JSON.stringify(enriched))
    } catch {
      // cleanup on close
    }
  }

  private broadcast(msg: object, excludePeerId?: string): void {
    const data = JSON.stringify(msg)
    for (const [id, peer] of this.peers) {
      if (id === excludePeerId) continue
      if (peer.ws.readyState === 1) {
        try {
          peer.ws.send(data)
        } catch {
          // cleanup on close
        }
      }
    }
  }

  private send(ws: WebSocket, msg: object): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg))
    }
  }

  // ── Auto-cleanup ──────────────────────────────────────────────────

  private async checkEmpty(): Promise<void> {
    if (this.peers.size === 0) {
      await this.scheduleDelete()
    }
  }

  private async scheduleDelete(): Promise<void> {
    await scheduleRoomOwnershipExpiry(this.ownership, this.ctx.storage)
  }

  private async cancelDelete(): Promise<void> {
    await cancelRoomOwnershipExpiry(this.ownership, this.ctx.storage)
  }

  override async alarm(): Promise<void> {
    this.hydrate()
    await this.hydrateOwnership()

    // A join normally cancels the alarm. If one was already being dispatched,
    // the hydrated socket set is the final authority: an occupied room lives.
    if (this.peers.size !== 0) {
      await this.cancelDelete()
      return
    }

    try {
      await this.expireOwnership()
    } catch (error: unknown) {
      // The in-memory state and persisted deadline already fail closed. Keep a
      // cleanup alarm alive beyond Cloudflare's finite automatic retry budget.
      console.error(
        `[JamRoom ${this.roomId}] failed to delete expired room storage: ${String(error)}`,
      )
      await this.ctx.storage.setAlarm(Date.now() + 60_000)
    }
  }
}
