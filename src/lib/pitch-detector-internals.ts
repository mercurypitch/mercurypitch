// ============================================================
// Pitch Detector Internal Functions
// Pure utility functions shared between PitchDetector and tests
// ============================================================

/** Compute adjusted YIN threshold from sensitivity (1-12).
 *  sensitivity 1 → 0.30 (strict), sensitivity 12 → 0.01 (relaxed) */
export function adjustedThreshold(sensitivity: number): number {
  return 0.3 - (sensitivity - 1) * 0.025
}

/** Compute MPM peak-pick threshold from sensitivity (1-10).
 *  sensitivity 1 → 0.9 (strict), sensitivity 10 → 0.54 (relaxed) */
export function mpmPickThreshold(sensitivity: number): number {
  return 0.9 - (sensitivity - 1) * 0.04
}

/** Parabolic interpolation around a MINIMUM (YIN). Given the value at
 *  tau and its two neighbours in `buf`, estimate the sub-sample position
 *  of the true minimum.
 *
 *  Formula: shift = (s2 - s0) / (2 * (2*s1 - s2 - s0)) */
export function parabolicInterpolation(tau: number, buf: Float32Array): number {
  if (tau <= 0 || tau >= buf.length - 1) return tau

  const s0 = buf[tau - 1]
  const s1 = buf[tau]
  const s2 = buf[tau + 1]
  const shift = (s2 - s0) / (2 * (2 * s1 - s2 - s0))

  return tau + shift
}

/** Parabolic interpolation around a MAXIMUM (MPM / NSDF peaks).
 *  Same concept as `parabolicInterpolation` but for peak finding.
 *
 *  Formula: shift = (s0 - s2) / (2 * (2*s1 - s2 - s0)) */
export function parabolicInterpolationMax(
  tau: number,
  buf: Float32Array,
): number {
  if (tau <= 0 || tau >= buf.length - 1) return tau

  const s0 = buf[tau - 1]
  const s1 = buf[tau]
  const s2 = buf[tau + 1]
  const denom = 2 * (2 * s1 - s2 - s0)
  if (Math.abs(denom) < 1e-10) return tau
  const shift = (s0 - s2) / denom

  return tau + shift
}
