// ── Jam signaling client ────────────────────────────────────────────
// WebSocket client that connects to the Cloudflare Durable Object
// signaling relay for SDP/ICE exchange and room lifecycle.

import type { JamCallbacks, SignalingMessage } from './types'

const SIGNALING_URL = import.meta.env.VITE_JAM_SIGNALING_URL ?? '/api/jam'

export function createSignalingClient(callbacks: JamCallbacks) {
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let currentRoomId: string | null = null
  let currentPeerId: string | null = null
  let currentDisplayName: string | null = null
  let connecting = false

  function connect(roomId: string, displayName: string): void {
    // Close any stale connection before opening a new one
    if (ws) {
      clearReconnect()
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      ws.close()
      ws = null
    }

    currentRoomId = roomId
    currentDisplayName = displayName
    connecting = true

    const url = `${SIGNALING_URL}/rooms/${roomId}/signal`
    ws = new WebSocket(url)

    ws.onopen = () => {
      connecting = false
      ws?.send(JSON.stringify({ type: 'join-room', roomId, displayName }))
    }

    ws.onmessage = (event) => {
      const msg = parseMessage(event.data)
      if (!msg) return
      handleMessage(msg)
    }

    ws.onclose = () => {
      connecting = false
      if (currentRoomId !== null && currentDisplayName !== null) {
        // Auto-reconnect after 2 seconds
        reconnectTimer = setTimeout(() => {
          if (currentRoomId !== null && currentDisplayName !== null) {
            connect(currentRoomId, currentDisplayName)
          }
        }, 2000)
      }
    }

    ws.onerror = () => {
      connecting = false
      callbacks.onError('Signaling connection failed')
    }
  }

  function createRoom(displayName: string): void {
    // Close any stale connection before opening a new one
    if (ws) {
      clearReconnect()
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      ws.close()
      ws = null
    }

    currentDisplayName = displayName
    connecting = true

    const url = `${SIGNALING_URL}/rooms/new`
    ws = new WebSocket(url)

    ws.onopen = () => {
      connecting = false
      ws?.send(JSON.stringify({ type: 'create-room', displayName }))
    }

    ws.onmessage = (event) => {
      const msg = parseMessage(event.data)
      if (!msg) return
      handleMessage(msg)
    }

    ws.onclose = () => {
      connecting = false
    }

    ws.onerror = () => {
      connecting = false
      callbacks.onError('Signaling connection failed')
    }
  }

  function handleMessage(msg: SignalingMessage): void {
    switch (msg.type) {
      case 'room-created':
        currentRoomId = msg.roomId
        currentPeerId = msg.peerId
        break

      case 'room-joined':
        currentPeerId = msg.peerId
        // Initiate connections to all peers already in the room
        for (const p of msg.peers) {
          callbacks.onPeerJoined({
            id: p.id,
            displayName: p.displayName,
            connectionState: 'connecting',
            latency: 0,
            hasVideo: false,
            hasAudio: true,
          })
        }
        break

      case 'peer-joined':
        callbacks.onPeerJoined({
          id: msg.peerId,
          displayName: msg.displayName,
          connectionState: 'connecting',
          latency: 0,
          hasVideo: false,
          hasAudio: true,
        })
        break

      case 'peer-left':
        callbacks.onPeerLeft(msg.peerId)
        break

      case 'offer':
        callbacks.onOffer?.(msg.from, msg.sdp)
        break

      case 'answer':
        callbacks.onAnswer?.(msg.from, msg.sdp)
        break

      case 'ice-candidate':
        callbacks.onIceCandidate?.(msg.from, msg.candidate)
        break

      case 'room-closed':
        callbacks.onRoomClosed()
        break

      case 'error':
        callbacks.onError(msg.message)
        break
    }
  }

  function sendSignal(msg: SignalingMessage): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  function sendOffer(target: string, sdp: string): void {
    sendSignal({ type: 'offer', target, from: currentPeerId ?? '', sdp })
  }

  function sendAnswer(target: string, sdp: string): void {
    sendSignal({ type: 'answer', target, from: currentPeerId ?? '', sdp })
  }

  function sendIceCandidate(target: string, candidate: string): void {
    sendSignal({ type: 'ice-candidate', target, from: currentPeerId ?? '', candidate })
  }

  function leaveRoom(): void {
    sendSignal({ type: 'leave-room' })
    clearReconnect()
    ws?.close()
    ws = null
    currentRoomId = null
    currentPeerId = null
    currentDisplayName = null
  }

  function clearReconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function disconnect(): void {
    clearReconnect()
    ws?.close()
    ws = null
    currentRoomId = null
    currentPeerId = null
    currentDisplayName = null
  }

  function getRoomId(): string | null {
    return currentRoomId
  }

  function getPeerId(): string | null {
    return currentPeerId
  }

  return {
    createRoom,
    connect,
    leaveRoom,
    disconnect,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    getRoomId,
    getPeerId,
    get connecting() {
      return connecting
    },
  }
}

function parseMessage(data: string): SignalingMessage | null {
  try {
    const msg = JSON.parse(data)
    if (typeof msg.type === 'string') {
      return msg as SignalingMessage
    }
    return null
  } catch {
    return null
  }
}
