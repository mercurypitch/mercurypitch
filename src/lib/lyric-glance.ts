// ============================================================
// Lyric glance — the line being sung and the one after it, as plain text
// ============================================================
//
// What a surface too small for the lyric sheet shows instead: Android's
// picture-in-picture window, a few centimetres across, where the Karaoke
// room puts the current line big and the next one under it. The zen stage
// keeps its own sheet; this reads the same map it renders from, so the two
// cannot disagree about which line is on.
//
// A rest has no words. During one the line being sung is nothing, and the
// next is the line the singer is waiting for, as it is before the first.

/** One line of the parsed lyrics, as far as a glance needs it. */
export interface GlanceLine {
  readonly words: readonly string[]
}

export interface LyricGlance {
  /** The line being sung, or null in a rest, the intro or a song without lyrics. */
  readonly current: string | null
  /** The next line with words, or null after the last one. */
  readonly next: string | null
}

export const NO_LYRIC_GLANCE: LyricGlance = { current: null, next: null }

const text = (line: GlanceLine | undefined): string | null =>
  line === undefined || line.words.length === 0 ? null : line.words.join(' ')

/**
 * The glance at `currentIndex`, a key of `lines` (-1 before the first line).
 * Keys are in song order, as the lyrics controller numbers them.
 */
export function lyricGlance(
  lines: ReadonlyMap<number, GlanceLine>,
  currentIndex: number,
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
  return { current: text(lines.get(currentIndex)), next }
}
