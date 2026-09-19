// ── Does this room song need a pitch line, and can it have one? ──────
//
// A jam room draws its target notes from whatever `sessionSongNotes` read
// out of the local pitch-analysis store. A song nobody has ever opened in
// the stem mixer has no such row, so the room got `[]` -- and drew empty
// lanes with no explanation at all. The singer saw a karaoke machine that
// had quietly stopped scoring.
//
// The fix is to analyse it, the same way Karaoke Night's zen stage does,
// with the same function and the same settings. This module is the part
// of that worth testing on its own: given a song and who you are in the
// room, what should happen. The doing of it lives in the store, because
// only the store can talk to the wire.

import type { JamSong } from '@/lib/jam/jam-song'
import { jamSongSessionId } from '@/lib/jam/jam-song-sources'

/** What a room should do about a song's target notes. */
export type JamPitchNeed =
  /** It already has them. Nothing to do, nothing to say. */
  | { kind: 'have' }
  /** This device can produce them, from this stem, under this session. */
  | { kind: 'analyse'; sessionId: string; vocalUrl: string }
  /** Somebody else's job: a guest follows the host's song. */
  | { kind: 'wait' }
  /** Nothing can produce them here. The reason is shown to the singer. */
  | { kind: 'cannot'; reason: string }

/**
 * A song with no vocal stem cannot have a vocal line worked out, ever.
 *
 * Said plainly rather than as a failure, because it is not one: an
 * instrumental, or a song shared into the room as a backing track alone,
 * is a perfectly good thing to sing over by ear.
 */
export const NO_VOCAL_STEM_REASON =
  'This song came without a vocal track, so there is no line to follow. Sing it by ear.'

/** A drill, a melody, a challenge: notes by construction or not at all. */
export const NOT_ANALYSABLE_REASON =
  'There is no pitch guide for this song, and nothing here to work one out from.'

/**
 * What to do about `song`'s notes.
 *
 * `isHost` decides who acts. Everyone in a room could technically analyse
 * the demo -- its stems are public -- but then every device would spend a
 * minute of CPU producing the same answer, and a guest with a song only
 * the host holds could not do it at all. So the host produces the line
 * once and sends it, which is also what keeps the room in agreement about
 * what is being sung.
 */
export function jamPitchNeed(
  song: JamSong | null,
  isHost: boolean,
): JamPitchNeed {
  if (song === null) return { kind: 'have' }
  if (song.notes.length > 0) return { kind: 'have' }
  if (!isHost) return { kind: 'wait' }

  const sessionId = jamSongSessionId(song.id)
  if (sessionId === null)
    return { kind: 'cannot', reason: NOT_ANALYSABLE_REASON }

  const vocalUrl = song.stems.vocal ?? ''
  if (vocalUrl === '') return { kind: 'cannot', reason: NO_VOCAL_STEM_REASON }

  return { kind: 'analyse', sessionId, vocalUrl }
}

// ── What the lane area says about it ─────────────────────────────────

/** Where the pitch guide has got to. */
export type JamPitchPhase =
  /** Either the notes are here, or this device is not the one making them. */
  | 'idle'
  /** This device is working the line out right now. */
  | 'working'
  /** There is no line, and saying so is the only honest thing left. */
  | 'unavailable'

export interface JamPitchProvisionState {
  phase: JamPitchPhase
  /** 0-100 while working. Meaningless otherwise. */
  progress: number
  /** The song this state describes. Guards a result that arrives late. */
  songId: string
  /** Shown to the singer when unavailable. Plain words, no jargon. */
  reason: string
  /** True when trying again could plausibly work. */
  retryable: boolean
}

export const JAM_PITCH_IDLE: JamPitchProvisionState = {
  phase: 'idle',
  progress: 0,
  songId: '',
  reason: '',
  retryable: false,
}

/** What a singer who is not the host is told while they wait. */
export const GUEST_WAITING_REASON =
  'No pitch guide for this song yet. The host is the one who can make it.'

/** The one thing the lane area shows over the lanes, if anything. */
export type JamPitchBanner =
  | { kind: 'none' }
  | { kind: 'working'; progress: number }
  | { kind: 'unavailable'; message: string; retry: boolean }

/**
 * What to draw over the lanes.
 *
 * Deliberately not "is the state working": the state belongs to whichever
 * song it names, and a stale one must not caption a different song. Notes
 * win over everything -- once there is a line to aim at, nothing is said
 * about how it got there.
 */
export function jamPitchBanner(
  state: JamPitchProvisionState,
  song: JamSong | null,
  isHost: boolean,
): JamPitchBanner {
  if (song === null) return { kind: 'none' }
  if (song.notes.length > 0) return { kind: 'none' }

  const mine = state.songId === song.id
  if (mine && state.phase === 'working') {
    return { kind: 'working', progress: state.progress }
  }
  if (mine && state.phase === 'unavailable') {
    return {
      kind: 'unavailable',
      message: state.reason,
      retry: state.retryable && isHost,
    }
  }
  // No notes, nothing running, nothing failed: a guest waiting on the
  // host, or a host between picking the song and the first frame.
  return isHost
    ? { kind: 'none' }
    : { kind: 'unavailable', message: GUEST_WAITING_REASON, retry: false }
}
