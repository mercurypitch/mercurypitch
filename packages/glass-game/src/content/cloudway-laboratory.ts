// Crystal Promenade courses — strict JSON placements compiled against certified contact profiles.

import { compileCloudwayCourseDocument } from '../authoring/compile-cloudway-course.ts'
import type { LevelDefinition, PlatformDefinition } from '../contracts'
import { CLOUDWAY_LABORATORY_COURSE_PROFILES } from './cloudway-laboratory-profiles.ts'
import courseDocument from './data/cloudway-crystal-promenade.course.json' with { type: 'json' }

const courses = compileCloudwayCourseDocument(
  courseDocument,
  CLOUDWAY_LABORATORY_COURSE_PROFILES,
)

function requiredCourse(id: string): LevelDefinition {
  const course = courses.find((candidate) => candidate.id === id)
  if (course === undefined)
    throw new Error(`Cloudway course document is missing "${id}".`)
  return course
}

/** Saved-progress Promenade; revision 4 retains its accepted revision-3 prefix. */
export const CLOUDWAY_CRYSTAL_PROMENADE_STUDY = requiredCourse(
  'cloudway-crystal-promenade-first-slice',
)

/** Development-only cardinal route for exercising every Promenade mechanic. */
export const CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW = requiredCourse(
  'cloudway-crystal-promenade-mechanics-preview',
)

function requiredPlatform(
  level: LevelDefinition,
  id: string,
): PlatformDefinition {
  const platform = level.platforms.find((candidate) => candidate.id === id)
  if (platform === undefined)
    throw new Error(
      `Cloudway course "${level.id}" is missing platform "${id}".`,
    )
  return platform
}

function centre(platform: PlatformDefinition): { x: number; z: number } {
  return {
    x: (platform.minX + platform.maxX) / 2,
    z: (platform.minZ + platform.maxZ) / 2,
  }
}

const promenade = CLOUDWAY_CRYSTAL_PROMENADE_STUDY
const rose = requiredPlatform(promenade, 'rose-step')
const amethyst = requiredPlatform(promenade, 'amethyst-step')
const scroll = requiredPlatform(promenade, 'scroll-deck')
if (scroll.behavior?.kind !== 'scroll')
  throw new Error('The Promenade scroll-deck must compile scroll behavior.')

/** Derived proof values retained for renderer and traversal contract tests. */
export const CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS = {
  crackle: {
    rose: {
      width: rose.maxX - rose.minX,
      depth: rose.maxZ - rose.minZ,
      height: rose.thickness,
    },
    amethyst: {
      width: amethyst.maxX - amethyst.minX,
      depth: amethyst.maxZ - amethyst.minZ,
      height: amethyst.thickness,
    },
  },
  gaps: {
    arrivalApproach: 0.55,
    scrollEntry: 0.7,
    scrollExit: 0.7,
    roseEntry: 0.5,
    crystalDuet: 0.5,
    duetExit: 0.5,
    frostEntry: 0.55,
    frostBend: 0.55,
    frostExit: 0.55,
    auroraEntry: 0.55,
    auroraExit: 0.55,
  },
  platformCentres: {
    arrivalEntry: centre(requiredPlatform(promenade, 'arrival-entry')),
    arrival: centre(requiredPlatform(promenade, 'arrival')),
    scrollApproachEntry: centre(
      requiredPlatform(promenade, 'scroll-approach-entry'),
    ),
    scrollApproach: centre(requiredPlatform(promenade, 'scroll-approach')),
    scroll: centre(scroll),
    scrollCatch: centre(requiredPlatform(promenade, 'scroll-catch')),
    scrollCourt: centre(requiredPlatform(promenade, 'scroll-court')),
    rose: centre(rose),
    amethyst: centre(amethyst),
    finalCatch: centre(requiredPlatform(promenade, 'final-catch')),
    finalTerrace: centre(requiredPlatform(promenade, 'final-terrace')),
    frostLilyOne: centre(requiredPlatform(promenade, 'frost-lily-one')),
    frostLilyTwo: centre(requiredPlatform(promenade, 'frost-lily-two')),
    wallApproach: centre(requiredPlatform(promenade, 'wall-approach')),
    auroraRaft: centre(requiredPlatform(promenade, 'aurora-raft')),
    raftCatch: centre(requiredPlatform(promenade, 'raft-catch')),
    finaleCourt: centre(requiredPlatform(promenade, 'finale-court')),
  },
  scroll: {
    extensionLength:
      scroll.behavior.axis === 'x'
        ? scroll.maxX - scroll.minX
        : scroll.maxZ - scroll.minZ,
    localWidth: 0.757494056,
    localDepth: 2.205964088,
    edgeSupports: scroll.behavior.edgeSupports!,
  },
} as const
