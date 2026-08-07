// ============================================================
// Auto word-sync — laying a line's words over detected vocal onsets
// ============================================================
//
// `@/lib/word-sync` holds the arithmetic for one line: spread its words across
// a span by syllable weight, then pull each toward the nearest onset. This
// holds the decisions around it — which lines are eligible, where a line's
// span ends, and what counts as a result worth saving.
//
// Those decisions matter more than they look. Auto-sync overwrites the saved
// lyrics wholesale, so a line wrongly judged eligible does not degrade the
// mapping, it replaces a hand-made one. Keeping this separate from the
// controller is what lets the judgement be asserted directly.
//
// Tests: src/tests/auto-word-sync.test.ts
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 0).

import { autoTimeLineWords } from '@/lib/word-sync'
import type { CanonicalLrcEntry, WordTimingsMap } from './types'

/**
 * A line shorter than this cannot hold word timings anybody could sing to,
 * and is almost always an artefact of two stamps landing on the same second.
 */
const MIN_LINE_SPAN_SEC = 0.1

export interface AutoWordSyncResult {
  /** Keyed by LRC index, matching the saved word-timings map. */
  wordTimings: WordTimingsMap
  linesSynced: number
}

/**
 * Time every eligible line's words against the detected onsets.
 *
 * A line's span runs from its own start to the next *sung* line's start —
 * rests are skipped rather than treated as the end, so a line before a long
 * instrumental keeps the whole gap to spread its words over instead of being
 * cut off at the rest row.
 */
export function autoSyncWordTimings(params: {
  canonical: readonly CanonicalLrcEntry[]
  duration: number
  onsets: number[]
}): AutoWordSyncResult {
  const { canonical, duration, onsets } = params
  const empty: AutoWordSyncResult = { wordTimings: {}, linesSynced: 0 }
  if (canonical.length === 0 || duration <= 0) return empty

  const lineEntries = canonical.filter((entry) => entry.type === 'line')
  const wordTimings: WordTimingsMap = {}
  let linesSynced = 0

  for (let i = 0; i < lineEntries.length; i++) {
    const entry = lineEntries[i]
    if (entry.lrcIndex < 0 || entry.words.length === 0) continue
    const lineStart = entry.time
    const lineEnd = Math.min(duration, lineEntries[i + 1]?.time ?? duration)
    if (lineEnd - lineStart < MIN_LINE_SPAN_SEC) continue
    const times = autoTimeLineWords(entry.words, lineStart, lineEnd, onsets)
    // A short result would silently drop the tail of the line, so take all of
    // it or none — a partly timed line reads as a mapping bug to the singer.
    if (times.length === entry.words.length) {
      wordTimings[entry.lrcIndex] = times
      linesSynced++
    }
  }

  return { wordTimings, linesSynced }
}
