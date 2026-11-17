// Studio note roll bands tests — a point on the roll's canvas falls in the ruler, the keys' column, the grid or the velocity lane, and in none over the corner or the velocity lane's label.
import { describe, expect, it } from 'vitest'
import { noteRollBandAt } from './note-roll-bands'
import { studioRollRegions } from './note-roll-geometry'

// A canvas 840 by 406: keys 72 wide, a ruler 26 high, a velocity lane 80 high.
const REGIONS = studioRollRegions({
  width: 840,
  height: 406,
  layout: { keysWidth: 72, rulerHeight: 26, velocityHeight: 80 },
})

describe('noteRollBandAt', () => {
  it.each([
    [300, 10, 'ruler'],
    [839, 25, 'ruler'],
    [10, 26, 'keys'],
    [71, 325, 'keys'],
    [72, 26, 'grid'],
    [300, 325, 'grid'],
    [300, 326, 'velocity'],
    [10, 10, null],
    [10, 380, null],
  ] as const)('puts %i, %i in %s', (x, y, band) => {
    expect(noteRollBandAt(REGIONS, x, y)).toBe(band)
  })
})
