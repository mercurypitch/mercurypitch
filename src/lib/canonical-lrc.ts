// ============================================================
// Canonical LRC — pure functions for canonical entry construction
// and LRC↔canonical index mapping
// ============================================================

import type { CanonicalLrcEntry } from '@/features/stem-mixer/types'
import type { LrcLine } from './lyrics-service'
import { parseLrcWordTimings } from './lyrics-service'

const REST_THRESHOLD = 20

/** Build canonical entries with synthetic ~Rest~ for gaps > 20s. */
export function buildCanonicalEntries(
  lrcLines: LrcLine[],
): CanonicalLrcEntry[] {
  const result: CanonicalLrcEntry[] = []

  for (let i = 0; i < lrcLines.length; i++) {
    const line = lrcLines[i]
    const gap = i > 0 ? line.time - lrcLines[i - 1].time : 0

    // Insert synthetic ~Rest~ for large gaps
    if (gap > REST_THRESHOLD) {
      result.push({
        type: 'rest',
        lrcIndex: -1,
        canonicalIndex: result.length,
        time: lrcLines[i - 1].time + gap / 2,
        text: '~Rest~',
        words: [],
      })
    }

    if (line.text === '~Rest~') {
      result.push({
        type: 'rest',
        lrcIndex: i,
        canonicalIndex: result.length,
        time: line.time,
        text: '~Rest~',
        words: [],
      })
      continue
    }

    const parsedWt = parseLrcWordTimings(line.text, line.time)
    const words = parsedWt
      ? parsedWt.words
      : line.text.split(/\s+/).filter((w: string) => w.length > 0)

    result.push({
      type: 'line',
      lrcIndex: i,
      canonicalIndex: result.length,
      time: line.time,
      text: line.text,
      words,
      wordTimes: parsedWt?.wordTimes,
    })
  }

  return result
}

/**
 * Build LRC index → canonical index map.
 * Only real LRC entries (lrcIndex >= 0) are mapped.
 * Synthetic ~Rest~ (lrcIndex = -1) are excluded.
 */
export function buildLrcToCanonicalMap(
  canonical: CanonicalLrcEntry[],
): Map<number, number> {
  const map = new Map<number, number>()
  for (const entry of canonical) {
    if (entry.lrcIndex >= 0) map.set(entry.lrcIndex, entry.canonicalIndex)
  }
  return map
}

/**
 * Build canonical index → LRC index map.
 * Only real LRC entries (lrcIndex >= 0) are mapped.
 * Synthetic ~Rest~ (lrcIndex = -1) are excluded.
 */
export function buildCanonicalToLrcMap(
  canonical: CanonicalLrcEntry[],
): Map<number, number> {
  const map = new Map<number, number>()
  for (const entry of canonical) {
    if (entry.lrcIndex >= 0) map.set(entry.canonicalIndex, entry.lrcIndex)
  }
  return map
}
