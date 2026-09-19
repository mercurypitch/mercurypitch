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
 * The vocal track is an address on somebody else's device.
 *
 * A song only its host held is sent to the room as that host's own blob
 * addresses. When the host leaves and the room passes to someone else, the
 * new host holds a manifest pointing at audio that went home with the old
 * one -- fetching it fails, and "try again" would fail the same way.
 */
export const VOCAL_LEFT_WITH_HOST_REASON =
  'The singer who loaded this song has left, and its vocal track went with them. Sing it by ear.'

/**
 * Whether a vocal address can only have been minted on another device.
 *
 * `origin: 'url'` on a song this device loaded itself means a public
 * address; on a song that arrived over the wire it is what every incoming
 * song is stamped with. A `blob:` address under it is therefore never ours.
 */
function vocalIsSomeoneElses(song: JamSong, vocalUrl: string): boolean {
  return song.origin === 'url' && vocalUrl.startsWith('blob:')
}

/** What can be worked out for this song on this device, if anything. */
function analysable(
  song: JamSong,
): { sessionId: string; vocalUrl: string } | { reason: string } {
  const sessionId = jamSongSessionId(song.id)
  if (sessionId === null) return { reason: NOT_ANALYSABLE_REASON }
  const vocalUrl = song.stems.vocal ?? ''
  if (vocalUrl === '') return { reason: NO_VOCAL_STEM_REASON }
  if (vocalIsSomeoneElses(song, vocalUrl))
    return { reason: VOCAL_LEFT_WITH_HOST_REASON }
  return { sessionId, vocalUrl }
}

/**
 * What to do about `song`'s notes.
 *
 * `isHost` decides who acts. Everyone in a room could technically analyse
 * the demo -- its stems are public -- but then every device would spend a
 * minute of CPU producing the same answer, and a guest with a song only
 * the host holds could not do it at all. So the host produces the line
 * once and sends it, which is also what keeps the room in agreement about
 * what is being sung.
 *
 * A `raw` line counts as half a line. It is a stored merge from before the
 * clean-up pass existed -- every wobble and breath still a note -- and
 * "there are notes" used to be the end of the question, so a song analysed
 * long ago was never cleaned up, in any room, ever. The host replaces it
 * when it can; the raw line stays on screen until the better one arrives,
 * and stays for good when nothing better can be made.
 */
export function jamPitchNeed(
  song: JamSong | null,
  isHost: boolean,
): JamPitchNeed {
  if (song === null) return { kind: 'have' }
  const hasNotes = song.notes.length > 0
  if (hasNotes && song.notesFrom !== 'raw') return { kind: 'have' }
  if (!isHost) return hasNotes ? { kind: 'have' } : { kind: 'wait' }

  const source = analysable(song)
  if ('reason' in source)
    return hasNotes ? { kind: 'have' } : { kind: 'cannot', ...source }
  return { kind: 'analyse', ...source }
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

/** What a guest is told once the host has looked and come back with nothing. */
export const GUEST_NO_GUIDE_REASON =
  'This song has no pitch guide. Sing it by ear.'

/**
 * Whose line the lanes are drawing. `host` is a guest's answer: the notes
 * came over the wire and that is all this device knows about them.
 */
export type JamGuideCredit = 'saved' | 'edited' | 'room' | 'host'

/** The one thing the lane area says about the pitch guide, if anything. */
export type JamPitchBanner =
  | { kind: 'none' }
  | { kind: 'working'; progress: number }
  | { kind: 'unavailable'; message: string; retry: boolean }
  /** There is a line, and this is where it came from. */
  | { kind: 'ready'; credit: JamGuideCredit }

/**
 * What to draw over the lanes.
 *
 * Deliberately not "is the state working": the state belongs to whichever
 * song it names, and a stale one must not caption a different song.
 *
 * Work in progress wins over notes, because a raw line is being replaced
 * while it is still on screen. After that, notes win over any failure --
 * a line to aim at matters more than why a better one could not be made --
 * and the lanes say where the line came from. They used to say nothing at
 * all, and "cleaned up a minute ago" and "nothing happened" looked the same.
 */
export function jamPitchBanner(
  state: JamPitchProvisionState,
  song: JamSong | null,
  isHost: boolean,
): JamPitchBanner {
  if (song === null) return { kind: 'none' }

  const mine = state.songId === song.id
  if (mine && state.phase === 'working') {
    return { kind: 'working', progress: state.progress }
  }
  if (song.notes.length > 0) {
    const from = song.notesFrom
    if (from === undefined) {
      // Notes that arrived over the wire. A guest is told whose they are; a
      // host who inherited the room mid-song is told nothing, because "from
      // the host" would now mean somebody who has left.
      return isHost ? { kind: 'none' } : { kind: 'ready', credit: 'host' }
    }
    // A raw line nothing could replace is still a saved line to a singer.
    return { kind: 'ready', credit: from === 'raw' ? 'saved' : from }
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
  if (isHost) return { kind: 'none' }
  return {
    kind: 'unavailable',
    message:
      song.pitchGuide === 'unavailable'
        ? GUEST_NO_GUIDE_REASON
        : GUEST_WAITING_REASON,
    retry: false,
  }
}
