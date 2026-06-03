// ============================================================
// LRC Gen Engine — pure functions extracted from handleLrcGenFinish
// ============================================================
//
// These functions implement the partial merge, interpolation, and
// monotonic enforcement logic used when the user finishes an LRC
// generation session (whether they mapped all lines or only a subset).
//
// Tests: src/tests/lrc-gen-partial-merge.test.ts

import type { CanonicalLrcEntry, WordTimingsMap, } from '@/features/stem-mixer/types'
import { estimateUnmappedTimes } from '@/lib/lrc-generator'

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
