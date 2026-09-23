import { describe, expect, it } from 'vitest'
import { ALLEY_PLATE, plateSourceFor } from './alley-plate'

describe('which plate file a screen gets', () => {
  it('keeps the 1x where it is not upscaled, and takes the 2x where it would be', () => {
    // 852 / 1536 x 3 = 1.664: just under the 1x file's 1.667.
    expect(plateSourceFor(393, 852, 3)).toBe(ALLEY_PLATE.src)
    // 932 / 1536 x 3 = 1.82.
    expect(plateSourceFor(430, 932, 3)).toBe(ALLEY_PLATE.hi)
    // A DPR 2 phone never needs it; a DPR 2 tablet does.
    expect(plateSourceFor(390, 844, 2)).toBe(ALLEY_PLATE.src)
    expect(plateSourceFor(1024, 1366, 2)).toBe(ALLEY_PLATE.hi)
  })
})
