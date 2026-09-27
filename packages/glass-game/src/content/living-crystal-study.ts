// Living-crystal art study — an isolated thick-platform audition with open staging for adjacent future reviews.

import type { LevelDefinition, PlatformDefinition } from '../contracts'
import type { LivingCrystalVariant } from './living-crystal-profile'
import { LIVING_CRYSTAL_PLATFORM_RENDER_ID, LIVING_CRYSTAL_PLATFORM_SUPPORT, LIVING_CRYSTAL_STAGING_RENDER_ID, } from './living-crystal-profile'

export const LIVING_CRYSTAL_PLATFORM_ID = 'living-crystal/main'
export const LIVING_CRYSTAL_START_ID = 'living-crystal/start-gallery'
export const LIVING_CRYSTAL_STAGING_ID = 'living-crystal/open-staging'

const TOP = 0

export const LIVING_CRYSTAL_STUDY_PLATFORMS: readonly PlatformDefinition[] = [
  {
    id: LIVING_CRYSTAL_START_ID,
    minX: -3,
    maxX: 3,
    minZ: -3.15,
    maxZ: -LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2,
    top: TOP,
    thickness: 0.28,
    kind: 'deck',
    material: 'stone',
    renderId: LIVING_CRYSTAL_STAGING_RENDER_ID,
  },
  {
    id: LIVING_CRYSTAL_PLATFORM_ID,
    minX: -LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2,
    maxX: LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2,
    minZ: -LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2,
    maxZ: LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2,
    top: TOP,
    thickness: LIVING_CRYSTAL_PLATFORM_SUPPORT.height,
    kind: 'deck',
    material: 'stone',
    renderId: LIVING_CRYSTAL_PLATFORM_RENDER_ID,
    renderQuarterTurns: 0,
  },
  {
    id: LIVING_CRYSTAL_STAGING_ID,
    minX: -4.8,
    maxX: 4.8,
    minZ: LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2,
    maxZ: 5.4,
    top: TOP,
    thickness: 0.28,
    kind: 'deck',
    material: 'stone',
    renderId: LIVING_CRYSTAL_STAGING_RENDER_ID,
  },
]

export function livingCrystalStudy(
  variant: LivingCrystalVariant = 'pearl-roots',
): LevelDefinition {
  const amber = variant === 'living-amber'
  const id = `living-crystal-${variant}-art-study-v2`
  return {
    id,
    title: amber ? 'The Living Amber' : 'The Living Pearl',
    authored: {
      levelId: id,
      layoutId: 'living-crystal-platform-art-study-v2',
      contentRevision: 1,
    },
    guidance: {
      subtitle: amber
        ? 'An amber-root crystal study'
        : 'A pearl-root crystal study',
      openingNotice:
        'Cross the thick crystal and look through its top and sides.',
      completionTitle: amber
        ? 'The amber light is still travelling.'
        : 'The pearl roots are still growing.',
      completionNext: 'This route is an isolated art and footing study.',
    },
    movement: {
      walkSpeed: 1.55,
      runSpeed: 2.7,
      runDelaySeconds: 0.6,
      runRampSeconds: 0.8,
    },
    camera: {
      kind: 'route-sections',
      initialSectionId: 'living-crystal',
      sections: [
        {
          id: 'living-crystal',
          platformIds: [
            LIVING_CRYSTAL_START_ID,
            LIVING_CRYSTAL_PLATFORM_ID,
            LIVING_CRYSTAL_STAGING_ID,
          ],
          yaw: Math.PI,
          targetOffset: { x: 0, y: 0.28, z: 0.35 },
        },
      ],
    },
    presentation: {
      theme: 'cloudway',
      worldBounds: {
        minX: -8,
        maxX: 8,
        minY: -2.5,
        maxY: 6,
        minZ: -5,
        maxZ: 8,
      },
      lightBounds: {
        minX: -6,
        maxX: 6,
        minY: -1,
        maxY: 5,
        minZ: -4,
        maxZ: 7,
      },
      rooms: [],
      audioRegions: [],
      visuals: [],
      livingCrystalInteriors: [
        {
          platformId: LIVING_CRYSTAL_PLATFORM_ID,
          variant,
          seed: amber ? 9049 : 271_828,
        },
      ],
      assetRecipeIds: [],
    },
    spawn: {
      position: { x: 0, y: TOP, z: -2.35 },
      facingYaw: 0,
      checkpointId: 'living-crystal-start',
    },
    platforms: LIVING_CRYSTAL_STUDY_PLATFORMS,
    intentionalGaps: [],
    checkpoints: [
      {
        id: 'living-crystal-start',
        position: { x: 0, y: TOP, z: -2.35 },
        radius: 0.55,
        facingYaw: 0,
      },
    ],
    breakables: [],
    exit: {
      minX: -0.65,
      maxX: 0.65,
      minZ: 4.72,
      maxZ: 5.16,
      top: TOP,
      requiresCompleted: [],
    },
    fallBelow: -2,
  }
}

export const LIVING_CRYSTAL_PEARL_ROOTS_STUDY = livingCrystalStudy()
export const LIVING_CRYSTAL_AMBER_STUDY = livingCrystalStudy('living-amber')
