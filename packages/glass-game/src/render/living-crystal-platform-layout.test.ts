// Living-crystal layout tests — every static box placement needs one palette and exact cardinal contact.

import { describe, expect, it } from 'vitest'
import { CLOUDWAY_THAWING_SONG } from '../content/cloudway-thawing-song'
import { LIVING_CRYSTAL_PLATFORM_RENDER_ID, LIVING_CRYSTAL_PLATFORM_SUPPORT, } from '../content/living-crystal-profile'
import { LIVING_CRYSTAL_PEARL_ROOTS_STUDY } from '../content/living-crystal-study'
import { LIVING_GLASS_ROSEBUD_ID, LIVING_GLASS_TRIAL, } from '../content/living-glass-trial'
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

  it('binds a pearl current only to an authored response exhibit', () => {
    expect(
      resolveLivingCrystalPlatformPlacements(LIVING_GLASS_TRIAL)[0],
    ).toMatchObject({
      interior: {
        effect: 'pearl-current',
        responseExhibitId: LIVING_GLASS_ROSEBUD_ID,
      },
    })
    const interior =
      LIVING_GLASS_TRIAL.presentation!.livingCrystalInteriors![0]!
    expect(() =>
      resolveLivingCrystalPlatformPlacements({
        ...LIVING_GLASS_TRIAL,
        presentation: {
          ...LIVING_GLASS_TRIAL.presentation,
          livingCrystalInteriors: [
            { ...interior, responseExhibitId: 'missing-exhibit' },
          ],
        },
      }),
    ).toThrow(/references missing exhibit/)
    expect(() =>
      resolveLivingCrystalPlatformPlacements({
        ...LIVING_GLASS_TRIAL,
        presentation: {
          ...LIVING_GLASS_TRIAL.presentation,
          livingCrystalInteriors: [
            { ...interior, responseExhibitId: undefined },
          ],
        },
      }),
    ).toThrow(/has no response exhibit/)
  })

  it('rejects malformed grouped supports before replacing any deck art', () => {
    const level = CLOUDWAY_THAWING_SONG
    const support = level.presentation!.livingCrystalSupports![0]!
    const withSupports = (
      supports: NonNullable<
        NonNullable<LevelDefinition['presentation']>['livingCrystalSupports']
      >,
      platforms = level.platforms,
    ): LevelDefinition => ({
      ...level,
      platforms,
      presentation: { ...level.presentation!, livingCrystalSupports: supports },
    })

    expect(() =>
      resolveLivingCrystalPlatformPlacements(
        withSupports([{ ...support, coveredPlatformIds: [] }]),
      ),
    ).toThrow(/at least one platform/)
    expect(() =>
      resolveLivingCrystalPlatformPlacements(withSupports([support, support])),
    ).toThrow(/duplicate grouped settings/)
    expect(() =>
      resolveLivingCrystalPlatformPlacements(
        withSupports([
          {
            ...support,
            coveredPlatformIds: ['thaw-arrival-2', 'thaw-arrival-2'],
          },
        ]),
      ),
    ).toThrow(/repeats platform/)
    expect(() =>
      resolveLivingCrystalPlatformPlacements(
        withSupports([
          {
            ...support,
            coveredPlatformIds: ['thaw-arrival-2', 'thaw-arrival-4'],
          },
        ]),
      ),
    ).toThrow(/gap-free rectangle/)
    expect(() =>
      resolveLivingCrystalPlatformPlacements(
        withSupports([{ ...support, roomId: 'missing-room' }]),
      ),
    ).toThrow(/missing room/)
    expect(() =>
      resolveLivingCrystalPlatformPlacements(
        withSupports([
          {
            ...support,
            effect: undefined,
            responseExhibitId: 'thaw-note-home',
          },
        ]),
      ),
    ).toThrow(/without a pearl-current effect/)
    expect(() =>
      resolveLivingCrystalPlatformPlacements(
        withSupports([support, { ...support, id: 'other-support' }]),
      ),
    ).toThrow(/shared by multiple/)
    expect(() =>
      resolveLivingCrystalPlatformPlacements(
        withSupports(
          [support],
          level.platforms.map((platform) =>
            platform.id === 'thaw-arrival-3'
              ? {
                  ...platform,
                  activation: { allCompleted: ['thaw-note-home'] },
                }
              : platform,
          ),
        ),
      ),
    ).toThrow(/always-active static deck/)
  })
})
