// Crystal obstacle study — isolate shaped blockers and one low hurdle from accepted course progress.

import { compileSongRunnerCourseDocument } from './compile-course.ts'
import { CRYSTAL_BULWARK_COLLISION, ROSE_HURDLE_COLLISION, } from './crystal-obstacle-collision.ts'
import { SINGING_CURRENT_CONTINUOUS_CATALOG, SINGING_CURRENT_CONTINUOUS_SOURCE, SINGING_CURRENT_RESPONSIVE_CATALOG, SINGING_CURRENT_RESPONSIVE_SOURCE, } from './first-course.ts'
import type { RunnerBlockerCatalogProfile, SongRunnerCourseCatalog, SongRunnerCourseSource, SongRunnerSourceDocument, } from './source.ts'

function blockerProfile(
  id: string,
  assetId: string,
  halfDepth: number,
  height: number,
  halfWidth = 0.78,
): RunnerBlockerCatalogProfile {
  return {
    kind: 'blocker',
    id,
    longitudinalHalfLengthMeters: halfDepth,
    laneHalfWidthMeters: halfWidth,
    minYOffsetMeters: 0,
    maxYOffsetMeters: height,
    visibleLongitudinalHalfLengthMeters: halfDepth,
    visibleLaneHalfWidthMeters: halfWidth,
    visibleMinYOffsetMeters: 0,
    visibleMaxYOffsetMeters: height,
    telegraphLeadBeats: 3,
    assetProfileIds: [assetId],
    collisionProfile:
      assetId === 'runner-rose-hurdle-v1'
        ? ROSE_HURDLE_COLLISION
        : CRYSTAL_BULWARK_COLLISION,
  }
}

const obstacleProfiles = {
  'runner-crystal-bulwark-v1': blockerProfile(
    'runner-crystal-bulwark-v1',
    'runner-crystal-bulwark-v1',
    0.425,
    1.15,
  ),
  'runner-crystal-bulwark-wide-v1': blockerProfile(
    'runner-crystal-bulwark-wide-v1',
    'runner-crystal-bulwark-v1',
    0.45,
    1.25,
  ),
  'runner-rose-hurdle-v1': {
    ...blockerProfile(
      'runner-rose-hurdle-v1',
      'runner-rose-hurdle-v1',
      0.35,
      0.45,
      0.5,
    ),
    traversal: { kind: 'jump-over', landingRunwayMeters: 2 },
  },
} as const satisfies SongRunnerCourseCatalog['obstacleProfiles']

export const SINGING_CURRENT_CRYSTAL_STUDY_CATALOG = {
  ...SINGING_CURRENT_RESPONSIVE_CATALOG,
  obstacleProfiles: {
    ...SINGING_CURRENT_RESPONSIVE_CATALOG.obstacleProfiles,
    ...obstacleProfiles,
  },
} as const satisfies SongRunnerCourseCatalog

export const SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_CATALOG = {
  ...SINGING_CURRENT_CONTINUOUS_CATALOG,
  obstacleProfiles: {
    ...SINGING_CURRENT_CONTINUOUS_CATALOG.obstacleProfiles,
    ...obstacleProfiles,
  },
} as const satisfies SongRunnerCourseCatalog

function studySource(
  source: SongRunnerCourseSource,
  mode: 'lanes' | 'continuous',
): SongRunnerCourseSource {
  return {
    ...source,
    id: `the-singing-current-trial-crystal-${mode}-v1`,
    revision: 1,
    obstacles: [
      ...source.obstacles.map((obstacle) => ({
        ...obstacle,
        profileId:
          obstacle.id === 'first-lane-gate'
            ? 'runner-crystal-bulwark-v1'
            : obstacle.id === 'second-lane-gate'
              ? 'runner-crystal-bulwark-wide-v1'
              : obstacle.profileId,
      })),
      {
        id: 'rose-jump-hurdle',
        atBeat: 33,
        laneMask: [1] as const,
        profileId: 'runner-rose-hurdle-v1',
      },
    ].sort((left, right) => left.atBeat - right.atBeat),
    rewards: {
      ...source.rewards,
      pickups: source.rewards.pickups.map((pickup) => ({
        ...pickup,
        id: `crystal-${mode}-${pickup.id}`,
      })),
      finishRewardIds: [`study-crystal-${mode}-finish`],
    },
  }
}

export const SINGING_CURRENT_CRYSTAL_STUDY_SOURCE = studySource(
  SINGING_CURRENT_RESPONSIVE_SOURCE,
  'lanes',
)
export const SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_SOURCE = studySource(
  SINGING_CURRENT_CONTINUOUS_SOURCE,
  'continuous',
)

export const SINGING_CURRENT_CRYSTAL_STUDY_SOURCE_DOCUMENT = {
  schema: 'mercurypitch.song-runner-course',
  version: 1,
  courses: [SINGING_CURRENT_CRYSTAL_STUDY_SOURCE],
} as const satisfies SongRunnerSourceDocument
export const SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_SOURCE_DOCUMENT = {
  schema: 'mercurypitch.song-runner-course',
  version: 1,
  courses: [SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_SOURCE],
} as const satisfies SongRunnerSourceDocument

export const SINGING_CURRENT_CRYSTAL_STUDY = compileSongRunnerCourseDocument(
  SINGING_CURRENT_CRYSTAL_STUDY_SOURCE_DOCUMENT,
  SINGING_CURRENT_CRYSTAL_STUDY_CATALOG,
)[0]!
export const SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY =
  compileSongRunnerCourseDocument(
    SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_SOURCE_DOCUMENT,
    SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_CATALOG,
  )[0]!
