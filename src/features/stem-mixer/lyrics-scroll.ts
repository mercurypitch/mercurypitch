// ============================================================
// lyrics-scroll — where the active lyric line should sit
// ============================================================
//
// The lyric list and the mapper list both keep the current line inside a
// comfortable band and scroll when it drifts out. The two effects that did
// this were near-identical copies differing only in their bottom threshold,
// so the arithmetic lived twice and was testable neither time.
//
// The rects come from the DOM, but the decision made from them does not, so
// it lives here as a pure function. Tests: src/tests/lyrics-scroll.test.ts.

/** The slice of a DOMRect this decision actually needs. */
export interface Bounds {
  top: number
  bottom: number
  height: number
}

/**
 * Fraction of the container height the active line is parked at after a
 * scroll. Slightly above centre: the eye reads downward, so the lines you
 * have not sung yet are worth more space than the ones you have.
 */
export const ANCHOR_RATIO = 0.35

/** A line above this fraction of the container has scrolled too far up. */
export const TOP_RATIO = 0.15

/**
 * The scrollTop that brings the active line back to the anchor, or null when
 * it is already comfortably in view.
 *
 * `bottomRatio` differs by surface — the mapper tolerates the line sitting a
 * little lower than the playback list does, because its rows are taller.
 */
export function scrollTargetFor(
  container: Bounds,
  line: Bounds,
  scrollTop: number,
  bottomRatio: number,
  topRatio: number = TOP_RATIO,
  anchorRatio: number = ANCHOR_RATIO,
): number | null {
  const thresholdBottom = container.top + container.height * bottomRatio
  const thresholdTop = container.top + container.height * topRatio
  const needsScrollDown = line.bottom > thresholdBottom
  const needsScrollUp = line.top < thresholdTop
  if (!needsScrollDown && !needsScrollUp) return null
  return scrollTop + (line.top - container.top) - container.height * anchorRatio
}

/**
 * How long the reader can leave the words alone before following resumes
 * by itself. The phone stage's number (KaraokeMobileStage), so a song
 * behaves the same on both.
 *
 * Without it, a scroll turned following off and only scrolling BACK onto the
 * sung line turned it on again: a reader who scrolled up to check a verse
 * and let go was left there for the rest of the song.
 */
export const FOLLOW_RESUME_MS = 3500

/**
 * Whether a user scroll has settled back onto the active line, so following
 * it can resume early. Deliberately more generous than `scrollTargetFor`'s
 * band: re-arming the moment the line is merely visible would fight someone
 * who scrolled ahead to read, and they would have to keep scrolling back.
 *
 * Measured from BOTH sides. It used to ask only whether the line was above
 * the settle mark, and a line two screens above the top of the list is --
 * so scrolling down past the sung line counted as coming back to it, and
 * the list snapped back within a second, while scrolling up never did.
 */
export function isBackOnActiveLine(
  container: Bounds,
  line: Bounds,
  settleRatio = 0.6,
): boolean {
  if (line.bottom <= container.top) return false
  return line.top - container.top < container.height * settleRatio
}
