// ── Jam store ───────────────────────────────────────────────────────
// Reactive state management for P2P jam sessions.
// Wires together jam-service callbacks with SolidJS signals.

import { batch, createMemo, createRoot, createSignal } from 'solid-js'
import { getStemBlob } from '@/db/services/uvr-service'
import { jamRunSource } from '@/lib/jam/jam-catalog'
import type { JamLineScore } from '@/lib/jam/jam-line-scoring'
import { overallLineScore } from '@/lib/jam/jam-line-scoring'
import { sessionIdOfSong } from '@/lib/jam/jam-lyrics-attach'
import type { JamRoomMode } from '@/lib/jam/jam-modes'
import { roleCountFor, roleIndexOf, roleNameFor, targetForRole, } from '@/lib/jam/jam-modes'
import { JamPitchDetector } from '@/lib/jam/jam-pitch-detector'
import type { JamRunScore } from '@/lib/jam/jam-scoring'
import { scoreOwnJamRun } from '@/lib/jam/jam-scoring'
import type { JamSong } from '@/lib/jam/jam-song'
import { secondsInFlight, songPlayableInRoom } from '@/lib/jam/jam-song'
import { SongFileInbox } from '@/lib/jam/jam-song-inbox'
import type { JamSongParts } from '@/lib/jam/jam-song-parts'
import { assignRange, isMyLine, rehomeDeparted } from '@/lib/jam/jam-song-parts'
import { encodeStemsForShare, shareStemsWithPeers, } from '@/lib/jam/jam-song-share'
import { createJamService } from '@/lib/jam/service'
import { jamSignalingIsMocked } from '@/lib/jam/signaling'
import type { JamChatMessage, JamMelodyMessage, JamPeer, JamPitchMessage, JamPlaybackMessage, LyricsLineTiming, TimeStampedPitchSample, } from '@/lib/jam/types'
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

/**
 * How sure the detector must be before a frame counts as singing.
 *
 * A detector hands back a frequency for room tone, a chair scrape and a
 * breath -- all with a low clarity. Without this the trail wandered
 * around the lane whenever nobody was singing, drawing shapes out of
 * noise. The same threshold the zen session uses (useZenPitchSession),
 * for the same reason and so the two feel alike.
 */
export const MIN_SUNG_CLARITY = 0.2

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
const [_jamExercisePlaying, _setJamExercisePlaying] = createSignal(false)
export const jamExercisePlaying = _jamExercisePlaying

/**
 * Every stop names itself.
 *
 * Playback stopping with no explanation cost two testing sessions and two
 * separate root causes -- a drill timer's broadcast, then a peer's melody
 * announcement -- both of which reached this one signal from somewhere
 * that did not look like playback at all. The log line is the cheapest
 * possible answer to "what stopped it".
 */
export function setJamExercisePlaying(
  value: boolean,
  because = 'unspecified',
): void {
  if (_jamExercisePlaying() && !value) {
    console.info(`[jam:transport] playback STOPPED — ${because}`)
  }
  _setJamExercisePlaying(value)
}
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

/**
 * Where the HOST last said the song was.
 *
 * Separate from the position above, which every device now writes from its
 * own audio element. Collapsing the two was a real bug: a guest's element
 * played on while the store's position sat frozen at the last transport
 * message, so guests watched a lyric column that never scrolled, lanes
 * that never moved, and lines that never scored -- everything downstream
 * reads the position, and on a guest it only ever changed when somebody
 * pressed play.
 *
 * So the local element is the local clock, and this is the correction it
 * is pulled towards.
 */
export const [jamSongHostTarget, setJamSongHostTarget] = createSignal(0)

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
/**
 * True while audio is being encoded or sent (rule R10).
 *
 * A function rather than a memo: jamShareState is declared further down,
 * and a memo built at module scope would read it before it exists.
 */
export function jamSendInFlight(): boolean {
  const phase = jamShareState().phase
  return phase === 'encoding' || phase === 'sending'
}

