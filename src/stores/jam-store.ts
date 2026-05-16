// ── Jam store ───────────────────────────────────────────────────────
// Reactive state management for P2P jam sessions.
// Wires together jam-service callbacks with SolidJS signals.

import { createMemo, createSignal } from 'solid-js'
import { createJamService } from '@/lib/jam-service'
import type { JamChatMessage, JamPeer } from '@/lib/jam-types'

// ── Signals ─────────────────────────────────────────────────────────

export const [jamRoomId, setJamRoomId] = createSignal<string | null>(null)
export const [jamPeerId, setJamPeerId] = createSignal<string | null>(null)
export const [jamIsHost, setJamIsHost] = createSignal(false)
export const [jamPeers, setJamPeers] = createSignal<JamPeer[]>([])
export const [jamIsMuted, setJamIsMuted] = createSignal(false)
export const [jamError, setJamError] = createSignal<string | null>(null)
export const [jamState, setJamState] = createSignal<
  'idle' | 'connecting' | 'active'
>('idle')
export const [jamRoomToJoin, setJamRoomToJoin] = createSignal<string | null>(null)
export const [jamLocalStream, setJamLocalStream] =
  createSignal<MediaStream | null>(null)
export const [jamRemoteStreams, setJamRemoteStreams] = createSignal<
  Record<string, MediaStream>
>({})
export const [jamVideoEnabled, setJamVideoEnabled] = createSignal(true)
export const [jamChatMessages, setJamChatMessages] = createSignal<JamChatMessage[]>(
  [],
)

// ── Derived ─────────────────────────────────────────────────────────

export const jamPeerCount = createMemo(() => jamPeers().length)
export const jamConnectedPeers = createMemo(() =>
  jamPeers().filter((p) => p.connectionState === 'connected'),
)
export const jamHasActiveRoom = createMemo(() => jamRoomId() !== null)

// ── Service instance ────────────────────────────────────────────────
// Created once per session and wired to store signals.

let jamService: ReturnType<typeof createJamService> | null = null
const remoteAudioNodes = new Map<string, MediaStreamAudioSourceNode>()
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
      // Clean up remote stream
      setJamRemoteStreams((prev) => {
        const next = { ...prev }
        delete next[peerId]
        return next
      })
    },
    onPeerStream: (peerId, stream) => {
      const ctx = getAudioContext()
      const source = ctx.createMediaStreamSource(stream)
      source.connect(ctx.destination)
      remoteAudioNodes.set(peerId, source)
      // Store remote stream for video display
      setJamRemoteStreams((prev) => ({ ...prev, [peerId]: stream }))
    },
    onChatMessage: (msg) => {
      setJamChatMessages((prev) => [...prev, msg])
    },
    onConnectionStateChange: (peerId, state) => {
      setJamPeers((prev) =>
        prev.map((p) =>
          p.id === peerId ? { ...p, connectionState: state } : p,
        ),
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

export async function createJamRoom(
  displayName: string,
): Promise<string | null> {
  initJam()
  setJamState('connecting')
  setJamIsHost(true)
  try {
    await jamService!.createRoom(displayName)
    // Room ID is set shortly after via signaling; poll briefly
    const roomId = await waitForRoomId()
    setJamRoomId(roomId)
    setJamPeerId(jamService!.getPeerId())
    setJamLocalStream(jamService!.getLocalStream())
    setJamState('active')
    return roomId
  } catch (_err) {
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
    setJamLocalStream(jamService!.getLocalStream())
    setJamState('active')
    return true
  } catch (_err) {
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

export async function toggleJamVideo(): Promise<void> {
  const enabled = !jamVideoEnabled()
  setJamVideoEnabled(enabled)
  await jamService?.setVideoEnabled(enabled)
}

export function sendJamChatMessage(text: string): void {
  if (!jamService || !jamPeerId()) return
  // Local echo
  const msg: JamChatMessage = {
    id: crypto.randomUUID(),
    peerId: jamPeerId()!,
    displayName: 'You',
    text,
    timestamp: Date.now(),
  }
  setJamChatMessages((prev) => [...prev, msg])
  jamService.sendChat(text)
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
  setJamRemoteStreams({})
  setJamLocalStream(null)
  setJamChatMessages([])
  setJamVideoEnabled(true)
}

function waitForRoomId(): Promise<string> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      const id = jamService?.getRoomId()
      if (id !== null && id !== undefined) {
        clearInterval(interval)
        resolve(id)
      } else if (attempts > 20) {
        clearInterval(interval)
        reject(new Error('Timeout waiting for room ID'))
      }
    }, 250)
  })
}
