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
// Writing needs no dependency: every scalar is double-quoted and JSON-escaped,
// which is exactly the subset YAML and JSON agree on. **Reading does** — real
// files come from other tools and use the whole language — so `parseLyricsfile`
// imports the `yaml` package dynamically. It is on nobody's first-paint path;
// the parser loads the first time somebody opens a `.lyricsfile` and never
// otherwise. Hand-rolling one for text full of apostrophes, quotes and colons
// is the classic version of this mistake.
//
// The one real trap, called out in the spec: **concatenating a line's word
// texts must reconstruct the line exactly.** Spacing lives inside the word
// strings. The app's `split(/\s+/)` model throws it away, so `splitWithSpacing`
// exists to put it back rather than assuming one space between words.

import type { WordSweepPoint, WordSweepTimingsMap, WordTimingsMap, } from '@/features/stem-mixer/types'
import { formatTimeLrc } from './lrc-generator'
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
    // All or nothing. `start_ms` is required on a word, so an untimed one
    // could only be fabricated or omitted — and omitting it shifts every word
    // after it by a position, which lands the rest of the line's timings on
    // the wrong words. A half-mapped line has no faithful word-level form in
    // this spec, so it ships with its line timing alone.
    const fullyTimed =
      words.length > 0 && words.every((_word, i) => starts[i] !== undefined)
    if (!fullyTimed) continue

    out.push('    words:')
    for (const [wordIdx, word] of words.entries()) {
      out.push(`      - text: ${scalar(word)}`)
      out.push(`        start_ms: ${ms(starts[wordIdx])}`)
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

// ── Reading ──────────────────────────────────────────────────────

export interface ParsedLyricsfile {
  metadata: LyricsfileMetadata
  lines: LrcLine[]
  wordTimings: WordTimingsMap
  wordEndTimings: WordTimingsMap
  wordSweepTimings: WordSweepTimingsMap
}

/**
 * Read a lyricsfile 1.0 document.
 *
 * Returns null for anything that is not one rather than throwing: the caller
 * is an upload handler, and a mistyped file is a normal thing for a person to
 * do. Every field is validated on the way in — a file from another tool is
 * untrusted input, and a `start_ms` of `"soon"` must not become `NaN`
 * timestamps three layers down.
 *
 * The parser is imported here rather than at module scope so it stays off the
 * path of everyone who never opens one of these.
 */
export async function parseLyricsfile(
  text: string,
): Promise<ParsedLyricsfile | null> {
  let doc: unknown
  try {
    const { parse } = await import('yaml')
    doc = parse(text)
  } catch {
    return null
  }
  if (!isRecord(doc)) return null

  const rawLines = doc.lines
  if (!Array.isArray(rawLines)) return null

  const lines: LrcLine[] = []
  const wordTimings: WordTimingsMap = {}
  const wordEndTimings: WordTimingsMap = {}

  for (const raw of rawLines) {
    if (!isRecord(raw)) continue
    const lineText = typeof raw.text === 'string' ? raw.text : null
    const startMs = finiteNumber(raw.start_ms)
    if (lineText === null || startMs === null) continue

    const lineIdx = lines.length
    lines.push({ time: startMs / 1000, text: lineText })

    if (!Array.isArray(raw.words)) continue
    // Word indices come from position in the list, which is what the spec
    // says and what makes the writer's all-or-nothing rule matter: a list with
    // a word missing would silently shift every timing after it.
    const starts: number[] = []
    const ends: number[] = []
    let sawStart = false
    let sawEnd = false
    for (const [wordIdx, word] of raw.words.entries()) {
      if (!isRecord(word)) continue
      const wordStart = finiteNumber(word.start_ms)
      if (wordStart !== null) {
        starts[wordIdx] = wordStart / 1000
        sawStart = true
      }
      const wordEnd = finiteNumber(word.end_ms)
      if (wordEnd !== null) {
        ends[wordIdx] = wordEnd / 1000
        sawEnd = true
      }
    }
    if (sawStart) wordTimings[lineIdx] = starts
    if (sawEnd) wordEndTimings[lineIdx] = ends
  }

  if (lines.length === 0) return null

  return {
    metadata: parseMetadata(doc.metadata),
    lines,
    wordTimings,
    wordEndTimings,
    wordSweepTimings: parseSweeps(doc[LYRICSFILE_SWEEPS_KEY]),
  }
}

function parseMetadata(raw: unknown): LyricsfileMetadata {
  if (!isRecord(raw)) return {}
  const out: LyricsfileMetadata = {}
  if (typeof raw.title === 'string') out.title = raw.title
  if (typeof raw.artist === 'string') out.artist = raw.artist
  if (typeof raw.album === 'string') out.album = raw.album
  if (typeof raw.language === 'string') out.language = raw.language
  if (typeof raw.instrumental === 'boolean') out.instrumental = raw.instrumental
  const duration = finiteNumber(raw.duration_ms)
  if (duration !== null) out.durationMs = duration
  const offset = finiteNumber(raw.offset_ms)
  if (offset !== null) out.offsetMs = offset
  return out
}

/**
 * Read back the namespaced sweep block.
 *
 * Lossy-optional in both directions: anything malformed is dropped rather than
 * failing the file, because a reader that ignores this key entirely is still a
 * conforming reader.
 */
function parseSweeps(raw: unknown): WordSweepTimingsMap {
  const out: WordSweepTimingsMap = {}
  if (!isRecord(raw)) return out
  for (const [lineKey, words] of Object.entries(raw)) {
    const lineIdx = Number(lineKey)
    if (!Number.isInteger(lineIdx) || lineIdx < 0 || !isRecord(words)) continue
    const perWord: Record<number, WordSweepPoint[]> = {}
    for (const [wordKey, points] of Object.entries(words)) {
      const wordIdx = Number(wordKey)
      if (!Number.isInteger(wordIdx) || wordIdx < 0 || !Array.isArray(points)) {
        continue
      }
      const curve: WordSweepPoint[] = []
      for (const point of points) {
        if (!isRecord(point)) continue
        const time = finiteNumber(point.t)
        const progress = finiteNumber(point.p)
        if (time === null || progress === null) continue
        curve.push({
          time: time / 1000,
          progress: Math.max(0, Math.min(1, progress)),
        })
      }
      if (curve.length > 0) perWord[wordIdx] = curve
    }
    if (Object.keys(perWord).length > 0) out[lineIdx] = perWord
  }
  return out
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A real number, or null. Rejects NaN, Infinity, strings and booleans. */
function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * A parsed lyricsfile as enhanced LRC text.
 *
 * The rest of the app speaks LRC — the parser, the canonical builder, the
 * version store and every renderer. Converting on the way in means a
 * `.lyricsfile` import reuses all of it instead of growing a second pipeline
 * that has to be kept in step.
 *
 * `offset_ms` becomes an `[offset:]` ID tag rather than being applied here, so
 * it goes through `parseLrcOffsetTag` — the one place that already knows the
 * sign convention and shifts the embedded word stamps to match.
 */
export function lyricsfileToLrc(parsed: ParsedLyricsfile): string {
  const head =
    parsed.metadata.offsetMs !== undefined && parsed.metadata.offsetMs !== 0
      ? [`[offset:${Math.round(parsed.metadata.offsetMs)}]`]
      : []

  const body = parsed.lines.map((line, lineIdx) => {
    const words = splitWithSpacing(line.text).map((word) => word.trim())
    const starts = parsed.wordTimings[lineIdx]
    if (starts === undefined || words.length === 0) {
      return `[${formatTimeLrc(line.time)}] ${line.text}`
    }
    return words
      .map((word, wordIdx) => {
        const start = starts[wordIdx]
        return start === undefined ? word : `[${formatTimeLrc(start)}] ${word}`
      })
      .join(' ')
  })

  return [...head, ...body].join('\n')
}
