import { describe, expect, it } from 'vitest'
import type { Lens } from './fov'
import { holdHorizontalFov } from './fov'

const HALLWAY: Lens = { designFovDeg: 40, designAspect: 1.5, maxFovDeg: 62 }
const CHAMBER: Lens = { designFovDeg: 42, designAspect: 1.5, maxFovDeg: 64 }

/** The Hallway's inline arithmetic, as it shipped, to hold the shared
 * rule to it exactly. */
const hallwayAsShipped = (aspect: number): number => {
  const halfH = Math.tan((40 * Math.PI) / 360) * 1.5
  return Math.min(62, Math.max(40, (Math.atan(halfH / aspect) * 360) / Math.PI))
}

/** The chambers' and the Line's, written the other way round. */
const chamberAsShipped = (aspect: number): number => {
  const designHalfH = (42 * Math.PI) / 360
  const halfW = Math.atan(Math.tan(designHalfH) * 1.5)
  const wanted = (2 * Math.atan(Math.tan(halfW) / aspect) * 180) / Math.PI
  return Math.min(64, Math.max(42, wanted))
}

const horizontalDeg = (fovDeg: number, aspect: number): number =>
  (2 * Math.atan(Math.tan((fovDeg * Math.PI) / 360) * aspect) * 180) / Math.PI

describe('holding the horizontal angle', () => {
  it.each([0.46, 0.56, 0.75, 1, 1.5, 1.78, 2.4])(
    'is the arithmetic every world shipped with, at aspect %f',
    (aspect) => {
      expect(holdHorizontalFov(aspect, HALLWAY)).toBeCloseTo(
        hallwayAsShipped(aspect),
        10,
      )
      expect(holdHorizontalFov(aspect, CHAMBER)).toBeCloseTo(
        chamberAsShipped(aspect),
        10,
      )
    },
  )

  it('keeps the composed framing on the composed screen, and on wider ones', () => {
    expect(holdHorizontalFov(1.5, HALLWAY)).toBeCloseTo(40, 10)
    expect(holdHorizontalFov(2.4, HALLWAY)).toBe(40)
  })

  it('widens a narrower screen until the width is back, up to the cap', () => {
    // A 4:3 tablet on its side: narrow enough to need it, wide enough to
    // get the whole composed width back under the cap.
    const landscape = holdHorizontalFov(4 / 3, HALLWAY)
    expect(landscape).toBeGreaterThan(40)
    expect(landscape).toBeLessThan(62)
    expect(horizontalDeg(landscape, 4 / 3)).toBeCloseTo(
      horizontalDeg(40, 1.5),
      6,
    )
    // Upright, a tablet and a phone both meet the cap -- and still get
    // far more width than the lens alone gave them.
    for (const aspect of [0.75, 390 / 844]) {
      const fov = holdHorizontalFov(aspect, HALLWAY)
      expect(fov).toBe(62)
      expect(horizontalDeg(fov, aspect)).toBeGreaterThan(
        horizontalDeg(40, aspect) * 1.5,
      )
    }
  })

  it('answers a screen with no shape yet with the design angle', () => {
    expect(holdHorizontalFov(0, HALLWAY)).toBe(40)
    expect(holdHorizontalFov(Number.NaN, HALLWAY)).toBe(40)
  })
})
