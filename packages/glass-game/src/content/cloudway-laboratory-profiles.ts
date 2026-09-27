// Cloudway laboratory profiles — certified art contacts compile editable course placements.

import type { CloudwayCourseProfileCatalog } from '../authoring/cloudway-course-profiles'
import { CLOUDWAY_LAB_PLATFORM_RENDER_IDS } from '../render/cloudway-laboratory-catalog.ts'
import { FROSTED_SCROLL_WALL_PROFILE } from './frost-wall-profile.ts'

export const CLOUDWAY_LABORATORY_PROFILE_IDS = {
  pearlRest: 'pearl-rest',
  scroll: 'gilt-scroll',
  roseCrackle: 'rose-crackle',
  amethystCrackle: 'amethyst-crackle',
  frostLily: 'frost-lily',
  auroraGlide: 'aurora-glide',
  frostWall: FROSTED_SCROLL_WALL_PROFILE.id,
} as const

export const CLOUDWAY_LABORATORY_COURSE_PROFILES = {
  platforms: {
    [CLOUDWAY_LABORATORY_PROFILE_IDS.pearlRest]: {
      id: CLOUDWAY_LABORATORY_PROFILE_IDS.pearlRest,
      width: 3.2,
      depth: 0.72,
      top: 0,
      thickness: 0.34,
      renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest,
    },
    [CLOUDWAY_LABORATORY_PROFILE_IDS.scroll]: {
      id: CLOUDWAY_LABORATORY_PROFILE_IDS.scroll,
      width: 2.205964088,
      depth: 2.205964088,
      top: 0,
      thickness: 0.1,
      renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.scroll,
      behaviorKind: 'scroll',
      scrollLocalAxis: 'x',
      scrollEdgeSupports: {
        negative: {
          outwardLength: 0.189,
          minCrossAxis: -1.05,
          maxCrossAxis: 1.05,
          topOffset: 0.05,
          thickness: 0.05,
        },
        positive: {
          outwardLength: 0.1885,
          minCrossAxis: -1.05,
          maxCrossAxis: 1.05,
          topOffset: 0.05,
          thickness: 0.05,
        },
      },
    },
    [CLOUDWAY_LABORATORY_PROFILE_IDS.roseCrackle]: {
      id: CLOUDWAY_LABORATORY_PROFILE_IDS.roseCrackle,
      width: 1.64,
      depth: 1.64,
      top: 0,
      thickness: 0.24,
      renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.roseCrackle,
      behaviorKind: 'crackle',
    },
    [CLOUDWAY_LABORATORY_PROFILE_IDS.amethystCrackle]: {
      id: CLOUDWAY_LABORATORY_PROFILE_IDS.amethystCrackle,
      width: 1.64,
      depth: 1.1,
      top: 0,
      thickness: 0.25,
      renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.amethystCrackle,
      behaviorKind: 'crackle',
    },
    [CLOUDWAY_LABORATORY_PROFILE_IDS.frostLily]: {
      id: CLOUDWAY_LABORATORY_PROFILE_IDS.frostLily,
      width: 1.65,
      depth: 2.2,
      top: 0,
      thickness: 0.3,
      renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.frostLily,
      surface: {
        kind: 'frost',
        controlMultiplier: 0.62,
        brakingMultiplier: 0.38,
        maximumSpeed: 2.45,
      },
    },
    [CLOUDWAY_LABORATORY_PROFILE_IDS.auroraGlide]: {
      id: CLOUDWAY_LABORATORY_PROFILE_IDS.auroraGlide,
      width: 2.55,
      depth: 1.4,
      top: 0,
      thickness: 0.28,
      renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.auroraGlide,
      behaviorKind: 'glide',
    },
  },
  barriers: {
    [FROSTED_SCROLL_WALL_PROFILE.id]: FROSTED_SCROLL_WALL_PROFILE,
  },
  encounterVariants: ['cloudway-lab-voice'],
} as const satisfies CloudwayCourseProfileCatalog
