// ============================================================
// Lantern geometry — one coordinate system for the glass and Merc
// ============================================================
//
// The lantern is drawn in a 200 x 400 view box, as two layers with Merc's
// canvas between them (the glass and the frame in front of him, the liquid
// behind). Everything that has to line up with the glass reads its numbers
// from here: the room places Merc on the liquid's surface, and the target
// line through the middle of the chimney.
//
// The lantern is painted (Lantern.tsx), so these numbers are measured off the
// painting: the top of its handle sits at 4 and the bottom of its foot at 370,
// the ground line Merc stands on beside it. The chimney is the inside of the
// glass, where the painted light is; its outline is fitted to that region
// (two cubics a side, within 0.4 units rms).

export const LANTERN_VIEW_W = 200
export const LANTERN_VIEW_H = 400

/** The chimney's inside, top and bottom, where the liquid can be. */
export const CHIMNEY_TOP = 116
export const CHIMNEY_BOTTOM = 312

/**
 * The chimney's outline: a narrow neck, widest low down, a round bowl. One
 * list of points, for the SVG clip (CHIMNEY_PATH) and the canvas (traceChimney).
 */
const CHIMNEY_OUTLINE = [
  ['M', 63.1, 115.8],
  ['L', 136.9, 115.8],
  ['C', 146.7, 170.1, 158.3, 192.6, 158.3, 252],
  ['C', 158.3, 279.9, 149.8, 295, 127.2, 312],
  ['L', 72.8, 312],
  ['C', 50.2, 295, 41.7, 279.9, 41.7, 252],
  ['C', 41.7, 192.6, 53.3, 170.1, 63.1, 115.8],
] as const

export const CHIMNEY_PATH = `${CHIMNEY_OUTLINE.map(([op, ...at]) => `${op}${at.join(' ')}`).join(' ')} Z`

/** The chimney's outline on a canvas path, in view-box units. */
export function traceChimney(path: CanvasPath): void {
  for (const step of CHIMNEY_OUTLINE) {
    if (step[0] === 'M') path.moveTo(step[1], step[2])
    else if (step[0] === 'L') path.lineTo(step[1], step[2])
    else
      path.bezierCurveTo(step[1], step[2], step[3], step[4], step[5], step[6])
  }
  path.closePath()
}

/** The chimney's half-width every 7 units from its top, on the same fit. */
const HALF_WIDTH_STEP = 7
const HALF_WIDTHS = [
  37, 38.3, 39.7, 41.1, 42.7, 44.3, 45.9, 47.5, 49.1, 50.6, 52.1, 53.4, 54.6,
  55.6, 56.4, 57.1, 57.6, 57.9, 58.2, 58.3, 58.2, 57.8, 56.7, 55, 52.2, 48.3,
  42.8, 35.7, 27.2,
]

/** Half the chimney's inside width at a height, in view-box units. */
export function chimneyHalfWidth(y: number): number {
  const at =
    (Math.min(CHIMNEY_BOTTOM, Math.max(CHIMNEY_TOP, y)) - CHIMNEY_TOP) /
    HALF_WIDTH_STEP
  const i = Math.min(HALF_WIDTHS.length - 2, Math.floor(at))
  const f = at - i
  return HALF_WIDTHS[i] + (HALF_WIDTHS[i + 1] - HALF_WIDTHS[i]) * f
}

/**
 * How full the goal fills the liquid: halfway up the chimney, as high as
 * it rises with Merc floating on it. At the goal he steps out, and only
 * steady singing fills the rest (the hold engine's stretch).
 */
export const HOLD_FILL_MAX = 0.54

/**
 * The liquid's level for the hold engine's two fills: the goal's `charge`
 * up to HOLD_FILL_MAX, then the steady stretch's `topCharge` from there to
 * the brim. Neither drains, so neither does the light.
 */
export function fillLevel(charge: number, topCharge: number): number {
  return charge * HOLD_FILL_MAX + topCharge * (1 - HOLD_FILL_MAX)
}

/** The middle of the chimney, where the target line crosses it. */
export const TARGET_LINE_Y = (CHIMNEY_TOP + CHIMNEY_BOTTOM) / 2

/** The liquid's surface, in view-box units, at a fill from 0 to 1. */
export function surfaceY(level: number): number {
  const clamped = Math.min(1, Math.max(0, level))
  return CHIMNEY_BOTTOM - clamped * (CHIMNEY_BOTTOM - CHIMNEY_TOP)
}
