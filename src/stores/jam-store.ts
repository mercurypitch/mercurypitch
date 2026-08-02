// ── Jam store ───────────────────────────────────────────────────────
// Reactive state management for P2P jam sessions.
// Wires together jam-service callbacks with SolidJS signals.

import { createMemo, createRoot, createSignal } from 'solid-js'
import { jamRunSource } from '@/lib/jam/jam-catalog'
import type { JamRoomMode } from '@/lib/jam/jam-modes'
import { roleCountFor, roleIndexOf, roleNameFor, targetForRole, } from '@/lib/jam/jam-modes'
import { JamPitchDetector } from '@/lib/jam/jam-pitch-detector'
import type { JamRunScore } from '@/lib/jam/jam-scoring'
import { scoreOwnJamRun } from '@/lib/jam/jam-scoring'
import type { JamSong } from '@/lib/jam/jam-song'
import { secondsInFlight, songPlayableInRoom } from '@/lib/jam/jam-song'
import { createJamService } from '@/lib/jam/service'
import type { JamChatMessage, JamMelodyMessage, JamPeer, JamPitchMessage, JamPlaybackMessage, TimeStampedPitchSample, } from '@/lib/jam/types'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import type { MelodyData } from '@/types'

// ── SessionStorage keys for auto-rejoin on page reload ──────────────
const SS_ROOM_ID = 'jam:roomId'
const SS_DISPLAY_NAME = 'jam:displayName'

function saveJamSession(roomId: string, displayName: string): void {
  try {
    sessionStorage.setItem(SS_ROOM_ID, roomId)
    sessionStorage.setItem(SS_DISPLAY_NAME, displayName)
  } catch {
    /* storage full or unavailable */
  }
}

function clearJamSession(): void {
  try {
    sessionStorage.removeItem(SS_ROOM_ID)
    sessionStorage.removeItem(SS_DISPLAY_NAME)
  } catch {
    /* ignore */
  }
}

export function getJamSessionInfo(): {
  roomId: string
  displayName: string
} | null {
  try {
    const roomId = sessionStorage.getItem(SS_ROOM_ID)
    const displayName = sessionStorage.getItem(SS_DISPLAY_NAME)
    if (
      roomId !== null &&
      roomId !== '' &&
      displayName !== null &&
      displayName !== ''
    )
      return { roomId, displayName }
  } catch {
    /* ignore */
  }
  return null
}

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
export const [jamVideoEnabled, setJamVideoEnabled] = createSignal(false)
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
export const [jamExerciseLoop, setJamExerciseLoop] = createSignal(false)
/** Host-overridden BPM; initialised from melody.bpm on selectJamExercise. */
export const [jamExerciseBpm, setJamExerciseBpm] = createSignal(120)

export interface JamExerciseResult {
  id: string
  melodyName: string
  timestamp: number
  scores: Array<{
    peerId: string
    name: string
    color: string
    accuracy: number
  }>
}

// Load persisted exercise history from sessionStorage
function loadExerciseHistory(): JamExerciseResult[] {
  try {
    const raw = sessionStorage.getItem('jam:exerciseHistory')
    if (raw !== null && raw !== '')
      return JSON.parse(raw) as JamExerciseResult[]
  } catch {
    /* ignore */
  }
  return []
}

function saveExerciseHistory(history: JamExerciseResult[]): void {
  try {
    sessionStorage.setItem('jam:exerciseHistory', JSON.stringify(history))
  } catch {
    /* storage full */
  }
}

const [_jamExerciseHistory, _setJamExerciseHistory] = createSignal<
  JamExerciseResult[]
>(loadExerciseHistory())

export const jamExerciseHistory = _jamExerciseHistory
export function setJamExerciseHistory(
  updater:
    | JamExerciseResult[]
    | ((prev: JamExerciseResult[]) => JamExerciseResult[]),
): void {
  if (typeof updater === 'function') {
    _setJamExerciseHistory((prev) => {
      const next = updater(prev)
      saveExerciseHistory(next)
      return next
    })
  } else {
    _setJamExerciseHistory(updater)
    saveExerciseHistory(updater)
  }
}

