// ── Jam store ───────────────────────────────────────────────────────
// Reactive state management for P2P jam sessions.
// Wires together jam-service callbacks with SolidJS signals.

import { createMemo, createRoot, createSignal } from 'solid-js'
import { JamPitchDetector } from '@/lib/jam/jam-pitch-detector'
import { createJamService } from '@/lib/jam/service'
import type { JamChatMessage, JamMelodyMessage, JamPeer, JamPitchMessage, JamPlaybackMessage, TimeStampedPitchSample, } from '@/lib/jam/types'
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
export const [jamRoomToJoin, setJamRoomToJoin] = createSignal<string | null>(
  null,
)
export const [jamLocalStream, setJamLocalStream] =
  createSignal<MediaStream | null>(null)
export const [jamRemoteStreams, setJamRemoteStreams] = createSignal<
  Record<string, MediaStream>
>({})
export const [jamVideoEnabled, setJamVideoEnabled] = createSignal(true)
export const [jamChatMessages, setJamChatMessages] = createSignal<
  JamChatMessage[]
>([])

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
// eslint-disable-next-line solid/reactivity
const _jamUnreadChatCount = createSignal(0)
export const jamUnreadChatCount = _jamUnreadChatCount[0]
export const setJamUnreadChatCount = _jamUnreadChatCount[1]

// ── Tab ──────────────────────────────────────────────────────────────

// eslint-disable-next-line solid/reactivity
const _jamPitchTab = createSignal<'pitch' | 'exercise'>('pitch')
export const jamPitchTab = _jamPitchTab[0]
export const setJamPitchTab = _jamPitchTab[1]

// ── Derived ─────────────────────────────────────────────────────────

export const jamPeerCount = createRoot(() => {
  const memo = createMemo(() => jamPeers().length)
  return memo
})
export const jamConnectedPeers = createRoot(() => {
  const memo = createMemo(() =>
    jamPeers().filter((p) => p.connectionState === 'connected'),
  )
  return memo
})
export const jamHasActiveRoom = createRoot(() => {
  const memo = createMemo(() => jamRoomId() !== null)
  return memo
})

// ── Service instance ────────────────────────────────────────────────
// Created once per session and wired to store signals.

