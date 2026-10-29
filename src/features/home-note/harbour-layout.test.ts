import { describe, expect, it } from 'vitest'
import { TRAIL_REACH_CENTS } from '@/components/room-kit/voice-trail'
import type { HarbourLayout } from './harbour-layout'
import { bandHalfHeight, layoutHarbour } from './harbour-layout'

const FEET = 0.81

/** Phones, then tablets, upright. */
const UPRIGHT: readonly (readonly [number, number])[] = [
  [390, 844],
  [375, 667],
  [360, 640],
  [360, 800],
  [430, 932],
  [744, 1133],
  [768, 1024],
  [820, 1180],
  [1024, 1366],
]
/** The same screens on their side. */
const SIDEWAYS = UPRIGHT.map(([width, height]) => [height, width] as const)

/**
 * The plates in ./art/, and the planks of their piers as the pictures have
 * them: the band of deck along the pier's front that a character stands
 * on, in shares of the plate.
 */
const PLATES = {
  portrait: {
    width: 1440,
    height: 2560,
    planks: { x: [0.02, 0.34], y: [0.7, 0.745] },
  },
  landscape: {
    width: 2048,
    height: 1152,
    planks: { x: [0.02, 0.31], y: [0.775, 0.805] },
  },
} as const

/**
 * A point of a room `width` x `height` on the plate the picture shows
 * there, covering the room, pinned at 84% across and 44% down
 * (`object-fit: cover`, `object-position: 84% 44%`).
 */
function onPlate(
  landscape: boolean,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const plate = landscape ? PLATES.landscape : PLATES.portrait
  const scale = Math.max(width / plate.width, height / plate.height)
  const left = (width - plate.width * scale) * 0.84
  const top = (height - plate.height * scale) * 0.44
  return {
    plate,
    x: (x - left) / (plate.width * scale),
    y: (y - top) / (plate.height * scale),
    /** The plate's height as the room shows it, px. */
    shown: plate.height * scale,
  }
}

/** The harbour of a room that is the whole screen, as the room has it:
 *  the picture shows its landscape plate on a screen wider than tall. */
function onScreen(width: number, height: number): HarbourLayout {
  return layoutHarbour(width, height, FEET, width > height)
}

/** Merc's feet in the room, px. */
function feetOf(layout: HarbourLayout): { x: number; y: number } {
  const { merc } = layout
  return { x: merc.left + merc.size / 2, y: merc.top + merc.size * FEET }
}

/** A point on its plate falls on that plate's planks. */
function expectOnPlanks(at: ReturnType<typeof onPlate>): void {
  expect(at.x).toBeGreaterThanOrEqual(at.plate.planks.x[0])
  expect(at.x).toBeLessThanOrEqual(at.plate.planks.x[1])
  expect(at.y).toBeGreaterThanOrEqual(at.plate.planks.y[0])
  expect(at.y).toBeLessThanOrEqual(at.plate.planks.y[1])
}

describe("the harbour's layout", () => {
  for (const [width, height] of [
    [390, 844],
    [375, 667],
    [360, 640],
    [820, 1180],
  ]) {
    it(`keeps the trail clear of the lamp and the dock at ${width} x ${height}`, () => {
      const layout = onScreen(width, height)
      // The trail's head sits left of the lamp's glow.
      expect(layout.trail.headX).toBeLessThan(layout.lampX - 30)
      // Half an octave either side of the beam stays inside the room's
      // middle: under the chip, over the dock.
      expect(layout.beamY - layout.trail.reach).toBeGreaterThan(height * 0.2)
      expect(layout.beamY + layout.trail.reach).toBeLessThan(height * 0.7)
    })
  }

  for (const [width, height] of [...UPRIGHT, ...SIDEWAYS]) {
    it(`stands Merc on the painted planks at ${width} x ${height}`, () => {
      const layout = onScreen(width, height)
      const feet = feetOf(layout)
      expectOnPlanks(onPlate(width > height, width, height, feet.x, feet.y))
      // And all of him on the screen: his body is half his canvas wide.
      const { size } = layout.merc
      expect(feet.x - size / 4).toBeGreaterThanOrEqual(0)
      expect(feet.x + size / 4).toBeLessThanOrEqual(width)
      expect(feet.y).toBeLessThan(height)
    })
  }

  it("sizes him to the painted pier, whatever the screen's width", () => {
    for (const screens of [UPRIGHT, SIDEWAYS]) {
      const shares = screens.map(([width, height]) => {
        const { size } = onScreen(width, height).merc
        return size / onPlate(width > height, width, height, 0, 0).shown
      })
      for (const share of shares) expect(share).toBeCloseTo(shares[0], 9)
    }
    // A phone on its side: he no longer fills the screen's height.
    expect(onScreen(844, 390).merc.size).toBeLessThan(390 / 3)
  })

  it('stands him on the plate the picture shows, not the shape of the room', () => {
    // An upright screen whose room is a little wider than tall (a bar over
    // it, a window near square): the picture shows the upright plate, and
    // he stands on its planks, at its scale.
    const layout = layoutHarbour(700, 680, FEET, false)
    const feet = feetOf(layout)
    const at = onPlate(false, 700, 680, feet.x, feet.y)
    expectOnPlanks(at)
    expect(feet.y).toBeLessThan(680)
    const upright = onScreen(390, 844)
    expect(layout.merc.size / at.shown).toBeCloseTo(
      upright.merc.size / onPlate(false, 390, 844, 0, 0).shown,
      9,
    )
  })

  it('keeps the place a phone held upright was painted for', () => {
    const layout = onScreen(390, 844)
    expect(layout.merc.size).toBeCloseTo(156, 0)
    const feet = feetOf(layout)
    expect(feet.x).toBeCloseTo(78, 0)
    expect(feet.y).toBeCloseTo(844 * 0.735, 0)
  })

  it('keeps him on screen in a window narrower than any phone', () => {
    const layout = onScreen(320, 1024)
    expect(feetOf(layout).x - layout.merc.size / 4).toBeGreaterThanOrEqual(0)
  })

  it("lays the drawing's deck under his feet", () => {
    for (const [width, height] of [
      [390, 844],
      [1180, 820],
    ]) {
      const layout = onScreen(width, height)
      const feet = feetOf(layout)
      expect(layout.pier.deckY).toBeCloseTo(feet.y)
      expect(layout.pier.end).toBeGreaterThan(feet.x)
    }
  })

  it("draws the level's band to the trail's own scale", () => {
    const layout = onScreen(390, 844)
    expect(bandHalfHeight(TRAIL_REACH_CENTS, layout)).toBeCloseTo(
      layout.trail.reach,
    )
    expect(bandHalfHeight(50, layout)).toBeCloseTo(layout.trail.reach / 12)
  })
})
