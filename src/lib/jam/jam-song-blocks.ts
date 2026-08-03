// ── Who sings what, as blocks ────────────────────────────────────────
// The parts map says line 7 belongs to Ada. Nobody reads a song that way:
// they read "Ada takes the second verse". Consecutive lines with the same
// singer are one thing, and this turns the map into that thing.
//
// It also answers the question the pitch lanes need -- which NOTES are
// whose -- from the same source, so the lyric column and the lanes can
// never disagree about who is singing.
//
// Pure, and derived rather than stored. The allocation has exactly one
// home (jam-song-parts), and a second copy shaped differently is a second
// copy to keep in step.

import { lineRange } from '@/lib/jam/jam-line-scoring'
import type { JamSongParts } from '@/lib/jam/jam-song-parts'
import { singerOfLine } from '@/lib/jam/jam-song-parts'
import type { JamSongNote, LyricsLineTiming } from '@/lib/jam/types'

export interface SingerBlock {
  /** null means the block belongs to the room. */
  singerId: string | null
  fromLine: number
  toLine: number
  startSec: number
  endSec: number
}

/**
 * Consecutive lines with the same singer, merged.
 *
 * Unassigned runs come back as blocks too, with a null singer, so a caller
 * can walk one list rather than a list plus the gaps between it.
 */
export function groupLinesBySinger(
  lines: readonly LyricsLineTiming[],
  parts: JamSongParts,
): SingerBlock[] {
  const blocks: SingerBlock[] = []
  for (let i = 0; i < lines.length; i++) {
    const singerId = singerOfLine(parts, i)
    const last = blocks[blocks.length - 1]
    const { startSec, endSec } = lineRange(lines, i)
    if (last !== undefined && last.singerId === singerId) {
      last.toLine = i
      last.endSec = endSec
      continue
    }
    blocks.push({ singerId, fromLine: i, toLine: i, startSec, endSec })
  }
  return blocks
}

/** The block a line belongs to, for rendering it in context. */
export function blockOfLine(
  blocks: readonly SingerBlock[],
  lineIndex: number,
): SingerBlock | null {
  return (
    blocks.find((b) => lineIndex >= b.fromLine && lineIndex <= b.toLine) ?? null
  )
}

/**
 * Which singer each note belongs to.
 *
 * By the note's START, not its overlap: a note that begins under Ada's
 * last line and rings into Bo's first is Ada's, because she is the one who
 * has to sing it. Returned aligned to `notes` so a renderer can index
 * rather than search per frame.
 */
export function noteSingers(
  notes: readonly JamSongNote[],
  blocks: readonly SingerBlock[],
): Array<string | null> {
  return notes.map((n) => {
    for (const b of blocks) {
      if (n.startSec >= b.startSec && n.startSec < b.endSec) return b.singerId
    }
    // Outside every lyric line -- an intro riff or an outro. Nobody's in
    // particular, so everybody's.
    return null
  })
}

/**
 * How long before a block starts a singer should be warned.
 *
 * Long enough to draw breath and find the note, short enough that it is
 * not lit for most of the song.
 */
export const LEAD_IN_SEC = 4

/**
 * Is this singer about to come in?
 *
 * Used to accent rather than to filter. Somebody who cannot see the other
 * parts cannot follow the song, so nothing is ever hidden -- their own
 * upcoming notes simply get louder on the way in.
 */
export function isComingUp(
  blocks: readonly SingerBlock[],
  singerId: string | null,
  positionSec: number,
  leadSec = LEAD_IN_SEC,
): boolean {
  if (singerId === null) return false
  return blocks.some(
    (b) =>
      b.singerId === singerId &&
      b.startSec > positionSec &&
      b.startSec - positionSec <= leadSec,
  )
}

/** The singer of the block under the playhead, or null. */
export function singerAt(
  blocks: readonly SingerBlock[],
  positionSec: number,
): string | null {
  for (const b of blocks) {
    if (positionSec >= b.startSec && positionSec < b.endSec) return b.singerId
  }
  return null
}
