// ── JamRoom Durable Object ──────────────────────────────────────────
// Manages room state and relays signaling messages between peers.
// Uses WebSocket Hibernation API for efficient resource usage.

import { DurableObject } from 'cloudflare:workers'

interface PeerInfo {
  id: string
  displayName: string
  ws: WebSocket
}

const GRACE_PERIOD_MS = 5 * 60 * 1000 // 5 min after last peer leaves
const MAX_PEERS = 12 // occupancy cap per room (bounds an unauthenticated channel)
const MSG_RATE_LIMIT = 120 // max messages per window, per connection
const MSG_RATE_WINDOW_MS = 1000

interface JamEnv {
  JAM_ROOM: DurableObjectNamespace
}

export class JamRoom extends DurableObject<JamEnv> {
  private peers: Map<string, PeerInfo> = new Map()
  private wsToPeerId: WeakMap<WebSocket, string> = new WeakMap()
  private roomId = ''
  private ownerId: string | null = null
  private ownerName: string | null = null
  private ownerToken: string | null = null
  private deleteTimer: ReturnType<typeof setTimeout> | null = null
  private isHydrated = false
  private msgRate: WeakMap<WebSocket, { windowStart: number; count: number }> =
    new WeakMap()

  private hydrate(): void {
    if (this.isHydrated) return
    this.isHydrated = true
    this.peers.clear()
    this.wsToPeerId = new WeakMap()
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const attachment = ws.deserializeAttachment() as { peerId?: string, displayName?: string, roomId?: string } | null
        if (attachment && attachment.peerId) {
          if (!this.roomId && attachment.roomId) this.roomId = attachment.roomId
          this.peers.set(attachment.peerId, {
            id: attachment.peerId,
            displayName: attachment.displayName || '',
            ws
          })
          this.wsToPeerId.set(ws, attachment.peerId)
        }
      } catch {
        // ignore
      }
    }
  }

  // ── WebSocket upgrade ────────────────────────────────────────────

  override fetch(request: Request): Response {
    this.hydrate()
    this.roomId = request.headers.get('X-Jam-Room-Id') || ''

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  // ── WebSocket message handler ─────────────────────────────────────

  override webSocketMessage(ws: WebSocket, message: string): void {
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
      msg = JSON.parse(message)
    } catch {
      return
    }

    switch (msg.type) {
      case 'create-room':
        this.handleCreateRoom(ws, msg as { type: string; displayName: string })
        break
      case 'join-room':
        void this.handleJoinRoom(ws, msg as {
          type: string
          roomId: string
          displayName: string
          ownerToken?: string
        })
        break
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.relayToPeer(ws, msg as { type: string; target?: string })
        break
      case 'leave-room':
        this.handleLeave(ws)
        break
    }
  }

  // ── WebSocket close / error ───────────────────────────────────────

  override webSocketClose(ws: WebSocket): void {
    this.hydrate()
    const peerId = this.wsToPeerId.get(ws)
    if (peerId) {
      const peer = this.peers.get(peerId)
      console.log(`[JamRoom ${this.roomId}] ${peer?.displayName || 'Anonymous'} disconnected (${peerId}). Remaining peers: ${this.peers.size - 1}`)
      this.peers.delete(peerId)
      this.wsToPeerId.delete(ws)
      this.broadcast({ type: 'peer-left', peerId }, peerId)
    }
    this.checkEmpty()
  }

  override webSocketError(_ws: WebSocket, _error: unknown): void {
    // webSocketClose fires after this, cleanup is handled there
  }

  // ── Room lifecycle ────────────────────────────────────────────────

  private handleCreateRoom(
    ws: WebSocket,
    msg: { displayName: string },
  ): void {
    const peerId = crypto.randomUUID()
    const ownerToken = crypto.randomUUID()

    this.ownerId = peerId
    this.ownerName = msg.displayName
    this.ownerToken = ownerToken
    void this.ctx.storage.put('ownerName', msg.displayName)
    void this.ctx.storage.put('ownerToken', ownerToken)

    ws.serializeAttachment({ peerId, displayName: msg.displayName, roomId: this.roomId })
    this.peers.set(peerId, { id: peerId, displayName: msg.displayName, ws })
    this.wsToPeerId.set(ws, peerId)
    this.cancelDelete()

    console.log(`[JamRoom ${this.roomId}] Room created by ${msg.displayName || 'Anonymous'} (${peerId})`)

    // ownerToken is the secret that proves host on reconnect — returned once,
    // and never derived from the (publicly broadcast) display name.
    this.send(ws, { type: 'room-created', roomId: this.roomId, peerId, isHost: true, ownerToken })
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

    const peerId = crypto.randomUUID()

    const existing = Array.from(this.peers.values()).map((p) => ({
      id: p.id,
      displayName: p.displayName,
    }))
    // Host is proven by the secret ownerToken issued at creation — NOT by the
    // (publicly broadcast) display name, which any peer can read and replay.
    // Load it from storage in case the DO hibernated and lost in-memory state.
    if (this.ownerToken === null) {
      const stored = await this.ctx.storage.get<string>('ownerToken')
      if (stored !== undefined) this.ownerToken = stored
    }
    const isHost =
      this.ownerToken !== null &&
      typeof msg.ownerToken === 'string' &&
      msg.ownerToken === this.ownerToken
    if (isHost) this.ownerId = peerId
    console.log(`[JamRoom ${this.roomId}] host check: incoming="${msg.displayName}" isHost=${isHost}`)
    this.send(ws, {
      type: 'room-joined',
      roomId: this.roomId,
      peerId,
      isHost,
      peers: existing,
    })

    console.log(`[JamRoom ${this.roomId}] ${msg.displayName || 'Anonymous'} joined (${peerId}). Total peers: ${this.peers.size + 1}`)

    this.broadcast(
      { type: 'peer-joined', peerId, displayName: msg.displayName },
      peerId,
    )

    ws.serializeAttachment({ peerId, displayName: msg.displayName, roomId: this.roomId })
    this.peers.set(peerId, { id: peerId, displayName: msg.displayName, ws })
    this.wsToPeerId.set(ws, peerId)
  }

  private handleLeave(ws: WebSocket): void {
    const peerId = this.wsToPeerId.get(ws)
    if (peerId) {
      const peer = this.peers.get(peerId)
      console.log(`[JamRoom ${this.roomId}] ${peer?.displayName || 'Anonymous'} left (${peerId}). Remaining peers: ${this.peers.size - 1}`)
      this.peers.delete(peerId)
      this.wsToPeerId.delete(ws)
      this.broadcast({ type: 'peer-left', peerId }, peerId)
    }
    this.checkEmpty()
  }

  // ── Message relay ─────────────────────────────────────────────────

  private relayToPeer(sender: WebSocket, msg: { type: string; target?: string }): void {
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

  private checkEmpty(): void {
    if (this.peers.size === 0) {
      this.scheduleDelete()
    }
  }

  private scheduleDelete(): void {
    this.cancelDelete()
    this.deleteTimer = setTimeout(() => {
      this.ctx.storage.deleteAll()
    }, GRACE_PERIOD_MS)
  }

  private cancelDelete(): void {
    if (this.deleteTimer) {
      clearTimeout(this.deleteTimer)
      this.deleteTimer = null
    }
  }
}
