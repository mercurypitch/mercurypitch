// ── Who sings which line ─────────────────────────────────────────────
// Lead and backing, verse-swapping, one person taking the chorus.
//
// The departure from Harmony and Relay: those derive roles from the
// sorted peer list, because nothing about a melody says who sings what.
// A song DOES -- the allocation is authored, by the host, against the
// lyric sheet. So this is state that travels with the song rather than a
// function of the room's shape.
//
// Deliberately a flat line -> peer map rather than the stem mixer's
// LyricsBlock model. Blocks carry repeat counts, labels and an edit layer
// that only make sense inside an editor, and importing that model here
// would drag in the very controller the refactor is meant to break up.
// A map is what the room needs and all it needs; blocks can project onto
// it later without either side changing.

import type { LyricsLineTiming } from '@/lib/jam/types'

/** Line index -> peer id. Absent means the line belongs to everyone. */
export type JamSongParts = Record<number, string>

/** The id meaning "everyone sings this", used by the assignment UI. */
export const EVERYONE = ''

/**
 * Whose line is this?
 *
 * Unassigned lines belong to the room. A song with no assignments at all
 * is therefore a unison singalong, which is the sane default and what
 * most rooms will ever do -- the feature costs nothing until it is used.
 */
export function singerOfLine(
  parts: JamSongParts,
  lineIndex: number,
): string | null {
  const id = parts[lineIndex]
  return id === undefined || id === EVERYONE ? null : id
}

/** Do I sing this line? True for unassigned lines, which are everyone's. */
export function isMyLine(
  parts: JamSongParts,
  lineIndex: number,
  myPeerId: string | null,
): boolean {
  const singer = singerOfLine(parts, lineIndex)
  if (singer === null) return true
  return myPeerId !== null && singer === myPeerId
}

/** Assign a line, or hand it back to the room with EVERYONE. */
export function assignLine(
  parts: JamSongParts,
  lineIndex: number,
  peerId: string,
): JamSongParts {
  const next = { ...parts }
  if (peerId === EVERYONE) delete next[lineIndex]
  else next[lineIndex] = peerId
  return next
}

/**
 * Assign a run of lines in one gesture.
 *
 * Because the unit people think in is a verse, not a line. Assigning a
 * chorus one line at a time is the kind of tedium that stops a feature
 * from being used at all.
 */
export function assignRange(
  parts: JamSongParts,
  fromLine: number,
  toLine: number,
  peerId: string,
): JamSongParts {
  const lo = Math.min(fromLine, toLine)
  const hi = Math.max(fromLine, toLine)
  let next = parts
  for (let i = lo; i <= hi; i++) next = assignLine(next, i, peerId)
  return next
}

/**
 * Re-home the lines of people who have left.
 *
 * The rule is that a part never falls silent. When a singer goes, their
 * lines pass to whoever is still here -- and if nobody is left to take
 * them, back to the room rather than to a peer id that no longer exists.
 * Silence in the middle of a song reads as a bug, and nobody in the room
 * can tell it apart from one.
 *
 * `presentIds` should include the host: the host is a singer like anyone
 * else and is the natural fallback, being the one who cannot leave
 * without ending the room.
 */
export function rehomeDeparted(
  parts: JamSongParts,
  presentIds: readonly string[],
): JamSongParts {
  const present = new Set(presentIds)
  const next: JamSongParts = {}
  let changed = false
  for (const [key, singer] of Object.entries(parts)) {
    const line = Number(key)
    if (present.has(singer)) {
      next[line] = singer
      continue
    }
    changed = true
    // Hand to the next singer along, so a two-singer song stays a
    // conversation rather than collapsing onto one voice. Falls through to
    // the room when there is nobody to hand to.
    const heir = presentIds[0]
    if (heir !== undefined) next[line] = heir
  }
  return changed ? next : parts
}

/** Every peer who has a line, in the order their first line appears. */
export function singersInSong(parts: JamSongParts): string[] {
  const seen: string[] = []
  for (const key of Object.keys(parts)
    .map(Number)
    .sort((a, b) => a - b)) {
    const id = parts[key]
    if (id !== undefined && id !== EVERYONE && !seen.includes(id)) {
      seen.push(id)
    }
  }
  return seen
}

/**
 * The lines I am next expected to sing, for a "you're up" cue.
 *
 * Returns the start of my next run of lines after `positionSec`, so the
 * room can warn a backing singer that their verse is coming rather than
 * leaving them to watch the lyric column and hope.
 */
export function nextLineFor(
  lines: readonly LyricsLineTiming[],
  parts: JamSongParts,
  myPeerId: string | null,
  positionSec: number,
): { lineIndex: number; startSec: number } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined || line.startSec <= positionSec) continue
    // Only an ASSIGNED line is worth a cue. Everyone's lines are nobody's
    // cue -- warning the whole room about every line is just the lyrics.
    if (singerOfLine(parts, i) === null) continue
    if (isMyLine(parts, i, myPeerId)) {
      return { lineIndex: i, startSec: line.startSec }
    }
  }
  return null
}
