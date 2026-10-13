// ============================================================
// EchoSky: the top light's gradient
// ============================================================

import { describe, expect, it } from 'vitest'
import { TOP_LIGHT } from './echo-geometry'
import { topLight } from './EchoSky'

/** A gradient's stop alphas, in order. */
const alphas = (gradient: string): number[] =>
  [...gradient.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/gu)].map((m) => Number(m[1]))

describe('the top light', () => {
  it('ends clear, so the colour a gradient paints past its edge tints nothing', () => {
    const stops = alphas(topLight(390, 0, 390))

    expect(stops[stops.length - 1]).toBe(0)
    expect(stops[0]).toBeCloseTo(TOP_LIGHT.alpha, 4)
  })

  it('falls off as a Gaussian, half way at 1.18 sigma', () => {
    const gradient = topLight(390, 0, 390)
    const stops = alphas(gradient)
    const rx = Number(/radial-gradient\(([\d.]+)px/u.exec(gradient)?.[1])

    // Four sigma across 16 intervals: stop 4 is one sigma out.
    expect(rx).toBeCloseTo(4 * TOP_LIGHT.sigmaXW * 390, 1)
    expect(stops[4]).toBeCloseTo(TOP_LIGHT.alpha * Math.exp(-0.5), 2)
    expect(stops.every((a, i) => i === 0 || a < stops[i - 1])).toBe(true)
  })
})
