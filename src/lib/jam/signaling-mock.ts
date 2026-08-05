// ── Mock signaling ────────────────────────────────────────────────────
// A jam room with nobody else in it, for looking at.
//
// PR previews cannot run the signaling Durable Object, so the Jam tab is
// a dead end there: create a room and it hangs on a WebSocket that will
// never connect. A preview signaling worker would not fix it either --
// WebRTC needs two real peers, so opening a preview URL alone would still
// show an empty room. The honest thing a preview CAN demonstrate is the
// room's surface, so this fakes exactly that and nothing more.
//
// What it does: answers create-room and join-room locally, then invents a
// peer or two so the room renders populated -- badges, colours, role
// assignment, the split layout, per-peer lanes.
//
// What it deliberately does NOT do: fabricate pitch, fake a scoreboard,
// or pretend transport is in sync. Those are the claims a preview cannot
// support, and inventing them would turn a demo into a lie. The room says
// it is a preview (see jamIsPreviewRoom) so nothing on screen implies a
// second person is really there.

import type { JamCallbacks } from './types'

/** Enough of a delay that the UI's connecting state is visible, not a flash. */
const FAKE_LATENCY_MS = 350

const FAKE_PEERS = [
  { id: 'preview-peer-1', displayName: 'Ada' },
  { id: 'preview-peer-2', displayName: 'Bo' },
]

function fakeRoomId(): string {
  // Same shape as a real room code so the header, the invite modal and the
  // hosted-rooms list all render exactly as they will in production.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

/**
 * A stand-in for createSignalingClient with the same surface.
 *
 * Every method that would reach the network is a no-op that resolves
 * locally. Peers "join" on a timer so the room fills in front of you
 * rather than appearing pre-populated, which is what makes the layout
 * legible -- you see the one-peer and two-peer states.
 */
export function createMockSignalingClient(callbacks: JamCallbacks) {
  let roomId: string | null = null
  let peerId: string | null = null
  let timers: Array<ReturnType<typeof setTimeout>> = []
  let disposed = false

  function later(fn: () => void, ms: number): void {
    timers.push(setTimeout(() => !disposed && fn(), ms))
  }

  function populate(): void {
    FAKE_PEERS.forEach((peer, i) => {
      later(
        () => {
          callbacks.onPeerJoined({
            id: peer.id,
            displayName: peer.displayName,
            connectionState: 'connecting',
            latency: 0,
            hasVideo: false,
            hasAudio: true,
          })
          // Then settle, so the peer list's connecting -> connected states
          // both get exercised rather than skipped.
          later(() => {
            callbacks.onConnectionStateChange(peer.id, 'connected')
            callbacks.onLatencyUpdate(peer.id, 24 + i * 11)
          }, 600)
        },
        900 + i * 1100,
      )
    })
  }

  function createRoom(displayName: string): void {
    later(() => {
      roomId = fakeRoomId()
      peerId = 'preview-self'
      callbacks.onHostStatus?.(true)
      callbacks.onHostPeerChanged?.(peerId)
      populate()
      console.info('[jam:mock] preview room', roomId, 'as', displayName)
    }, FAKE_LATENCY_MS)
  }

  function connect(id: string, displayName: string): void {
    later(() => {
      roomId = id
      peerId = 'preview-self'
      // A joiner is not the host, which is the more interesting state to
      // look at: it hides the mode picker and the transport.
      callbacks.onHostStatus?.(false)
      callbacks.onHostPeerChanged?.(FAKE_PEERS[0]?.id ?? null)
      populate()
      console.info('[jam:mock] preview join', id, 'as', displayName)
    }, FAKE_LATENCY_MS)
  }

  function leaveRoom(): void {
    for (const peer of FAKE_PEERS) callbacks.onPeerLeft(peer.id)
    roomId = null
    peerId = null
  }

  function disconnect(): void {
    disposed = true
    for (const t of timers) clearTimeout(t)
    timers = []
    roomId = null
    peerId = null
  }

  // Nothing to negotiate with -- there is no remote end -- but the
  // signatures must match the real client exactly. A zero-argument stub
  // type-checks here and then breaks at the call site in service.ts,
  // which is the one place a mock must never diverge.
  const noop = (_target: string, _payload: string): void => {}

  function setBackground(backgroundId: string): void {
    callbacks.onBackgroundChanged?.({ backgroundId, revision: 1 })
  }

  return {
    createRoom,
    connect,
    leaveRoom,
    disconnect,
    sendOffer: noop,
    sendAnswer: noop,
    sendIceCandidate: noop,
    setBackground,
    getRoomId: () => roomId,
    getPeerId: () => peerId,
    get connecting() {
      return false
    },
  }
}
