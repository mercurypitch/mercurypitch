// ============================================================
// A-B loop — canvas rendering + hit-testing, shared by every canvas that
// draws the loop overlay (Singing PitchCanvas, Piano falling-notes lane,
// Compose piano-roll grid + ruler). Pure and framework-free, and
// UNIT-AGNOSTIC: the caller supplies the value→pixel map (`posOf`), so the
// same helper serves beats or seconds. Pairs with the boundary/seek math in
// ./ab-loop. Extracted so the draw + hit-test rules live in one place instead
// of a near-identical copy per surface.
// ============================================================

/** Pixel tolerance for grabbing an A/B boundary to drag. */
export const LOOP_MARKER_HIT_PX = 8

// Dark-theme equivalents of --accent / --red / --green. Canvas can't read CSS
// vars, so these mirror app.css and keep the loop reading the same everywhere.
const A_LINE = 'rgba(88,166,255,0.85)'
const A_GLOW = 'rgba(88,166,255,0.5)'
const A_FLAG = '#58a6ff'
const B_LINE = 'rgba(248,81,73,0.85)'
const B_GLOW = 'rgba(248,81,73,0.5)'
const B_FLAG = '#f85149'
const REGION_ARMED = 'rgba(63,185,80,0.08)'
const REGION_IDLE = 'rgba(88,166,255,0.06)'

/** How the A/B label is drawn (or not). */
export type LoopFlagStyle =
  | 'pill' // rounded pill at the line's leading edge (Singing, Piano)
  | 'ruler' // plain rect beside the line, A-right / B-left (Compose ruler)
  | 'none' // boundary line only (Compose grid — the ruler carries the labels)

export interface AbLoopDrawOpts {
  /** Loop bounds in the caller's unit (beats or seconds); 0 = unset. */
  a: number
  b: number
  /** Whether the loop is armed — tints the region green vs blue. */
  enabled: boolean
  /** Forward map: a loop value → pixel along the SCROLL axis. */
  posOf: (value: number) => number
  /**
   * Which screen axis the scroll/value axis runs along:
   *  - 'vertical'   : boundaries are VERTICAL lines at x = posOf(v) (Singing,
   *                   Compose). `crossExtent` is the canvas height.
   *  - 'horizontal' : boundaries are HORIZONTAL lines at y = posOf(v) (Piano's
   *                   falling lane, which scrolls in Y). `crossExtent` is the
   *                   canvas width.
   */
  orientation: 'vertical' | 'horizontal'
  /** Perpendicular length of each boundary line (canvas h for vertical, w for
   *  horizontal). */
  crossExtent: number
  /** Clip range along the SCROLL axis (e.g. [0, w]); off-range lines are skipped. */
  clipMin: number
  clipMax: number
  /** Flag rendering. Default 'pill'. */
  flag?: LoopFlagStyle
  /** Draw the shaded region between A and B. Default true. */
  region?: boolean
}

/**
 * Draw the A-B loop overlay: a shaded region between A and B plus a boundary
 * marker at each of A (accent/blue) and B (--red). Handles either orientation
 * and an inverted axis (Piano's Y grows away from the playhead) by ordering
 * the two pixel positions rather than assuming a < b maps to lo < hi.
 */
export function drawAbLoopOverlay(
  ctx: CanvasRenderingContext2D,
  opts: AbLoopDrawOpts,
): void {
  const { a, b, enabled, posOf, orientation, crossExtent, clipMin, clipMax } =
    opts
  if (a <= 0 && b <= 0) return
  const vertical = orientation === 'vertical'
  const clamp = (p: number) => Math.max(clipMin, Math.min(clipMax, p))

  // Region fill between A and B (only when both are set and ordered by value).
  if ((opts.region ?? true) && a > 0 && b > 0 && a < b) {
    const p1 = clamp(posOf(a))
    const p2 = clamp(posOf(b))
    const lo = Math.min(p1, p2)
    const hi = Math.max(p1, p2)
    if (hi > lo) {
      ctx.fillStyle = enabled ? REGION_ARMED : REGION_IDLE
      if (vertical) ctx.fillRect(lo, 0, hi - lo, crossExtent)
      else ctx.fillRect(0, lo, crossExtent, hi - lo)
    }
  }

  if (a > 0) drawBoundary(ctx, posOf(a), 'A', A_LINE, A_GLOW, A_FLAG, opts)
  if (b > 0) drawBoundary(ctx, posOf(b), 'B', B_LINE, B_GLOW, B_FLAG, opts)
}

