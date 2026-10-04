// ============================================================
// Lyric glance — the line being sung and the one after it
// ============================================================
//
// What a surface too small for the lyric sheet shows instead: Android's
// picture-in-picture window, a few centimetres across, where the Karaoke
// room puts the current line big and the next one under it. The zen stage
// keeps its own sheet; this reads the same map it renders from, so the two
// cannot disagree about which line is on.
//
// The line being sung also says how far through it the voice is, worked out
// as the stage works out its highlight (computeActiveWord), so the window
// lights the words the stage would. A line with no timing is all lit.
//
// A rest has no words. During one the line being sung is nothing, and the
// next is the line the singer is waiting for, as it is before the first.

import { computeActiveWord } from './lyrics-service'

/** A line's per-word highlight curves, as the highlight reads them. */
type WordSweeps = Parameters<typeof computeActiveWord>[6]

/** One line of the parsed lyrics, as far as a glance needs it. */
export interface GlanceLine {
  readonly words: readonly string[]
  /** When the line starts and ends, where it is timed. */
  readonly time?: number
  readonly endTime?: number
  readonly wordTimes?: readonly number[]
  readonly wordEndTimes?: readonly number[]
  readonly wordSweeps?: WordSweeps
}

export interface LyricGlance {
  /** The line being sung, or null in a rest, the intro or a song without lyrics. */
  readonly current: string | null
  /** The next line with words, or null after the last one. */
  readonly next: string | null
  /** The words of `current`, empty when there is no current line. */
  readonly words: readonly string[]
  /** The last of `words` sung through, -1 before the first. */
  readonly sungUpTo: number
  /** How far into the word after `sungUpTo` the voice is, 0 to 1. */
  readonly sweep: number
}

export const NO_LYRIC_GLANCE: LyricGlance = {
  current: null,
  next: null,
  words: [],
  sungUpTo: -1,
  sweep: 0,
}

const text = (line: GlanceLine | undefined): string | null =>
  line === undefined || line.words.length === 0 ? null : line.words.join(' ')

/**
 * How far the voice is through `line` at `elapsed` seconds into the song.
 * Also what the iOS lyrics window's script is read off (lyric-window-script.ts).
 */
export function lineProgress(
  line: GlanceLine,
  elapsed: number | undefined,
): Pick<LyricGlance, 'sungUpTo' | 'sweep'> {
  if (
    elapsed === undefined ||
    line.time === undefined ||
    line.endTime === undefined
  ) {
    return { sungUpTo: line.words.length - 1, sweep: 0 }
  }
  const active = computeActiveWord(
    line.words,
    line.time,
    line.endTime,
    line.wordTimes,
    elapsed,
    line.wordEndTimes,
    line.wordSweeps,
  )
  return { sungUpTo: active.activeUpTo, sweep: active.fraction }
}

/**
 * The glance at `currentIndex`, a key of `lines` (-1 before the first line),
 * `elapsed` seconds into the song. Keys are in song order, as the lyrics
 * controller numbers them.
 */
export function lyricGlance(
  lines: ReadonlyMap<number, GlanceLine>,
  currentIndex: number,
  elapsed?: number,
): LyricGlance {
  let next: string | null = null
  let nextIndex = Number.POSITIVE_INFINITY
  for (const [index, line] of lines) {
    if (index <= currentIndex || index >= nextIndex) continue
    const words = text(line)
    if (words === null) continue
    next = words
    nextIndex = index
  }
  const line = lines.get(currentIndex)
  const current = text(line)
  if (line === undefined || current === null) {
    return { ...NO_LYRIC_GLANCE, next }
  }
  return { current, next, words: line.words, ...lineProgress(line, elapsed) }
}
