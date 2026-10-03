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
 * How far before a window's end the next line's first note may start.
 * A singer comes in a little ahead of the line's stamp: across the example
 * songs the next line's first note starts up to ~0.45 s early.
 */
export const NEXT_LINE_LEAD_SEC = 0.5

/** A note that starts this long after the voice last stopped opens a new
 *  phrase, rather than continuing the one before it. */
export const PHRASE_GAP_SEC = 0.25

/**
 * How long after a word's stamp its first detected note may start and still
 * be that word's. Stamps sit on the consonant, and the analysis drops short
 * and unvoiced notes, so the first pitched note of a word arrives late: for
 * the last words of the three bundled songs, up to 0.45 s late, and 0.85 s
 * for a "Josephine" whose first syllable was not detected at all.
 */
export const WORD_ONSET_LAG_SEC = 0.9

/**
 * Whether `note` is the next line coming in early: it starts in the last
 * NEXT_LINE_LEAD_SEC of the window, after the voice had stopped, and it is
 * still sounding when the window ends. Counted as this window's vocal it
 * would stretch the line over the whole silence before the next line
 * ("dark" in Nothing in the Dark, held to 114 s, swept until the next line
 * at 125.36 s because "Broken" comes in at 125.31 s).
 *
 * A note that carries on without a break is a held syllable, and stays. So
 * does a word sung late in the window that is over before the next stamp:
 * that is this line's last word, not the next line's first.
 */
function opensNextLine(
  note: SungNote,
  notes: readonly SungNote[],
  windowEnd: number,
): boolean {
  if (note.startBeat < windowEnd - NEXT_LINE_LEAD_SEC) return false
  if (note.endBeat <= windowEnd) return false
  for (const other of notes) {
    if (other === note || other.startBeat >= note.startBeat) continue
    if (other.endBeat > note.startBeat - PHRASE_GAP_SEC) return false
  }
  return true
}

/**
 * The latest note end among notes overlapping [windowStart, windowEnd),
 * clamped to the window — or null when no note overlaps (instrumental
 * stretch, or the analysis missed the phrase; callers keep their own
 * fallback then). The next line coming in early is not part of the window
 * (`opensNextLine`).
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
    if (latest !== null && end <= latest) continue
    if (opensNextLine(note, notes, windowEnd)) continue
    latest = end
  }
  return latest
}

/**
 * A line's display end clamped to when the vocal actually finishes
 * (plus the release tail). Without overlapping notes the original end
 * is kept — never guess shorter than the evidence.
 *
 * With `lastWordStart`, the end never comes before the line's last word
 * has started and had its release tail: an analysis that missed that word
 * must not end the line ahead of it.
 */
export function clampLineEndToVocal(
  lineStart: number,
  lineEnd: number,
  notes: readonly SungNote[],
  lastWordStart?: number,
): number {
  const sungEnd = sungEndWithin(notes, lineStart, lineEnd)
  if (sungEnd === null) return lineEnd
  const floor =
    lastWordStart === undefined
      ? lineStart + SUNG_END_MIN_SPAN_SEC
      : Math.max(
          lineStart + SUNG_END_MIN_SPAN_SEC,
          lastWordStart + SUNG_END_RELEASE_SEC,
        )
  return Math.min(
    lineEnd,
    Math.max(floor, Math.min(lineEnd, sungEnd + SUNG_END_RELEASE_SEC)),
  )
}

/**
 * The longest silence inside one word. A word's syllables can be detected
 * as separate notes with a gap between them where a consonant sits: the
 * bundled songs have "Jo-sephine" with 0.27 s between its notes and
 * "be-tween" with 0.37 s. A longer silence is a breath, and ends the word.
 */
export const WORD_GAP_MAX_SEC = 0.5

/**
 * An end time for the LAST word of a word-timed line when the mapping
 * recorded only starts: where the word's own sound stops.
 *
 * The word starts with the first note that reaches past its stamp and
 * begins no later than WORD_ONSET_LAG_SEC after it, and runs on through the
 * notes that follow it. It stops at the first silence that is a breath
 * rather than a consonant: one longer than WORD_GAP_MAX_SEC, or one longer
 * than PHRASE_GAP_SEC that leads into the last NEXT_LINE_LEAD_SEC before
 * the next line, where what follows is the next line's pickup even when it
 * is over before that line's stamp. Undefined when the word has no note of
 * its own: computeActiveWord then keeps its conservative gap/syllable
 * estimate.
 *
 * `nextLineAt` is the next line's start, when `lineEnd` has already been
 * clamped to the vocal; it defaults to `lineEnd`.
 */
export function synthesizeLastWordEnd(
  wordTimes: readonly number[] | undefined,
  lineEnd: number,
  notes: readonly SungNote[],
  nextLineAt: number = lineEnd,
): number | undefined {
  if (wordTimes === undefined || wordTimes.length === 0) return undefined
  const lastStart = wordTimes[wordTimes.length - 1]
  const inWindow = notes
    .filter((note) => note.endBeat > lastStart && note.startBeat < lineEnd)
    .sort((a, b) => a.startBeat - b.startBeat)
  const first = inWindow[0]
  if (first === undefined || first.startBeat > lastStart + WORD_ONSET_LAG_SEC)
    return undefined
  if (opensNextLine(first, notes, nextLineAt)) return undefined
  let runEnd = first.endBeat
  for (const note of inWindow.slice(1)) {
    const gap = note.startBeat - runEnd
    const breath =
      gap > WORD_GAP_MAX_SEC ||
      (gap > PHRASE_GAP_SEC &&
        note.startBeat >= nextLineAt - NEXT_LINE_LEAD_SEC)
    if (breath) break
    runEnd = Math.max(runEnd, note.endBeat)
  }
  const end = Math.min(lineEnd, runEnd + SUNG_END_RELEASE_SEC)
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
