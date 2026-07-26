// ============================================================
// Lyric sung-end — when does a line's singing actually stop?
// ============================================================
//
// A lyric line's display end has always been "the next line's start",
// so the last word of a line before a gap (or a single-word line)
// sweeps its highlight across the whole silence — a ~1s "Valjda" can
// stretch for 6 seconds. The vocal itself knows better: the analyzed
// melody notes carry real end times. These helpers derive an honest
// sung end from those notes, with a small release tail so decay and
// reverb aren't cut visually short; when no analysis exists, a
// syllable-based cap bounds the even-division fallback instead.
//
// Pure data-in/data-out. Tests: src/tests/lyric-sung-end.test.ts

import { estimateWordDuration } from '@/lib/word-sync'

/** Minimal analyzed-note shape (seconds, despite the field names). */
export interface SungNote {
  startBeat: number
  endBeat: number
}

/** Visual release tail after the last note — vocal decay isn't a hard stop. */
export const SUNG_END_RELEASE_SEC = 0.35

/** Never clamp a line's sung span below this. */
export const SUNG_END_MIN_SPAN_SEC = 0.6

/**
 * The latest note end among notes overlapping [windowStart, windowEnd),
 * clamped to the window — or null when no note overlaps (instrumental
 * stretch, or the analysis missed the phrase; callers keep their own
 * fallback then).
 */
export function sungEndWithin(
  notes: readonly SungNote[],
  windowStart: number,
  windowEnd: number,
): number | null {
  let latest: number | null = null
  for (const note of notes) {
    if (note.endBeat <= windowStart || note.startBeat >= windowEnd) continue
    const end = Math.min(note.endBeat, windowEnd)
    if (latest === null || end > latest) latest = end
  }
  return latest
}

/**
 * A line's display end clamped to when the vocal actually finishes
 * (plus the release tail). Without overlapping notes the original end
 * is kept — never guess shorter than the evidence.
 */
export function clampLineEndToVocal(
  lineStart: number,
  lineEnd: number,
  notes: readonly SungNote[],
): number {
  const sungEnd = sungEndWithin(notes, lineStart, lineEnd)
  if (sungEnd === null) return lineEnd
  return Math.max(
    lineStart + SUNG_END_MIN_SPAN_SEC,
    Math.min(lineEnd, sungEnd + SUNG_END_RELEASE_SEC),
  )
}

/**
 * An end time for the LAST word of a word-timed line when the mapping
 * recorded only starts: the vocal's end within the word's window.
 * Undefined when no note overlaps — computeActiveWord then keeps its
 * conservative gap/syllable estimate.
 */
export function synthesizeLastWordEnd(
  wordTimes: readonly number[] | undefined,
  lineEnd: number,
  notes: readonly SungNote[],
): number | undefined {
  if (wordTimes === undefined || wordTimes.length === 0) return undefined
  const lastStart = wordTimes[wordTimes.length - 1]
  const sungEnd = sungEndWithin(notes, lastStart, lineEnd)
  if (sungEnd === null) return undefined
  const end = Math.min(lineEnd, sungEnd + SUNG_END_RELEASE_SEC)
  return end > lastStart + 0.05 ? end : undefined
}

/** The raw span must exceed the plausible sung time by this factor before
 *  the cap kicks in — normally paced lines keep their real span (syllable
 *  estimates run fast; compressing a legitimate line would race the singer). */
export const CAP_TRIGGER_RATIO = 2.5

/** …and must also be at least this long in absolute terms: short spans are
 *  held notes ("solo" sung over 2s), not silence-stretches. */
export const CAP_MIN_STRETCH_SEC = 4

/** When capping, allow this much beyond the syllable estimate — the cap
 *  exists to kill multi-second stretches, not to time-trial the singer. */
export const CAP_GENEROSITY = 1.5

/**
 * Tier-2 cap for the no-word-times fallback: when a line's raw span
 * (endTime = next line's start) is far beyond what its words could
 * plausibly take to sing, bound the even word division so the line
 * completes and dwells instead of stretching across the silence.
 * Normally paced lines, short held-note spans, and the panel's ~Rest~
 * pseudo-word (whose slow reveal IS the gap progress) keep the raw span.
 */
export function cappedEvenLineDuration(
  words: readonly string[],
  lineDuration: number,
): number {
  if (words.length === 0) return lineDuration
  if (words.length === 1 && words[0] === '~Rest~') return lineDuration
  if (lineDuration <= CAP_MIN_STRETCH_SEC) return lineDuration
  let plausible = 0
  for (const word of words) plausible += estimateWordDuration(word)
  plausible *= 1.25
  if (lineDuration <= plausible * CAP_TRIGGER_RATIO) return lineDuration
  return Math.min(
    lineDuration,
    Math.max(SUNG_END_MIN_SPAN_SEC, plausible * CAP_GENEROSITY),
  )
}
