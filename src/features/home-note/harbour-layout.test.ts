import { describe, expect, it } from 'vitest'
import { bandHalfHeight, layoutHarbour, MERC_SIZE_W } from './harbour-layout'
import { TRAIL_REACH_CENTS } from './voice-trail'

const FEET = 0.81

describe("the harbour's layout", () => {
  for (const [width, height] of [
    [390, 844],
    [375, 667],
    [360, 640],
    [820, 1180],
  ]) {
    it(`keeps the trail clear of the lamp and the dock at ${width} x ${height}`, () => {
      const layout = layoutHarbour(width, height, FEET)
      // The trail's head sits left of the lamp's glow.
      expect(layout.trail.headX).toBeLessThan(layout.lampX - 30)
      // Half an octave either side of the beam stays inside the room's
      // middle: under the chip, over the dock.
      expect(layout.beamY - layout.trail.reach).toBeGreaterThan(height * 0.2)
      expect(layout.beamY + layout.trail.reach).toBeLessThan(height * 0.7)
      // Merc stands on the pier, his feet where the layout puts them.
      const feetY = layout.merc.top + layout.merc.size * FEET
      expect(feetY).toBeCloseTo(height * 0.735)
      expect(layout.merc.size).toBeCloseTo(width * MERC_SIZE_W)
    })
  }

  it("draws the level's band to the trail's own scale", () => {
    const layout = layoutHarbour(390, 844, FEET)
    expect(bandHalfHeight(TRAIL_REACH_CENTS, layout)).toBeCloseTo(
      layout.trail.reach,
    )
    expect(bandHalfHeight(50, layout)).toBeCloseTo(layout.trail.reach / 12)
  })
})
