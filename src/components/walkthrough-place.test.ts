// Where the Guide's tooltip stands (walkthrough-place.ts): on the side the
// step asks for, the opposite one when that has no room, and beside a target
// too tall for either, rather than over its middle.

import { describe, expect, it } from 'vitest'
import type { PlaceRect } from './walkthrough-place'
import { placeTooltip } from './walkthrough-place'

const box = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }) satisfies PlaceRect

/** Whether the tooltip at `at` takes any of `target`. */
const covers = (
  target: PlaceRect,
  at: { left: number; top: number },
  w: number,
  h: number,
): boolean =>
  at.left < target.right &&
  target.left < at.left + w &&
  at.top < target.bottom &&
  target.top < at.top + h

describe('placeTooltip', () => {
  it('stands where the step asks when there is room', () => {
    const at = placeTooltip(
      box(100, 100, 200, 40),
      340,
      200,
      1280,
      800,
      'bottom',
    )

    expect(at).toEqual({ placement: 'bottom', left: 30, top: 152 })
  })

  it('goes above when there is no room below', () => {
    const at = placeTooltip(
      box(400, 560, 200, 40),
      340,
      200,
      1280,
      800,
      'bottom',
    )

    expect(at.placement).toBe('top')
    expect(at.top).toBe(348)
  })

  // The Home tour's streak card on a phone on its side, 844x390: 411 x 430
  // from (10, 130). Below and above have no room, and the tooltip covered the
  // card's top while 423 px stood empty to its right.
  it('stands beside a target too tall for above and below, where a side has room', () => {
    const card = box(10, 130, 411, 430)

    const at = placeTooltip(card, 340, 206, 844, 390, 'bottom')

    expect(at.placement).toBe('right')
    expect(covers(card, at, 340, 206)).toBe(false)
  })

  it('takes the left side when only that has the room', () => {
    // The Legend card beside it, from x 423.
    const card = box(423, 42, 411, 430)

    const at = placeTooltip(card, 340, 206, 844, 390, 'bottom')

    expect(at.placement).toBe('left')
    expect(covers(card, at, 340, 206)).toBe(false)
  })

  it('keeps to above or below, inside the window, when no side has the room', () => {
    // A settings section as wide as the page at 844x390.
    const section = box(116, 42, 612, 380)

    const at = placeTooltip(section, 340, 248, 844, 390, 'bottom')

    expect(at.placement).toBe('top')
    expect(at.top).toBe(12)
  })
})
