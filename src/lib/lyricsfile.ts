// ============================================================
// lyricsfile 1.0 — serialising a mapping to the interchange format
// ============================================================
//
// Enhanced LRC is what the app has always exported, and it is lossy in ways
// that matter here: no per-word end times, no duration, no language, no way to
// say "this whole file is 200 ms early". `lyricsfile` carries all of it, and
// LRCLib's live API already returns one, so writing it is a door rather than a
// fork.
//
// **This module writes only.** Reading needs a YAML parser, which is a new
// client dependency; hand-rolling one for text that is full of apostrophes,
// quotes and colons is the classic version of this mistake. The decision is
// recorded as open in docs/plans/lrc-mapper-studio-plan.md (Phase 1) — until
// it is taken, an export that no reader here can round-trip is still worth
// having, because the readers that matter are elsewhere.
//
// The one real trap, called out in the spec: **concatenating a line's word
// texts must reconstruct the line exactly.** Spacing lives inside the word
// strings. The app's `split(/\s+/)` model throws it away, so `splitWithSpacing`
// exists to put it back rather than assuming one space between words.

import type { WordSweepTimingsMap, WordTimingsMap, } from '@/features/stem-mixer/types'
import type { LrcLine } from './lyrics-service'

/** Sweeps have no home in the 1.0 spec — see `LYRICSFILE_SWEEPS_KEY`. */
export const LYRICSFILE_VERSION = '1.0'

/**
 * Where sub-word split points go.
 *
 * The spec defines no extension mechanism and no rule for unknown fields, so
 * this is namespaced and **lossy-optional**: a reader that drops it still gets
 * a completely valid word-synced file. Proposing a sweep extension upstream is
 * the right long game; silently inventing a top-level field is not.
 */
export const LYRICSFILE_SWEEPS_KEY = 'x_mercurypitch_sweeps'

export interface LyricsfileMetadata {
  title?: string
  artist?: string
  album?: string
  durationMs?: number
  offsetMs?: number
  language?: string
  instrumental?: boolean
}

export interface SerialiseLyricsfileInput {
  lines: readonly LrcLine[]
  metadata?: LyricsfileMetadata
  /** Word starts, keyed by line index then word index. */
  wordTimings?: WordTimingsMap
  /** Word ends, same indices. */
  wordEndTimings?: WordTimingsMap
  /** Sub-word split curves, written under the namespaced key. */
  wordSweepTimings?: WordSweepTimingsMap
}

/**
 * A line's words with their spacing intact, so `join('')` is the line again.
 *
 * Trailing whitespace attaches to the word before it and any leading
 * whitespace to the first word, which keeps the count equal to what
 * `split(/\s+/)` produces — the indices every timing map in the app is keyed
 * by. An empty line yields no words rather than one empty one.
 */
export function splitWithSpacing(line: string): string[] {
  const matches = [...line.matchAll(/\S+/g)]
  if (matches.length === 0) return []
  // Each word owns the whitespace that FOLLOWS it, and the first also owns
  // whatever came before it. Taking the preceding gap instead would hand the
  // same characters to two words and lose the rest of the line.
  return matches.map((match, i) => {
    const start = i === 0 ? 0 : match.index
    const end = i === matches.length - 1 ? line.length : matches[i + 1].index
    return line.slice(start, end)
  })
}

/** Seconds to whole milliseconds, which is the unit the spec uses. */
const ms = (seconds: number): number => Math.round(seconds * 1000)

/**
 * Quote a YAML scalar.
 *
 * Always quoted, never guessed at: lyrics are full of colons, apostrophes,
 * leading dashes and words like `no` and `on` that a bare scalar would turn
 * into something else. Double quotes with JSON escaping is exactly the subset
 * YAML shares with JSON, so this cannot produce something a YAML reader
 * misreads.
 */
function scalar(value: string): string {
  return JSON.stringify(value)
}

/**
 * Serialise a mapping as a lyricsfile 1.0 document.
 *
 * `plain` is written alongside `lines` because the spec carries both and a
 * reader that wants only the text should not have to reassemble it.
 */
