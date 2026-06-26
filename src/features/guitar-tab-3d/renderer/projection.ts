// ============================================================
// Projection math for the 3D tab view (pure, renderer-agnostic)
// ============================================================
//
// Notes descend from a vanishing point onto the neck; `perspectiveScale` gives
// the size/position factor at a normalized time-depth, and `beatsToDepth` maps a
// beats-ahead value into that [0,1] depth. Kept pure for unit testing and reuse
// by any backend (Canvas2D today, a WebGPU backend later).

/** Perspective factor at normalized depth `v` (0 = near/now, 1 = far/future). */
export function perspectiveScale(v: number, depthCurve: number): number {
  return 1 / (1 + v * depthCurve)
}

/** Convert a beats-ahead value to normalized depth using the visible window. */
export function beatsToDepth(
  beatsAhead: number,
  visibleBeatWindow: number,
): number {
  if (visibleBeatWindow <= 0) return 0
  return beatsAhead / visibleBeatWindow
}
