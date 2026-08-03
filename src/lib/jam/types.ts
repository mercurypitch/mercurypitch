// ── Jam session type definitions ────────────────────────────────────

import type { JamRoomMode } from '@/lib/jam/jam-modes'
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
  | {
      type: 'room-created'
      roomId: string
      peerId: string
      isHost: boolean
      ownerToken?: string
    }
  | {
      type: 'join-room'
      roomId: string
      displayName: string
      ownerToken?: string
    }
  | {
      type: 'room-joined'
      roomId: string
      peerId: string
      isHost: boolean
      peers: Array<{ id: string; displayName: string }>
      /** Issued only when an ownerless room adopts this joiner as owner. */
      ownerToken?: string
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
  /**
   * The sender's room beat when this pitch was detected -- the coordinate
   * every peer scores in. Wall-clock timestamps cannot do this job: they
   * come off the SENDER's Date.now(), so comparing them to the receiver's
   * clock measures machine skew (seconds, easily) rather than musical time,
   * and two people in one room end up with different scoreboards.
   *
   * Absent when nothing is playing, and optional so a peer on an older
   * build still parses -- its samples fall back to the timestamp estimate.
   */
  beat?: number
}

export interface JamMelodyMessage {
  type: 'melody'
  action: 'set' | 'clear'
  melody?: MelodyData
  /**
   * The room's mode, riding along with the melody that it reshapes.
   * Changing mode re-broadcasts the current melody, so there is one code
   * path for "the room's part assignment changed" instead of two.
   *
   * Roles are NOT sent: every peer derives them from the sorted peer list
   * (see jam-modes.ts), so there is no handshake to fall out of sync.
   */
  mode?: JamRoomMode
}

export interface JamPlaybackMessage {
  type: 'playback'
  action: 'play' | 'pause' | 'stop' | 'seek'
  /**
   * What this command is about.
   *
   * A room runs a drill OR a song, and the two used to share one pair of
   * transport signals with nothing on the wire to tell them apart. A
   * drill's beat timer finishing broadcast a bare `stop`, which every peer
   * applied to whatever it happened to be running -- so somebody's
   * five-second scale ending killed the room's song, seconds after it
   * started, with no explanation.
   *
   * Absent on messages from an older client; treated as 'drill', which is
   * what those clients could only ever have meant.
   */
  scope?: 'drill' | 'song'
  currentBeat?: number
  /**
   * Position in the song's own timeline, for a room running a song rather
   * than a drill. Present INSTEAD of currentBeat, never alongside it -- the
   * two coordinates do not mix, and a receiver uses whichever it was sent.
   */
  positionSec?: number
  timestamp: number
  /**
   * The host's tempo, stamped on every transport command. Peers adopt it,
   * which makes each command a resync point: a peer that missed a tempo
   * change is corrected by the next play, pause or seek rather than
   * running its playhead at the wrong speed for the rest of the session.
   */
  bpm?: number
}

export interface JamVideoStateMessage {
  type: 'video-state'
  peerId?: string
  enabled: boolean
}

export type JamDataMessage =
  | JamChatMessage
  | JamPitchMessage
  | JamMelodyMessage
  | JamSongMessage
  | JamPlaybackMessage
  | JamVideoStateMessage

// ── Songs ────────────────────────────────────────────────────────────

/**
 * One lyric line, pinned to the song's own timeline.
 *
 * Seconds, not beats: a song's lyrics are authored against the recording,
 * and the beat grid the drills use does not survive rubato. See
 * lib/jam/jam-song.ts for why the two timelines stay separate.
 */
export interface LyricsLineTiming {
  text: string
  startSec: number
  /** Absent means "until the next line starts". */
  endSec?: number
}

/**
 * The room loading a song. Carries a manifest, never audio -- every peer
 * fetches the same URLs, and peer-to-peer transfer of a local song is a
 * later phase (docs/plans/jam-karaoke-songs.md).
 */
/** One target note of the song's vocal line, on the song's own timeline. */
export interface JamSongNote {
  midi: number
  startSec: number
  endSec: number
}

/**
 * The control track of a stem transfer.
 *
 * The bytes travel as raw binary frames alongside these; an offer opens a
 * transfer, and only one runs at a time per peer, which is what lets a
 * chunk be matched to its transfer without a header on every frame.
 */
/**
 * A peer reporting whether it can actually hear the loaded song.
 *
 * Sent on joining a room that already has one, and after a reload. Without
 * it the host has no way to know: a guest who refreshes stays in the room
 * and silently loses the audio, and the host sees a full room happily
 * playing to somebody hearing nothing.
 */
export interface JamSongHaveMessage {
  type: 'song-have'
  songId: string
  /** False when this device has no playable audio for it. */
  have: boolean
}

export interface JamSongFileMessage {
  type: 'song-file'
  action: 'offer' | 'done' | 'abort'
  transferId: string
  /** Present on 'offer'. */
  header?: {
    stem: 'instrumental' | 'vocal'
    bytes: number
    sha256: string
    mime: string
  }
  /** Present on 'abort', so the other end can say why it stopped. */
  reason?: string
}

export interface JamSongMessage {
  type: 'song'
  action: 'set' | 'clear'
  song?: {
    id: string
    title: string
    artist?: string
    stems: { instrumental: string; vocal?: string }
    lines: LyricsLineTiming[]
    durationSec: number
    /**
     * The vocal line as notes, so every lane can draw what to sing rather
     * than only what was sung.
     *
     * Sent with the manifest even though the AUDIO cannot be: notes are
     * kilobytes, which is the whole reason this works for a song only the
     * host holds -- peers get the target and the words, and only the
     * backing track is missing.
     */
    notes?: JamSongNote[]
    /**
     * Who sings which line (see lib/jam/jam-song-parts.ts).
     *
     * Travels with the manifest rather than as its own message: the
     * allocation is authored against THIS lyric sheet, and a part map
     * arriving separately could describe a song the peer has not loaded.
     */
    parts?: Record<number, string>
  }
}

// ── State helpers ────────────────────────────────────────────────────

export interface TimeStampedPitchSample {
  frequency: number
  noteName: string
  cents: number
  clarity: number
  midi: number
  timestamp: number
  /** Room beat at detection -- see JamPitchMessage.beat. */
  beat?: number
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
  onHostStatus?: (isHost: boolean) => void
  onError: (message: string) => void
  // Signaling events from signaling (from = sender peerId)
  onOffer?: (from: string, sdp: string) => void
  onAnswer?: (from: string, sdp: string) => void
  onIceCandidate?: (from: string, candidate: string) => void
  // DataChannel events
  onPitchMessage?: (msg: JamPitchMessage) => void
  onMelodyMessage?: (msg: JamMelodyMessage) => void
  onSongMessage?: (msg: JamSongMessage) => void
  /** Control frames for a stem transfer (offer / done / abort). */
  onSongFileMessage?: (msg: JamSongFileMessage, fromPeerId: string) => void
  /** A peer telling us whether it can hear the song (see JamSongHaveMessage). */
  onSongHaveMessage?: (msg: JamSongHaveMessage, fromPeerId: string) => void
  /**
   * A slice of stem audio. Binary, and deliberately NOT wrapped in JSON:
   * base64 would cost a third more bytes on the one message type where
   * bytes are the whole problem.
   */
  onSongFileChunk?: (chunk: ArrayBuffer, fromPeerId: string) => void
  /** fromPeerId lets the store charge the message its own flight time. */
  onPlaybackMessage?: (msg: JamPlaybackMessage, fromPeerId: string) => void
  onVideoState?: (peerId: string, enabled: boolean) => void
}
