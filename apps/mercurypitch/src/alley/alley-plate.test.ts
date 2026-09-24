import { describe, expect, it } from 'vitest'
import { alleyFit } from './alley-geometry'
import { ALLEY_PLATE, DOORS, plateSourceFor } from './alley-plate'

const drawn = (
  w: number,
  h: number,
  frame?: { top: number; bottom: number; left?: number },
): number => alleyFit(ALLEY_PLATE, DOORS, w, h, frame).scale

describe('which plate file a screen gets', () => {
  it('keeps the 1x where it is not upscaled, and takes the 2x where it would be', () => {
    // 852 / 1536 x 3 = 1.664: just under the 1x file's 1.667.
    expect(plateSourceFor(drawn(393, 852), 3)).toBe(ALLEY_PLATE.src)
    // 932 / 1536 x 3 = 1.82.
    expect(plateSourceFor(drawn(430, 932), 3)).toBe(ALLEY_PLATE.hi)
    // A DPR 2 phone never needs it; a DPR 2 tablet does.
    expect(plateSourceFor(drawn(390, 844), 2)).toBe(ALLEY_PLATE.src)
    expect(plateSourceFor(drawn(1024, 1366), 2)).toBe(ALLEY_PLATE.hi)
  })

  it('reads the scale the plate is drawn at on its side, not the cover scale', () => {
    // 852 x 393 at DPR 3 beside its headline block: the band draws the plate
    // at about 0.36 CSS px per unit, 1.09 device px. The cover scale (0.83,
    // 2.5 device px) asked for the 2x.
    const scale = drawn(852, 393, { top: 8, bottom: 321, left: 300 })
    expect(scale * 3).toBeLessThan(1.2)
    expect(plateSourceFor(scale, 3)).toBe(ALLEY_PLATE.src)
  })
})
