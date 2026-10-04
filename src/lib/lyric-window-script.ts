// ============================================================
// Lyric window script — the song's lyrics, worked out ahead for iOS
// ============================================================
//
// iOS's picture-in-picture window is drawn by the app's native half, while
// the page sits hidden behind another app and cannot run a frame. So the
// page works the whole song out once, whenever the lyrics or the song's
// length change, and hands native a script: which line is being sung from
// when, the line after it, and when each of its words fills. Native runs the
// song's clock against it (docs/plans/mobile-native/ios-lyrics-window.md).
//
// It is read off the functions the stage lights its words with, the line rule
// (lyric-line-at.ts) and the glance with its per-line progress
// (lyric-glance.ts), sampled every 20 ms, so the window and the stage cannot
// disagree by more than a sample. A frame of the window is 66 ms.

import type { GlanceLine } from './lyric-glance'
import { lineProgress, lyricGlance } from './lyric-glance'
import type { TimedLyricLine } from './lyric-line-at'
import { lyricLineAt } from './lyric-line-at'

/** One stretch of the song with one line being sung, or a rest. */
export interface LyricWindowSegment {
  /** Seconds into the song; it runs until the next segment's `at`. */
  readonly at: number
  /** The words of the line being sung; none in a rest or the intro. */
  readonly current: readonly string[]
  /** The next line with words, or null after the last. */
  readonly next: string | null
  /** Per word of `current`: when it starts to fill, and when it is lit. */
  readonly words: readonly (readonly [number, number])[]
}

export interface LyricWindowScript {
  readonly title: string
  /** The song's length in seconds, 0 while it is not known. */
  readonly duration: number
  /** In song order, the first at 0. */
  readonly segments: readonly LyricWindowSegment[]
}

/** What the room's lyrics give the script. */
export interface LyricWindowSource {
  readonly title: string
  /** The parsed lines the stage renders, keyed as the line rule numbers them. */
  readonly lines: ReadonlyMap<number, GlanceLine>
  /** Timed lines in song order; none for untimed lyrics. */
  readonly timed: readonly TimedLyricLine[]
  /** How many untimed lines there are. */
  readonly untimedCount: number
  /** The song's length in seconds, 0 while it is not known. */
  readonly duration: number
}

/** How often the stage's functions are asked, in seconds. */
const STEP = 0.02

/** Seconds to the millisecond: the script crosses the bridge as JSON. */
const ms = (seconds: number): number => Math.round(seconds * 1000) / 1000

/** The last moment the lyrics speak of, for a song with no length yet. */
function lyricsEnd(source: LyricWindowSource): number {
  let end = 0
  for (const line of source.lines.values()) {
    end = Math.max(end, line.endTime ?? line.time ?? 0)
  }
  for (const line of source.timed) end = Math.max(end, line.time)
  return end
}

/** A segment while its samples come in. */
interface OpenSegment {
  readonly index: number
  readonly at: number
  readonly current: readonly string[]
  readonly next: string | null
  /** The line being sung, when there is one with words. */
  readonly line: GlanceLine | undefined
  readonly starts: (number | undefined)[]
  readonly ends: (number | undefined)[]
}

/** Where the voice is at `t` in the segment's line, word by word. */
function sample(segment: OpenSegment, line: GlanceLine, t: number): void {
  const { sungUpTo, sweep } = lineProgress(line, t)
  for (let i = 0; i < segment.current.length; i++) {
    const lit = i <= sungUpTo
    if (lit || (i === sungUpTo + 1 && sweep > 0)) segment.starts[i] ??= t
    if (lit) segment.ends[i] ??= t
  }
}

/** A segment as native takes it; a word never reached fills at its end. */
function close(segment: OpenSegment, until: number): LyricWindowSegment {
  return {
    at: ms(segment.at),
    current: segment.current,
    next: segment.next,
    words: segment.current.map((_, i) => {
      const start = segment.starts[i] ?? until
      const end = segment.ends[i] ?? until
      return [ms(start), ms(Math.max(start, end))] as const
    }),
  }
}

export function lyricWindowScript(
  source: LyricWindowSource,
): LyricWindowScript {
  const duration = source.duration > 0 ? source.duration : 0
  const end = duration > 0 ? duration : lyricsEnd(source)
  const segments: OpenSegment[] = []
  let open: OpenSegment | null = null
  const samples = Math.floor(end / STEP)
  for (let k = 0; k <= samples; k++) {
    const t = k * STEP
    const index =
      lyricLineAt(source.timed, source.untimedCount, t, duration) ?? -1
    if (open === null || index !== open.index) {
      const glance = lyricGlance(source.lines, index)
      open = {
        index,
        at: t,
        current: glance.words,
        next: glance.next,
        line: glance.current === null ? undefined : source.lines.get(index),
        starts: [],
        ends: [],
      }
      segments.push(open)
    }
    if (open.line !== undefined) sample(open, open.line, t)
  }
  return {
    title: source.title,
    duration: ms(duration),
    segments: segments.map((segment, i) =>
      close(segment, segments[i + 1]?.at ?? end),
    ),
  }
}
