// ============================================================
// EchoSky: the top light's gradient
// ============================================================

import { describe, expect, it } from 'vitest'
import { TOP_LIGHT } from './echo-geometry'
import { topLight } from './EchoSky'
import { RESULT_TOP_LIGHT } from './top-light'

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

describe("the result's top light", () => {
  /** A gradient's centre, px. */
  const centre = (gradient: string): number[] =>
    (/ at ([\d.]+)px ([\d.-]+)px/u.exec(gradient) ?? []).slice(1).map(Number)

  it("sits where screen 4's does: left of the middle, below the top edge", () => {
    const [x, y] = centre(topLight(390, 0, 390, RESULT_TOP_LIGHT))

    expect(x).toBeCloseTo(195 + RESULT_TOP_LIGHT.centreXW! * 390, 1)
    expect(x).toBeLessThan(195)
    expect(y).toBeCloseTo(RESULT_TOP_LIGHT.centreYW * 390, 1)
    expect(y).toBeGreaterThan(0)
  })

  it("keeps the room's light centred on its column", () => {
    const [x] = centre(topLight(390, 20, 350))

    expect(x).toBeCloseTo(195, 1)
  })

  it('ends clear too', () => {
    const stops = alphas(topLight(390, 0, 390, RESULT_TOP_LIGHT))

    expect(stops[stops.length - 1]).toBe(0)
    expect(stops[0]).toBeCloseTo(RESULT_TOP_LIGHT.alpha, 4)
  })
})
