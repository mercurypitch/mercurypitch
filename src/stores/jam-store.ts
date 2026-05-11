// ── Jam store ───────────────────────────────────────────────────────
// Reactive state management for P2P jam sessions.
// Wires together jam-service callbacks with SolidJS signals.

import { createSignal, createMemo } from 'solid-js'
import type { JamPeer } from '@/lib/jam-types'
import { createJamService } from '@/lib/jam-service'

// ── Signals ─────────────────────────────────────────────────────────

export const [jamRoomId, setJamRoomId] = createSignal<string | null>(null)
export const [jamPeerId, setJamPeerId] = createSignal<string | null>(null)
export const [jamIsHost, setJamIsHost] = createSignal(false)
export const [jamPeers, setJamPeers] = createSignal<JamPeer[]>([])
export const [jamIsMuted, setJamIsMuted] = createSignal(false)
export const [jamError, setJamError] = createSignal<string | null>(null)
export const [jamState, setJamState] = createSignal<'idle' | 'connecting' | 'active'>('idle')

// ── Derived ─────────────────────────────────────────────────────────

export const jamPeerCount = createMemo(() => jamPeers().length)
export const jamConnectedPeers = createMemo(() =>
  jamPeers().filter((p) => p.connectionState === 'connected'),
)
export const jamHasActiveRoom = createMemo(() => jamRoomId() !== null)

// ── Service instance ────────────────────────────────────────────────
// Created once per session and wired to store signals.

let jamService: ReturnType<typeof createJamService> | null = null
let remoteAudioNodes = new Map<string, MediaStreamAudioSourceNode>()
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

export function initJam() {
  if (jamService) return

  jamService = createJamService({
    onPeerJoined: (peer) => {
      setJamPeers((prev) => [...prev, peer])
    },
    onPeerLeft: (peerId) => {
      setJamPeers((prev) => prev.filter((p) => p.id !== peerId))
      // Clean up audio node
      const source = remoteAudioNodes.get(peerId)
      if (source) {
        source.disconnect()
        remoteAudioNodes.delete(peerId)
      }
    },
    onPeerStream: (peerId, stream) => {
      const ctx = getAudioContext()
      const source = ctx.createMediaStreamSource(stream)
      source.connect(ctx.destination)
      remoteAudioNodes.set(peerId, source)
    },
    onConnectionStateChange: (peerId, state) => {
      setJamPeers((prev) =>
        prev.map((p) => (p.id === peerId ? { ...p, connectionState: state } : p)),
      )
    },
    onLatencyUpdate: (peerId, latency) => {
      setJamPeers((prev) =>
        prev.map((p) => (p.id === peerId ? { ...p, latency } : p)),
      )
    },
    onRoomClosed: () => {
      cleanupJam()
    },
    onError: (message) => {
      setJamError(message)
    },
  })
}

export async function createJamRoom(displayName: string): Promise<string | null> {
  initJam()
  setJamState('connecting')
  setJamIsHost(true)
  try {
    await jamService!.createRoom(displayName)
    // Room ID is set shortly after via signaling; poll briefly
    const roomId = await waitForRoomId()
    setJamRoomId(roomId)
    setJamPeerId(jamService!.getPeerId())
    setJamState('active')
    return roomId
  } catch (err) {
    setJamError('Failed to create room')
    setJamState('idle')
    return null
  }
}

export async function joinJamRoom(
  roomId: string,
  displayName: string,
): Promise<boolean> {
  initJam()
  setJamState('connecting')
  setJamRoomId(roomId)
  setJamIsHost(false)
  try {
    await jamService!.joinRoom(roomId, displayName)
    setJamPeerId(jamService!.getPeerId())
    setJamState('active')
    return true
  } catch (err) {
    setJamError('Failed to join room')
    setJamState('idle')
    return false
  }
}

export function leaveJamRoom(): void {
  jamService?.leaveRoom()
  cleanupJam()
}

export function toggleJamMute(): void {
  const muted = !jamIsMuted()
  setJamIsMuted(muted)
  jamService?.setMuted(muted)
}

export function disposeJam(): void {
  jamService?.dispose()
  jamService = null
  cleanupJam()
}

function cleanupJam(): void {
  for (const [, source] of remoteAudioNodes) {
    source.disconnect()
  }
  remoteAudioNodes.clear()
  audioContext?.close()
  audioContext = null
  setJamRoomId(null)
  setJamPeerId(null)
  setJamIsHost(false)
  setJamPeers([])
  setJamError(null)
  setJamState('idle')
}

function waitForRoomId(): Promise<string> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      const id = jamService?.getRoomId()
      if (id) {
        clearInterval(interval)
        resolve(id)
      } else if (attempts > 20) {
        clearInterval(interval)
        reject(new Error('Timeout waiting for room ID'))
      }
    }, 250)
  })
}