// eslint-disable-next-line solid/reactivity
const _jamUnreadChatCount = createSignal(0)
export const jamUnreadChatCount = _jamUnreadChatCount[0]
export const setJamUnreadChatCount = _jamUnreadChatCount[1]

// ── Room glass ───────────────────────────────────────────────────────
// How solid the room's UI surfaces are over the rehearsal-room backdrop:
// 1 = opaque, 0.05 = almost pure photo. JamPage writes it to --jam-alpha
// and every jam surface resolves its background from there, so the header
// slider rethemes the whole room in one move.
//
// A display preference, not session state -- persisted across reloads and
// deliberately NOT reset by cleanupJam().

const LS_ROOM_ALPHA = 'pitchperfect_jam_alpha'
const ROOM_ALPHA_MIN = 0.05
const ROOM_ALPHA_MAX = 1
/** 70% transparent: the backdrop is the point of the room. */
const ROOM_ALPHA_DEFAULT = 0.3

function loadRoomAlpha(): number {
  try {
    const v = Number(localStorage.getItem(LS_ROOM_ALPHA))
    if (v >= ROOM_ALPHA_MIN && v <= ROOM_ALPHA_MAX) return v
  } catch {
    /* localStorage unavailable */
  }
  return ROOM_ALPHA_DEFAULT
}

const [_jamRoomAlpha, _setJamRoomAlpha] = createSignal(loadRoomAlpha())

export const jamRoomAlpha = _jamRoomAlpha

export function setJamRoomAlpha(value: number): void {
  const clamped = Math.min(
    ROOM_ALPHA_MAX,
    Math.max(
      ROOM_ALPHA_MIN,
      Number.isFinite(value) ? value : ROOM_ALPHA_DEFAULT,
    ),
  )
  _setJamRoomAlpha(clamped)
  try {
    localStorage.setItem(LS_ROOM_ALPHA, String(clamped))
  } catch {
    /* storage full or unavailable */
  }
}

// ── Song ─────────────────────────────────────────────────────────────
// A room running a SONG rather than a drill. The two are mutually
// exclusive: a song has lyrics pinned to seconds and no useful bar
// number, a drill has a tempo and a grid, and mixing the coordinates is
// how you get a playhead that is subtly wrong all the time. Loading one
// clears the other.

export const [jamSong, setJamSong] = createSignal<JamSong | null>(null)
/** Position in the song's own timeline. Meaningless with no song loaded. */
export const [jamSongPositionSec, setJamSongPositionSec] = createSignal(0)

/** True when the room is on a song, which is what the layout switches on. */
export const jamIsSongRoom = createRoot(() => {
  const memo = createMemo(() => jamSong() !== null)
  return memo
})

/**
 * Load a song for the room, or refuse it with a reason.
 *
 * Refusing here rather than at play time is deliberate: a song only half
 * the room can fetch would leave everyone else staring at a silent screen
 * with nothing to explain it -- the same failure Relay's empty parts had.
 */
export function selectJamSong(song: JamSong): boolean {
  // Peer count matters: a song only this device holds is fine alone and a
  // problem once somebody is waiting to hear it. Passing 0 by omission
  // meant the refusal could never fire, whoever was in the room.
  const verdict = songPlayableInRoom(song, jamConnectedPeers().length)
  if (!verdict.ok) {
    setJamError(verdict.reason ?? 'That song cannot be played in a room.')
    return false
  }
  // A room runs one thing at a time.
  setJamExerciseMelody(null)
  setJamExerciseTotalBeats(0)
  setJamExercisePlaying(false)
  setJamExercisePaused(false)
  stopPlaybackTimer()

  setJamSong(song)
  setJamSongPositionSec(0)
  setJamError(null)
  jamService?.sendSong({
    id: song.id,
    title: song.title,
    artist: song.artist,
    stems: song.stems,
    lines: song.lines,
    // Notes travel even when the audio cannot: kilobytes, and they are
    // what lets a peer see the target for a song only the host holds.
    notes: song.notes,
    durationSec: song.durationSec,
  })
  return true
}

