// ============================================================
// One-Euro filter (Casiez, Roussel & Vogel, CHI 2012).
//
// An adaptive low-pass filter: steady on held values, low-lag on fast changes.
// It works on a single scalar with the real elapsed time per sample, so it
// adapts correctly to the variable requestAnimationFrame cadence rather than
// assuming a fixed frame period.
//   https://gery.casiez.net/1euro/
// ============================================================

export interface OneEuroFilter {
  filter(value: number, timeSec: number): number
  reset(): void
}

export interface OneEuroOptions {
  /** Minimum cutoff frequency (Hz). Lower = smoother but laggier at rest. */
  minCutoff?: number
  /** Speed coefficient. Higher = less lag during fast changes. */
  beta?: number
  /** Cutoff for the derivative low-pass (Hz). */
  dCutoff?: number
}

function smoothingAlpha(cutoff: number, dtSec: number): number {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dtSec)
}

export function createOneEuro(opts: OneEuroOptions = {}): OneEuroFilter {
  const minCutoff = opts.minCutoff ?? 1.0
  const beta = opts.beta ?? 0.01
  const dCutoff = opts.dCutoff ?? 1.0

  let xPrev: number | null = null
  let dxPrev = 0
  let tPrev: number | null = null

  return {
    filter(value: number, timeSec: number): number {
      if (xPrev === null || tPrev === null) {
        xPrev = value
        tPrev = timeSec
        dxPrev = 0
        return value
      }
      let dt = timeSec - tPrev
      if (!(dt > 0)) dt = 1e-3 // guard against zero / non-monotonic timestamps
      const dx = (value - xPrev) / dt
      const aD = smoothingAlpha(dCutoff, dt)
      const dxHat = aD * dx + (1 - aD) * dxPrev
      const cutoff = minCutoff + beta * Math.abs(dxHat)
      const a = smoothingAlpha(cutoff, dt)
      const xHat = a * value + (1 - a) * xPrev
      xPrev = xHat
      dxPrev = dxHat
      tPrev = timeSec
      return xHat
    },
    reset(): void {
      xPrev = null
      dxPrev = 0
      tPrev = null
    },
  }
}
