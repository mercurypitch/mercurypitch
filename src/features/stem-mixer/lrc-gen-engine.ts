// ============================================================
// LRC Gen Engine — pure functions extracted from handleLrcGenFinish
// ============================================================
//
// These functions implement the partial merge, interpolation, and
// monotonic enforcement logic used when the user finishes an LRC
// generation session (whether they mapped all lines or only a subset).
//
// Tests: src/tests/lrc-gen-partial-merge.test.ts

import type { CanonicalLrcEntry, WordSweepPoint, WordSweepTimingsMap, WordTimingsMap, } from '@/features/stem-mixer/types'
import { estimateUnmappedTimes } from '@/lib/lrc-generator'

function isMappableLine(line: string | undefined): boolean {
  const text = line?.trim()
  return text !== undefined && text !== '' && text !== '~Rest~'
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Convert JSON's null-filled sparse arrays back to optional lyric times. */
export function restoreLineTimes(
  value: unknown,
  lineCount: number,
): (number | undefined)[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, Math.max(0, lineCount))
    .map((time) => (isTime(time) ? time : undefined))
}

/** Validate a line-indexed timing map recovered from localStorage. */
export function restoreWordTimingsMap(
  value: unknown,
  lineCount: number,
): WordTimingsMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  const restored: WordTimingsMap = {}
  for (const [rawLineIdx, rawTimes] of Object.entries(value)) {
    const lineIdx = Number(rawLineIdx)
    if (
      !Number.isInteger(lineIdx) ||
      lineIdx < 0 ||
      lineIdx >= lineCount ||
      !Array.isArray(rawTimes)
    ) {
      continue
    }
    const times: number[] = []
    for (let wordIdx = 0; wordIdx < rawTimes.length; wordIdx++) {
      if (isTime(rawTimes[wordIdx])) times[wordIdx] = rawTimes[wordIdx]
    }
    if (times.length > 0) restored[lineIdx] = times
  }
  return restored
}

/** Validate compact marker curves recovered from localStorage. */
export function restoreWordSweepTimingsMap(
  value: unknown,
  lineCount: number,
): WordSweepTimingsMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  const restored: WordSweepTimingsMap = {}
  for (const [rawLineIdx, rawWords] of Object.entries(value)) {
    const lineIdx = Number(rawLineIdx)
    if (
      !Number.isInteger(lineIdx) ||
      lineIdx < 0 ||
      lineIdx >= lineCount ||
      typeof rawWords !== 'object' ||
      rawWords === null ||
      Array.isArray(rawWords)
    ) {
      continue
    }
    const words: WordSweepTimingsMap[number] = {}
    for (const [rawWordIdx, rawPoints] of Object.entries(rawWords)) {
      const wordIdx = Number(rawWordIdx)
      if (
        !Number.isInteger(wordIdx) ||
        wordIdx < 0 ||
        !Array.isArray(rawPoints)
      ) {
        continue
      }
      const points = rawPoints
        .slice(0, 512)
        .filter((point): point is WordSweepPoint => {
          if (typeof point !== 'object' || point === null) return false
          const candidate = point as { time?: unknown; progress?: unknown }
          return (
            isTime(candidate.time) &&
            typeof candidate.progress === 'number' &&
            Number.isFinite(candidate.progress) &&
            candidate.progress >= 0 &&
            candidate.progress <= 1
          )
        })
      if (points.length > 0) words[wordIdx] = points
    }
    if (Object.keys(words).length > 0) restored[lineIdx] = words
  }
  return restored
}

/**
 * Restore the explicit set of lines changed by an interrupted mapping session.
 *
 * Older saved payloads did not include this set. For those, completed lines
 * before the saved cursor are the safest recoverable approximation of the
 * mapper's forward-only workflow.
 */
export function restoreTouchedLines(params: {
  savedTouchedLines: unknown
  lines: readonly string[]
  lineIdx: number
  wordIdx: number
}): Set<number> {
  const { savedTouchedLines, lines, lineIdx, wordIdx } = params
  if (Array.isArray(savedTouchedLines)) {
    return new Set(
      savedTouchedLines.filter(
        (index): index is number =>
          typeof index === 'number' &&
          Number.isInteger(index) &&
          index >= 0 &&
          index < lines.length &&
          isMappableLine(lines[index]),
      ),
    )
  }

  const restored = new Set<number>()
  const cursor = Number.isFinite(lineIdx)
    ? Math.max(0, Math.min(lines.length, Math.trunc(lineIdx)))
    : 0
  for (let index = 0; index < cursor; index++) {
    if (isMappableLine(lines[index])) restored.add(index)
  }
  if (wordIdx > 0 && cursor < lines.length && isMappableLine(lines[cursor])) {
    restored.add(cursor)
  }
  return restored
}