export function clearJamSong(): void {
  setJamSong(null)
  setJamSongPositionSec(0)
  jamService?.sendSong(null)
}

// ── Room mode ────────────────────────────────────────────────────────
// What the room does with the shared melody (see lib/jam/jam-modes.ts).
// The host owns it, exactly as it owns the melody and the tempo.

export const [jamRoomMode, setJamRoomMode] = createSignal<JamRoomMode>('unison')

/** Host-only: switch mode and re-broadcast the melody it reshapes. */
export function selectJamRoomMode(mode: JamRoomMode): void {
  setJamRoomMode(mode)
  const melody = jamExerciseMelody()
  if (melody !== null) jamService?.sendMelody(melody, mode)
}

/**
 * How the room is split right now, and where I sit in it.
 *
 * Everyone computes this from the same sorted peer list, so no part
 * assignment is ever sent -- see jam-modes.ts. Counting myself among the
 * peers matters: jamPeers() holds the OTHERS, so a duet is two.
 */
export const jamMyRole = createRoot(() => {
  const memo = createMemo(() => {
    const mode = jamRoomMode()
    const ids = jamPeers().map((p) => p.id)
    const myId = jamPeerId()
    if (myId !== null && myId !== '') ids.push(myId)
    const roleCount = roleCountFor(mode, ids.length)
    const index = roleIndexOf(myId, ids)
    return {
      mode,
      index,
      roleCount,
      name: roleNameFor(mode, index, roleCount),
      /** True when the mode is doing nothing yet -- alone, or in unison. */
      isUnison: roleCount <= 1,
    }
  })
  return memo
})

/**
 * My part, as notes. The canvas draws this and the scorer scores it, so a
 * mode only has to answer "what are MY notes" and the piano roll, the MIDI
 * range, the per-note scoring and the take chip all follow.
 */
/**
 * The part the room would assign right now, before a take pins it down.
 *
 * Reactive on the peer list, which is correct between takes and wrong
 * during one -- hence jamMyTarget below.
 */
const jamLiveTarget = createRoot(() => {
  const memo = createMemo(() => {
    const role = jamMyRole()
    return targetForRole(
      jamExerciseMelody(),
      role.mode,
      role.index,
      role.roleCount,
    )
  })
  return memo
})

/**
 * The part frozen for the take in progress, if there is one.
 *
 * Roles come from the sorted peer list, so somebody joining or leaving
 * re-derives them -- which is right between takes and wrong during one. Mid
 * take it would rewrite the notes under a singer already singing, and then
 * score their samples against a part they never saw. In Harmony Stack that
 * is a near-zero for doing nothing wrong.
 *
 * So a take captures its target when it starts and keeps it. The new
 * assignment applies from the next take, which is when the room can
 * actually act on it.
 */
const [takeTarget, setTakeTarget] = createSignal<MelodyData | null>(null)

export const jamMyTarget = createRoot(() => {
  const memo = createMemo(() => takeTarget() ?? jamLiveTarget())
  return memo
})

// ── Own run score ────────────────────────────────────────────────────
// What the last take was actually worth, scored the way the solo exercises
// score theirs (see lib/jam/jam-scoring.ts) rather than by the canvas's
// rolling hit-rate HUD. Computed from THIS device's own samples only --
// the DataChannel is an unauthenticated relay, so a peer's stream may draw
// their trail but must never become anyone's record.

export const [jamOwnRunScore, setJamOwnRunScore] =
  createSignal<JamRunScore | null>(null)

/** Local receive time the current pass began; 0 when none is running. */
let passStartedAt = 0
/** When the session of passes began -- survives a loop wrapping round. */
let sessionStartedAt = 0
/** Best pass of the current session, which is what gets credited. */
let sessionBest: JamRunScore | null = null

/**
 * Score the pass that just ended and show it.
 *
 * Idempotent, because the paths that end a pass overlap: the host both
 * stops locally and broadcasts a stop it will not receive, while peers only
 * ever see the broadcast.
 */
