// ── Jam session type definitions ────────────────────────────────────

export interface JamPeer {
  id: string
  displayName: string
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed'
  latency: number // ms, last measured RTT
}

export interface JamRoom {
  roomId: string
  ownerId: string
  peers: JamPeer[]
  createdAt: number
}

// ── Signaling protocol messages ─────────────────────────────────────
// All messages are JSON-serializable with a "type" discriminator.

export type SignalingMessage =
  | { type: 'create-room'; displayName: string }
  | { type: 'room-created'; roomId: string; peerId: string }
  | { type: 'join-room'; roomId: string; displayName: string }
  | {
      type: 'room-joined'
      roomId: string
      peerId: string
      peers: Array<{ id: string; displayName: string }>
    }
  | { type: 'peer-joined'; peerId: string; displayName: string }
  | { type: 'peer-left'; peerId: string }
  | { type: 'offer'; target: string; sdp: string }
  | { type: 'answer'; target: string; sdp: string }
  | { type: 'ice-candidate'; target: string; candidate: string }
  | { type: 'leave-room' }
  | { type: 'error'; message: string }
  | { type: 'room-closed' }

// ── Store shape ─────────────────────────────────────────────────────

export interface JamState {
  roomId: string | null
  peerId: string | null
  isHost: boolean
  peers: JamPeer[]
  localStream: MediaStream | null
  isMuted: boolean
  latency: Record<string, number> // peerId → ms
}

// ── Service callbacks ────────────────────────────────────────────────

export interface JamCallbacks {
  onPeerJoined: (peer: JamPeer) => void
  onPeerLeft: (peerId: string) => void
  onPeerStream: (peerId: string, stream: MediaStream) => void
  onConnectionStateChange: (
    peerId: string,
    state: JamPeer['connectionState'],
  ) => void
  onLatencyUpdate: (peerId: string, latency: number) => void
  onRoomClosed: () => void
  onError: (message: string) => void
  // Signaling events from jam-signaling
  onOffer?: (target: string, sdp: string) => void
  onAnswer?: (target: string, sdp: string) => void
  onIceCandidate?: (target: string, candidate: string) => void
}
