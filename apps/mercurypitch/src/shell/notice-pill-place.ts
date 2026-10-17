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
// leaves too narrow a gap to read a sentence in. So the search goes:
//
//   1. Bands, top down. The first is the header's row; each next one starts
//      under the lowest control in the band above it. No band may run past
//      the bottom of the safe area.
//   2. In each band in turn, a pill centred on the screen, as wide as the
//      controls either side allow.
//   3. Failing that in every band (a phone on its side in the Karaoke room
//      has a control across the middle of every row), the widest gap in a
//      band, top down, with the pill centred in that gap.
//   4. Failing even that, the header's row at the least width: a notice
//      that cannot be seen is worse than one that covers a control, and
//      the walk (scripts/probe-notices.mjs) reports it.
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
  readonly viewportHeight: number
  /** The safe area's insets. */
  readonly safeTop: number
  readonly safeLeft: number
  readonly safeRight: number
  readonly safeBottom: number
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
/** Enough bands for a header, a bar, a room's head and a row of chips. */
const MAX_BANDS = 6

function overlapsBand(box: Box, top: number, bottom: number): boolean {
  return box.top < bottom + PILL_CLEARANCE && box.bottom > top - PILL_CLEARANCE
}

function inBand(input: PillPlaceInput, top: number): Box[] {
  return input.controls.filter((box) =>
    overlapsBand(box, top, top + input.pillHeight),
  )
}

/** The usable span across the screen, inside the side insets. */
function span(input: PillPlaceInput): { min: number; max: number } {
  return {
    min: input.safeLeft + EDGE,
    max: input.viewportWidth - input.safeRight - EDGE,
  }
}

/**
 * The widest pill centred on the screen that keeps clear of every control
 * in the band, or null when it would be narrower than `PILL_MIN_WIDTH`.
 */
function centredWidth(input: PillPlaceInput, band: Box[]): number | null {
  const centre = input.viewportWidth / 2
  let { min: leftEdge, max: rightEdge } = span(input)
  for (const box of band) {
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

/** The widest clear gap across the band, if a pill fits in it. */
function widestGap(
  input: PillPlaceInput,
  band: Box[],
): { left: number; width: number } | null {
  const { min, max } = span(input)
  const blocked = band
    .map((box) => [box.left - PILL_CLEARANCE, box.right + PILL_CLEARANCE])
    .sort((a, b) => a[0]! - b[0]!)
  let best: { from: number; to: number } | null = null
  let from = min
  for (const [start, end] of blocked) {
    if (start! > from && (best === null || start! - from > best.to - best.from))
      best = { from, to: Math.min(start!, max) }
    from = Math.max(from, end!)
  }
  if (max > from && (best === null || max - from > best.to - best.from))
    best = { from, to: max }
  if (best === null) return null
  const room = Math.floor(best.to - best.from)
  if (room < PILL_MIN_WIDTH) return null
  const width = Math.min(PILL_MAX_WIDTH, room)
  return { left: Math.round(best.from + (room - width) / 2), width }
}

export function placePill(input: PillPlaceInput): PillPlace {
  const centre = input.viewportWidth / 2
  const firstTop = input.safeTop + PILL_TOP_GAP
  const floor = input.viewportHeight - input.safeBottom - PILL_CLEARANCE

  // 1. The bands, top down, none past the safe area's bottom.
  const bands: Array<{ top: number; boxes: Box[] }> = []
  let top = firstTop
  while (bands.length < MAX_BANDS && top + input.pillHeight <= floor) {
    const boxes = inBand(input, top)
    bands.push({ top, boxes })
    if (boxes.length === 0) break
    top = Math.max(...boxes.map((box) => box.bottom)) + PILL_CLEARANCE
  }
  const docked = (at: number): 'top' | 'below' =>
    at === firstTop ? 'top' : 'below'

  // 2. Centred, in the first band that allows it.
  for (const band of bands) {
    const width = centredWidth(input, band.boxes)
    if (width !== null) {
      return {
        top: band.top,
        left: Math.round(centre - width / 2),
        width,
        docked: docked(band.top),
      }
    }
  }

  // 3. The widest gap, in the first band that has one.
  for (const band of bands) {
    const gap = widestGap(input, band.boxes)
    if (gap !== null) return { top: band.top, ...gap, docked: docked(band.top) }
  }

  // 4. Seen, if nothing else: the header's row at the least width.
  return {
    top: firstTop,
    left: Math.round(centre - PILL_MIN_WIDTH / 2),
    width: PILL_MIN_WIDTH,
    docked: 'top',
  }
}
