// ============================================================
// Tune line motion tests — the lift, the travel, the glow and the afterglow
// ============================================================

import { describe, expect, it } from 'vitest'
import type { Slide } from './tune-line-motion'
import { AFTERGLOW_SEC, GLOW_RISE_SEC, GLOW_SEC, landsAfter, LIFT_SEC, lightAt, SETTLE_SEC, slideAt, travelSec, } from './tune-line-motion'

/** A slide of six semitones up from C4, begun at 10 s on the page's clock. */
const SLIDE: Slide = { from: 60, to: 66, t0: 10, travel: travelSec(6) }

describe('travelSec', () => {
  it('takes a little longer for a longer slide, the same either way, and never more than 0.75 s', () => {
    expect(travelSec(1)).toBeCloseTo(0.305)
    expect(travelSec(6)).toBeCloseTo(0.58)
    expect(travelSec(-6)).toBe(travelSec(6))
    expect(travelSec(40)).toBe(0.75)
  })
})

describe('slideAt', () => {
  it('stays on its rows while it lifts, and lifts fully before it moves', () => {
    // Arrange
    const lifted = SLIDE.t0 + LIFT_SEC

    // Act
    const start = slideAt(SLIDE, SLIDE.t0)
    const up = slideAt(SLIDE, lifted)

    // Assert
    expect(start).toEqual({ view: 60, lift: 0, glow: 0, done: false })
    expect(up.view).toBe(60)
    expect(up.lift).toBe(1)
  })

  it('travels without overshooting and lands exactly on the new start', () => {
    // Arrange
    const times = Array.from(
      { length: 21 },
      (_, i) => SLIDE.t0 + LIFT_SEC + (SLIDE.travel * i) / 20,
    )

    // Act
    const views = times.map((t) => slideAt(SLIDE, t).view)

    // Assert
    for (let i = 1; i < views.length; i++)
      expect(views[i]).toBeGreaterThanOrEqual(views[i - 1])
    expect(views[0]).toBeCloseTo(60, 9)
    expect(views.at(-1)).toBeCloseTo(66, 9)
  })

  it('glows once the line lands, at its brightest just after, then fades', () => {
    // Arrange
    const land = SLIDE.t0 + landsAfter(SLIDE)

    // Act
    const before = slideAt(SLIDE, land - 0.01).glow
    const peak = slideAt(SLIDE, land + GLOW_RISE_SEC).glow
    const fading = slideAt(SLIDE, land + GLOW_RISE_SEC + GLOW_SEC / 2).glow

    // Assert
    expect(before).toBe(0)
    expect(peak).toBeCloseTo(1, 9)
    expect(fading).toBeCloseTo(0.5, 9)
  })

  it('settles back onto its rows and is done only once the glow is spent', () => {
    // Arrange
    const land = SLIDE.t0 + landsAfter(SLIDE)
    const spent = land + GLOW_RISE_SEC + GLOW_SEC

    // Act
    const settled = slideAt(SLIDE, land + SETTLE_SEC)
    const glowing = slideAt(SLIDE, spent - 0.01)
    const over = slideAt(SLIDE, spent + 0.001)

    // Assert
    expect(settled.lift).toBeCloseTo(0, 9)
    expect(settled.done).toBe(false)
    expect(glowing.done).toBe(false)
    expect(over).toEqual({ view: 66, lift: 0, glow: 0, done: true })
  })
})

describe('lightAt', () => {
  it('lights a note while it sounds and lets it fade over the afterglow', () => {
    expect(lightAt(1, 2, 0.99)).toBe(0)
    expect(lightAt(1, 2, 1)).toBe(1)
    expect(lightAt(1, 2, 2)).toBe(1)
    expect(lightAt(1, 2, 2 + AFTERGLOW_SEC / 2)).toBeCloseTo(0.5, 9)
    expect(lightAt(1, 2, 2 + AFTERGLOW_SEC + 0.001)).toBe(0)
    expect(lightAt(1, 2, 9)).toBe(0)
  })
})
