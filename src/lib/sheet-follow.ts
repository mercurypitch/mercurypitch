// ============================================================
// sheet-follow — where a staff's scrollers go to keep the cursor in sight
// ============================================================
//
// A score follows its playback cursor one system at a time. Once the
// cursor's system sinks past the middle of the staff's view (or jumps above
// it, on a loop or a seek back), the system goes up to the top quarter of
// the view; across a system, the cursor is kept clear of the side edges.
// Where the staff sits inside another scroller (the MIDI Melody panel's
// Notes view), that one moves just far enough to show the stave.
//
// The decisions are pure and live here. The elements and the timing are
// the follow controller's (components/sheet-follow-controller.ts).

/** A stretch along one axis, in one coordinate space. */
export interface Span {
  start: number
  end: number
}

/** One axis of a scroller: where it is, how much shows, how much there is. */
export interface ScrollAxis {
  offset: number
  size: number
  extent: number
}

/** The clear space kept between the cursor and the staff's side edges. */
export const CURSOR_EDGE_PX = 80

/** A followed system is parked a quarter of the way down, and at least this far. */
export const SYSTEM_PARK_MIN_PX = 16

/**
 * How long a hand on the staff keeps the follow off, from the last scroll.
 * The lyrics' number (FOLLOW_RESUME_MS in features/stem-mixer/lyrics-scroll.ts,
 * and KaraokeMobileStage's), so the score lets go the way the words do.
 */
export const SHEET_FOLLOW_RESUME_MS = 3500

/**
 * The longest one of the follow's own glides is believed to run. A glide
 * that lands says so with `scrollend`; one that does not, or a browser
 * without the event, is looked at again after this.
 */
export const SHEET_GLIDE_CAP_MS = 1000

function clampOffset(axis: ScrollAxis, offset: number): number {
  return Math.min(Math.max(0, axis.extent - axis.size), Math.max(0, offset))
}

/** An offset worth scrolling to: null for the one the axis already has. */
function moveTo(axis: ScrollAxis, offset: number): number | null {
  const target = clampOffset(axis, Math.round(offset))
  // A scroll to where the scroller already stands stops a glide in
  // Chromium (measured 4 Nov 2026), so it is never asked for.
  return Math.abs(target - axis.offset) < 1 ? null : target
}

/**
 * The scroll offset that parks the cursor's system a quarter of the way down
 * the staff's view, or null while its stave already sits in the view's
 * upper half. `stave` is in the scroller's content coordinates.
 */
export function systemFollowOffset(
  axis: ScrollAxis,
  stave: Span,
): number | null {
  const middle = axis.offset + axis.size / 2
  if (stave.start >= axis.offset && stave.end <= middle) return null
  return moveTo(
    axis,
    stave.start - Math.max(SYSTEM_PARK_MIN_PX, axis.size * 0.25),
  )
}

/**
 * The scroll offset that keeps the cursor CURSOR_EDGE_PX clear of the
 * staff's side edges, or null when it already is, or cannot be.
 */
export function cursorFollowLeft(axis: ScrollAxis, x: number): number | null {
  if (x < axis.offset + CURSOR_EDGE_PX) return moveTo(axis, x - CURSOR_EDGE_PX)
  if (x > axis.offset + axis.size - CURSOR_EDGE_PX) {
    return moveTo(axis, x - axis.size + CURSOR_EDGE_PX)
  }
  return null
}

/**
 * How far a scroller has to move so `band` shows inside `view` with
 * `margin` to spare above and below it: positive is down, 0 when it shows
 * already. A band taller than the view lines up its top. Both spans in one
 * coordinate space, a client rect's.
 */
export function revealShift(view: Span, band: Span, margin: number): number {
  const top = band.start - margin
  const bottom = band.end + margin
  if (bottom - top >= view.end - view.start) return top - view.start
  if (top < view.start) return top - view.start
  if (bottom > view.end) return bottom - view.end
  return 0
}
