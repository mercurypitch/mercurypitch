// An A/B loop, described once so every surface that repeats a span agrees.
// ============================================================
//
// The two rooms count time in different units and neither is wrong: the
// play-along room's timeline is seconds of a real recording, and the tab room's
// is beats of a score whose tempo the player can change. So a span here is
// unit-agnostic — the host says which unit its positions are in, and the rules
// (ordering, clamping, a floor on length, when to wrap) are identical either
// way.
//
// One rule worth stating outright: a loop only ever wraps when the playhead
// passes B. Setting a loop never yanks the player back to A mid-phrase.

export interface LoopSpan {
  start: number
  end: number
}

/**
 * The shortest loop worth having, in the host's own unit. Below this a wrap
 * fires every few frames and the room sounds like a stutter, not a loop.
 */
export const MIN_LOOP_LENGTH = 0.25

/**
 * Put two marks in order and inside the timeline. Returns null when they
 * describe nothing loopable — the caller keeps whichever mark it has rather
 * than showing a loop that cannot run.
 */
export function normalizeLoopSpan(
  a: number | null,
  b: number | null,
  limit: number,
): LoopSpan | null {
  if (a === null || b === null) return null
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null

  const upper = Number.isFinite(limit) && limit > 0 ? limit : Math.max(a, b)
  const start = Math.min(Math.max(0, Math.min(a, b)), upper)
  const end = Math.min(Math.max(0, Math.max(a, b)), upper)
  if (end - start < MIN_LOOP_LENGTH) return null
  return { start, end }
}

/** True once the playhead has run past B and the room owes a jump back to A. */
export function shouldWrapToStart(
  position: number,
  span: LoopSpan | null,
): boolean {
  if (span === null || !Number.isFinite(position)) return false
  return position >= span.end
}

/**
 * Where a monotonic clock reads *inside* the loop.
 *
 * The tab room's click cannot be rewound — it is a scheduled pulse — so its
 * elapsed time keeps growing while the player hears the same four bars. This
 * folds that growing number back into the span, and it is the same arithmetic
 * the click scheduler uses to decide which beat of the loop to sound, so the
 * playhead and the click can never disagree.
 */
export function foldIntoLoop(position: number, span: LoopSpan | null): number {
  if (span === null || !Number.isFinite(position)) return position
  if (position < span.end) return position
  const length = span.end - span.start
  if (length <= 0) return position
  return span.start + ((position - span.end) % length)
}

/**
 * Snap a span to whole beats. The click is a steady pulse: a loop that is not a
 * whole number of beats would move the downbeat a little further every pass.
 */
export function quantizeSpanToBeats(span: LoopSpan): LoopSpan {
  const start = Math.max(0, Math.round(span.start))
  const end = Math.max(start + 1, Math.round(span.end))
  return { start, end }
}
