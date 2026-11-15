// Studio kit hit tests — a hit draws as a square at its start, sized to its row less a margin, and never wider than a sixteenth at the zoom shown; a press takes it anywhere in a square its row's height about it, however small it draws.
import { describe, expect, it } from 'vitest'
import { kitHitSquare, kitHitTarget } from './kit-hit'

/** A bar across 960 px: a sixteenth is 60 px. */
const WIDE = { start: 0, end: 3840, width: 960 }
/** Two bars across 320 px: a sixteenth is 10 px. */
const NARROW = { start: 0, end: 7680, width: 320 }

describe('a hit', () => {
  it('draws as a square at its start, its row less a margin each way', () => {
    // A row 40 px tall from 80: a margin of 7 px.
    expect(kitHitSquare(100, 80, 40, WIDE)).toEqual({
      x: 100.5,
      y: 87,
      width: 26,
      height: 26,
    })
  })

  it('draws no wider than a sixteenth less 2 px where sixteenths are narrow', () => {
    const drawn = kitHitSquare(100, 0, 32, NARROW)

    expect(drawn.width).toBe(8)
    expect(drawn.height).toBe(8)
    expect(drawn.y).toBe(12)
  })

  it("is taken anywhere in a square its row's height about it, however small it draws", () => {
    const drawn = kitHitSquare(100, 0, 32, NARROW)

    expect(kitHitTarget(drawn, 0, 32)).toEqual({
      x: 88.5,
      y: 0,
      width: 32,
      height: 32,
    })
  })
})
