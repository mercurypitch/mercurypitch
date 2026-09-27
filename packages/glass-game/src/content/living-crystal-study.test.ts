// Living-crystal study contract — the optional route keeps one exact walkable donor and open neutral staging.

import { describe, expect, it } from 'vitest'
import { LIVING_CRYSTAL_PLATFORM_RENDER_ID, LIVING_CRYSTAL_PLATFORM_SUPPORT, LIVING_CRYSTAL_STAGING_RENDER_ID, } from './living-crystal-profile'
import { LIVING_CRYSTAL_AMBER_STUDY, LIVING_CRYSTAL_PEARL_ROOTS_STUDY, LIVING_CRYSTAL_PLATFORM_ID, } from './living-crystal-study'

describe('living-crystal v2 art study', () => {
  it.each([
    [LIVING_CRYSTAL_PEARL_ROOTS_STUDY, 'pearl-roots'],
    [LIVING_CRYSTAL_AMBER_STUDY, 'living-amber'],
  ] as const)(
    'keeps %s on the same exact walkable support',
    (level, variant) => {
      const platform = level.platforms.find(
        (candidate) => candidate.id === LIVING_CRYSTAL_PLATFORM_ID,
      )!
      expect(platform.renderId).toBe(LIVING_CRYSTAL_PLATFORM_RENDER_ID)
      expect(platform.maxX - platform.minX).toBe(
        LIVING_CRYSTAL_PLATFORM_SUPPORT.width,
      )
      expect(platform.maxZ - platform.minZ).toBe(
        LIVING_CRYSTAL_PLATFORM_SUPPORT.depth,
      )
      expect(platform.thickness).toBe(LIVING_CRYSTAL_PLATFORM_SUPPORT.height)
      expect(level.presentation?.livingCrystalInteriors).toEqual([
        expect.objectContaining({
          platformId: LIVING_CRYSTAL_PLATFORM_ID,
          variant,
        }),
      ])
      expect(level.breakables).toEqual([])
      expect(level.intentionalGaps).toEqual([])
    },
  )

  it('reserves a broad neutral staging deck without pretending future art is walkable', () => {
    const staging = LIVING_CRYSTAL_PEARL_ROOTS_STUDY.platforms.filter(
      (platform) => platform.renderId === LIVING_CRYSTAL_STAGING_RENDER_ID,
    )
    expect(staging).toHaveLength(2)
    expect(Math.max(...staging.map((platform) => platform.maxX))).toBe(4.8)
    expect(Math.min(...staging.map((platform) => platform.minX))).toBe(-4.8)
    expect(
      LIVING_CRYSTAL_PEARL_ROOTS_STUDY.platforms.filter(
        (platform) => platform.renderId === LIVING_CRYSTAL_PLATFORM_RENDER_ID,
      ),
    ).toHaveLength(1)
  })
})
