// ============================================================
// Lantern geometry — one coordinate system for the glass and Merc
// ============================================================
//
// The lantern is drawn in a 200 x 400 view box, as two SVG layers with Merc's
// canvas between them (the glass and the frame in front of him, the liquid
// behind). Everything that has to line up with the glass reads its numbers
// from here: the room places Merc on the liquid's surface, and the target
// line through the middle of the chimney.

export const LANTERN_VIEW_W = 200
export const LANTERN_VIEW_H = 400

/** The chimney's inside, top and bottom, where the liquid can be. */
export const CHIMNEY_TOP = 92
export const CHIMNEY_BOTTOM = 336

/** The chimney's outline: narrow at both ends, bulging in the middle. */
export const CHIMNEY_PATH =
  'M62 92 C46 150 44 280 60 336 L140 336 C156 280 154 150 138 92 Z'

/**
 * How full the liquid may get while Merc floats on it. The rest of the
 * chimney is his headroom; the result tops it up once he has hopped out.
 */
export const HOLD_FILL_MAX = 0.66

/** The middle of the chimney, where the target line crosses it. */
export const TARGET_LINE_Y = (CHIMNEY_TOP + CHIMNEY_BOTTOM) / 2

/** The liquid's surface, in view-box units, at a fill from 0 to 1. */
export function surfaceY(level: number): number {
  const clamped = Math.min(1, Math.max(0, level))
  return CHIMNEY_BOTTOM - clamped * (CHIMNEY_BOTTOM - CHIMNEY_TOP)
}
