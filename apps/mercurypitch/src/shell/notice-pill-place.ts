// ============================================================
// Where the notice pill sits: under the status bar, between the controls
// ============================================================
//
// The pill (NoticePill.tsx) is centred just under the status bar, in the
// header's own row, and it is never wider than the gap between that row's
// controls: Back on one side, the gear or a screen's actions on the other.
// A notice is transient and a header control is not, so the notice is the
// one that gives way (owner, 17 Oct 2026: a notice must not cover the UI).
//
// Not every header leaves its centre free. The Sing and Karaoke rooms put
// their room-name chip there, and it is a button (the room picker); a
// premium room's bar carries its level pill and "?" on the right, which
// leaves too narrow a gap to read a sentence in. Where the row has no room,
// the pill steps down below the lowest control in its way and tries again,
// so it lands on the first band that is clear.
//
// Pure, so the rule can be tested without a layout: the pill measures the
// screen (its own height and every control a tap could reach) and asks.

/** A box on screen, in CSS px from the viewport's top-left. */
export interface Box {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface PillPlaceInput {
  readonly viewportWidth: number
  /** The safe area: top inset, and the usable span between the side insets. */
  readonly safeTop: number
  readonly safeLeft: number
  readonly safeRight: number
  /** The pill's height at the width it would be given. */
  readonly pillHeight: number
  /** Every control a tap could reach, anywhere on screen. */
  readonly controls: readonly Box[]
}

export interface PillPlace {
  readonly top: number
  readonly left: number
  readonly width: number
  /** In the header's row, or stepped down below a control in its way. */
  readonly docked: 'top' | 'below'
}

/** From the status bar to the pill's top edge. */
export const PILL_TOP_GAP = 6
/** The least room kept between the pill and any control beside it. */
export const PILL_CLEARANCE = 8
/** A tablet's pill stops here; the rest of a wide header stays clear. */
export const PILL_MAX_WIDTH = 420
/** Narrower than this and a sentence breaks into a column of words. */
export const PILL_MIN_WIDTH = 200
/** The pill keeps this far from the screen's edge (inside the insets). */
const EDGE = 12
/** Enough steps for a header, a bar and a room's head, and no more. */
const MAX_STEPS = 4

function overlapsBand(box: Box, top: number, bottom: number): boolean {
  return box.top < bottom + PILL_CLEARANCE && box.bottom > top - PILL_CLEARANCE
}

/**
 * The widest pill centred on the screen that keeps clear of every control
 * in the band from `top` to `top + height`, or null when it would be
 * narrower than `PILL_MIN_WIDTH`.
 */
function centredWidth(
  input: PillPlaceInput,
  top: number,
  height: number,
): number | null {
  const centre = input.viewportWidth / 2
  let leftEdge = input.safeLeft + EDGE
  let rightEdge = input.viewportWidth - input.safeRight - EDGE
  for (const box of input.controls) {
    if (!overlapsBand(box, top, top + height)) continue
    if (box.right <= centre)
      leftEdge = Math.max(leftEdge, box.right + PILL_CLEARANCE)
    else if (box.left >= centre)
      rightEdge = Math.min(rightEdge, box.left - PILL_CLEARANCE)
    else return null // it straddles the centre
  }
  const half = Math.min(centre - leftEdge, rightEdge - centre)
  const width = Math.min(PILL_MAX_WIDTH, Math.floor(half * 2))
  return width >= PILL_MIN_WIDTH ? width : null
}

export function placePill(input: PillPlaceInput): PillPlace {
  const centre = input.viewportWidth / 2
  const firstTop = input.safeTop + PILL_TOP_GAP
  let top = firstTop
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const width = centredWidth(input, top, input.pillHeight)
    if (width !== null) {
      return {
        top,
        left: Math.round(centre - width / 2),
        width,
        docked: top === firstTop ? 'top' : 'below',
      }
    }
    // Under the lowest control in the way, and try that band.
    let lowest = top
    for (const box of input.controls) {
      if (overlapsBand(box, top, top + input.pillHeight))
        lowest = Math.max(lowest, box.bottom)
    }
    top = lowest + PILL_CLEARANCE
  }
  // A screen full of controls: the full usable width at the last band
  // tried, which is still clear of everything above it.
  const width = Math.min(
    PILL_MAX_WIDTH,
    input.viewportWidth - input.safeLeft - input.safeRight - EDGE * 2,
  )
  return {
    top,
    left: Math.round(centre - width / 2),
    width,
    docked: 'below',
  }
}
