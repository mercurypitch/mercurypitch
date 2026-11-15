// Studio kit hit tests — a hit draws as a square at its start, sized to its row less a margin, and stops 2 px short of the next hit on its row; a press takes it anywhere in a square its row's height about it, however small it draws; and the next hit on a row is found among that row's starts alone.
import { describe, expect, it } from 'vitest'
import { kitHitSquare, kitHitTarget, kitNextStart, kitRowStarts, } from './kit-hit'

describe('a hit', () => {
  it('draws as a square at its start, its row less a margin each way', () => {
    // A row 40 px tall from 80: a margin of 7 px.
    expect(kitHitSquare(100, 80, 40)).toEqual({
      x: 100.5,
      y: 87,
      width: 26,
      height: 26,
    })
  })

  it('stops 2 px short of the next hit on its row', () => {
    const drawn = kitHitSquare(100, 0, 32, 110)

    expect([drawn.width, drawn.height, drawn.y]).toEqual([8, 8, 12])
  })

  it("is taken anywhere in a square its row's height about it, however small it draws", () => {
    const drawn = kitHitSquare(100, 0, 32, 110)

    expect(kitHitTarget(drawn, 0, 32)).toEqual({
      x: 88.5,
      y: 0,
      width: 32,
      height: 32,
    })
  })
})

describe('the next hit on a row', () => {
  // Hats on every eighth, a kick on the first beat.
  const starts = kitRowStarts([
    { row: 4, start: 480 },
    { row: 0, start: 0 },
    { row: 4, start: 0 },
    { row: 4, start: 960 },
  ])

  it('is the first later start on that row, and none past the last', () => {
    expect([
      kitNextStart(starts, 4, 0),
      kitNextStart(starts, 4, 480),
      kitNextStart(starts, 4, 960),
      kitNextStart(starts, 0, 0),
      kitNextStart(starts, 2, 0),
    ]).toEqual([480, 960, Infinity, Infinity, Infinity])
  })
})