function drawBoundary(
  ctx: CanvasRenderingContext2D,
  pos: number,
  label: 'A' | 'B',
  line: string,
  glow: string,
  flagBg: string,
  opts: AbLoopDrawOpts,
): void {
  const { orientation, crossExtent, clipMin, clipMax } = opts
  const flag = opts.flag ?? 'pill'
  if (pos < clipMin - 2 || pos > clipMax + 2) return
  const vertical = orientation === 'vertical'
  const p = Math.max(clipMin, Math.min(clipMax, pos))

  // Boundary line.
  ctx.save()
  ctx.shadowColor = glow
  ctx.shadowBlur = 6
  ctx.strokeStyle = line
  ctx.lineWidth = 2
  ctx.beginPath()
  if (vertical) {
    ctx.moveTo(p, 0)
    ctx.lineTo(p, crossExtent)
  } else {
    ctx.moveTo(0, p)
    ctx.lineTo(crossExtent, p)
  }
  ctx.stroke()
  ctx.restore()

  if (flag === 'none') return

  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (flag === 'ruler') {
    // Compose ruler: plain rect beside the line — A to its right, B to its
    // left, so adjacent markers don't overlap.
    const pillW = ctx.measureText(label).width + 8
    const pillH = 13
    const px = label === 'A' ? p : p - pillW
    ctx.fillStyle = flagBg
    ctx.fillRect(px, 1, pillW, pillH)
    ctx.fillStyle = '#fff'
    ctx.fillText(label, px + pillW / 2, 1 + pillH / 2 + 0.5)
    ctx.textBaseline = 'alphabetic'
    return
  }

  // 'pill' — rounded pill at the line's leading edge (top for vertical lines,
  // left for horizontal), clamped to stay inside the canvas.
  const pillW = ctx.measureText(label).width + 10
  const pillH = 15
  if (vertical) {
    const px = Math.max(
      clipMin + 1,
      Math.min(clipMax - pillW - 1, p - pillW / 2),
    )
    ctx.beginPath()
    ctx.roundRect(px, 1, pillW, pillH, 3)
    ctx.fillStyle = flagBg
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(label, px + pillW / 2, 1 + pillH / 2 + 0.5)
  } else {
    const py = Math.max(
      clipMin + 1,
      Math.min(clipMax - pillH - 1, p - pillH / 2),
    )
    ctx.beginPath()
    ctx.roundRect(6, py, pillW, pillH, 3)
    ctx.fillStyle = flagBg
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(label, 6 + pillW / 2, py + pillH / 2 + 0.5)
  }
  ctx.textBaseline = 'alphabetic'
}

/**
 * Hit-test the A/B boundaries: returns the closest marker within `tol` pixels,
 * or null. `pointerPos` and `posOf(...)` must be in the SAME coordinate space
 * (both canvas-local, or both client). Mirrors where the markers are drawn.
 */
export function hitTestAbLoopMarker(
  pointerPos: number,
  a: number,
  b: number,
  posOf: (value: number) => number,
  tol: number = LOOP_MARKER_HIT_PX,
): 'A' | 'B' | null {
  let best: 'A' | 'B' | null = null
  let bestDist = tol
  if (a > 0) {
    const d = Math.abs(pointerPos - posOf(a))
    if (d <= bestDist) {
      best = 'A'
      bestDist = d
    }
  }
  if (b > 0) {
    const d = Math.abs(pointerPos - posOf(b))
    if (d <= bestDist) best = 'B'
  }
  return best
}