let jamService: ReturnType<typeof createJamService> | null = null
const remoteAudioNodes = new Map<string, MediaStreamAudioSourceNode>()
let audioContext: AudioContext | null = null
let pitchDetector: JamPitchDetector | null = null
let pitchNetworkInterval: ReturnType<typeof setInterval> | null = null
let playbackTimerId: ReturnType<typeof requestAnimationFrame> | null = null
let playbackLastTick = 0

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
      console.info('[jam:store] onPeerJoined', peer.id, peer.displayName)
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
      setJamUnreadChatCount((prev) => prev + 1)
    },
    onConnectionStateChange: (peerId, state) => {
      console.info(
        '[jam:store] connection state change for',
        peerId,
        '=>',
        state,
      )
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
        const arr = next[msg.peerId] ?? []
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
        stopPlaybackTimer()
      } else if (msg.melody) {
        setJamExerciseMelody(msg.melody)
        const total = msg.melody.items.reduce(
          (max, item) => Math.max(max, item.startBeat + item.duration),
          0,
        )
        setJamExerciseTotalBeats(total)
        setJamExerciseBeat(0)
        setJamExerciseNoteIndex(-1)
        setJamExercisePlaying(false)
        setJamExercisePaused(false)
        stopPlaybackTimer()
        setJamPitchTab('exercise')
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
          startPlaybackTimer()
          setJamPitchTab('exercise')
          break
        case 'pause':
          setJamExercisePaused(true)
          stopPlaybackTimer()
          break
        case 'stop':
          setJamExercisePlaying(false)
          setJamExercisePaused(false)
          setJamExerciseBeat(0)
          setJamExerciseNoteIndex(-1)
          stopPlaybackTimer()
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
      console.error('[jam:store] error:', message)
      setJamError(message)
      // If we haven't reached active state yet, reset to idle
      if (jamState() === 'connecting') {
        setJamState('idle')
      }
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
  setJamError(null)
  try {
    await jamService!.joinRoom(roomId, displayName)
    // Wait for signaling handshake — peer ID arrives via room-joined
    const peerId = await waitForPeerId()
    if (peerId === null || peerId === '') {
      setJamError('Failed to join room — no response from server')
      setJamState('idle')
      return false
    }
    setJamPeerId(peerId)
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
  if (jamService === null || jamPeerId() === null) return
  // Local echo
  const msg: JamChatMessage = {
    id: globalThis.crypto.randomUUID(),
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

      const myId = jamPeerId()
      if (myId !== null && myId !== '') {
        setJamPitchHistory((prev) => {
          const next = { ...prev }
          const arr = next[myId] ?? []
          arr.push({
            ...p,
            timestamp: Date.now(),
          })
          if (arr.length > 600) arr.splice(0, arr.length - 600)
          next[myId] = arr
          return next
        })
      }
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
  // Update local state immediately (DataChannel only sends to remotes)
  setJamExerciseMelody(melody)
  const total = melody.items.reduce(
    (max, item) => Math.max(max, item.startBeat + item.duration),
    0,
  )
  setJamExerciseTotalBeats(total)
  setJamExerciseBeat(0)
  setJamExerciseNoteIndex(-1)
  setJamExercisePlaying(false)
  setJamExercisePaused(false)
  stopPlaybackTimer()
  jamService?.sendMelody(melody)
  setJamPitchTab('exercise')
}

export function clearJamExercise(): void {
  setJamExerciseMelody(null)
  setJamExerciseTotalBeats(0)
  setJamExercisePlaying(false)
  setJamExercisePaused(false)
  setJamExerciseBeat(0)
  setJamExerciseNoteIndex(-1)
  stopPlaybackTimer()
  jamService?.sendClearMelody()
}

export function jamPlaybackPlay(startBeat?: number): void {
  const ci = 4 // 4 beats count-in
  const actualStart = startBeat ?? -ci
  setJamExerciseBeat(actualStart)
  setJamExercisePlaying(true)
  setJamExercisePaused(false)
  startPlaybackTimer()
  jamService?.sendPlaybackCommand('play', actualStart)
  setJamPitchTab('exercise')
}

export function jamPlaybackPause(): void {
  setJamExercisePaused(true)
  stopPlaybackTimer()
  jamService?.sendPlaybackCommand('pause', jamExerciseBeat())
}

export function jamPlaybackStop(): void {
  setJamExercisePlaying(false)
  setJamExercisePaused(false)
  setJamExerciseBeat(0)
  setJamExerciseNoteIndex(-1)
  stopPlaybackTimer()
  jamService?.sendPlaybackCommand('stop', 0)
}

export function jamPlaybackSeek(beat: number): void {
  setJamExerciseBeat(beat)
  jamService?.sendPlaybackCommand('seek', beat)
}

// ── Playback timer ───────────────────────────────────────────────────

function startPlaybackTimer(): void {
  stopPlaybackTimer()
  playbackLastTick = performance.now()
  const melody = jamExerciseMelody()
  if (!melody) return

  const tick = () => {
    if (!jamExercisePlaying() || jamExercisePaused()) {
      playbackTimerId = null
      return
    }
    const now = performance.now()
    const delta = now - playbackLastTick
    playbackLastTick = now

    const bpm = melody.bpm
    const beatDelta = (bpm / 60) * (delta / 1000)
    const newBeat = jamExerciseBeat() + beatDelta
    const totalBeats = jamExerciseTotalBeats()

    if (newBeat >= totalBeats) {
      // Finished — stop at end
      setJamExerciseBeat(totalBeats)
      setJamExercisePlaying(false)
      setJamExercisePaused(false)
      stopPlaybackTimer()
      return
    }

    setJamExerciseBeat(newBeat)
    playbackTimerId = requestAnimationFrame(tick)
  }
  playbackTimerId = requestAnimationFrame(tick)
}

function stopPlaybackTimer(): void {
  if (playbackTimerId !== null) {
    cancelAnimationFrame(playbackTimerId)
    playbackTimerId = null
  }
}

export function disposeJam(): void {
  jamService?.dispose()
  jamService = null
  cleanupJam()
}

function cleanupJam(): void {
  stopJamPitchDetection()
  stopPlaybackTimer()
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
  setJamUnreadChatCount(0)
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

function waitForPeerId(): Promise<string | null> {
  return new Promise((resolve) => {
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      const id = jamService?.getPeerId()
      if (id !== undefined && id !== null && id !== '') {
        clearInterval(interval)
        resolve(id)
      } else if (attempts > 20) {
        clearInterval(interval)
        resolve(null)
      }
    }, 250)
  })
}
