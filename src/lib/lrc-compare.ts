// ============================================================
// lrc-compare — measure one mapping against another
// ============================================================
//
// Two enhanced-LRC files of the same song, word for word: how far apart are
// they, where, and in which direction. Used by the Lab's mapping differ and
// by `pnpm lyrics:compare`.
//
// Lifted out of scripts/compare-lrc-timing.mjs, which is now a thin CLI over
// this. The aggregate numbers are unchanged — the same normalisation, the
// same strict positional matching — with the per-line detail the UI needs
// added around them.
//
// Deliberately dependency-free and alias-free: the CLI imports this file
// directly and lets Node strip the types.
//
// Tests: src/tests/lrc-compare.test.ts

const TIMESTAMP_RE = /\[(\d+):(\d+(?:\.\d+)?)\]/g

/** A word and the moment it starts, in seconds. */
export interface CompareWord {
  value: string
  normalized: string
  time: number
}

export interface CompareLine {
  /** Words joined by spaces — the key two files are matched on. */
  normalized: string
  words: CompareWord[]
}

/** Per-word result. `delta` is candidate − reference: positive means late. */
export interface WordDelta {
  lineIdx: number
  wordIdx: number
  word: string
  reference: number
  candidate: number
  delta: number
}

export type LineStatus = 'compared' | 'text-mismatch'

export interface LineComparison {
  /** Zero-based, matching the mapper's own line indices. */
  lineIdx: number
  status: LineStatus
  /** Reference text where there is one, else the candidate's. */
  text: string
  words: WordDelta[]
  /** Mean |delta| over this line's compared words, 0 when none. */
  meanAbsolute: number
  /** Median signed delta for this line — a line late as a whole shows here. */
  medianBias: number
}

export interface LrcComparison {
  lines: LineComparison[]
  comparedWords: number
  /** One-based line numbers, as the CLI has always reported them. */
  mismatchedLines: number[]
  /** One-based `line:word` labels. */
  mismatchedWords: string[]
  /** Every signed delta, for histograms and tolerance shares. */
  deltas: number[]
  meanAbsolute: number
  medianAbsolute: number
  p95Absolute: number
  maxAbsolute: number
  medianBias: number
}

function timestampSeconds(minutes: string, seconds: string): number {
  return Number(minutes) * 60 + Number(seconds)
}

/**
 * Lowercase and strip everything that is not a letter or a digit, so
 * punctuation and capitalisation cannot make two spellings of the same word
 * look like different words.
 */
export function normalizeToken(value: string): string {
  return value.toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, '')
}

export function parseEnhancedLrc(text: string): CompareLine[] {
  const lines: CompareLine[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const matches = [...rawLine.matchAll(TIMESTAMP_RE)]
    if (matches.length === 0) continue

    const words = matches
      .map((match, index) => {
        const start = (match.index ?? 0) + match[0].length
        const end = matches[index + 1]?.index ?? rawLine.length
        const value = rawLine.slice(start, end).trim()
        return {
          value,
          normalized: normalizeToken(value),
          time: timestampSeconds(match[1], match[2]),
        }
      })
      .filter((word) => word.normalized.length > 0)

    lines.push({
      normalized: words.map((word) => word.normalized).join(' '),
      words,
    })
  }
  return lines
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  )
  return sorted[index]
}

function median(values: readonly number[]): number {
  return percentile(
    [...values].sort((a, b) => a - b),
    0.5,
  )
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * Compare two mappings word for word.
 *
 * Matching is strictly positional: line i against line i, word j against
 * word j, and a line whose text differs is reported rather than realigned.
 * Two mappings of the same lyrics line up by construction, and guessing an
 * alignment for ones that do not would quietly invent agreement.
 */
export function compareLrc(
  reference: readonly CompareLine[],
  candidate: readonly CompareLine[],
): LrcComparison {
  const lines: LineComparison[] = []
  const deltas: number[] = []
  const mismatchedLines: number[] = []
  const mismatchedWords: string[] = []
  const count = Math.max(reference.length, candidate.length)

  for (let lineIdx = 0; lineIdx < count; lineIdx++) {
    const expectedLine = reference[lineIdx]
    const actualLine = candidate[lineIdx]
    const text = (expectedLine ?? actualLine)?.normalized ?? ''

    if (
      expectedLine === undefined ||
      actualLine === undefined ||
      expectedLine.normalized !== actualLine.normalized
    ) {
      mismatchedLines.push(lineIdx + 1)
      lines.push({
        lineIdx,
        status: 'text-mismatch',
        text,
        words: [],
        meanAbsolute: 0,
        medianBias: 0,
      })
      continue
    }

    const words: WordDelta[] = []
    const wordCount = Math.max(
      expectedLine.words.length,
      actualLine.words.length,
    )
    for (let wordIdx = 0; wordIdx < wordCount; wordIdx++) {
      const expected = expectedLine.words[wordIdx]
      const actual = actualLine.words[wordIdx]
      if (
        expected === undefined ||
        actual === undefined ||
        expected.normalized !== actual.normalized
      ) {
        mismatchedWords.push(`${lineIdx + 1}:${wordIdx + 1}`)
        continue
      }
      const delta = actual.time - expected.time
      words.push({
        lineIdx,
        wordIdx,
        word: expected.value,
        reference: expected.time,
        candidate: actual.time,
        delta,
      })
      deltas.push(delta)
    }

    const lineDeltas = words.map((word) => word.delta)
    lines.push({
      lineIdx,
      status: 'compared',
      text,
      words,
      meanAbsolute: mean(lineDeltas.map(Math.abs)),
      medianBias: median(lineDeltas),
    })
  }

  const absolute = deltas.map(Math.abs).sort((a, b) => a - b)
  return {
    lines,
    comparedWords: deltas.length,
    mismatchedLines,
    mismatchedWords,
    deltas,
    meanAbsolute: mean(absolute),
    medianAbsolute: percentile(absolute, 0.5),
    p95Absolute: percentile(absolute, 0.95),
    maxAbsolute: absolute.at(-1) ?? 0,
    medianBias: median(deltas),
  }
}

/** Convenience for the common case of two files. */
export function compareLrcText(
  referenceText: string,
  candidateText: string,
): LrcComparison {
  return compareLrc(
    parseEnhancedLrc(referenceText),
    parseEnhancedLrc(candidateText),
  )
}

/**
 * Fraction of compared words within `toleranceSec` of the reference.
 *
 * The headline number: "82% of words land within 100 ms" says more about a
 * mapping than a mean does, because a handful of badly placed words drags a
 * mean far more than it hurts the experience of singing along.
 */
export function shareWithin(
  deltas: readonly number[],
  toleranceSec: number,
): number {
  if (deltas.length === 0) return 0
  const hits = deltas.filter((delta) => Math.abs(delta) <= toleranceSec).length
  return hits / deltas.length
}
