// ============================================================
// Where the Home note demo's tooltips point, on a measured room
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

/**
 * A 390 x 844 phone: the chord lamps under the chip, the band of light
 * across the sea at home's height, the lamp at its right end, Merc on the
 * pier.
 */
const SCENE: DemoScene = {
  room: rect(0, 47, 390, 763),
  merc: rect(30, 470, 94, 94),
  chords: rect(140, 148, 110, 24),
  band: rect(0, 344, 328, 24),
  lamp: rect(300, 324, 64, 64),
  head: [rect(140, 110, 110, 32), rect(140, 148, 110, 24)],
  mic: rect(153, 700, 84, 84),
  controls: [rect(300, 53, 78, 44)],
}

describe("the Home note demo's tooltip targets", () => {
  it('aims "the band plays" under the chord lamps, covering none of the head', () => {
    const target = tipTarget('chords', SCENE)
    expect(target?.sides).toEqual(['below'])
    expect(target?.anchors.below?.y).toBeGreaterThan(148 + 24)
    expect(target?.avoid).toEqual(expect.arrayContaining([...SCENE.head]))
  })

  it("aims at home's line over or under its band of light, glowing it", () => {
    const target = tipTarget('beam', SCENE)
    expect(target?.sides).toEqual(['above', 'below'])
    expect(target?.glow?.kind).toBe('light')
    expect(target?.avoid).toEqual(
      expect.arrayContaining([SCENE.band, ...SCENE.head]),
    )
  })

  it('aims "not home" over Merc on the pier, or beside him', () => {
    const target = tipTarget('merc', SCENE)
    expect(target?.sides).toEqual(['above', 'right'])
    expect(target?.anchors.above?.y).toBeLessThan(470 + 94 * 0.3)
  })

  it("aims at the lamp from the room's side, glowing it", () => {
    const target = tipTarget('lamp', SCENE)
    expect(target?.sides[0]).toBe('left')
    expect(target?.anchors.left?.x).toBeLessThan(300)
    expect(target?.glow?.kind).toBe('light')
  })

  it('hides a tooltip whose part is not on the screen', () => {
    expect(tipTarget('chords', { ...SCENE, chords: null })).toBeNull()
    expect(tipTarget('beam', { ...SCENE, band: null })).toBeNull()
    expect(tipTarget('merc', { ...SCENE, merc: null })).toBeNull()
    expect(tipTarget('lamp', { ...SCENE, lamp: null })).toBeNull()
  })

  it('aims the mic hint beside the mic', () => {
    expect(tipTarget('mic', SCENE)?.sides).toEqual(['above', 'right', 'left'])
  })
})
