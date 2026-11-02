// ============================================================
// Where the Harmony demo's tooltips point, on a measured room
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

/** A 390 x 844 phone: Merc on the jetty, the gold lamps across the lake. */
const SCENE: DemoScene = {
  room: rect(0, 47, 390, 763),
  merc: rect(14, 574, 94, 94),
  lamps: rect(132, 500, 222, 64),
  missed: rect(203, 492, 16, 16),
  head: [rect(140, 110, 110, 32), rect(130, 148, 130, 28)],
  mic: rect(153, 700, 84, 84),
  controls: [rect(300, 53, 78, 44)],
}

describe("the Harmony demo's tooltip targets", () => {
  it('aims "call" over Merc, or beside him', () => {
    const target = tipTarget('merc', SCENE)
    expect(target?.sides).toEqual(['above', 'right'])
    expect(target?.anchors.above?.y).toBeLessThan(574 + 94 * 0.3)
  })

  it('aims "yours" over or under the gold lamps, glowing them, clear of the head', () => {
    const target = tipTarget('lamps', SCENE)
    expect(target?.sides).toEqual(['above', 'below'])
    expect(target?.glow?.kind).toBe('light')
    expect(target?.avoid).toEqual(
      expect.arrayContaining([SCENE.lamps, ...SCENE.head]),
    )
  })

  it('aims "my note, not yours" at the lamp that missed, glowing its light', () => {
    const target = tipTarget('missed', SCENE)
    expect(target?.sides).toEqual(['above', 'below'])
    expect(target?.anchors.above?.y).toBeLessThan(492)
    expect(target?.anchors.below?.y).toBeGreaterThan(492 + 16)
    expect(target?.glow?.rect.x).toBeLessThan(203)
  })

  it('hides a tooltip whose part is not on the screen', () => {
    expect(tipTarget('missed', { ...SCENE, missed: null })).toBeNull()
    expect(tipTarget('lamps', { ...SCENE, lamps: null })).toBeNull()
    expect(tipTarget('merc', { ...SCENE, merc: null })).toBeNull()
  })

  it('aims the mic hint beside the mic', () => {
    expect(tipTarget('mic', SCENE)?.sides).toEqual(['above', 'right', 'left'])
  })
})