export function selectJamSong(song: JamSong): boolean {
  // R10: a transfer describes THIS song -- its length, its hash, its
  // lyrics. Swapping underneath one would hand peers a file that does not
  // match the manifest they are about to be given.
  if (jamSendInFlight()) {
    setJamError(
      'Wait for the song to finish sending before choosing a different one.',
    )
    return false
  }
  // Peer count matters: a song only this device holds is fine alone and a
  // problem once somebody is waiting to hear it. Passing 0 by omission
  // meant the refusal could never fire, whoever was in the room.
  //
  // A preview room counts as empty. Its peers are invented (signaling-mock),
  // so refusing on their behalf blocks a real feature to protect people who
  // do not exist -- which is a preview making the thing it exists to
  // demonstrate untestable.
  const verdict = songPlayableInRoom(
    song,
    jamSignalingIsMocked() ? 0 : jamConnectedPeers().length,
  )
  if (!verdict.ok) {
    setJamError(verdict.reason ?? 'That song cannot be played in a room.')
    return false
  }
  // A room runs one thing at a time.
  //
  // In ONE batch, and the song first. Outside a batch every setter flushes
  // effects synchronously, so clearing the melody ran the panel's
  // "pick a default melody if none is loaded" effect at a moment when the
  // song had not been set yet -- it saw an empty drill room, put a drill
  // back, and the room ended up with both. That is where the second play
  // button came from, and the beat timer that stopped the song.
  batch(() => {
    setJamSong(song)
    setJamExerciseMelody(null)
    setJamExerciseTotalBeats(0)
    setJamExercisePlaying(false, 'a song was loaded')
    setJamExercisePaused(false)

    setJamSongPositionSec(0)
    // Both clocks, or a guest carries the last song's correction target
    // into the new one and gets yanked there on the first transport
    // message.
    setJamSongHostTarget(0)
    // A new song is a new lyric sheet, so the old allocation means nothing
    // -- and neither does a brush still armed from editing the last one,
    // which would turn the first click on the new words into a paint.
    setJamSongParts({})
    setJamAssignBrush(null)
    setJamSongHaves({})
    setJamSongSentOnce(false)
    resetJamLineScores()
    setJamError(null)
  })
  stopPlaybackTimer()
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

/**
 * Give the loaded song its words, after the fact.
 *
 * The manifest is re-sent so peers get them too: they are following the
 * host's song, and words that only the finder can see would leave everyone
 * else reading an empty column while somebody sings.
 *
 * Host-only for the broadcast. A guest attaching lyrics updates their own
 * view -- which is a fair thing to want if they found the words first --
 * but must not rewrite what the room is singing from.
 */
export function attachJamSongLyrics(lines: LyricsLineTiming[]): void {
  const song = jamSong()
  if (song === null || lines.length === 0) return
  const next = { ...song, lines }
  setJamSong(next)
  // The words changed, so the lines scored against them are stale.
  resetJamLineScores()
  if (!jamIsHost()) return
  broadcastSongWithParts()
}

// ── Who sings which line ─────────────────────────────────────────────
// Host-authored, and broadcast with the song (lib/jam/jam-song-parts.ts).

export const [jamSongParts, setJamSongParts] = createSignal<JamSongParts>({})

/** Do I sing this line? True for unassigned lines -- they are everyone's. */
export function jamLineIsMine(lineIndex: number): boolean {
  return isMyLine(jamSongParts(), lineIndex, jamPeerId())
}

/**
 * The singer currently being painted onto lines, or null for off.
 *
 * Person-first, because that is the order people think in: "Ada takes the
 * chorus" is one decision and then a sweep, where line-first made it one
 * decision per line. A brush has to persist across clicks, which is why
 * this is a mode rather than a gesture -- and while it is armed a click on
 * a line paints instead of seeking, so the two meanings never overlap.
 */
export const [jamAssignBrush, setJamAssignBrush] = createSignal<string | null>(
  null,
)

/** Arm a singer, or disarm by picking the armed one again. */
export function toggleJamAssignBrush(peerId: string): void {
  if (!jamIsHost()) return
  setJamAssignBrush((prev) => (prev === peerId ? null : peerId))
}

/**
 * Host-only: give a run of lines to a singer, and tell the room.
 *
 * Re-sent as a whole manifest rather than a delta. The map is a few
 * hundred bytes and a peer that missed one delta would be quietly singing
 * the wrong part for the rest of the song -- which is exactly the class of
 * bug that is impossible to diagnose from inside a room.
 */
export function assignJamSongLines(
  fromLine: number,
  toLine: number,
  peerId: string,
): void {
  if (!jamIsHost()) return
  const next = assignRange(jamSongParts(), fromLine, toLine, peerId)
  setJamSongParts(next)
  broadcastSongWithParts()
}

function broadcastSongWithParts(): void {
  const song = jamSong()
  if (song === null) return
  jamService?.sendSong({
    id: song.id,
    title: song.title,
    artist: song.artist,
    stems: song.stems,
    lines: song.lines,
    notes: song.notes,
    durationSec: song.durationSec,
    parts: jamSongParts(),
  })
}

/**
 * Hand a departed singer's lines to whoever is still here.
 *
 * Called when the peer list changes. A part that falls silent mid-song is
 * indistinguishable from a bug to everyone in the room, so it never does:
 * lines pass to the next singer, and to the room if there is nobody left.
 */
export function rehomeJamSongParts(): void {
  if (!jamIsHost()) return
  const parts = jamSongParts()
  if (Object.keys(parts).length === 0) return
  const mine = jamPeerId()
  const present = [
    ...jamConnectedPeers().map((p) => p.id),
    ...(mine === null || mine === '' ? [] : [mine]),
  ]
  const next = rehomeDeparted(parts, present)
  if (next === parts) return
  setJamSongParts(next)
  broadcastSongWithParts()
}

// ── Sharing a song with the room ─────────────────────────────────────
// Encoding and moving the audio for a song only this device holds
// (lib/jam/jam-song-share.ts, jam-song-inbox.ts).

export interface JamShareState {
  phase: 'idle' | 'encoding' | 'sending' | 'receiving' | 'done' | 'error'
  /** 0-1 through the current stage. */
  ratio: number
  message: string
}

/**
 * Whether the transfer dialog has been pushed to the background.
 *
 * A transfer can take a while and the room is still usable during it, so
 * the dialog is dismissible -- but dismissing must not mean losing the
 * thread, which is what the header chip is for.
 */
export const [jamTransferMinimised, setJamTransferMinimised] =
  createSignal(false)

export const [jamShareState, setJamShareState] = createSignal<JamShareState>({
  phase: 'idle',
  ratio: 0,
  message: '',
})

/**
 * Blob URLs minted for stems that arrived from a peer.
 *
 * Kept so they can be revoked. A blob URL pins its data in memory for the
 * life of the document, so a room where three songs were shared would
 * hold all three until the tab closed.
 */
const receivedStemUrls = new Set<string>()

function revokeReceivedStems(): void {
  for (const url of receivedStemUrls) URL.revokeObjectURL(url)
  receivedStemUrls.clear()
}

/**
 * Point the loaded song at audio that arrived from a peer.
 *
 * Deliberately NOT written to IndexedDB. This is somebody else's file,
 * received to sing along to for as long as the room lasts; quietly
 * building a library of other people's audio on someone's disk is not a
 * thing to do without asking, and nothing about the feature needs it.
 */
export function applyReceivedStem(
  stem: 'instrumental' | 'vocal',
  blob: Blob,
): void {
  const song = jamSong()
  if (song === null) return
  const url = URL.createObjectURL(blob)
  receivedStemUrls.add(url)
  // Land in an honest state and wait to be told.
  //
  // This used to clear `paused` so the arriving audio would not sit silent
  // -- but `playing` is this device's record of what the HOST is doing, and
  // it can be stale: a stop the host issued under the drill scope is
  // ignored here (rule R5), so a guest can sit at playing=true while the
  // host is stopped. Clearing `paused` on top of that started the song by
  // itself the moment the file landed, on a device nobody had pressed play
  // on. reportSongHave() below asks the host for the truth, which arrives
  // in a round trip and is the only thing that starts playback.
  setJamExercisePlaying(false, 'the audio arrived — waiting for the host')
  setJamExercisePaused(false)
  setJamError(null)
  setJamSong({
    ...song,
    stems: { ...song.stems, [stem]: url },
    // It plays here now, so it is no longer the local-only case that the
    // warning and the share prompt are about.
    ...(stem === 'instrumental' ? { origin: 'url' as const } : {}),
  })
}

/**
 * Inbound transfers, one per peer.
 *
 * Module-level rather than per-service so a reconnect does not lose a
 * transfer mid-flight, and cleared explicitly on leaving.
 */
const songInbox = new SongFileInbox({
  onProgress: (peerId, p, stem) =>
    setJamShareState({
      phase: 'receiving',
      ratio: p.ratio,
      message: `Getting the ${stem === 'vocal' ? 'guide vocal' : 'backing track'} from ${peerName(peerId)} — ${Math.round(p.ratio * 100)}%`,
    }),
  onStem: ({ stem, blob }) => {
    applyReceivedStem(stem, blob)
    // The host is waiting to know whether that worked.
    reportSongHave()
    markShareDone(
      stem === 'instrumental'
        ? 'Got the backing track — you can hear the song now.'
        : 'Got the guide vocal too.',
    )
  },
  onFailed: (_peerId, reason) =>
    setJamShareState({ phase: 'error', ratio: 0, message: reason }),
})

/**
 * Who can actually hear the loaded song.
 *
 * peerId -> true once they report having playable audio. A guest that
 * reloads stays in the room and loses the audio silently; the host used to
 * have no way to know, and no way to put it right. This is what they
 * report, and what the re-send button reads.
 */
export const [jamSongHaves, setJamSongHaves] = createSignal<
  Record<string, boolean>
>({})

/**
 * Whether this host has already sent the loaded song out at least once.
 *
 * The distinction the prompt needs. Reading it off "does anybody have it"
 * fails exactly when it matters: the person who reloaded re-reports NO,
 * and if they were the only peer the room looks untouched again -- so the
 * host is told "only you can hear this" about a song they just sent.
 */
export const [jamSongSentOnce, setJamSongSentOnce] = createSignal(false)

/** Connected peers who cannot hear the loaded song. */
export const jamPeersMissingSong = createRoot(() => {
  const memo = createMemo(() => {
    if (jamSong() === null) return []
    const haves = jamSongHaves()
    return jamConnectedPeers().filter((p) => haves[p.id] !== true)
  })
  return memo
})

/**
 * Can THIS device actually play the song it has been given?
 *
 * Not `origin`: onSongMessage stamps every incoming manifest 'url', so a
 * guest holding the host's own blob URL would have reported yes and the
 * host's re-send prompt would have vanished for the one person who needed
 * it. The honest test is the URL itself -- a blob URL belongs to the
 * document that made it, so unless this device minted it while receiving,
 * it points at nothing here.
 */
export function songIsPlayableHere(song: JamSong | null): boolean {
  if (song === null) return false
  const url = song.stems.instrumental
  if (url === '') return false
  // Our own separation: this device made the URL, so of course it plays.
  // Only a peer's manifest is ever stamped 'url', so this cannot let a
  // guest claim somebody else's file.
  if (song.origin === 'local') return true
  return !url.startsWith('blob:') || receivedStemUrls.has(url)
}

/** Tell the room whether THIS device can play the song it has been given. */
export function reportSongHave(): void {
  const song = jamSong()
  if (song === null) return
  jamService?.sendSongHave(song.id, songIsPlayableHere(song))
}

let shareAbort: { aborted: boolean } | null = null

/** Stop a share in progress -- the host changed their mind, or left. */
export function cancelJamSongShare(): void {
  if (shareAbort !== null) shareAbort.aborted = true
}

/**
 * Send the loaded song to everyone in the room.
 *
 * Host-only and explicit: encoding costs seconds of CPU and the transfer
 * costs somebody's data, so it happens when asked rather than the moment
 * a local song is picked.
 */
export async function shareJamSongWithRoom(onlyMissing = false): Promise<void> {
  const song = jamSong()
  if (song === null || !jamIsHost()) return
  const sessionId = sessionIdOfSong(song)
  if (sessionId === null) {
    setJamShareState({
      phase: 'error',
      ratio: 0,
      message: 'This song did not come from one of your separations.',
    })
    return
  }
  // Only the people who cannot hear it. Re-sending to somebody who already
  // has it costs them their data and the host their uplink, and a reload is
  // the common case: one person refreshes, everybody else is fine.
  const peers = onlyMissing ? jamPeersMissingSong() : jamConnectedPeers()
  if (peers.length === 0) {
    setJamShareState({
      phase: 'error',
      ratio: 0,
      message: onlyMissing
        ? 'Everybody can already hear this one.'
        : 'Nobody else is in the room yet.',
    })
    return
  }

  const signal = { aborted: false }
  shareAbort = signal
  try {
    setJamShareState({
      phase: 'encoding',
      ratio: 0,
      message: 'Packing the song…',
    })
    const [instrumental, vocal] = await Promise.all([
      getStemBlob(sessionId, 'instrumental'),
      getStemBlob(sessionId, 'vocal'),
    ])
    if (instrumental === null) {
      setJamShareState({
        phase: 'error',
        ratio: 0,
        message: 'The backing track is missing from this device.',
      })
      return
    }
    const encoded = await encodeStemsForShare(
      {
        instrumental: await instrumental.arrayBuffer(),
        ...(vocal === null ? {} : { vocal: await vocal.arrayBuffer() }),
      },
      (p) =>
        setJamShareState({
          phase: 'encoding',
          ratio: p.ratio,
          message: `Packing the ${p.stem === 'vocal' ? 'guide vocal' : 'backing track'}…`,
        }),
    )
    if (signal.aborted) {
      setJamShareState({ phase: 'idle', ratio: 0, message: '' })
      return
    }

    const { sent, skipped } = await shareStemsWithPeers(
      encoded,
      peers.map((peer) => ({
        peerId: peer.id,
        channel: jamService?.channelTo(peer.id) ?? null,
        connection: jamService?.connectionTo(peer.id) ?? null,
      })),
      {
        sendMessage: (peerId, msg) =>
          jamService?.sendSongFileMessage(peerId, msg),
        nextTransferId: () => globalThis.crypto.randomUUID(),
      },
      {
        signal,
        onProgress: (p) =>
          setJamShareState({
            phase: 'sending',
            // The whole job, not this stem to this person: per-stem the
            // bar filled once for the backing track, again for the guide
            // vocal, and again for the next peer.
            ratio: p.overall,
            message: `Sending the ${p.stem === 'vocal' ? 'guide vocal' : 'backing track'} to ${peerName(p.peerId)} — ${Math.round(p.ratio * 100)}%`,
          }),
      },
    )

    // Report the shortfall rather than a bare tick. Somebody who did not
    // get it is going to hear silence, and being told why beforehand is
    // the difference between a limitation and a bug.
    setJamSongHaves((prev) => {
      const next = { ...prev }
      for (const id of sent) next[id] = true
      return next
    })
    if (sent.length > 0) setJamSongSentOnce(true)
    markShareDone(
      skipped.length === 0
        ? `Sent to everyone (${sent.length}).`
        : `Sent to ${sent.length}. ${skipped.length} could not receive it: ${skipped[0]?.reason ?? ''}`,
    )
  } catch (err) {
    setJamShareState({
      phase: 'error',
      ratio: 0,
      message:
        err instanceof Error ? err.message : 'The song could not be sent.',
    })
  } finally {
    shareAbort = null
  }
}

function peerName(peerId: string): string {
  return jamPeers().find((p) => p.id === peerId)?.displayName ?? 'them'
}

/** How long a finished transfer stays on screen before it clears itself. */
const SHARE_DONE_LINGER_MS = 6000
let shareDoneTimer: ReturnType<typeof setTimeout> | null = null

/**
 * A transfer that worked says so, then gets out of the way.
 *
 * Only the happy path expires, and only while it is a chip nobody has
 * opened. Tapping the chip to read the outcome used to start a countdown
 * the reader could not see, so the panel they had just opened vanished
 * from under them -- on both devices, which made it look like a fault.
 * An error never expires: somebody still cannot hear the song.
 */
function markShareDone(message: string): void {
  setJamShareState({ phase: 'done', ratio: 1, message })
  if (shareDoneTimer !== null) clearTimeout(shareDoneTimer)
  shareDoneTimer = setTimeout(() => {
    shareDoneTimer = null
    if (jamShareState().phase !== 'done') return
    // Opened for reading: it is now the reader's to dismiss.
    if (!jamTransferMinimised()) return
    setJamShareState({ phase: 'idle', ratio: 0, message: '' })
  }, SHARE_DONE_LINGER_MS)
}

/** Put a finished or failed transfer away for good. */
export function dismissJamShareNotice(): void {
  if (shareDoneTimer !== null) {
    clearTimeout(shareDoneTimer)
    shareDoneTimer = null
  }
  if (jamSendInFlight()) return
  setJamShareState({ phase: 'idle', ratio: 0, message: '' })
}

export function clearJamSong(): void {
  batch(() => {
    // Nothing is loaded, so nothing is playing. Leaving the flag set left a
    // room claiming to play a song it no longer had -- and the next thing
    // to read it, whatever that turned out to be, believed it.
    setJamExercisePlaying(false, 'the song was cleared')
    setJamExercisePaused(false)
    setJamSong(null)
    setJamSongPositionSec(0)
    setJamSongHostTarget(0)
    setJamSongParts({})
    setJamAssignBrush(null)
    setJamSongHaves({})
    setJamSongSentOnce(false)
    resetJamLineScores()
  })
  revokeReceivedStems()
  setJamShareState({ phase: 'idle', ratio: 0, message: '' })
  jamService?.sendSong(null)
}

// ── Per-line scores ──────────────────────────────────────────────────
// Your own take, line by line (see lib/jam/jam-line-scoring.ts).
//
// Own samples only, exactly as the drill scorer does: the DataChannel is
// an unauthenticated relay, so a score built from what a peer SAYS it sang
// is a score anybody can type. Everyone scores themselves and shares the
// number, which is a claim rather than a proof -- fine for a jam, and the
// reason none of this feeds credits or a leaderboard.
//
// Keyed by line index rather than pushed onto a list because a singer can
// scrub back and take a line again, and the second attempt should replace
// the first rather than appear beside it.

export const [jamSongLineScores, setJamSongLineScores] = createSignal<
  Record<number, JamLineScore>
>({})

export function recordJamLineScore(score: JamLineScore): void {
  // Lines with nothing to sing are not recorded at all -- an empty badge
  // on an instrumental bar reads as a zero you earned.
  if (score.noteCount === 0) return
  setJamSongLineScores((prev) => ({ ...prev, [score.lineIndex]: score }))
}

export function resetJamLineScores(): void {
  setJamSongLineScores({})
}

/** The take so far, or null when nothing scoreable has been sung yet. */
export const jamSongRunScore = createRoot(() => {
  const memo = createMemo(() =>
    overallLineScore(Object.values(jamSongLineScores())),
  )
  return memo
})

// ── Room mode ────────────────────────────────────────────────────────
// What the room does with the shared melody (see lib/jam/jam-modes.ts).
// The host owns it, exactly as it owns the melody and the tempo.

export const [jamRoomMode, setJamRoomMode] = createSignal<JamRoomMode>('unison')

/** Host-only: switch mode and re-broadcast the melody it reshapes. */
export function selectJamRoomMode(mode: JamRoomMode): void {
  if (!jamIsHost()) return
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
      // Tell them what the room is on. The DataChannel's onopen only sends
      // video-state, so somebody arriving mid-song saw an empty room and
      // no way to ask what everyone else was singing.
      //
      // Safe to re-send to everyone now that a manifest for the song
      // already loaded no longer resets the transport (see onSongMessage) --
      // before that, one person joining would have stopped the music for
      // the whole room.
      if (jamIsHost() && jamSong() !== null) broadcastSongWithParts()
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
      // Nothing more is coming from them.
      songInbox.forget(peerId)
      setJamSongHaves((prev) => {
        const next = { ...prev }
        delete next[peerId]
        return next
      })
      // Disarm if they were the one being painted: assigning lines to a
      // peer who has left creates parts that only get re-homed on the NEXT
      // departure, and silently.
      if (jamAssignBrush() === peerId) setJamAssignBrush(null)
      // Their lines have to go somewhere. A part that falls silent because
      // its singer closed a tab is indistinguishable, from inside the room,
      // from the song being broken.
      rehomeJamSongParts()
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
    onMelodyMessage: applyRemoteMelody,
    onSongFileMessage: (msg, fromPeerId) => {
      switch (msg.action) {
        case 'offer':
          if (msg.header === undefined) return
          songInbox.offer(fromPeerId, {
            transferId: msg.transferId,
            ...msg.header,
          })
          setJamShareState({
            phase: 'receiving',
            ratio: 0,
            message: `Getting the song from ${peerName(fromPeerId)}…`,
          })
          break
        case 'done':
          void songInbox.done(fromPeerId)
          break
        case 'abort':
          songInbox.abort(
            fromPeerId,
            msg.reason ?? 'The sender stopped part-way through.',
          )
          break
      }
    },
    onSongFileChunk: (chunk, fromPeerId) => {
      songInbox.chunk(fromPeerId, chunk)
    },
    onSongHaveMessage: (msg, fromPeerId) => {
      // Only about the song currently loaded -- a late report about the
      // previous one would mark somebody as ready for a song nobody is on.
      if (jamSong()?.id !== msg.songId) return
      setJamSongHaves((prev) => ({ ...prev, [fromPeerId]: msg.have }))
      // Somebody can suddenly hear the room. Tell them where it is, or
      // they join the song at whatever their own stale state said -- which
      // is how a peer ended up playing alone while the host sat stopped.
      if (msg.have) announceSongTransport()
    },
    onSongMessage: (msg) => {
      if (msg.action === 'clear' || msg.song === undefined) {
        setJamExercisePlaying(false, 'the host cleared the song')
        setJamExercisePaused(false)
        setJamSong(null)
        setJamSongPositionSec(0)
        setJamSongParts({})
        return
      }
      // An UPDATE to the song already loaded -- the host assigned a part,
      // or found the lyrics -- is not a new song, and must not touch the
      // transport. Treating it as one stopped the music mid-verse for
      // everybody except the person who made the change, which looks
      // exactly like the room breaking by itself.
      const same = jamSong()?.id === msg.song.id
      if (same) {
        setJamSong((prev) =>
          prev === null
            ? prev
            : {
                ...prev,
                lines: msg.song?.lines ?? prev.lines,
                notes: msg.song?.notes ?? prev.notes,
              },
        )
        setJamSongParts(msg.song.parts ?? {})
        // The words or the parts moved under the scores, so they are stale.
        resetJamLineScores()
        return
      }
      // Peers trust the host's manifest but still resolve the audio
      // themselves -- nothing but URLs and lyrics crossed the wire.
      //
      // Batched, song first: a bare setter flushes effects, so clearing
      // the melody on its own let the panel's auto-select see an empty
      // drill room and put a drill back before the song landed.
      const incoming = msg.song
      batch(() => {
        setJamSong({ ...incoming, notes: incoming.notes ?? [], origin: 'url' })
        setJamExerciseMelody(null)
        setJamExercisePlaying(false, 'the host loaded a song')
        setJamExercisePaused(false)
        setJamSongPositionSec(0)
        // The allocation is the host's to author; a peer only ever adopts
        // it.
        setJamSongParts(incoming.parts ?? {})
        resetJamLineScores()
      })
      stopPlaybackTimer()
      // Tell the host straight away. A guest that reloaded lands here with
      // a manifest pointing at the host's own blob URLs, which it cannot
      // play -- and that silence is exactly what the host needs to see.
      reportSongHave()
    },
    onPlaybackMessage: applyRemoteTransport,
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
    if (p && p.frequency > 0 && p.clarity >= MIN_SUNG_CLARITY && age < 150) {
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

/**
 * Is the drill transport meaningless right now?
 *
 * The two engines share `jamExercisePlaying`, so a drill command reaching
 * the signal while the room is on a song moves the SONG -- and the drill's
 * beat timer, once running, ends and stops it. That is the whole of "the
 * song stopped and nobody touched it": the room had a drill it should
 * never have had, and a play button wired to the same signal.
 *
 * Rule R7, enforced where it cannot be routed around by a component.
 */
function drillIsIdleHere(what: string): boolean {
  if (jamSong() === null) return false
  console.info(`[jam:transport] ignoring drill ${what} — the room is on a song`)
  return true
}

export function selectJamExercise(melody: MelodyData): void {
  // A room runs one thing at a time, and picking a drill is a deliberate
  // switch away from the song. Without this the two coexisted: the song
  // kept playing under a drill that owned the transport.
  if (jamSong() !== null) {
    // ...and only the host switches the room (R3). A guest picking a drill
    // locally would leave itself on a drill while everyone else sings.
    if (!jamIsHost()) return
    clearJamSong()
  }
  const total = melody.items.reduce(
    (max, item) => Math.max(max, item.startBeat + item.duration),
    0,
  )
  // One batch, for the same reason selectJamSong uses one: a bare setter
  // flushes effects immediately, and the panel's auto-select would see a
  // half-applied room in between.
  batch(() => {
    // Update local state immediately (DataChannel only sends to remotes)
    setJamExerciseMelody(melody)
    setJamExerciseBpm(melody.bpm) // seed BPM override from melody default
    setJamExerciseTotalBeats(total)
    setJamExerciseBeat(0)
    setJamExerciseNoteIndex(-1)
    setJamExercisePlaying(false)
    setJamExercisePaused(false)
  })
  stopPlaybackTimer()
  // Host-only, like the song and the transport. A guest picking a drill
  // locally must not retune the room.
  if (jamIsHost()) jamService?.sendMelody(melody, jamRoomMode())
  setJamPitchTab('exercise')
}

export function clearJamExercise(): void {
  setJamExerciseMelody(null)
  setJamExerciseTotalBeats(0)
  setJamExercisePlaying(false, 'a song was loaded')
  setJamExercisePaused(false)
  setJamExerciseBeat(0)
  setJamExerciseNoteIndex(-1)
  stopPlaybackTimer()
  jamService?.sendClearMelody()
}

export function jamPlaybackPlay(startBeat?: number): void {
  if (drillIsIdleHere('start')) return
  const ci = 4 // 4 beats count-in
  const actualStart = startBeat ?? -ci
  setJamExerciseBeat(actualStart)
  setJamExercisePlaying(true)
  setJamExercisePaused(false)
  beginOwnRun()
  startPlaybackTimer()
  broadcastTransport('play', actualStart)
  setJamPitchTab('exercise')
}

export function jamPlaybackPause(): void {
  if (drillIsIdleHere('pause')) return
  setJamExercisePaused(true)
  stopPlaybackTimer()
  broadcastTransport('pause', jamExerciseBeat())
}

export function jamPlaybackResume(): void {
  if (drillIsIdleHere('resume')) return
  if (!jamExercisePlaying() || !jamExercisePaused()) return
  setJamExercisePaused(false)
  startPlaybackTimer()
  broadcastTransport('play', jamExerciseBeat())
}

export function jamPlaybackStop(): void {
  if (drillIsIdleHere('stop')) return
  setJamExercisePlaying(false, 'you pressed stop')
  setJamExercisePaused(false)
  setJamExerciseBeat(0)
  setJamExerciseNoteIndex(-1)
  stopPlaybackTimer()
  settleOwnRun()
  creditOwnRun()
  broadcastTransport('stop', 0)
}

export function jamPlaybackSeek(beat: number): void {
  if (drillIsIdleHere('seek')) return
  setJamExerciseBeat(beat)
  broadcastTransport('seek', beat)
}

// ── Song transport ───────────────────────────────────────────────────
// Deliberately separate from the beat transport rather than a branch
// inside it: a song is driven by its own <audio> element, whose
// currentTime is the truth, so there is no rAF beat accumulator to run
// and nothing to keep in step with a tempo.

export function jamSongPlay(fromSec = 0): void {
  if (jamSong() === null) return
  // Only a play from the top is a new take. Resuming from a pause keeps
  // the lines you already sang -- clearing them would punish a breath.
  if (fromSec === 0) resetJamLineScores()
  setJamSongPositionSec(fromSec)
  setJamExercisePlaying(true)
  setJamExercisePaused(false)
  broadcastSongTransport('play', fromSec)
}

export function jamSongPause(atSec: number): void {
  setJamSongPositionSec(atSec)
  setJamExercisePaused(true)
  broadcastSongTransport('pause', atSec)
}

export function jamSongStop(): void {
  setJamSongPositionSec(0)
  setJamExercisePlaying(false)
  setJamExercisePaused(false)
  broadcastSongTransport('stop', 0)
}

export function jamSongSeek(toSec: number): void {
  setJamSongPositionSec(toSec)
  broadcastSongTransport('seek', toSec)
}

// ── Playback timer ───────────────────────────────────────────────────

/**
 * Broadcast a transport command, if this device is entitled to.
 *
 * Only the host drives the room. The drill timer runs on every peer so the
 * playhead stays smooth locally, and its completion used to broadcast a
 * stop from whoever finished first -- so a guest's five-second scale ending
 * stopped the song the room was singing. Local state still updates; only
 * the telling-everyone-else part is the host's.
 */
/** Same rule for the song's own transport: the host drives it. */
/**
 * Apply a transport command that arrived from the room.
 *
 * Exported so the rules can be tested directly: which commands this device
 * obeys is the difference between a room that stays together and one where
 * somebody else's drill ending stops the song.
 */
/**
 * Adopt a melody the room announced.
 *
 * Exported for the same reason applyRemoteTransport is: which announcements
 * this device obeys is exactly where two separate "the song stopped"
 * bugs lived.
 */
export function applyRemoteMelody(msg: JamMelodyMessage): void {
  // Same rule as transport: the host drives the room, so it never
  // adopts what a peer announces. Without this a guest broadcasting
  // its own melody set jamExercisePlaying(false) here -- the very
  // signal the song's audio reads -- and the host's song stopped
  // seconds in, with a 'recv melody' the only trace in the log.
  if (jamIsHost()) {
    console.info('[jam:store] ignoring melody from a peer (host drives)')
    return
  }
  // And a melody means nothing to a room that is singing a song. One
  // thing at a time: only the host can switch the room between them.
  if (jamSong() !== null) {
    console.info('[jam:store] ignoring melody while a song is loaded')
    return
  }
  if (msg.action === 'clear') {
    setJamExerciseMelody(null)
    setJamExerciseTotalBeats(0)
    setJamExercisePlaying(false, 'the host cleared the drill')
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
    setJamExercisePlaying(false, 'the host loaded a different drill')
    setJamExercisePaused(false)
    stopPlaybackTimer()
    setJamPitchTab('exercise')
  }
}

export function applyRemoteTransport(
  msg: JamPlaybackMessage,
  fromPeerId = '',
): void {
  // Only the host drives the room. A guest's own drill timer finishing
  // used to broadcast a stop, which every peer obeyed -- so somebody
  // else's five-second scale ending killed the song the room was
  // singing. Transport is the host's, like the song and the tempo.
  if (jamIsHost()) return
  // And a command means nothing for a thing this device is not
  // running. Without the scope tag a bare drill 'stop' was applied to
  // whatever was playing, which is how a drill ending stopped a song.
  const scope = msg.scope ?? 'drill'
  const running = jamSong() !== null ? 'song' : 'drill'
  if (scope !== running) {
    console.info(
      '[jam:store] ignoring',
      scope,
      'transport while running',
      running,
    )
    return
  }
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
        setJamSongHostTarget(msg.positionSec + ahead)
        break
      case 'pause':
        setJamExercisePaused(true)
        setJamSongPositionSec(msg.positionSec)
        setJamSongHostTarget(msg.positionSec)
        break
      case 'stop':
        setJamExercisePlaying(false)
        setJamExercisePaused(false)
        setJamSongPositionSec(0)
        setJamSongHostTarget(0)
        break
      case 'seek':
        setJamSongPositionSec(msg.positionSec + ahead)
        setJamSongHostTarget(msg.positionSec + ahead)
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
}

function broadcastSongTransport(
  action: 'play' | 'pause' | 'stop' | 'seek',
  positionSec: number,
): void {
  if (!jamIsHost()) return
  jamService?.sendPlaybackCommandSec(action, positionSec)
}

function broadcastTransport(
  action: 'play' | 'pause' | 'stop' | 'seek',
  beat: number,
): void {
  if (!jamIsHost()) return
  // Nothing drill-shaped goes on the wire while the room is on a song.
  if (jamSong() !== null) return
  jamService?.sendPlaybackCommand(action, beat, jamExerciseBpm())
}

/**
 * Say where the room's song is, for anybody who has just caught up.
 *
 * A guest holds `jamExercisePlaying` as its record of what the host is
 * doing, and that record can go stale -- so the moment a peer reports it
 * can hear the song, it gets told the truth rather than acting on what it
 * happened to be holding.
 */
export function announceSongTransport(): void {
  if (!jamIsHost() || jamSong() === null) return
  const at = jamSongPositionSec()
  if (!jamExercisePlaying()) broadcastSongTransport('stop', 0)
  else if (jamExercisePaused()) broadcastSongTransport('pause', at)
  else broadcastSongTransport('play', at)
}

function startPlaybackTimer(): void {
  stopPlaybackTimer()
  playbackLastTick = performance.now()
  // Belt and braces on R7. Even if some path starts the beat accumulator
  // during a song, it must not run: its finish branch writes the shared
  // playing signal, which is the audio element's on/off switch.
  if (jamSong() !== null) return
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
        broadcastTransport('seek', 0)
        playbackTimerId = requestAnimationFrame(tick)
      } else {
        // Finished — reset to start and broadcast
        setJamExercisePlaying(false, 'the drill reached its last beat')
        setJamExercisePaused(false)
        setJamExerciseBeat(0)
        setJamExerciseNoteIndex(-1)
        stopPlaybackTimer()
        settleOwnRun()
        creditOwnRun()
        broadcastTransport('stop', 0)
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
  // A share in flight is over, and a blob URL pins its data for the life
  // of the document -- leaving a room should not keep somebody else's
  // song in memory until the tab closes.
  cancelJamSongShare()
  setJamAssignBrush(null)
  songInbox.clear()
  revokeReceivedStems()
  if (shareDoneTimer !== null) {
    clearTimeout(shareDoneTimer)
    shareDoneTimer = null
  }
  setJamShareState({ phase: 'idle', ratio: 0, message: '' })
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
