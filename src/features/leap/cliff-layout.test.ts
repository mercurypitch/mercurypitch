import { describe, expect, it } from 'vitest'
import { trailY } from '@/components/room-kit/voice-trail'
import { bandHalfHeight, layoutCliffs, trailNote } from './cliff-layout'

const FEET = 0.81

describe("The cliffs' layout", () => {
  it('stands the target above Merc for a leap up, below for a leap down', () => {
    const upward = layoutCliffs(390, 844, { from: 55, to: 62 }, FEET)
    expect(upward.toY).toBeLessThan(upward.fromY)
    expect(upward.fromY - upward.toY).toBeCloseTo(7 * upward.semitone)
    const downward = layoutCliffs(390, 844, { from: 62, to: 55 }, FEET)
    expect(downward.toY).toBeGreaterThan(downward.fromY)
  })

  it('keeps an octave between the head and the dock on a short phone', () => {
    for (const [width, height] of [
      [360, 640],
      [375, 667],
      [390, 844],
      [1280, 800],
      [800, 1280],
    ]) {
      const layout = layoutCliffs(width, height, { from: 50, to: 62 }, FEET)
      // The head (the chip and the leap's lamp) ends by 190 px down.
      expect(layout.toY).toBeGreaterThanOrEqual(190)
      // The dock (the mic and "Hear Merc again") starts 200 px up.
      expect(layout.fromY).toBeLessThanOrEqual(height - 200)
    }
  })

  it('stands Merc on his ledge, on the near cliff', () => {
    const layout = layoutCliffs(390, 844, { from: 57, to: 64 }, FEET)
    const feet = layout.merc.top + layout.merc.size * FEET
    expect(feet).toBeCloseTo(layout.fromY)
    expect(layout.merc.left + layout.merc.size / 2).toBeLessThan(
      layout.nearEdge,
    )
    expect(layout.lantern.x).toBeGreaterThan(layout.farEdge)
  })

  it('draws the trail through both notes, read against the leap middle', () => {
    const round = { from: 55, to: 64 }
    const layout = layoutCliffs(390, 844, round, FEET)
    const middle = trailNote(round)
    expect(middle).toBe(59.5)
    // Merc's note is half the leap under the middle, the target half over.
    expect(trailY((round.from - middle) * 100, layout.trail)).toBeCloseTo(
      layout.fromY,
    )
    expect(trailY((round.to - middle) * 100, layout.trail)).toBeCloseTo(
      layout.toY,
    )
  })

  it('stands the ledges low at the result, over the dock, for the leaps card', () => {
    for (const [width, height] of [
      [360, 640],
      [390, 844],
      [1280, 800],
    ]) {
      const layout = layoutCliffs(width, height, null, FEET, true)
      expect(layout.fromY).toBeLessThanOrEqual(height - 136)
      expect(layout.fromY).toBeGreaterThan(height * 0.6)
      expect(layout.toY).toBeLessThan(layout.fromY)
    }
  })

  it("sizes the target's band to the level tolerance", () => {
    const layout = layoutCliffs(390, 844, { from: 55, to: 62 }, FEET)
    expect(bandHalfHeight(50, layout)).toBeCloseTo(layout.semitone / 2)
  })
})