export function serialiseLyricsfile(input: SerialiseLyricsfileInput): string {
  const out: string[] = [`version: ${scalar(LYRICSFILE_VERSION)}`]

  const meta = input.metadata ?? {}
  const metaEntries: [string, string][] = []
  if (meta.title !== undefined) metaEntries.push(['title', scalar(meta.title)])
  if (meta.artist !== undefined) {
    metaEntries.push(['artist', scalar(meta.artist)])
  }
  if (meta.album !== undefined) metaEntries.push(['album', scalar(meta.album)])
  if (meta.durationMs !== undefined) {
    metaEntries.push(['duration_ms', String(Math.round(meta.durationMs))])
  }
  if (meta.offsetMs !== undefined) {
    metaEntries.push(['offset_ms', String(Math.round(meta.offsetMs))])
  }
  if (meta.language !== undefined) {
    metaEntries.push(['language', scalar(meta.language)])
  }
  if (meta.instrumental !== undefined) {
    metaEntries.push(['instrumental', String(meta.instrumental)])
  }
  if (metaEntries.length > 0) {
    out.push('metadata:')
    for (const [key, value] of metaEntries) out.push(`  ${key}: ${value}`)
  }

  out.push('lines:')
  for (const [lineIdx, line] of input.lines.entries()) {
    out.push(`  - text: ${scalar(line.text)}`)
    out.push(`    start_ms: ${ms(line.time)}`)

    const starts = input.wordTimings?.[lineIdx]
    const ends = input.wordEndTimings?.[lineIdx]
    const lineEnd = lineEndMs(input, lineIdx)
    if (lineEnd !== undefined) out.push(`    end_ms: ${lineEnd}`)
    if (starts === undefined) continue

    const words = splitWithSpacing(line.text)
    // A word with no start has no place in the spec's model, and guessing one
    // would put a fabricated timing in an interchange file.
    const timed = words.some((_word, i) => starts[i] !== undefined)
    if (!timed) continue

    out.push('    words:')
    for (const [wordIdx, word] of words.entries()) {
      const start = starts[wordIdx]
      if (start === undefined) continue
      out.push(`      - text: ${scalar(word)}`)
      out.push(`        start_ms: ${ms(start)}`)
      const end = ends?.[wordIdx]
      if (end !== undefined) out.push(`        end_ms: ${ms(end)}`)
    }
  }

  out.push(`plain: ${scalar(input.lines.map((line) => line.text).join('\n'))}`)

  const sweeps = serialiseSweeps(input.wordSweepTimings)
  if (sweeps !== null) out.push(sweeps)

  return `${out.join('\n')}\n`
}

/** The line's audible end: its last timed word's end, if there is one. */
function lineEndMs(
  input: SerialiseLyricsfileInput,
  lineIdx: number,
): number | undefined {
  const ends = input.wordEndTimings?.[lineIdx]
  if (ends === undefined) return undefined
  let latest: number | undefined
  for (const end of ends) {
    if (end === undefined) continue
    if (latest === undefined || end > latest) latest = end
  }
  return latest === undefined ? undefined : ms(latest)
}

/** The namespaced sweep block, or null when nothing was split. */
function serialiseSweeps(
  sweeps: WordSweepTimingsMap | undefined,
): string | null {
  if (sweeps === undefined) return null
  const lineKeys = Object.keys(sweeps)
    .map(Number)
    .filter((key) => Object.keys(sweeps[key] ?? {}).length > 0)
    .sort((a, b) => a - b)
  if (lineKeys.length === 0) return null

  const out = [`${LYRICSFILE_SWEEPS_KEY}:`]
  for (const lineIdx of lineKeys) {
    out.push(`  "${lineIdx}":`)
    const words = sweeps[lineIdx]
    for (const wordIdx of Object.keys(words)
      .map(Number)
      .sort((a, b) => a - b)) {
      const points = words[wordIdx]
      if (points.length === 0) continue
      out.push(`    "${wordIdx}":`)
      for (const point of points) {
        out.push(
          `      - { t: ${ms(point.time)}, p: ${Number(point.progress.toFixed(4))} }`,
        )
      }
    }
  }
  return out.join('\n')
}