/**
 * Merge partial LRC gen results with pre-existing timing data.
 *
 * For each line:
 *  1. If the user explicitly touched it during gen -> use the new lineTimes
 *  2. If the original had word timings for it   -> use the first word time
 *  3. If canonical entries have a time for it   -> preserve that original time
 *  4. Otherwise                                 -> undefined (will be estimated)
 */
export function mergePartialLineTimes(
  lines: string[],
  lineTimes: (number | undefined)[],
  touchedLines: ReadonlySet<number>,
  origWtCanon: WordTimingsMap | undefined,
  canonical: readonly CanonicalLrcEntry[],
): (number | undefined)[] {
  return lines.map((_line, i) => {
    if (touchedLines.has(i)) return lineTimes[i]
    if (origWtCanon?.[i] !== undefined) return origWtCanon[i][0]
    // Fall back to canonical entry time (from original LRC parse).
    // This preserves line-level LRC timings even when no word timings exist.
    if (canonical[i] !== undefined) return canonical[i].time
    return undefined
  })
}

/**
 * Merge word timings: touched lines get new timings, untouched keep original.
 */
export function mergePartialWordTimings(
  touchedLines: ReadonlySet<number>,
  origWtCanon: WordTimingsMap | undefined,
  newWordTimings: WordTimingsMap,
): WordTimingsMap {
  const merged: WordTimingsMap = {}
  if (origWtCanon) {
    for (const k of Object.keys(origWtCanon)) {
      const ki = +k
      if (!touchedLines.has(ki)) merged[ki] = [...origWtCanon[ki]]
    }
  }
  for (const k of Object.keys(newWordTimings)) {
    if (touchedLines.has(+k)) merged[+k] = [...newWordTimings[+k]]
  }
  return merged
}

/**
 * Interpolate timestamps for unmapped lines between touched lines.
 *
 * Only fills gaps within the range [0, lastTouched].
 * Lines beyond lastTouched are left for estimateUnmappedTimes.
 */
export function interpolateGaps(
  finalTimes: (number | undefined)[],
  touchedLines: ReadonlySet<number>,
  songDuration: number,
): (number | undefined)[] {
  const result = finalTimes.slice()
  const lastTouched = Math.max(-1, ...Array.from(touchedLines))

  let prevMappedIdx = -1
  let prevMappedTime = 0

  for (let i = 0; i <= lastTouched; i++) {
    if (touchedLines.has(i)) {
      if (result[i] !== undefined) {
        prevMappedIdx = i
        prevMappedTime = result[i]!
      }
    } else if (result[i] === undefined) {
      let nextMappedTime = songDuration
      for (let j = i + 1; j <= lastTouched; j++) {
        if (touchedLines.has(j) && result[j] !== undefined) {
          nextMappedTime = result[j]!
          break
        }
      }
      const gap = nextMappedTime - prevMappedTime
      const posInGap = i - prevMappedIdx
      const gapLen =
        (() => {
          let n = prevMappedIdx + 1
          while (n <= lastTouched && !touchedLines.has(n)) n++
          return n
        })() - prevMappedIdx
      result[i] =
        Math.round((prevMappedTime + gap * (posInGap / gapLen)) * 1000) / 1000
    }
  }

  return result
}

/**
 * Enforce monotonic non-decreasing time order.
 *
 * If a user mapped line 5 at 1:00 then line 20 at 0:30, interpolated
 * lines between them could go backwards. This clamps each line time
 * to be >= the previous so timestamps always flow forward.
 */
export function enforceMonotonicTimes(
  finalTimes: (number | undefined)[],
): (number | undefined)[] {
  const result = finalTimes.slice()
  let prev = 0
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== undefined) {
      if (result[i]! < prev) {
        result[i] = prev
      }
      prev = result[i]!
    }
  }
  return result
}

/**
 * Full pipeline: merge partial times -> interpolate gaps ->
 * estimate unmapped -> enforce monotonic.
 */
export function buildFinalPartialTimes(params: {
  lines: string[]
  lineTimes: (number | undefined)[]
  touchedLines: ReadonlySet<number>
  origWtCanon: WordTimingsMap | undefined
  canonical: readonly CanonicalLrcEntry[]
  duration: number
}): (number | undefined)[] {
  const { lines, lineTimes, touchedLines, origWtCanon, canonical, duration } =
    params

  // 1. Merge: touched -> origWordTimings -> canonical fallback
  let result = mergePartialLineTimes(
    lines,
    lineTimes,
    touchedLines,
    origWtCanon,
    canonical,
  )

  // 2. Interpolate gaps between touched lines
  result = interpolateGaps(result, touchedLines, duration)

  // 3. Estimate times for completely unmapped lines beyond last touched
  if (duration > 0) {
    result = estimateUnmappedTimes(result, lines, duration)
  }

  // 4. Enforce monotonic ordering
  result = enforceMonotonicTimes(result)

  return result
}
