// ============================================================
// Volume curve — perceptual mapping from slider position to gain
// ============================================================

/**
 * Map a volume slider position (0–1) to a GainNode gain value.
 *
 * A linear mapping squeezes the audible range into the bottom fifth of the
 * slider: 50% is only −6 dB, barely quieter to the ear. Squaring the
 * position spreads loudness evenly across the travel (50% ≈ −12 dB,
 * 10% ≈ −40 dB) while keeping the endpoints exact (0 → silent, 1 → unity),
 * which is the standard DAW-style fader feel.
 *
 * Store and display the raw slider position; apply this only at the point
 * where a gain value is written to an AudioParam.
 */
export function sliderToGain(position: number): number {
  const p = Math.max(0, Math.min(1, position))
  return p * p
}
