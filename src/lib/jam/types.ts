// ── Jam session type definitions ────────────────────────────────────

import type { MelodyData } from '@/types'

export interface JamPeer {
  id: string
  displayName: string
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed'
  latency: number // ms, last measured RTT
  hasVideo: boolean
  hasAudio: boolean
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
  | { type: 'offer'; target: string; from: string; sdp: string }
  | { type: 'answer'; target: string; from: string; sdp: string }
  | { type: 'ice-candidate'; target: string; from: string; candidate: string }
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

// ── Chat ─────────────────────────────────────────────────────────────

export interface JamChatMessage {
  id: string
  peerId: string
  displayName: string
  text: string
  timestamp: number
}

// ── DataChannel messages (extended beyond chat) ──────────────────────

export interface JamPitchMessage {
  type: 'pitch'
  peerId: string
  frequency: number
  noteName: string
  cents: number
  clarity: number
  midi: number
  timestamp: number
}

export interface JamMelodyMessage {
  type: 'melody'
  action: 'set' | 'clear'
  melody?: MelodyData
}

export interface JamPlaybackMessage {
  type: 'playback'
  action: 'play' | 'pause' | 'stop' | 'seek'
  currentBeat?: number
  timestamp: number
}

export type JamDataMessage =
  | JamChatMessage
  | JamPitchMessage
  | JamMelodyMessage
  | JamPlaybackMessage

// ── State helpers ────────────────────────────────────────────────────

export interface TimeStampedPitchSample {
  frequency: number
  noteName: string
  cents: number
  clarity: number
  midi: number
  timestamp: number
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
  onChatMessage: (message: JamChatMessage) => void
  onRoomClosed: () => void
  onError: (message: string) => void
  // Signaling events from signaling (from = sender peerId)
  onOffer?: (from: string, sdp: string) => void
  onAnswer?: (from: string, sdp: string) => void
  onIceCandidate?: (from: string, candidate: string) => void
  // DataChannel events
  onPitchMessage?: (msg: JamPitchMessage) => void
  onMelodyMessage?: (msg: JamMelodyMessage) => void
  onPlaybackMessage?: (msg: JamPlaybackMessage) => void
}
