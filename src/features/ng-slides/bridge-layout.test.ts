// ============================================================
// The bridge's frame on the phones the room is checked at
// ============================================================

import { describe, expect, it } from 'vitest'
import { MERC_FEET } from '@/components/room-kit/MercView'
import { ARCH, NOTE_NAMES } from './bridge-geometry'
import { archG, cropTop, layoutBridge, MERC_SIZE_W, mercBoxAt, pitchY, yOf, } from './bridge-layout'

/** The room's chip and mic on a phone: safe areas as an iPhone's. */
function box(
  width: number,
  height: number,
  safeTop: number,
  safeBottom: number,
) {
  return {
    width,
    height,
    chipBottom: safeTop + 56 + 58,
    controlsTop: height - safeBottom - 28 - 76,
  }
}

const PHONES = [
  ['390x844', box(390, 844, 47, 34)],
  ['430x932', box(430, 932, 59, 34)],
  ['375x667', box(375, 667, 20, 0)],
  ['360x640', box(360, 640, 24, 0)],
] as const

describe('the frame rule', () => {
  it('crops the storyboard equally from the sky and the water', () => {
    // ng-geometry.json frame.examples
    expect(cropTop(844 / 390)).toBeCloseTo(0.2069, 3)
    expect(cropTop(932 / 430)).toBeCloseTo(0.2053, 3)
    expect(cropTop(667 / 375)).toBeCloseTo(0.3997, 3)
  })

  it('keeps the frame rule where the phone is tall enough', () => {
    const layout = layoutBridge(box(390, 844, 47, 34))

    expect(layout.top).toBeCloseTo(cropTop(844 / 390), 9)
    expect(layout.mercSize).toBeCloseTo(MERC_SIZE_W * 390, 9)
  })
})

describe.each(PHONES)('on a %s phone', (_, phone) => {
  const layout = layoutBridge(phone)

  it('keeps the top note and Merc on the apex under the chip', () => {
    const merc = mercBoxAt(layout, 0.35, ARCH.apexY)
    const label = yOf(layout, ARCH.apexY + NOTE_NAMES.top.dy - 0.032)

    expect(merc.top).toBeGreaterThanOrEqual(phone.chipBottom)
    expect(label).toBeGreaterThanOrEqual(phone.chipBottom)
  })

  it('keeps Merc on the deck clear of the controls', () => {
    const merc = mercBoxAt(layout, 0.35, ARCH.deckY)

    expect(merc.top + merc.size).toBeLessThanOrEqual(phone.controlsTop)
    expect(merc.top + merc.size * MERC_FEET).toBeCloseTo(
      yOf(layout, ARCH.deckY),
      6,
    )
  })

  it('never lifts Merc into the chip, however sharp the voice', () => {
    const merc = mercBoxAt(layout, 0.35, pitchY(70, 45))

    expect(merc.top).toBeGreaterThanOrEqual(phone.chipBottom)
  })
})

describe('pitchY', () => {
  it('puts the root on the deck and the fifth on the apex', () => {
    expect(pitchY(45, 45)).toBeCloseTo(ARCH.deckY, 9)
    expect(pitchY(52, 45)).toBeCloseTo(ARCH.deckY - ARCH.h, 9)
  })
})

describe('archG', () => {
  it('is the arch: flat on top, eased to the feet, the glide path on the bridge', () => {
    expect(archG(0, ARCH.f)).toBe(1)
    expect(archG(ARCH.f, ARCH.f)).toBe(1)
    expect(archG(1, ARCH.f)).toBe(0)
    expect(archG(-0.5, ARCH.f)).toBeCloseTo(archG(0.5, ARCH.f), 12)
    // Halfway down the ramp, halfway up the arch (smoothstep's middle).
    expect(archG((1 + ARCH.f) / 2, ARCH.f)).toBeCloseTo(0.5, 12)
  })
})
