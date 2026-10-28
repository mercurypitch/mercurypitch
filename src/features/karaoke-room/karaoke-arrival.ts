// ============================================================
// The Karaoke room's arrival: which song goes on the stage, and how
// ============================================================
//
// What a room that has just arrived puts on its stage, decided from what it
// knows: a song First note handed over to sing on, a song parked on the way
// out, the one on the stage when the room was last here, the last one sung,
// Goodbye to Spring, or whatever the library has first. Pure, so the rules
// are read in one place; KaraokeRoomStage.tsx cues what this says.

import type { GuideLevel } from '@/components/stem-mixer-hosting'
import { DEMO_SESSION_ID } from '@/lib/example-session'
import type { RoomSong } from './karaoke-room-library'
import type { KaraokeSongRequest, ParkedSong } from './karaoke-room-store'

/**
 * The song an arrival cues: a parked song first, then the one on the stage
 * when the room was last here, then the last one sung, then Goodbye to
 * Spring, then whatever the library has first.
 */
export function arrivalSong(
  rows: readonly RoomSong[],
  parked: ParkedSong | null,
  staged: string | null,
  lastSung: string | null,
): RoomSong | null {
  const find = (id: string | null | undefined): RoomSong | undefined =>
    id === null || id === undefined
      ? undefined
      : rows.find((row) => row.sessionId === id)
  return (
    find(parked?.sessionId) ??
    find(staged) ??
    find(lastSung) ??
    find(DEMO_SESSION_ID) ??
    rows.at(0) ??
    null
  )
}

/** What an arrival puts on the stage. */
export interface ArrivalCue {
  readonly song: RoomSong
  /** The parked song comes back where it stopped, paused. */
  readonly resuming: boolean
  /** First note's "Sing on in Karaoke": the song plays at once. */
  readonly autoPlay: boolean
  /** Where it starts, s; undefined for its start. */
  readonly seekSec: number | undefined
  /** The guide vocal to put back, or null. */
  readonly guide: GuideLevel | null
}

/**
 * The arrival's cue. A song First note handed over with the place the
 * singer came in on (`request.seekSec`) is the answer, before a parked
 * song, and starts there, playing: the singer asked to sing on. One the
 * room does not have leaves the arrival as it would be without it. Null
 * while the library has no song at all.
 */
export function arrivalCue(
  rows: readonly RoomSong[],
  parked: ParkedSong | null,
  staged: string | null,
  lastSung: string | null,
  request: KaraokeSongRequest | null,
): ArrivalCue | null {
  const singOn =
    request?.seekSec === undefined
      ? undefined
      : rows.find((row) => row.sessionId === request.sessionId)
  const song = singOn ?? arrivalSong(rows, parked, staged, lastSung)
  if (song === null) return null
  if (singOn !== undefined) {
    return {
      song,
      resuming: false,
      autoPlay: true,
      seekSec: request?.seekSec,
      guide: null,
    }
  }
  const resuming = parked !== null && parked.sessionId === song.sessionId
  return {
    song,
    resuming,
    autoPlay: false,
    seekSec: resuming && parked.seconds > 0 ? parked.seconds : undefined,
    guide: resuming ? parked.guide : null,
  }
}
