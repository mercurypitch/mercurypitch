// Studio true-peak estimate — every 8x phase of a 64-tap Hann-sinc filter, including padded boundaries.
// This finite reconstruction is an estimate, not certification. Reference receipts document its error.
export const STUDIO_TRUE_PEAK_VERSION = 'hann64-8x-v1'
const TAPS = 64
const RADIUS = TAPS / 2
const PHASES = 8
const COEFFICIENTS = Array.from({ length: PHASES - 1 }, (_, phase) => {
  const fraction = (phase + 1) / PHASES
  return Float64Array.from({ length: TAPS }, (_, tap) => {
    const distance = tap - RADIUS + 1 - fraction
    return (
      (Math.sin(Math.PI * distance) / (Math.PI * distance)) *
      (0.5 + 0.5 * Math.cos((Math.PI * distance) / RADIUS))
    )
  })
})

/** Fixed memory; finish flushes the FIR's zero-padded end exactly once. */
export function createTruePeakEstimator() {
  const ring = new Float64Array(TAPS * 2)
  let cursor = 0
  let peak = 0
  let finished = false

  function sample(value: number): void {
    ring[cursor] = value
    ring[cursor + TAPS] = value
    cursor = (cursor + 1) % TAPS
    peak = Math.max(peak, Math.abs(value))
    for (const coefficients of COEFFICIENTS) {
      let interpolated = 0
      for (let tap = 0; tap < TAPS; tap++)
        interpolated += ring[cursor + tap] * coefficients[tap]
      peak = Math.max(peak, Math.abs(interpolated))
    }
  }
  return {
    push(value: number) {
      if (finished) throw new Error('The peak measurement is already complete.')
      sample(value)
    },
    finish(): number {
      if (!finished) {
        for (let i = 0; i < TAPS; i++) sample(0)
        finished = true
      }
      return peak
    },
    peak: () => peak,
    reset() {
      ring.fill(0)
      cursor = 0
      peak = 0
      finished = false
    },
  }
}
