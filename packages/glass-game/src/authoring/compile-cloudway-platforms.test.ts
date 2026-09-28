// Cloudway platform compiler tests — measured convex contacts survive every cardinal placement.

import { describe, expect, it } from 'vitest'
import type { CloudwayCourseProfileCatalog } from './cloudway-course-profiles'
import { compilePlatform } from './compile-cloudway-platforms'

const HEX = [
  { x: -1, z: 0 },
  { x: -0.5, z: 0.8 },
  { x: 0.5, z: 0.8 },
  { x: 1, z: 0 },
  { x: 0.5, z: -0.8 },
  { x: -0.5, z: -0.8 },
] as const

function catalog(
  overrides: Partial<CloudwayCourseProfileCatalog['platforms'][string]> = {},
): CloudwayCourseProfileCatalog {
  return {
    platforms: {
      hex: {
        id: 'hex',
        width: 2,
        depth: 1.6,
        top: 0,
        thickness: 0.4,
        renderId: 'hex-art',
        supportPolygon: HEX,
        ...overrides,
      },
    },
    barriers: {},
    encounterVariants: [],
  }
}

describe('compilePlatform convex contacts', () => {
  it.each([0, 1, 2, 3] as const)(
    'rotates the certified outline and exact envelope at quarter turn %d',
    (quarterTurns) => {
      const result = compilePlatform(
        {
          id: 'step',
          profileId: 'hex',
          center: { x: 3, y: 0, z: 5 },
          quarterTurns,
        },
        catalog(),
        'platforms[0]',
      ).definition

      expect(result.supportPolygon).toHaveLength(6)
      expect(result.maxX - result.minX).toBeCloseTo(
        quarterTurns % 2 === 0 ? 2 : 1.6,
      )
      expect(result.maxZ - result.minZ).toBeCloseTo(
        quarterTurns % 2 === 0 ? 1.6 : 2,
      )
      expect(
        result.supportPolygon!.reduce((sum, point) => sum + point.x, 0) /
          result.supportPolygon!.length,
      ).toBeCloseTo(3)
      expect(
        result.supportPolygon!.reduce((sum, point) => sum + point.z, 0) /
          result.supportPolygon!.length,
      ).toBeCloseTo(5)
    },
  )

  it('rejects false envelopes and moving polygon contacts', () => {
    expect(() =>
      compilePlatform(
        {
          id: 'step',
          profileId: 'hex',
          center: { x: 0, y: 0, z: 0 },
          quarterTurns: 0,
        },
        catalog({ width: 2.2 }),
        'platforms[0]',
      ),
    ).toThrow(/match the certified profile width and depth/)
    expect(() =>
      compilePlatform(
        {
          id: 'step',
          profileId: 'hex',
          center: { x: 0, y: 0, z: 0 },
          quarterTurns: 0,
          behavior: {
            kind: 'glide',
            translation: { x: 1, y: 0, z: 0 },
            travelSeconds: 1,
            dwellSeconds: 1,
          },
        },
        catalog({ behaviorKind: 'glide' }),
        'platforms[0]',
      ),
    ).toThrow(/not supported by moving or retractable/)
  })
})
