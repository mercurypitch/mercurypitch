// ── Jam signaling client ────────────────────────────────────────────
// WebSocket client that connects to the Cloudflare Durable Object
// signaling relay for SDP/ICE exchange and room lifecycle.

import { forgetHostedRoom, ownerTokenFor, rememberHostedRoom, touchHostedRoom, } from './jam-rooms'
import { createMockSignalingClient } from './signaling-mock'
import type { JamCallbacks, SignalingMessage } from './types'

const SIGNALING_URL = import.meta.env.VITE_JAM_SIGNALING_URL ?? '/api/jam'

function getWsUrl(path: string): string {
  if (path.startsWith('ws://') || path.startsWith('wss://')) {
    return path
  }
  if (path.startsWith('http://')) {
    return path.replace('http://', 'ws://')
  }
  if (path.startsWith('https://')) {
    return path.replace('https://', 'wss://')
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${protocol}//${host}${normalizedPath}`
}

/**
 * Is this build one where the signaling worker does not exist?
 *
 * PR previews are served without the jam worker, so the real client hangs
 * on a WebSocket that will never connect and the Jam tab is a dead end.
 * The flag is opt-in rather than "any non-production build", so a local
 * dev server with `pnpm dev:jam` running still exercises the real thing --
 * mocking that would hide the bugs this whole feature is made of.
 */
export function jamSignalingIsMocked(): boolean {
  return import.meta.env.VITE_JAM_MOCK_SIGNALING === '1'
}

export function createSignalingClient(callbacks: JamCallbacks) {
  if (jamSignalingIsMocked()) {
    return createMockSignalingClient(callbacks)
  }
  return createRealSignalingClient(callbacks)
}

function createRealSignalingClient(callbacks: JamCallbacks) {
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let currentRoomId: string | null = null
  let currentPeerId: string | null = null
  let currentDisplayName: string | null = null
  // Secret proving host on reconnect, captured from `room-created`. Kept in
  // memory so it survives WS reconnects (DO hibernation), the common re-grant
  // path; a full page reload intentionally drops it.
  let currentOwnerToken: string | null = null
  /** The secret offered on the last join, so a refusal is detectable. */
  let presentedToken: string | null = null
  // True once the DO has answered room-created or room-joined. An `error`
  // frame before that is a refusal of the join itself, not a hiccup in an
  // established session, and retrying it is pointless.
  let admitted = false
  // Consecutive failed reconnects, for backoff. A refused join used to
  // re-open the socket every 2s for ever: the 13th person to open an invite
  // to a full room was bounced to an idle lobby with no Leave button while
  // their tab hammered that room's Durable Object ~30 times a minute.
  let reconnectAttempts = 0
  let connecting = false

  /** Join a room because the user asked to. Clears the backoff: the give-up
   *  path leaves the counter at its ceiling, and a fresh, deliberate join
   *  must not inherit the previous room's exhausted budget. */
  function connect(roomId: string, displayName: string): void {
    reconnectAttempts = 0
    openSocket(roomId, displayName)
  }

  /** Open the socket without touching the backoff — the retry path. */
  function openSocket(roomId: string, displayName: string): void {
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
    admitted = false
    connecting = true

    const url = getWsUrl(`${SIGNALING_URL}/rooms/${roomId}/signal`)
    ws = new WebSocket(url)

    ws.onopen = () => {
      connecting = false
      // Fall back to the stored secret: the in-memory copy survives a
      // reconnect but not a reload or a Leave, and without it the host
      // walks back into their own room as an ordinary peer.
      const token = currentOwnerToken ?? ownerTokenFor(roomId)
      // Remembered so a refused claim can be told apart from an ordinary
      // join, which never presented anything and expects to be a guest.
      presentedToken = token ?? null
      ws?.send(
        JSON.stringify({
          type: 'join-room',
          roomId,
          displayName,
          ownerToken: token ?? undefined,
        }),
      )
    }

    ws.onmessage = (event) => {
      const msg = parseMessage(event.data)
      if (!msg) return
      handleMessage(msg)
    }

    ws.onclose = () => {
      connecting = false
      scheduleReconnect()
    }

    ws.onerror = () => {
      connecting = false
      // A WebSocket error carries no detail by design, so say what was
      // attempted and name the cause that actually bites in practice: on a
      // LAN dev server the page's self-signed certificate is accepted for
      // the document but not always for the socket, and the handshake is
      // refused before it ever reaches the server.
      console.warn('[jam:signaling] socket failed', url)
      callbacks.onError(
        url.startsWith('wss://') && !url.includes('localhost')
          ? `Could not open the room connection to ${new URL(url).host}. On a local network this is usually the certificate: open https://${new URL(url).host} directly and accept it, then try again.`
          : 'Signaling connection failed',
      )
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
    admitted = false
    reconnectAttempts = 0
    connecting = true

    const url = getWsUrl(`${SIGNALING_URL}/rooms/new`)
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
      scheduleReconnect()
    }

    ws.onerror = () => {
      connecting = false
      callbacks.onError('Signaling connection failed')
    }
  }

  function handleMessage(msg: SignalingMessage): void {
    console.info('[jam:signaling] recv', msg.type)
    switch (msg.type) {
      case 'room-created':
        admitted = true
        reconnectAttempts = 0
        currentRoomId = msg.roomId
        currentPeerId = msg.peerId
        currentOwnerToken = msg.ownerToken ?? null
        if (msg.ownerToken !== undefined && msg.ownerToken !== '') {
          rememberHostedRoom(
            msg.roomId,
            currentDisplayName ?? '',
            msg.ownerToken,
          )
        }
        callbacks.onHostStatus?.(msg.isHost)
        callbacks.onHostPeerChanged?.(msg.hostPeerId)
        if (msg.background !== undefined) {
          callbacks.onBackgroundChanged?.(msg.background)
        }
        console.info(
          '[jam:signaling] room created',
          msg.roomId,
          'peer',
          msg.peerId,
        )
        break

      case 'room-joined':
        admitted = true
        reconnectAttempts = 0
        currentPeerId = msg.peerId
        // An ownerless room adopts its first joiner, so a fresh token can
        // arrive here too -- that is how walking back into a room whose DO
        // has since been cleaned up returns the controls.
        if (msg.ownerToken !== undefined && msg.ownerToken !== '') {
          currentOwnerToken = msg.ownerToken
          rememberHostedRoom(
            msg.roomId,
            currentDisplayName ?? '',
            msg.ownerToken,
          )
        } else if (msg.isHost) {
          touchHostedRoom(msg.roomId)
        } else if (presentedToken !== null) {
          // We walked in on "rejoin as host", presented the secret, and came
          // back an ordinary peer. The token is dead: either the room was
          // empty long enough for its Durable Object to be cleaned up and
          // somebody else was adopted as owner, or this room predates the
          // worker issuing tokens at all.
          //
          // Say so and forget the entry. Leaving it in the lobby offers a
          // promise it cannot keep, and the silence was the actual
          // complaint -- you end up in the room with no controls and no idea
          // why.
          forgetHostedRoom(msg.roomId)
          callbacks.onError(
            'You are back in the room, but not as host — somebody else holds it now. Controls stay with them until the room is empty again.',
          )
        }
        callbacks.onHostStatus?.(msg.isHost)
        callbacks.onHostPeerChanged?.(msg.hostPeerId)
        if (msg.background !== undefined) {
          callbacks.onBackgroundChanged?.(msg.background)
        }
        console.info(
          '[jam:signaling] room joined, peer',
          msg.peerId,
          'isHost:',
          msg.isHost,
          'peers in room:',
          msg.peers.length,
        )
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
        console.info('[jam:signaling] peer joined', msg.peerId)
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
        console.info('[jam:signaling] peer left', msg.peerId)
        callbacks.onPeerLeft(msg.peerId)
        break

      case 'offer':
        console.info('[jam:signaling] offer from', msg.from)
        callbacks.onOffer?.(msg.from, msg.sdp)
        break

      case 'answer':
        console.info('[jam:signaling] answer from', msg.from)
        callbacks.onAnswer?.(msg.from, msg.sdp)
        break

      case 'ice-candidate':
        callbacks.onIceCandidate?.(msg.from, msg.candidate)
        break

      case 'background-changed':
        callbacks.onHostPeerChanged?.(msg.hostPeerId)
        callbacks.onBackgroundChanged?.({
          backgroundId: msg.backgroundId,
          revision: msg.revision,
        })
        break

      case 'host-changed':
        callbacks.onHostPeerChanged?.(msg.hostPeerId)
        break

      case 'room-closed':
        console.info('[jam:signaling] room closed')
        callbacks.onRoomClosed()
        break

      case 'error':
        console.info('[jam:signaling] error', msg.message)
        // Refused before admission — a full room, a duplicate room id, a
        // rejected signaling sequence. The DO will refuse the identical join
        // again, so forget the room and let onclose find nothing to re-arm.
        if (!admitted) {
          clearReconnect()
          currentRoomId = null
          currentDisplayName = null
        }
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
    sendSignal({
      type: 'ice-candidate',
      target,
      from: currentPeerId ?? '',
      candidate,
    })
  }

  function setBackground(backgroundId: string): void {
    sendSignal({ type: 'set-background', backgroundId })
  }

  function leaveRoom(): void {
    sendSignal({ type: 'leave-room' })
    clearReconnect()
    if (ws) {
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      ws.close()
      ws = null
    }
    currentRoomId = null
    currentPeerId = null
    currentDisplayName = null
    currentOwnerToken = null
    admitted = false
    reconnectAttempts = 0
  }

  function clearReconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const RECONNECT_BASE_MS = 2000
  const RECONNECT_MAX_MS = 30_000
  const RECONNECT_MAX_ATTEMPTS = 8

  /** Re-arm the socket, backing off and eventually giving up. */
  function scheduleReconnect(): void {
    if (currentRoomId === null || currentDisplayName === null) return
    if (reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      console.info('[jam:signaling] giving up after', reconnectAttempts)
      callbacks.onError('Lost the room. Rejoin to try again.')
      currentRoomId = null
      currentDisplayName = null
      return
    }
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** reconnectAttempts,
      RECONNECT_MAX_MS,
    )
    reconnectAttempts += 1
    reconnectTimer = setTimeout(() => {
      if (currentRoomId !== null && currentDisplayName !== null) {
        openSocket(currentRoomId, currentDisplayName)
      }
    }, delay)
  }

  function disconnect(): void {
    clearReconnect()
    if (ws) {
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      ws.close()
      ws = null
    }
    currentRoomId = null
    currentPeerId = null
    currentDisplayName = null
    currentOwnerToken = null
    admitted = false
    reconnectAttempts = 0
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
    setBackground,
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
