import { describe, expect, it } from 'vitest'
import { JETTY_PLATE, jettyBox, layoutLake, nameTop, restingLines, stepsPath, xOf, yOf, } from './lake-layout'

const FEET = 0.81

describe("the lake's layout", () => {
  it('shows a line at rest of the level, G3 A3 B3 A3 under B3 C4 D4 C4', () => {
    expect(restingLines(4)).toEqual({
      merc: [55, 57, 59, 57],
      harmony: [59, 60, 62, 60],
    })
    expect(restingLines(3).merc).toEqual([55, 57, 59])
    expect(restingLines(5).harmony).toEqual([59, 60, 62, 60, 59])
  })

  it.each([
    [390, 844],
    [360, 640],
    [834, 1194],
  ])(
    'lays the lamps across the water at %i x %i, clear of the jetty and the edge',
    (width, height) => {
      const layout = layoutLake(width, height, restingLines(5), FEET)
      expect(layout.lampX).toHaveLength(5)
      expect(layout.lampX[0]).toBeGreaterThan(
        layout.merc.left + layout.merc.size,
      )
      expect(layout.lampX[4]).toBeLessThan(width - 30)
      for (const midi of [55, 57, 59, 60, 62]) {
        const y = yOf(layout, midi)
        expect(y).toBeGreaterThan(layout.shore)
        // Over the jetty's deck, and clear of the dock (the mic, and "Hear
        // Merc again" over it).
        expect(y).toBeLessThan(layout.jetty.top)
        expect(y + 8).toBeLessThanOrEqual(height - Math.max(height * 0.25, 200))
      }
      // The bubble floats over the highest lamp, under the head.
      expect(layout.lampsTop).toBeLessThan(yOf(layout, 62) - 7)
      expect(layout.lampsTop).toBeGreaterThan(layout.shore)
      // Merc's feet on the deck.
      expect(layout.merc.top + layout.merc.size * FEET).toBeCloseTo(
        layout.jetty.top,
      )
    },
  )

  it.each([
    [390, 844],
    [360, 640],
  ])(
    'stands the jetty low at the result at %i x %i, Merc on it, over the dock',
    (width, height) => {
      const live = layoutLake(width, height, restingLines(4), FEET)
      const low = layoutLake(width, height, restingLines(4), FEET, true)
      expect(low.jetty.top).toBeGreaterThan(live.jetty.top)
      // Just over the dock: Again and Done, 80 px with their margin.
      expect(low.jetty.top).toBeLessThanOrEqual(height - 136)
      expect(low.merc.top + low.merc.size * FEET).toBeCloseTo(low.jetty.top)
      // The lamps keep their places: only the jetty and Merc move.
      expect(low.lampX).toEqual(live.lampX)
      expect(low.lampsTop).toBe(live.lampsTop)
    },
  )

  it("puts a harmony note's name over its lamp, clear of the lamp's top", () => {
    const layout = layoutLake(390, 844, restingLines(4), FEET)
    // The highest lamp is D4's: its name's top is over the lamps' top.
    expect(nameTop(layout, 62)).toBeLessThan(layout.lampsTop)
    expect(yOf(layout, 62) - nameTop(layout, 62)).toBe(26)
  })

  it('draws a higher note higher, on one semitone scale for both lines', () => {
    const layout = layoutLake(390, 844, restingLines(4), FEET)
    expect(yOf(layout, 62)).toBeLessThan(yOf(layout, 59))
    expect(yOf(layout, 60) - yOf(layout, 61)).toBeCloseTo(layout.semitone)
  })

  it('walks the trail along the lamps, and past the ends at their spacing', () => {
    const layout = layoutLake(390, 844, restingLines(4), FEET)
    const [a, b] = layout.lampX
    expect(xOf(layout, 0)).toBe(a)
    expect(xOf(layout, 1)).toBe(b)
    expect(xOf(layout, 0.5)).toBeCloseTo((a + b) / 2)
    expect(xOf(layout, -0.5)).toBeCloseTo(a - (b - a) / 2)
    expect(xOf(layout, 3.5)).toBeCloseTo(layout.lampX[3] + (b - a) / 2)
  })

  it("draws a line's steps through its lamps, a level run at each", () => {
    const layout = layoutLake(390, 844, restingLines(3), FEET)
    const path = stepsPath(layout, [55, 57, 59])
    expect(path.match(/[ML]/g)).toEqual(['M', 'L', 'L'])
    expect(path.match(/H/g)).toHaveLength(3)
  })
  it("lays the painted jetty's deck from the room's edge to the jetty's end, on the deck", () => {
    for (const [width, height] of [
      [320, 480],
      [390, 844],
      [430, 932],
      [820, 1180],
      [1180, 760],
    ]) {
      for (const atResult of [false, true]) {
        const layout = layoutLake(
          width,
          height,
          restingLines(4),
          FEET,
          atResult,
        )
        const box = jettyBox(layout)
        const scale = box.width / JETTY_PLATE.width
        expect(box.x).toBe(0)
        expect(box.y).toBe(0)
        expect(JETTY_PLATE.deckRight * scale).toBeCloseTo(layout.jetty.right)
        // Merc's feet on the planks, wherever the deck stands.
        const feet = layout.merc.top + layout.merc.size * FEET
        expect(feet).toBeCloseTo(layout.jetty.top)
        expect(layout.merc.left + layout.merc.size / 2).toBeLessThan(
          layout.jetty.right,
        )
      }
    }
  })
})
