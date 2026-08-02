// ── Jam songs ────────────────────────────────────────────────────────
// A song a room can sing together, and the timeline it runs on.
//
// Everything else in the jam room measures time in BEATS, because a drill
// is a tempo and a grid. A song is neither: it has lyrics pinned to
// seconds, it can rubato, and nothing about it is usefully expressed as a
// bar. So a song carries its own timeline in seconds and the beat path is
// left completely alone -- which is the point, because the beat path is
// what the drills depend on.
//
// The two coordinates never mix. A room is running one or the other, and
// jamSongPositionSec is only meaningful while a song is loaded.

import type { LyricsLineTiming } from '@/lib/jam/types'

/** Where a song's audio lives, and what every peer must be able to reach. */
export interface JamSongStems {
  /** The backing track. Required -- there is nothing to sing over without it. */
  instrumental: string
  /** Optional guide vocal, for hearing the line rather than scoring it. */
  vocal?: string
}

export interface JamSong {
  id: string
  title: string
  artist?: string
  stems: JamSongStems
  /** Lyrics with start times in seconds; empty is legal (an instrumental). */
  lines: LyricsLineTiming[]
  durationSec: number
  /**
   * Where the audio came from, which decides whether the room can run it
   * at all. 'url' is fetchable by every peer; 'local' exists on one device
   * and needs the peer-to-peer transfer that phase 1 does not build.
   */
  origin: 'url' | 'local'
}

/**
 * The line being sung at a given moment, or null before the first / after
 * the last.
 *
 * Linear rather than a binary search on purpose: a lyric sheet is tens of
 * lines, this runs once per frame at most, and the obvious version is the
 * one that stays correct when someone adds a rest row.
 */
export function lineAt(
  lines: readonly LyricsLineTiming[],
  positionSec: number,
): LyricsLineTiming | null {
  let current: LyricsLineTiming | null = null
  for (const line of lines) {
    if (line.startSec > positionSec) break
    current = line
  }
  if (current === null) return null
  // A line with an end time stops being current once it passes; one without
  // runs until the next line starts, which the loop above already handles.
  if (current.endSec !== undefined && positionSec >= current.endSec) return null
  return current
}

/** Index of the current line, or -1. Cheaper for callers that only scroll. */
export function lineIndexAt(
  lines: readonly LyricsLineTiming[],
  positionSec: number,
): number {
  const line = lineAt(lines, positionSec)
  return line === null ? -1 : lines.indexOf(line)
}

/**
 * How far a transport command travelled, in seconds.
 *
 * The beat path already compensates for this (beatsInFlight in the jam
 * store): a play at position 0 does not arrive at position 0, it arrives
 * one-way-latency later, and a peer starting at the number in the message
 * is permanently that far behind. Same correction, simpler units -- no
 * tempo to convert through.
 *
 * Clamped for the same reason: a stale RTT reading should nudge the
 * playhead, never throw it into the middle of the song.
 */
const MAX_FLIGHT_MS = 500

export function secondsInFlight(rttMs: number): number {
  if (!Number.isFinite(rttMs) || rttMs <= 0) return 0
  return Math.min(rttMs, MAX_FLIGHT_MS) / 2 / 1000
}

/**
 * A gap long enough to be worth counting into.
 *
 * Under this and the singer barely notices the pause; over it and they
 * need to know when to come back in. The stem mixer arrived at the same
 * idea for its karaoke countdown dots, but that derivation lives inside a
 * three-thousand-line controller wired to block instances and edit
 * layers, so this is the idea rather than the code.
 */
export const MIN_REST_SEC = 3

export interface JamRest {
  /** Index of the line the rest comes BEFORE. */
  beforeLine: number
  startSec: number
  endSec: number
  /** One dot a second, capped -- a 40-second intro is not 40 dots. */
  dotCount: number
}

/**
 * The silences between sung lines.
 *
 * A singer needs to know when to come back in as much as what to sing,
 * and a lyric sheet alone does not say. Only gaps AFTER a line count: the
 * time before the first line is an intro, which wants a count-in of its
 * own rather than being treated as a rest in the middle of a song.
 */
export function restsBetween(lines: readonly LyricsLineTiming[]): JamRest[] {
  const rests: JamRest[] = []
  for (let i = 0; i < lines.length - 1; i++) {
    const end = lines[i]!.endSec ?? lines[i + 1]!.startSec
    const next = lines[i + 1]!.startSec
    const gap = next - end
    if (gap < MIN_REST_SEC) continue
    rests.push({
      beforeLine: i + 1,
      startSec: end,
      endSec: next,
      dotCount: Math.min(8, Math.floor(gap)),
    })
  }
  return rests
}

/**
 * The rest currently running, if the song is inside one.
 *
 * Returns the countdown as well as the rest, because "four dots" is not
 * the useful number -- "two left" is.
 */
export function restAt(
  rests: readonly JamRest[],
  positionSec: number,
): { rest: JamRest; secondsLeft: number } | null {
  for (const rest of rests) {
    if (positionSec >= rest.startSec && positionSec < rest.endSec) {
      return { rest, secondsLeft: rest.endSec - positionSec }
    }
  }
  return null
}

/**
 * Can this room actually play this song?
 *
 * Phase 1 answers "only if every peer can fetch it". A local song needs the
 * peer-to-peer transfer (see docs/plans/jam-karaoke-songs.md §1b), so it is
 * refused here with a reason rather than loaded into a room where half the
 * people would sit in silence wondering what broke.
 */
export function songPlayableInRoom(
  song: JamSong,
  peerCount = 0,
): { ok: boolean; reason?: string; warning?: string } {
  // A local song plays perfectly well for the person who owns it. It is
  // only a problem once somebody else is in the room expecting to hear
  // it, so refuse on THAT rather than on the song -- practising alone
  // with your own material is the obvious thing to want, and blocking it
  // to protect a case that is not happening is just being unhelpful.
  if (song.origin === 'local' && peerCount > 0) {
    return {
      ok: false,
      reason:
        'This song is only on your device, so nobody else in the room could hear it. Sharing your own songs is coming — for now pick one everybody can load, or sing it alone.',
    }
  }
  if (!song.stems.instrumental) {
    return { ok: false, reason: 'This song has no backing track to sing over.' }
  }
  if (song.origin === 'local') {
    return {
      ok: true,
      warning:
        'Only you can hear this one — it is on your device, not shared with the room yet.',
    }
  }
  return { ok: true }
}
