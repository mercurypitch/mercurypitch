// ============================================================
// The bay's frame on the phones the room is checked at
// ============================================================

import { describe, expect, it } from 'vitest'
import { MERC_FEET } from '@/components/room-kit/MercView'
import { BAY, INTRO, RESULT_ASPECT, WAVE } from './bay-geometry'
import { ABOVE_CREST_W, cropTop, frameY, horizonAt, layoutBay, MERC_SINK_W, MERC_SIZE_W, mercBoxAt, mercResultBox, pitchY, UNDER_ROOT_W, waveG, yOf, zoomAt, } from './bay-layout'

/**
 * The room's chip and mic on a phone, as LipRollRoom.module.css draws
 * them: the bar (56 px) and the chip under the safe area; the controls
 * over it. Tighter on a short phone (max-height 700px).
 */
function box(
  width: number,
  height: number,
  safeTop: number,
  safeBottom: number,
) {
  const short = height <= 700
  return {
    width,
    height,
    chipBottom: safeTop + 56 + (short ? 46 : 58),
    controlsTop: height - safeBottom - (short ? 92 : 104),
  }
}

const PHONES = [
  ['390x844', box(390, 844, 47, 34)],
  ['430x932', box(430, 932, 59, 34)],
  ['375x667', box(375, 667, 20, 0)],
  ['360x640', box(360, 640, 24, 0)],
] as const

describe('the frame rule', () => {
  it("is top-anchored where the phone is tall enough: the storyboard's top row at the top, the world at its size", () => {
    const layout = layoutBay(box(390, 844, 47, 34))

    expect(layout.top).toBe(0)
    expect(layout.scale).toBe(1)
    expect(layout.mercSize).toBeCloseTo(MERC_SIZE_W * 390, 9)
  })

  it('draws the world smaller on a short phone, about the playhead, until Merc clears both', () => {
    const layout = layoutBay(box(375, 667, 20, 0))

    // Measured: 0.90 of its size on 375 x 667 (L0 put it at 0.73 with the
    // storyboard's own, taller, controls).
    expect(layout.scale).toBeGreaterThan(0.85)
    expect(layout.scale).toBeLessThan(0.95)
  })

  it("crops screen 4's picture equally at the result", () => {
    const layout = layoutBay(box(390, 844, 47, 34))

    expect(layout.resultTop).toBeCloseTo(cropTop(RESULT_ASPECT, 844 / 390), 9)
  })
})

describe.each(PHONES)('on a %s phone', (_, phone) => {
  const layout = layoutBay(phone)
  const run = zoomAt(1)

  it('keeps Merc under the chip riding sharp over a crest', () => {
    const merc = mercBoxAt(layout, run, 0.35, WAVE.crestY - ABOVE_CREST_W)

    expect(merc.top).toBeGreaterThanOrEqual(phone.chipBottom)
  })

  it('keeps Merc flat under a root clear of the controls, sitting in the water', () => {
    const feet = WAVE.rootY + UNDER_ROOT_W
    const merc = mercBoxAt(layout, run, 0.35, feet)

    expect(merc.top + merc.size).toBeLessThanOrEqual(phone.controlsTop)
    expect(merc.top + merc.size * MERC_FEET).toBeCloseTo(
      yOf(layout, feet) + MERC_SINK_W * layout.unit,
      6,
    )
  })

  it('never lifts Merc into the chip, however sharp the voice', () => {
    const merc = mercBoxAt(layout, run, 0.35, pitchY(90, 48, 12))

    expect(merc.top).toBeGreaterThanOrEqual(phone.chipBottom)
  })

  it('keeps Merc at the result clear of the buttons', () => {
    const merc = mercResultBox(layout)

    expect(merc.top + merc.size * (1 + MERC_FEET) * 0.5).toBeLessThan(
      phone.controlsTop,
    )
  })
})

describe('the zoom', () => {
  it("is screen 1's wave at 0 and the run's at 1", () => {
    expect(zoomAt(0)).toEqual({
      sx: INTRO.sx,
      sy: INTRO.sy,
      crestY: INTRO.crestY,
    })
    expect(zoomAt(1)).toEqual({ sx: 1, sy: 1, crestY: WAVE.crestY })
    expect(frameY(zoomAt(1), WAVE.rootY)).toBeCloseTo(WAVE.rootY, 12)
    // Screen 1's root: wave A's (lip-geometry, 1.204 W).
    expect(frameY(zoomAt(0), WAVE.rootY)).toBeCloseTo(1.204, 2)
  })

  it("moves the bay-back's horizon from screen 1's to the run's", () => {
    expect(horizonAt(0)).toBe(BAY.horizon)
    expect(horizonAt(1)).toBe(BAY.horizonRun)
    expect(horizonAt(2)).toBe(BAY.horizonRun)
  })
})

describe('pitchY', () => {
  it("puts the root on the root line and the wave's top note on the crest, whatever its height", () => {
    expect(pitchY(48, 48, 12)).toBeCloseTo(WAVE.rootY, 9)
    expect(pitchY(60, 48, 12)).toBeCloseTo(WAVE.crestY, 3)
    // A narrow voice: ten semitones still reach the painted crest.
    expect(pitchY(58, 48, 10)).toBeCloseTo(WAVE.crestY, 3)
  })
})

describe('waveG', () => {
  it('is the wave: flat on top, eased to the feet', () => {
    expect(waveG(0, WAVE.f)).toBe(1)
    expect(waveG(WAVE.f, WAVE.f)).toBe(1)
    expect(waveG(1, WAVE.f)).toBe(0)
    expect(waveG(-0.5, WAVE.f)).toBeCloseTo(waveG(0.5, WAVE.f), 12)
    expect(waveG((1 + WAVE.f) / 2, WAVE.f)).toBeCloseTo(0.5, 12)
  })
})
