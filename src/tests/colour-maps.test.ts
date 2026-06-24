// ============================================================
// Tests: colour-maps.ts
// ============================================================

import { describe, expect, it } from 'vitest'
import { COLOUR_MAPS, getColourMap, nextColourMap } from '@/lib/colour-maps'

describe('COLOUR_MAPS', () => {
  it('has 6 entries', () => {
    expect(COLOUR_MAPS).toHaveLength(6)
  })

  it('all maps return valid RGB for 0 and 1', () => {
    for (const map of COLOUR_MAPS) {
      const [r0, g0, b0] = map.fn(0)
      expect(r0).toBeGreaterThanOrEqual(0)
      expect(r0).toBeLessThanOrEqual(255)
      expect(g0).toBeGreaterThanOrEqual(0)
      expect(b0).toBeLessThanOrEqual(255)

      const [r1, g1, b1] = map.fn(1)
      expect(r1).toBeGreaterThanOrEqual(0)
      expect(r1).toBeLessThanOrEqual(255)
      expect(g1).toBeGreaterThanOrEqual(0)
      expect(b1).toBeLessThanOrEqual(255)
    }
  })

  it('all maps return increasing total energy for increasing norm', () => {
    for (const map of COLOUR_MAPS) {
      if (map.id === 'phase') continue // phase is a placeholder fn
      const sum0 = map.fn(0).reduce((a, b) => a + b, 0)
      const sum1 = map.fn(1).reduce((a, b) => a + b, 0)
      expect(sum1).toBeGreaterThanOrEqual(sum0)
    }
  })
})

describe('getColourMap', () => {
  it('returns viridis for unknown id', () => {
    const fn = getColourMap('nonexistent')
    expect(fn(0.5)).toEqual(getColourMap('viridis')(0.5))
  })

  it('returns the correct map for each id', () => {
    expect(getColourMap('thermal')(0.5)).toEqual(COLOUR_MAPS[1]!.fn(0.5))
    expect(getColourMap('ice')(0.5)).toEqual(COLOUR_MAPS[2]!.fn(0.5))
  })
})

describe('nextColourMap', () => {
  it('cycles viridis → thermal', () => {
    expect(nextColourMap('viridis')).toBe('thermal')
  })

  it('cycles phase → viridis (wraps around)', () => {
    expect(nextColourMap('phase')).toBe('viridis')
  })
})
