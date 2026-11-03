// ============================================================
// Where the First note demo's tooltips point, on a measured room
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
 * A 390 x 844 phone: the chip and the song's name at the top, the
 * countdown under them, the band of light across the curtain at the
 * line's height, Merc on the boards at the left.
 */
const SCENE: DemoScene = {
  room: rect(0, 47, 390, 763),
  merc: rect(20, 520, 110, 110),
  countdown: rect(55, 155, 280, 40),
  band: rect(0, 400, 390, 40),
  head: [rect(140, 100, 110, 32), rect(90, 136, 210, 18)],
  mic: rect(153, 700, 84, 84),
  controls: [rect(300, 53, 78, 44)],
}

describe("the First note demo's tooltip targets", () => {
  it('aims "the song plays" under the countdown, covering none of the head', () => {
    const target = tipTarget('countdown', SCENE)
    expect(target?.sides).toEqual(['below'])
    expect(target?.anchors.below?.y).toBeGreaterThan(155 + 40)
    expect(target?.avoid).toEqual(
      expect.arrayContaining([SCENE.countdown, ...SCENE.head]),
    )
  })

  it("aims at the note's line over or under its band of light, glowing it", () => {
    const target = tipTarget('line', SCENE)
    expect(target?.sides).toEqual(['above', 'below'])
    expect(target?.glow?.kind).toBe('light')
    expect(target?.avoid).toEqual(
      expect.arrayContaining([SCENE.band, ...SCENE.head]),
    )
  })

  it('aims "Merc sings it" over Merc on the boards, or beside him', () => {
    const target = tipTarget('merc', SCENE)
    expect(target?.sides).toEqual(['above', 'right'])
    expect(target?.anchors.above?.y).toBeLessThan(520 + 110 * 0.3)
  })

  it('aims "come in" beside the mic', () => {
    expect(tipTarget('mic', SCENE)?.sides).toEqual(['above', 'right', 'left'])
  })

  it('hides a tooltip whose part is not on the screen', () => {
    expect(tipTarget('countdown', { ...SCENE, countdown: null })).toBeNull()
    expect(tipTarget('line', { ...SCENE, band: null })).toBeNull()
    expect(tipTarget('merc', { ...SCENE, merc: null })).toBeNull()
    expect(tipTarget('mic', { ...SCENE, mic: null })).toBeNull()
  })
})
