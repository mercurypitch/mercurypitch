import { describe, expect, it } from 'vitest'
import type { Rect, Side, TipPlace } from './tip-place'
import { overlapArea, placeTip, TIP_GAP } from './tip-place'

const ROOM: Rect = { x: 0, y: 0, w: 390, h: 700 }
/** A tooltip that is 200 wide at most, two lines tall. */
const size = (maxWidth: number) => ({ w: Math.min(200, maxWidth), h: 48 })

/** Where the arrow's tip lands, from the box and the arrow offset. */
function arrowTip(place: TipPlace): { x: number; y: number } {
  const { box, side, arrow } = place
  switch (side) {
    case 'above':
      return { x: box.x + arrow, y: box.y + box.h + TIP_GAP }
    case 'below':
      return { x: box.x + arrow, y: box.y - TIP_GAP }
    case 'left':
      return { x: box.x + box.w + TIP_GAP, y: box.y + arrow }
    case 'right':
      return { x: box.x - TIP_GAP, y: box.y + arrow }
  }
}

function place(
  anchors: Partial<Record<Side, { x: number; y: number }>>,
  sides: Side[],
  avoid: Rect[] = [],
  prefer: Rect[] = [],
): TipPlace {
  const result = placeTip({
    anchors,
    sides,
    size,
    bounds: ROOM,
    avoid,
    prefer,
    maxWidth: 240,
  })
  if (result === null) throw new Error('no place')
  return result
}

describe('placeTip', () => {
  it('centres over its anchor with the arrow on it', () => {
    const anchor = { x: 195, y: 300 }
    const result = place({ above: anchor }, ['above'])
    expect(result.side).toBe('above')
    expect(result.box.x + result.box.w / 2).toBeCloseTo(195)
    expect(arrowTip(result)).toEqual(anchor)
    expect(result.clear).toBe(true)
  })

  it('takes the next side when the first would cover what it explains', () => {
    const anchor = { x: 195, y: 300 }
    const target: Rect = { x: 100, y: 200, w: 190, h: 95 }
    const result = place(
      { above: anchor, below: anchor },
      ['above', 'below'],
      [target],
    )
    expect(result.side).toBe('below')
    expect(overlapArea(result.box, target)).toBe(0)
  })

  it('stays in the room at its edge, and the arrow still reaches', () => {
    const anchor = { x: 30, y: 300 }
    const result = place({ above: anchor }, ['above'])
    expect(result.box.x).toBeGreaterThanOrEqual(8)
    expect(arrowTip(result)).toEqual(anchor)
  })

  it('slides along its side to keep off what it would rather not cover', () => {
    const anchor = { x: 120, y: 300 }
    const merc: Rect = { x: 130, y: 240, w: 60, h: 60 }
    const result = place({ left: anchor }, ['left'], [], [merc])
    expect(result.side).toBe('left')
    expect(overlapArea(result.box, merc)).toBe(0)
    expect(arrowTip(result)).toEqual(anchor)
  })

  it('narrows to fit beside its anchor', () => {
    const anchor = { x: 140, y: 300 }
    const result = place({ left: anchor }, ['left'])
    expect(result.box.w).toBeLessThanOrEqual(140 - TIP_GAP - 8)
    expect(result.box.x).toBeGreaterThanOrEqual(8)
  })

  it('skips a side with no room for a readable tooltip', () => {
    const anchor = { x: 60, y: 300 }
    const result = place({ left: anchor, right: anchor }, ['left', 'right'])
    expect(result.side).toBe('right')
  })

  it('says so when every place covers something it must not', () => {
    const anchor = { x: 195, y: 300 }
    const everything: Rect = { x: 0, y: 0, w: 390, h: 700 }
    const result = place({ above: anchor }, ['above'], [everything])
    expect(result.clear).toBe(false)
  })

  it('wraps narrower rather than cover what it should keep off', () => {
    // A two-line tooltip at 120 wide, one line at 200.
    const wrap = (maxWidth: number) =>
      maxWidth >= 200
        ? { w: 200, h: 30 }
        : { w: Math.min(maxWidth, 136), h: 48 }
    const anchor = { x: 70, y: 300 }
    const lantern: Rect = { x: 150, y: 150, w: 120, h: 300 }
    const result = placeTip({
      anchors: { above: anchor },
      sides: ['above'],
      size: wrap,
      bounds: ROOM,
      avoid: [],
      prefer: [lantern],
      maxWidth: 240,
    })
    expect(result?.box.w).toBeLessThanOrEqual(136)
    expect(result === null ? -1 : overlapArea(result.box, lantern)).toBe(0)
  })
})
