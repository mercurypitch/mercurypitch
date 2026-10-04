// ============================================================
// Lyric line at — which line is being sung at a moment of the song
// ============================================================
//
// The rule the lyric sheet follows, kept on its own so that what has to agree
// with the sheet can ask it too: the iOS lyrics window works the whole song
// out ahead of time (lyric-window-script.ts) and must light the line the
// stage would.
//
// Timed lyrics: the last line (or rest) whose time has come, numbered as the
// canonical lines number it, -1 before the first. Untimed lyrics: the song
// shared evenly between the lines, which needs the song's length. With
// neither there is no rule, and null says so: the sheet keeps the line it
// had.

import { getCurrentLineIndex } from './lyrics-service'

/** A timed line as the rule reads it: when it starts, and its number. */
export interface TimedLyricLine {
  readonly time: number
  readonly canonicalIndex: number
}

/**
 * The number of the line being sung `elapsed` seconds into the song, or null
 * when the lyrics give no way to tell. `timed` is in song order.
 */
export function lyricLineAt(
  timed: readonly TimedLyricLine[],
  untimedCount: number,
  elapsed: number,
  duration: number,
): number | null {
  if (timed.length > 0) {
    let index = -1
    for (const line of timed) {
      if (line.time > elapsed) break
      index = line.canonicalIndex
    }
    return index
  }
  if (untimedCount > 0 && duration > 0) {
    return getCurrentLineIndex(untimedCount, elapsed, duration)
  }
  return null
}
