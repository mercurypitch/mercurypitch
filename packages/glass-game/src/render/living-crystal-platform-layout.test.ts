// Living-crystal layout tests — every static box placement needs one palette and exact cardinal contact.

import { describe, expect, it } from 'vitest'
import { LIVING_CRYSTAL_PLATFORM_RENDER_ID, LIVING_CRYSTAL_PLATFORM_SUPPORT, } from '../content/living-crystal-profile'
import { LIVING_CRYSTAL_PEARL_ROOTS_STUDY } from '../content/living-crystal-study'
import type { LevelDefinition, PlatformDefinition } from '../contracts'
import { resolveLivingCrystalPlatformPlacements } from './living-crystal-platform-layout'

function secondPlatform(): PlatformDefinition {
  return {
    id: 'living-crystal/repeated',
    minX: 4 - LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2,
    maxX: 4 + LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2,
    minZ: 1 - LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2,
    maxZ: 1 + LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2,
    top: 0.4,
    thickness: LIVING_CRYSTAL_PLATFORM_SUPPORT.height,
    kind: 'deck',
    material: 'stone',
    renderId: LIVING_CRYSTAL_PLATFORM_RENDER_ID,
    renderQuarterTurns: 1,
  }
}

function repeatedLevel(platform = secondPlatform()): LevelDefinition {
  return {
    ...LIVING_CRYSTAL_PEARL_ROOTS_STUDY,
    platforms: [...LIVING_CRYSTAL_PEARL_ROOTS_STUDY.platforms, platform],
    presentation: {
      ...LIVING_CRYSTAL_PEARL_ROOTS_STUDY.presentation!,
      livingCrystalInteriors: [
        ...LIVING_CRYSTAL_PEARL_ROOTS_STUDY.presentation!
          .livingCrystalInteriors!,
        {
          platformId: platform.id,
          variant: 'living-amber',
          seed: 9049,
        },
      ],
    },
  }
}

describe('living-crystal platform placement collection', () => {
  it('resolves repeated cardinal placements without merging identities', () => {
    const placements = resolveLivingCrystalPlatformPlacements(repeatedLevel())
    expect(placements).toHaveLength(2)
    expect(placements[1]).toMatchObject({
      platformId: 'living-crystal/repeated',
      position: { x: 4, y: 0.4, z: 1 },
      rotationY: Math.PI / 2,
      interior: { variant: 'living-amber', seed: 9049 },
    })
  })

  it('rejects resized or independently activated art instead of inventing support', () => {
    const platform = secondPlatform()
    expect(() =>
      resolveLivingCrystalPlatformPlacements(
        repeatedLevel({ ...platform, maxX: platform.maxX + 0.01 }),
      ),
    ).toThrow(/must match the rotated/)
    expect(() =>
      resolveLivingCrystalPlatformPlacements(
        repeatedLevel({
          ...platform,
          activation: { allCompleted: ['unrelated-gate'] },
        }),
      ),
    ).toThrow(/always-active static deck/)
  })

  it('rejects missing, duplicate and orphan palette bindings', () => {
    const base = LIVING_CRYSTAL_PEARL_ROOTS_STUDY
    expect(() =>
      resolveLivingCrystalPlatformPlacements({
        ...base,
        presentation: { ...base.presentation!, livingCrystalInteriors: [] },
      }),
    ).toThrow(/has no interior presentation/)
    const binding = base.presentation!.livingCrystalInteriors![0]!
    expect(() =>
      resolveLivingCrystalPlatformPlacements({
        ...base,
        presentation: {
          ...base.presentation!,
          livingCrystalInteriors: [binding, binding],
        },
      }),
    ).toThrow(/duplicate interior settings/)
    expect(() =>
      resolveLivingCrystalPlatformPlacements({
        ...base,
        presentation: {
          ...base.presentation!,
          livingCrystalInteriors: [
            binding,
            { ...binding, platformId: 'missing-platform' },
          ],
        },
      }),
    ).toThrow(/orphan interior presentations/)
  })
})
