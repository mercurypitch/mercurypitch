// ============================================================
// Beat quantization (Logic-style Q-Strength / Q-Range).
//
// Pure and UI-agnostic, extracted so the finalize pitch pipeline and the piano
// roll can share one definition instead of the inline snap at
// piano-roll.ts:3019.
// ============================================================

/**
 * Quantize a beat position toward a grid with adjustable strength and a
 * dead-zone.
 *
 * @param beat          Position in beats.
 * @param gridBeats     Grid spacing in beats (e.g. 0.5 for 1/8 notes when a
 *                      beat is a quarter note). Must be > 0.
 * @param strength      0 = no movement, 1 = snap fully to the grid. Default 1.
 * @param deadzoneBeats Positions already within this distance of the grid are
 *                      left untouched, preserving intentional feel. Default 0.
 */
export function quantizeBeat(
  beat: number,
  gridBeats: number,
  strength = 1,
  deadzoneBeats = 0,
): number {
  if (!(gridBeats > 0)) return beat
  const nearest = Math.round(beat / gridBeats) * gridBeats
  const delta = nearest - beat
  if (Math.abs(delta) <= deadzoneBeats) return beat
  const s = Math.min(1, Math.max(0, strength))
  return beat + s * delta
}
