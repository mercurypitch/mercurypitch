// Slide study — teach the Celadon arch in an isolated course without rewriting accepted progress.
import { compileSongRunnerCourseDocument } from './compile-course'
import { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_CATALOG, SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_SOURCE, SINGING_CURRENT_CRYSTAL_STUDY_CATALOG, SINGING_CURRENT_CRYSTAL_STUDY_SOURCE, } from './crystal-obstacle-study'
import { CELADON_ARCH_COLLISION } from './slide-arch-collision'
import type { SongRunnerCourseCatalog, SongRunnerCourseSource, SongRunnerSourceDocument, } from './source'

function study(
  catalog: SongRunnerCourseCatalog,
  original: SongRunnerCourseSource,
  mode: 'lanes' | 'continuous',
) {
  const movementId = `runner-slide-${mode}-v1`
  const nextCatalog: SongRunnerCourseCatalog = {
    ...catalog,
    movementProfiles: {
      ...catalog.movementProfiles,
      [movementId]: {
        ...catalog.movementProfiles[original.movementProfileId]!,
        id: movementId,
        slide: {
          version: 1,
          bodyHeightMeters: 0.42,
          enterSeconds: 0.18,
          exitSeconds: 0.22,
        },
      },
    },
    obstacleProfiles: {
      ...catalog.obstacleProfiles,
      'runner-celadon-arch-v1': {
        kind: 'blocker',
        id: 'runner-celadon-arch-v1',
        longitudinalHalfLengthMeters: 0.325,
        laneHalfWidthMeters: 1,
        minYOffsetMeters: 0,
        maxYOffsetMeters: 1.25,
        visibleLongitudinalHalfLengthMeters: 0.325,
        visibleLaneHalfWidthMeters: 1,
        visibleMinYOffsetMeters: 0,
        visibleMaxYOffsetMeters: 1.25,
        telegraphLeadBeats: 7,
        assetProfileIds: ['runner-celadon-arch-v1'],
        collisionProfile: CELADON_ARCH_COLLISION,
        traversal: {
          kind: 'slide-under',
          clearanceHeightMeters: 0.63,
          clearanceMinXFraction: -0.3,
          clearanceMaxXFraction: 0.3,
          exitRunwayMeters: 2,
        },
      },
    },
  }
  const source: SongRunnerCourseSource = {
    ...original,
    id: `the-singing-current-trial-slide-${mode}-v1`,
    title: 'The Low Arch',
    revision: 1,
    movementProfileId: movementId,
    tempoMap: [{ atBeat: 0, bpm: 104 }],
    track: { ...original.track, lengthBeats: 56, chunkBeats: 8 },
    voice: {
      ...original.voice,
      targets: [
        original.voice.targets[0]!,
        { ...original.voice.targets[1]!, atBeat: 44 },
      ],
    },
    obstacles: [
      {
        id: 'celadon-slide-arch',
        atBeat: 24,
        laneMask: [1],
        profileId: 'runner-celadon-arch-v1',
      },
      {
        id: 'blue-side-step',
        atBeat: 32,
        laneMask: [1],
        profileId: 'runner-crystal-bulwark-v1',
      },
      {
        id: 'rose-jump-hurdle',
        atBeat: 38,
        laneMask: [1],
        profileId: 'runner-rose-hurdle-v1',
      },
    ],
    checkpoints: [
      original.checkpoints[0]!,
      { id: 'arch-approach', atBeat: 16, respawnLane: 1, countInBeats: 4 },
    ],
    rewards: {
      ...original.rewards,
      pickups: [],
      singingStarTargetIds: [
        original.voice.targets[0]!.id,
        original.voice.targets[1]!.id,
      ],
      finishRewardIds: [`study-slide-${mode}-finish`],
    },
    presentation: {
      ...original.presentation,
      ...(mode === 'continuous'
        ? { cameraProfile: 'steering-angled' as const }
        : {}),
    },
  }
  const document = {
    schema: 'mercurypitch.song-runner-course',
    version: 1,
    courses: [source],
  } as const satisfies SongRunnerSourceDocument
  return {
    catalog: nextCatalog,
    source,
    document,
    course: compileSongRunnerCourseDocument(document, nextCatalog)[0]!,
  }
}

export const SLIDE_LANES_STUDY = study(
  SINGING_CURRENT_CRYSTAL_STUDY_CATALOG,
  SINGING_CURRENT_CRYSTAL_STUDY_SOURCE,
  'lanes',
)
export const SLIDE_CONTINUOUS_STUDY = study(
  SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_CATALOG,
  SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_SOURCE,
  'continuous',
)