function settleOwnRun(): void {
  if (passStartedAt === 0) return
  const startedAt = passStartedAt
  passStartedAt = 0
  const result = scoreOwnJamRun(
    jamMyTarget(),
    jamPitchHistory(),
    jamPeerId(),
    startedAt,
  )
  // Nothing sung at all is not a pass worth showing.
  if (result.coverage === 0) return
  setJamOwnRunScore(result)
  if (sessionBest === null || result.score > sessionBest.score) {
    sessionBest = result
  }
}

/**
 * A loop wrapped: the pass that just finished is scored and shown, and a
 * fresh one opens, but the SESSION continues -- so nothing is credited.
 * See creditOwnRun for why that distinction matters.
 */
export function wrapOwnRun(): void {
  settleOwnRun()
  // Deliberately does NOT re-pin: a looped run is one continuous take, and
  // letting the part change between wraps is the same bug in slow motion.
  passStartedAt = Date.now()
}

/** Open a fresh pass: later samples belong to it, earlier ones do not. */
function beginOwnRun(): void {
  passStartedAt = Date.now()
  if (sessionStartedAt === 0) sessionStartedAt = Date.now()
  // Pin the part for the duration of the take -- see jamMyTarget.
  setTakeTarget(jamLiveTarget())
}

/**
 * Credit the session that just finished to practice history -- once.
 *
 * The unit of credit is the SESSION, not the pass. A looping room wraps
 * every few seconds, and recordExerciseResult does far more than append a
 * row: it auto-advances the daily routine, counts a finished run for the
 * survey gate, and credits practice minutes. Firing that per wrap would
 * inflate all three, which is exactly the double-count its own header
 * warns about. So passes update the on-screen score and only stopping
 * (or the melody running out) credits anything -- with the best pass as
 * the score and the whole session's wall time as the minutes.
 *
 * Only runs that came from the exercise or Ascent shelf can be credited,
 * because only those are a drill with an ExerciseType. Two shelves are
 * deliberately left out:
 *
 *   - a saved melody of your own is not an exercise, and there is no
 *     honest type to file it under.
 *   - the weekly could arm a real board attempt, and deliberately does
 *     not. recordWeeklyAttempt only fires for an attempt armed from the
 *     Challenges hero, and that path ends by calling setActiveTab
 *     (weekly-attempt.ts) -- so arming from here would throw the singer
 *     out of a live room, mid-session, while everyone else waits. Attempts
 *     stay an explicit act on the Challenges tab; jamming the weekly is
 *     practice.
 */
const MIN_CREDITED_SESSION_MS = 3_000

function creditOwnRun(): void {
  setTakeTarget(null)
  const startedAt = sessionStartedAt
  const best = sessionBest
  sessionStartedAt = 0
  sessionBest = null

  if (startedAt === 0 || best === null) return
  const durationMs = Date.now() - startedAt
  // A stray start-stop is not practice.
  if (durationMs < MIN_CREDITED_SESSION_MS) return

  const { exerciseType } = jamRunSource(jamExerciseMelody()?.id)
  if (exerciseType === undefined) return

  recordExerciseResult({
    type: exerciseType,
    score: best.score,
    metrics: {
      durationMs,
      coverage: best.coverage,
      notes: best.notes.length,
      // So a look through history can tell a room run from a solo one.
      jam: 1,
    },
    completedAt: Date.now(),
  })
}

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

/**
 * How far the room moved on while a transport command was in the air.
 *
 * A `play` at beat 0 does not arrive at beat 0 -- it arrives one-way-latency
 * later, and a peer that starts at the number in the message is permanently
 * that far behind the sender. RTT is already measured per peer for the
 * latency readout, so half of it is the flight time, and multiplying by
 * beats-per-second turns it into the correction.
 *
 * Clamped: a stale or absurd RTT reading should nudge the playhead, never
 * throw it into the middle of the melody.
 */
const MAX_FLIGHT_MS = 500

