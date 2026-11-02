// ============================================================
// Where the Leap demo's tooltips point, on a measured room
// ============================================================

import { describe, expect, it } from 'vitest'
import type { Rect } from '@/components/demo-kit/tip-place'
import type { DemoScene } from './tip-targets'
import { tipTarget } from './tip-targets'

const rect = (x: number, y: number, w: number, h: number): Rect => ({
  x,
  y,
  w,
  h,
})

/** A 390 x 844 phone: Merc on the near ledge, the band and lantern far right. */
const SCENE: DemoScene = {
  room: rect(0, 47, 390, 763),
  merc: rect(20, 470, 94, 94),
  band: rect(234, 390, 112, 24),
  lantern: rect(352, 354, 16, 16),
  head: [rect(140, 110, 110, 32), rect(150, 148, 90, 28)],
  mic: rect(153, 700, 84, 84),
  controls: [rect(300, 53, 78, 44)],
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe("the Leap demo's tooltip targets", () => {
  it('aims "call" over Merc, or beside him', () => {
    const target = tipTarget('merc', SCENE)
    expect(target?.sides).toEqual(['above', 'right'])
    expect(target?.anchors.above?.y).toBeLessThan(470 + 94 * 0.3)
  })

  it('aims "leap" over or under the band on the far ledge, glowing it', () => {
    const target = tipTarget('band', SCENE)
    expect(target?.sides).toEqual(['above', 'below'])
    expect(target?.glow?.kind).toBe('light')
    // It covers none of the band, the head or the controls.
    expect(target?.avoid).toEqual(
      expect.arrayContaining([SCENE.band, ...SCENE.head]),
    )
  })

  it("aims at the lantern from the room's side, never over the band", () => {
    const target = tipTarget('lantern', SCENE)
    expect(target?.sides[0]).toBe('left')
    expect(target?.anchors.left?.x).toBeLessThan(352)
    expect(target?.avoid.some((r) => overlaps(r, SCENE.band as Rect))).toBe(
      true,
    )
  })

  it('hides a tooltip whose part is not on the screen', () => {
    expect(tipTarget('lantern', { ...SCENE, lantern: null })).toBeNull()
    expect(tipTarget('band', { ...SCENE, band: null })).toBeNull()
    expect(tipTarget('merc', { ...SCENE, merc: null })).toBeNull()
  })

  it('aims the mic hint beside the mic', () => {
    expect(tipTarget('mic', SCENE)?.sides).toEqual(['above', 'right', 'left'])
  })
})
