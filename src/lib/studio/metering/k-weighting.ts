// Studio K weighting — stateful filters without song-sized temporary arrays.
export interface BiquadCoefficients {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

export function kWeightingCoefficients(
  sampleRate: number,
): BiquadCoefficients[] {
  const k = Math.tan((Math.PI * 1681.974450955533) / sampleRate)
  const q = 0.7071752369554196
  const vh = Math.pow(10, 3.999843853973347 / 20)
  const vb = Math.pow(vh, 0.4996667741545416)
  const a0 = 1 + k / q + k * k
  const highPassK = Math.tan((Math.PI * 38.13547087602444) / sampleRate)
  const highPassQ = 0.5003270373238773
  const highPassA0 = 1 + highPassK / highPassQ + highPassK * highPassK
  return [
    {
      b0: (vh + (vb * k) / q + k * k) / a0,
      b1: (2 * (k * k - vh)) / a0,
      b2: (vh - (vb * k) / q + k * k) / a0,
      a1: (2 * (k * k - 1)) / a0,
      a2: (1 - k / q + k * k) / a0,
    },
    {
      b0: 1,
      b1: -2,
      b2: 1,
      a1: (2 * (highPassK * highPassK - 1)) / highPassA0,
      a2: (1 - highPassK / highPassQ + highPassK * highPassK) / highPassA0,
    },
  ]
}

export function createBiquad(f: BiquadCoefficients) {
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0
  return {
    push(x: number): number {
      const y = f.b0 * x + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2
      x2 = x1
      x1 = x
      y2 = y1
      y1 = y
      return y
    },
    reset() {
      x1 = 0
      x2 = 0
      y1 = 0
      y2 = 0
    },
  }
}
