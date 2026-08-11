// Highway geometry tests keep both visual projections on one musical coordinate system.
// ============================================================

import { describe, expect, it } from 'vitest'
import { TAB_FLOOR_DEPTH, tabConvergedX, tabFlightPoint, tabLandingPoint, tabTransverseWorldSpan, } from './highway-geometry'

describe('highway geometry', () => {
  it('encodes fret position on the grid and only in the label on string lanes', () => {
    const gridOpen = tabLandingPoint('fret-axis', 2, 0, 6, 24, false)
    const gridTwelfth = tabLandingPoint('fret-axis', 2, 12, 6, 24, false)
    const laneOpen = tabLandingPoint('string-highway', 2, 0, 6, 24, false)
    const laneTwelfth = tabLandingPoint('string-highway', 2, 12, 6, 24, false)

    expect(gridOpen[0]).not.toBe(gridTwelfth[0])
    expect(laneOpen).toEqual(laneTwelfth)
  })

  it.each([4, 6, 8])(
    'orders %i string lanes inside the shared world span',
    (stringCount) => {
      const lanes = Array.from({ length: stringCount }, (_, stringIndex) =>
        tabLandingPoint(
          'string-highway',
          stringIndex,
          0,
          stringCount,
          24,
          false,
        ),
      )

      expect(lanes).toHaveLength(stringCount)
      for (let index = 1; index < lanes.length; index += 1) {
        expect(lanes[index]![0]).toBeGreaterThan(lanes[index - 1]![0])
      }
      expect(lanes[0]![0]).toBeGreaterThanOrEqual(-6)
      expect(lanes.at(-1)![0]).toBeLessThanOrEqual(6)
      expect(
        tabTransverseWorldSpan('string-highway', 0, 0, stringCount, 24),
      ).toBeGreaterThan(0)
    },
  )

  it('shares the same time depth and NOW plane in both presentations', () => {
    for (const presentation of ['fret-axis', 'string-highway'] as const) {
      expect(tabFlightPoint(presentation, 3, 9, 0, 6, 24, false)[2]).toBe(0)
      expect(tabFlightPoint(presentation, 3, 9, 0.5, 6, 24, false)[2]).toBe(
        -TAB_FLOOR_DEPTH / 2,
      )
    }
  })

  it('can mirror string order without changing timing or fret identity', () => {
    const rightHanded = tabLandingPoint('string-highway', 0, 7, 6, 24, false)
    const leftHanded = tabLandingPoint('string-highway', 0, 7, 6, 24, true)

    expect(leftHanded[0]).toBe(-rightHanded[0])
    expect(leftHanded.slice(1)).toEqual(rightHanded.slice(1))
  })

  it('mirrors Grid fret positions as one coherent surface', () => {
    const rightHanded = tabLandingPoint('fret-axis', 0, 7, 6, 24, false)
    const leftHanded = tabLandingPoint('fret-axis', 0, 7, 6, 24, true)

    expect(leftHanded[0]).toBe(-rightHanded[0])
    expect(leftHanded.slice(1)).toEqual(rightHanded.slice(1))
  })

  it('can tighten portrait lanes toward the horizon without moving NOW', () => {
    expect(tabConvergedX(5.6, 0, 0.45)).toBe(5.6)
    expect(tabConvergedX(5.6, 1, 0.45)).toBeCloseTo(2.52)
    expect(tabConvergedX(-5.6, 1, 0.45)).toBeCloseTo(-2.52)
  })
})
