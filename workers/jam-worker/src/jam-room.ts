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

interface JamEnv {
  JAM_ROOM: DurableObjectNamespace
}

export class JamRoom extends DurableObject<JamEnv> {
  private peers: Map<string, PeerInfo> = new Map()
  private wsToPeerId: WeakMap<WebSocket, string> = new WeakMap()
  private roomId = ''
  private ownerId: string | null = null
  private deleteTimer: ReturnType<typeof setTimeout> | null = null

  // ── WebSocket upgrade ────────────────────────────────────────────

  override fetch(request: Request): Response {
    this.roomId = request.headers.get('X-Jam-Room-Id') || ''

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  // ── WebSocket message handler ─────────────────────────────────────

  override webSocketMessage(ws: WebSocket, message: string): void {
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
        this.handleJoinRoom(ws, msg as {
          type: string
          roomId: string
          displayName: string
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
    const peerId = this.wsToPeerId.get(ws)
    if (peerId) {
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

    this.ownerId = peerId

    this.peers.set(peerId, { id: peerId, displayName: msg.displayName, ws })
    this.wsToPeerId.set(ws, peerId)
    this.cancelDelete()

    this.send(ws, { type: 'room-created', roomId: this.roomId, peerId })
  }

  private handleJoinRoom(
    ws: WebSocket,
    msg: { displayName: string },
  ): void {
    const peerId = crypto.randomUUID()

    const existing = Array.from(this.peers.values()).map((p) => ({
      id: p.id,
      displayName: p.displayName,
    }))
    this.send(ws, {
      type: 'room-joined',
      roomId: this.roomId,
      peerId,
      peers: existing,
    })

    this.broadcast(
      { type: 'peer-joined', peerId, displayName: msg.displayName },
      peerId,
    )

    this.peers.set(peerId, { id: peerId, displayName: msg.displayName, ws })
    this.wsToPeerId.set(ws, peerId)
  }

  private handleLeave(ws: WebSocket): void {
    const peerId = this.wsToPeerId.get(ws)
    if (peerId) {
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
