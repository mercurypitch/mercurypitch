// ============================================================
// Home glyph — the house that marks do, the tonic, on a lesson's drawings
// ============================================================
//
// Lesson 4 marks home with a house, never with a colour: the pitch-canvas
// set's tonic butter sits too close to the series gold to carry a second
// meaning (WEB-SPEC, Look). One path, two ways in: the page's icon sprite
// holds it as `#i-home` (a lesson page's own inline SVG), and a canvas draws
// it with `drawHome`. A page test holds the sprite's copy to this one.

/** The house on the sprite's 24 by 24 grid: a roof, two walls and a floor, and a door. */
export const HOME_PATH =
  'M4 11.4 12 4.6l8 6.8M6.4 9.6V19.4h11.2V9.6M10.1 19.4v-5h3.8v5'

let cached: Path2D | null = null

/** The house as a Path2D, made once; null where the canvas has none (jsdom). */
function homePath(): Path2D | null {
  if (cached === null && typeof Path2D === 'function')
    cached = new Path2D(HOME_PATH)
  return cached
}

/**
 * Strokes the house `size` px square, centred on (cx, cy), in `color`: a
 * touch heavier than the sprite's 1.7 on the same grid, since a canvas
 * draws it small.
 */
export function drawHome(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  const path = homePath()
  if (path === null) return
  const k = size / 24
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(k, k)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.9
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke(path)
  ctx.restore()
}
