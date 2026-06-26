// ============================================================
// 3D-highway projection math (pure, renderer-agnostic)
// ============================================================
//
// Maps a note's (string lane, time-depth) onto 2D screen space with a faux
// perspective so notes appear to fall down per-string lanes toward a fretboard
// at the bottom, converging on a vanishing point near the top (the "highway"
// look). Kept pure so it can be unit-tested and reused by any backend (the
// Canvas2D renderer today, a WebGPU/TypeGPU backend later).

export interface HighwayLayout {
  /** CSS-pixel width of the drawing surface. */
  width: number
  /** CSS-pixel height of the drawing surface. */
  height: number
  /** Number of string lanes (6 for standard guitar). */
  stringCount: number
  /** Vertical position of the hit line (now), as a ratio of height. */
  hitLineRatio: number
  /** Vertical position of the vanishing point, as a ratio of height. */
  horizonRatio: number
  /** Half-width of the board at the near (hit-line) edge, as a ratio of width. */
  nearHalfWidthRatio: number
  /** Higher = stronger perspective compression toward the horizon. */
  depthCurve: number
}

export const DEFAULT_LAYOUT: Omit<HighwayLayout, 'width' | 'height'> = {
  stringCount: 6,
  hitLineRatio: 0.82,
  horizonRatio: 0.16,
  nearHalfWidthRatio: 0.46,
  depthCurve: 3,
}

export interface ProjectedPoint {
  x: number
  y: number
  /** Perspective scale at this depth (1 at the hit line, smaller toward horizon). */
  scale: number
}

/** Perspective scale at normalized depth `v` (0 = near/now, 1 = far/future). */
export function perspectiveScale(v: number, depthCurve: number): number {
  return 1 / (1 + v * depthCurve)
}

/** Centered lane coordinate in [-1, 1] for string index `i`. */
export function laneU(
  i: number,
  stringCount: number,
  leftHanded: boolean,
): number {
  const u = ((i + 0.5) / stringCount) * 2 - 1
  return leftHanded ? -u : u
}

/**
 * Project a board point at lane coordinate `u` (-1..1) and depth `v` to screen.
 * `v` may go slightly negative for notes that just passed the hit line.
 */
export function projectBoardPoint(
  layout: HighwayLayout,
  u: number,
  v: number,
): ProjectedPoint {
  const s = perspectiveScale(v, layout.depthCurve)
  const hitY = layout.height * layout.hitLineRatio
  const horizonY = layout.height * layout.horizonRatio
  const y = hitY + (horizonY - hitY) * (1 - s)
  const halfW = layout.width * layout.nearHalfWidthRatio * s
  const x = layout.width / 2 + u * halfW
  return { x, y, scale: s }
}

/** Convert a beats-ahead value to normalized depth using the visible window. */
export function beatsToDepth(
  beatsAhead: number,
  visibleBeatWindow: number,
): number {
  if (visibleBeatWindow <= 0) return 0
  return beatsAhead / visibleBeatWindow
}

/** Width of a single lane at the near (hit-line) edge, in CSS pixels. */
export function nearLaneWidth(layout: HighwayLayout): number {
  return (layout.width * layout.nearHalfWidthRatio * 2) / layout.stringCount
}