function beatsInFlight(fromPeerId: string): number {
  const peer = jamPeers().find((p) => p.id === fromPeerId)
  const rtt = peer?.latency ?? 0
  if (!Number.isFinite(rtt) || rtt <= 0) return 0
  const oneWayMs = Math.min(rtt, MAX_FLIGHT_MS) / 2
  return (jamExerciseBpm() / 60) * (oneWayMs / 1000)
}

export function initJam() {
  if (jamService) return

  jamService = createJamService({
    onPeerJoined: (peer) => {
      console.info('[jam:store] onPeerJoined', peer.id, peer.displayName)
      setJamPeers((prev) => [...prev, peer])
      // State sync is handled via DataChannel onopen in service.ts now
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
      const existing = remoteAudioNodes.get(peerId)
      if (existing) {
        try {
          existing.disconnect()
        } catch (_e) {
          // ignore if already disconnected
        }
      }
      const ctx = getAudioContext()
      const source = ctx.createMediaStreamSource(stream)
      source.connect(ctx.destination)
      remoteAudioNodes.set(peerId, source)
      // Store remote stream for video display
      // (When tracks are added to the existing stream, the browser automatically updates video elements playing it)
      setJamRemoteStreams((prev) => ({ ...prev, [peerId]: stream }))
    },
    onVideoState: (peerId, enabled) => {
      setJamPeers((prev) =>
        prev.map((p) => (p.id === peerId ? { ...p, hasVideo: enabled } : p)),
      )
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
          // Receive time, not msg.timestamp. The sender's clock is not
          // comparable to ours, but "when did this device see it" is, and
          // that is all timestamp is used for now that beat carries the
          // musical position: telling this take's samples from the last.
          timestamp: Date.now(),
          ...(msg.beat === undefined ? {} : { beat: msg.beat }),
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
        if (msg.mode !== undefined) setJamRoomMode(msg.mode)
        setJamExerciseMelody(msg.melody)
        // Adopt the melody's tempo exactly as selectJamExercise does on the
        // host. Without this a peer kept whatever bpm it last had (120 by
        // default) and ran its playhead at a different speed from the room.
        setJamExerciseBpm(msg.melody.bpm)
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
    onSongMessage: (msg) => {
      if (msg.action === 'clear' || msg.song === undefined) {
        setJamSong(null)
        setJamSongPositionSec(0)
        return
      }
      // Peers trust the host's manifest but still resolve the audio
      // themselves -- nothing but URLs and lyrics crossed the wire.
      setJamExerciseMelody(null)
      setJamExercisePlaying(false)
      setJamExercisePaused(false)
      stopPlaybackTimer()
      setJamSong({ ...msg.song, notes: msg.song.notes ?? [], origin: 'url' })
      setJamSongPositionSec(0)
    },
    onPlaybackMessage: (msg: JamPlaybackMessage, fromPeerId: string) => {
      // Every transport command is a tempo resync point (see
      // JamPlaybackMessage.bpm), so adopt it before anything reads the bpm.
      if (msg.bpm !== undefined && msg.bpm > 0) setJamExerciseBpm(msg.bpm)

      // A song carries positionSec INSTEAD of currentBeat. Same flight
      // compensation, simpler units -- no tempo to convert through.
      if (msg.positionSec !== undefined) {
        const peer = jamPeers().find((p) => p.id === fromPeerId)
        const ahead = secondsInFlight(peer?.latency ?? 0)
        switch (msg.action) {
          case 'play':
            setJamExercisePlaying(true)
            setJamExercisePaused(false)
            setJamSongPositionSec(msg.positionSec + ahead)
            break
          case 'pause':
            setJamExercisePaused(true)
            setJamSongPositionSec(msg.positionSec)
            break
          case 'stop':
            setJamExercisePlaying(false)
            setJamExercisePaused(false)
            setJamSongPositionSec(0)
            break
          case 'seek':
            setJamSongPositionSec(msg.positionSec + ahead)
            break
        }
        return
      }

      switch (msg.action) {
        case 'play':
          setJamExercisePlaying(true)
          setJamExercisePaused(false)
          if (msg.currentBeat !== undefined) {
            setJamExerciseBeat(msg.currentBeat + beatsInFlight(fromPeerId))
          }
          beginOwnRun()
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
          settleOwnRun()
          creditOwnRun()
          break
        case 'seek':
          if (msg.currentBeat !== undefined) {
            setJamExerciseBeat(msg.currentBeat + beatsInFlight(fromPeerId))
          }
          break
      }
    },
    onRoomClosed: () => {
      cleanupJam()
    },
    onHostStatus: (isHost) => {
      console.info('[jam:store] host status from server:', isHost)
      setJamIsHost(isHost)
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
  try {
    await jamService!.createRoom(displayName)
    // Room ID is set shortly after via signaling; poll briefly
    const roomId = await waitForRoomId()
    setJamRoomId(roomId)
    setJamPeerId(jamService!.getPeerId())
    setJamLocalStream(jamService!.getLocalStream())
    setJamState('active')
    saveJamSession(roomId, displayName)
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
  setJamError(null)
  try {
    await jamService!.joinRoom(roomId, displayName)
    // Wait for signaling handshake — peer ID arrives via room-joined
    const peerId = await waitForPeerId()
    if (peerId === null || peerId === '') {
      // Do not clobber a specific diagnosis. The socket reports its own
      // failure immediately; this timeout fires five seconds later, and
      // overwriting made every failure look like an unreachable server
      // when the real one was usually the connection never opening.
      if (jamError() === null) {
        setJamError('Failed to join room — no response from server')
      }
      setJamState('idle')
      return false
    }
    setJamPeerId(peerId)
    setJamLocalStream(jamService!.getLocalStream())
    setJamState('active')
    saveJamSession(roomId, displayName)
    return true
  } catch (_err) {
    if (jamError() === null) setJamError('Failed to join room')
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

/** Latest RMS mic input level (0–1) for mic-feedback insights; 0 when off. */
export function jamGetInputLevel(): number {
  return pitchDetector?.getInputLevel() ?? 0
}

export function startJamPitchDetection(): void {
  if (pitchDetector) return
  const stream = jamService?.getLocalStream()
  if (!stream) return

  pitchDetector = new JamPitchDetector()

  // Track when the last live pitch detection happened so the network interval
  // does not keep broadcasting stale frequency after the mic goes quiet.
  let lastPitchTime = 0

  pitchDetector.onPitch = (pitch) => {
    // YIN/MPM paths in PitchDetector do not set midi — compute it from freq
    const midi =
      pitch.midi ?? Math.round(69 + 12 * Math.log2(pitch.frequency / 440))
    lastPitchTime = Date.now()
    setJamLocalPitch({
      frequency: pitch.frequency,
      noteName: pitch.noteName,
      cents: pitch.cents,
      clarity: pitch.clarity,
      midi,
    })
  }
  pitchDetector.start(stream)

  // Throttled network sends at ~20 Hz.
  // Only sends when a fresh pitch was detected within the last 150 ms so that
  // the stale last-detected frequency is not broadcast indefinitely after the
  // mic goes quiet.
  pitchNetworkInterval = setInterval(() => {
    const p = jamLocalPitch()
    const age = Date.now() - lastPitchTime
    if (p && p.frequency > 0 && age < 150) {
      // Stamp the room beat, not just the wall clock: the beat is the only
      // coordinate every peer agrees on. Omitted when nothing is playing,
      // where there is no beat to speak of.
      const beat =
        jamExercisePlaying() && !jamExercisePaused()
          ? jamExerciseBeat()
          : undefined
      jamService?.sendPitch(p, beat)

      const myId = jamPeerId()
      if (myId !== null && myId !== '') {
        setJamPitchHistory((prev) => {
          const next = { ...prev }
          const arr = next[myId] ?? []
          arr.push({
            ...p,
            timestamp: Date.now(),
            ...(beat === undefined ? {} : { beat }),
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
  setJamExerciseBpm(melody.bpm) // seed BPM override from melody default
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
  jamService?.sendMelody(melody, jamRoomMode())
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
  beginOwnRun()
  startPlaybackTimer()
  jamService?.sendPlaybackCommand('play', actualStart, jamExerciseBpm())
  setJamPitchTab('exercise')
}

export function jamPlaybackPause(): void {
  setJamExercisePaused(true)
  stopPlaybackTimer()
  jamService?.sendPlaybackCommand('pause', jamExerciseBeat(), jamExerciseBpm())
}

export function jamPlaybackResume(): void {
  if (!jamExercisePlaying() || !jamExercisePaused()) return
  setJamExercisePaused(false)
  startPlaybackTimer()
  jamService?.sendPlaybackCommand('play', jamExerciseBeat(), jamExerciseBpm())
}

export function jamPlaybackStop(): void {
  setJamExercisePlaying(false)
  setJamExercisePaused(false)
  setJamExerciseBeat(0)
  setJamExerciseNoteIndex(-1)
  stopPlaybackTimer()
  settleOwnRun()
  creditOwnRun()
  jamService?.sendPlaybackCommand('stop', 0, jamExerciseBpm())
}

export function jamPlaybackSeek(beat: number): void {
  setJamExerciseBeat(beat)
  jamService?.sendPlaybackCommand('seek', beat, jamExerciseBpm())
}

// ── Song transport ───────────────────────────────────────────────────
// Deliberately separate from the beat transport rather than a branch
// inside it: a song is driven by its own <audio> element, whose
// currentTime is the truth, so there is no rAF beat accumulator to run
// and nothing to keep in step with a tempo.

export function jamSongPlay(fromSec = 0): void {
  if (jamSong() === null) return
  setJamSongPositionSec(fromSec)
  setJamExercisePlaying(true)
  setJamExercisePaused(false)
  jamService?.sendPlaybackCommandSec('play', fromSec)
}

export function jamSongPause(atSec: number): void {
  setJamSongPositionSec(atSec)
  setJamExercisePaused(true)
  jamService?.sendPlaybackCommandSec('pause', atSec)
}

export function jamSongStop(): void {
  setJamSongPositionSec(0)
  setJamExercisePlaying(false)
  setJamExercisePaused(false)
  jamService?.sendPlaybackCommandSec('stop', 0)
}

export function jamSongSeek(toSec: number): void {
  setJamSongPositionSec(toSec)
  jamService?.sendPlaybackCommandSec('seek', toSec)
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

    // Use the reactive BPM override so speed changes take effect immediately
    const bpm = jamExerciseBpm()
    const beatDelta = (bpm / 60) * (delta / 1000)
    const newBeat = jamExerciseBeat() + beatDelta
    const totalBeats = jamExerciseTotalBeats()

    if (newBeat >= totalBeats) {
      if (jamExerciseLoop()) {
        // Loop back to start
        setJamExerciseBeat(0)
        setJamExerciseNoteIndex(-1)
        playbackLastTick = now
        wrapOwnRun()
        jamService?.sendPlaybackCommand('seek', 0, jamExerciseBpm())
        playbackTimerId = requestAnimationFrame(tick)
      } else {
        // Finished — reset to start and broadcast
        setJamExercisePlaying(false)
        setJamExercisePaused(false)
        setJamExerciseBeat(0)
        setJamExerciseNoteIndex(-1)
        stopPlaybackTimer()
        settleOwnRun()
        creditOwnRun()
        jamService?.sendPlaybackCommand('stop', 0, jamExerciseBpm())
      }
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
  clearJamSession()
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
  setJamVideoEnabled(false)
  setJamPitchHistory({})
  setJamLocalPitch(null)
  setJamExerciseMelody(null)
  setJamExercisePlaying(false)
  setJamExercisePaused(false)
  setJamExerciseBeat(0)
  setJamExerciseNoteIndex(-1)
  setJamExerciseTotalBeats(0)
  setJamUnreadChatCount(0)
  // Leaving mid-take abandons it rather than settling it: the samples are
  // gone with the history above, so there is nothing honest left to score.
  passStartedAt = 0
  sessionStartedAt = 0
  sessionBest = null
  setTakeTarget(null)
  setJamOwnRunScore(null)
  setJamRoomMode('unison')
  setJamSong(null)
  setJamSongPositionSec(0)
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
