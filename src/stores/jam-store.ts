// ── Jam store ───────────────────────────────────────────────────────
// Reactive state management for P2P jam sessions.
// Wires together jam-service callbacks with SolidJS signals.

import { createMemo, createSignal } from 'solid-js'
import { createJamService } from '@/lib/jam/service'
import type {
  JamChatMessage,
  JamMelodyMessage,
  JamPeer,
  JamPlaybackMessage,
  JamPitchMessage,
  TimeStampedPitchSample,
} from '@/lib/jam/types'
import { JamPitchDetector } from '@/lib/jam/jam-pitch-detector'
import type { MelodyData } from '@/types'

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

// ── Pitch ────────────────────────────────────────────────────────────

export const [jamLocalPitch, setJamLocalPitch] = createSignal<{
  frequency: number
  noteName: string
  cents: number
  clarity: number
  midi: number
} | null>(null)

export const [jamPitchHistory, setJamPitchHistory] = createSignal<
  Record<string, TimeStampedPitchSample[]>
>({})

// ── Exercise ─────────────────────────────────────────────────────────

export const [jamExerciseMelody, setJamExerciseMelody] =
  createSignal<MelodyData | null>(null)
export const [jamExercisePlaying, setJamExercisePlaying] = createSignal(false)
export const [jamExercisePaused, setJamExercisePaused] = createSignal(false)
export const [jamExerciseBeat, setJamExerciseBeat] = createSignal(0)
export const [jamExerciseNoteIndex, setJamExerciseNoteIndex] = createSignal(-1)
export const [jamExerciseTotalBeats, setJamExerciseTotalBeats] = createSignal(0)

// ── Tab ──────────────────────────────────────────────────────────────

export const [jamPitchTab, setJamPitchTab] = createSignal<
  'pitch' | 'exercise' | 'chat'
>('pitch')

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
let pitchDetector: JamPitchDetector | null = null
let pitchNetworkInterval: ReturnType<typeof setInterval> | null = null

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
      // Clean up pitch history
      setJamPitchHistory((prev) => {
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
    onPitchMessage: (msg: JamPitchMessage) => {
      setJamPitchHistory((prev) => {
        const next = { ...prev }
        const arr = next[msg.peerId] || []
        arr.push({
          frequency: msg.frequency,
          noteName: msg.noteName,
          cents: msg.cents,
          clarity: msg.clarity,
          midi: msg.midi,
          timestamp: msg.timestamp,
        })
        // Cap at 600 samples (~30s at 20Hz)
        if (arr.length > 600) arr.splice(0, arr.length - 600)
        next[msg.peerId] = arr
        return next
      })
    },
    onMelodyMessage: (msg: JamMelodyMessage) => {
      if (msg.action === 'clear') {
        setJamExerciseMelody(null)
        setJamExerciseTotalBeats(0)
        setJamExercisePlaying(false)
        setJamExercisePaused(false)
        setJamExerciseBeat(0)
        setJamExerciseNoteIndex(-1)
      } else if (msg.melody) {
        setJamExerciseMelody(msg.melody)
        const total = msg.melody.items.reduce(
          (max, item) =>
            Math.max(max, item.startBeat + item.duration),
          0,
        )
        setJamExerciseTotalBeats(total)
        setJamExerciseBeat(0)
        setJamExerciseNoteIndex(-1)
        setJamExercisePlaying(false)
        setJamExercisePaused(false)
      }
    },
    onPlaybackMessage: (msg: JamPlaybackMessage) => {
      switch (msg.action) {
        case 'play':
          setJamExercisePlaying(true)
          setJamExercisePaused(false)
          if (msg.currentBeat !== undefined) {
            setJamExerciseBeat(msg.currentBeat)
          }
          break
        case 'pause':
          setJamExercisePaused(true)
          break
        case 'stop':
          setJamExercisePlaying(false)
          setJamExercisePaused(false)
          setJamExerciseBeat(0)
          setJamExerciseNoteIndex(-1)
          break
        case 'seek':
          if (msg.currentBeat !== undefined) {
            setJamExerciseBeat(msg.currentBeat)
          }
          break
      }
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

// ── Pitch detection ──────────────────────────────────────────────────

export function startJamPitchDetection(): void {
  if (pitchDetector) return
  const stream = jamService?.getLocalStream()
  if (!stream) return

  pitchDetector = new JamPitchDetector()
  pitchDetector.onPitch = (pitch) => {
    setJamLocalPitch({
      frequency: pitch.frequency,
      noteName: pitch.noteName,
      cents: pitch.cents,
      clarity: pitch.clarity,
      midi: pitch.midi ?? 0,
    })
  }
  pitchDetector.start(stream)

  // Throttled network sends at ~20 Hz
  pitchNetworkInterval = setInterval(() => {
    const p = jamLocalPitch()
    if (p && p.frequency > 0) {
      jamService?.sendPitch(p)
    }
  }, 50)
}

export function stopJamPitchDetection(): void {
  pitchDetector?.stop()
  pitchDetector = null
  if (pitchNetworkInterval) {
    clearInterval(pitchNetworkInterval)
    pitchNetworkInterval = null
  }
  setJamLocalPitch(null)
}

// ── Exercise actions ─────────────────────────────────────────────────

export function selectJamExercise(melody: MelodyData): void {
  jamService?.sendMelody(melody)
}

export function clearJamExercise(): void {
  jamService?.sendClearMelody()
}

export function jamPlaybackPlay(startBeat?: number): void {
  jamService?.sendPlaybackCommand('play', startBeat ?? jamExerciseBeat())
}

export function jamPlaybackPause(): void {
  jamService?.sendPlaybackCommand('pause', jamExerciseBeat())
}

export function jamPlaybackStop(): void {
  jamService?.sendPlaybackCommand('stop', 0)
}

export function jamPlaybackSeek(beat: number): void {
  jamService?.sendPlaybackCommand('seek', beat)
}

export function disposeJam(): void {
  jamService?.dispose()
  jamService = null
  cleanupJam()
}

function cleanupJam(): void {
  stopJamPitchDetection()
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
  setJamPitchHistory({})
  setJamLocalPitch(null)
  setJamExerciseMelody(null)
  setJamExercisePlaying(false)
  setJamExercisePaused(false)
  setJamExerciseBeat(0)
  setJamExerciseNoteIndex(-1)
  setJamExerciseTotalBeats(0)
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
