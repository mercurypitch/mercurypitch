// Thawing Song alcove source — extend the canonical lesson with one optional static side room.

import type { CloudwayCourseDocumentSource, CloudwayCourseEncounterSource, CloudwayCoursePlatformSource, } from '../authoring/cloudway-course-source.ts'
import canonicalDocument from './data/cloudway-thawing-song.course.json' with { type: 'json' }

export const THAWING_SONG_ALCOVE_ID = 'cloudway-thawing-song-alcove'
export const THAWING_SONG_ALCOVE_LESSON_ID = 'thawing-song-alcove-sunlit'
export const THAWING_SONG_ALCOVE_OPTIONAL_IDS = [
  'thaw-alcove-goblet',
  'thaw-alcove-coupe',
] as const

export const THAWING_SONG_ALCOVE_BEACON_POSE = {
  supportingPlatformId: 'thaw-alcove-beacon-rest',
  position: { x: 3.51, y: 0, z: 9.55 },
  facingYaw: -Math.PI / 2,
} as const

const canonical = (canonicalDocument as unknown as CloudwayCourseDocumentSource)
  .courses[0]
if (canonical === undefined)
  throw new Error('The canonical Thawing Song source is missing.')

const platforms = [
  {
    id: 'thaw-alcove-approach',
    profileId: 'pearl-rest',
    center: { x: 1.55, y: 0, z: 6.03 },
    quarterTurns: 1,
  },
  {
    id: 'thaw-alcove-court-1',
    profileId: 'pearl-rest',
    center: { x: 1.55, y: 0, z: 7.99 },
    quarterTurns: 0,
  },
  {
    id: 'thaw-alcove-court-2',
    profileId: 'pearl-rest',
    center: { x: 1.55, y: 0, z: 8.71 },
    quarterTurns: 0,
  },
  {
    id: 'thaw-alcove-court-3',
    profileId: 'pearl-rest',
    center: { x: 1.55, y: 0, z: 9.43 },
    quarterTurns: 0,
  },
  {
    id: THAWING_SONG_ALCOVE_BEACON_POSE.supportingPlatformId,
    profileId: 'pearl-rest',
    center: { x: 3.51, y: 0, z: 8.71 },
    quarterTurns: 1,
  },
] as const satisfies readonly CloudwayCoursePlatformSource[]

const encounters = [
  {
    id: THAWING_SONG_ALCOVE_OPTIONAL_IDS[0],
    label: 'Sunlit side goblet',
    variant: 'goblet',
    position: { x: 0.55, y: 0, z: 9.38 },
    anchor: { x: 0.55, y: 0, z: 8.71 },
    optional: true,
    challenge: { profileId: 'comfortable-hold' },
    requiresCompleted: ['thaw-note-crown'],
  },
  {
    id: THAWING_SONG_ALCOVE_OPTIONAL_IDS[1],
    label: 'Moonlit side coupe',
    variant: 'coupe',
    position: { x: 2.55, y: 0, z: 9.38 },
    anchor: { x: 2.55, y: 0, z: 8.71 },
    optional: true,
    challenge: { profileId: 'comfortable-hold' },
    requiresCompleted: ['thaw-note-crown'],
  },
] as const satisfies readonly CloudwayCourseEncounterSource[]

const canonicalEncounters = canonical.encounters.map((encounter) => {
  if (
    encounter.challenge?.profileId !== 'melody-anchor' &&
    encounter.challenge?.profileId !== 'melody-contour'
  )
    return encounter
  return {
    ...encounter,
    challenge: {
      ...encounter.challenge,
      lessonId: THAWING_SONG_ALCOVE_LESSON_ID,
    },
  }
})

/** A distinct level identity keeps alcove discoveries out of canonical saves. */
export const THAWING_SONG_ALCOVE_DOCUMENT: CloudwayCourseDocumentSource = {
  ...canonicalDocument,
  schema: 'mercurypitch.cloudway-course',
  schemaVersion: 3,
  courses: [
    {
      ...canonical,
      id: THAWING_SONG_ALCOVE_ID,
      title: 'The Thawing Song: Curator Alcove',
      authored: {
        levelId: THAWING_SONG_ALCOVE_ID,
        layoutId: 'thawing-song-curator-alcove-v1',
        contentRevision: 1,
      },
      guidance: {
        ...canonical.guidance,
        subtitle: 'Five little sparks, two quiet discoveries',
        openingNotice:
          'Learn the five notes. A marked side path leaves the east court, if you want to explore it.',
        completionNext:
          'The melody is yours. The east alcove remains open for another visit.',
      },
      platforms: [...canonical.platforms, ...platforms],
      checkpoints: [
        ...canonical.checkpoints,
        {
          id: 'thaw-alcove-save',
          position: { x: 1.55, y: 0, z: 7.99 },
          radius: 0.4,
          facingYaw: 0,
          requiresCompleted: ['thaw-note-crown'],
        },
      ],
      encounters: [...canonicalEncounters, ...encounters],
      rewards: {
        revision: 1,
        discoveries: [
          {
            encounterId: THAWING_SONG_ALCOVE_OPTIONAL_IDS[0],
            coinIds: ['thaw-alcove-sun-coin'],
          },
          {
            encounterId: THAWING_SONG_ALCOVE_OPTIONAL_IDS[1],
            coinIds: ['thaw-alcove-moon-coin'],
          },
        ],
      },
      melodyLesson: {
        ...canonical.melodyLesson!,
        id: THAWING_SONG_ALCOVE_LESSON_ID,
      },
      camera: {
        ...canonical.camera,
        sections: [
          ...canonical.camera.sections,
          {
            id: 'thaw-alcove',
            platformIds: platforms.map((platform) => platform.id),
            lookFromPlatformId: 'thaw-alcove-approach',
            lookToPlatformId: 'thaw-alcove-court-3',
          },
        ],
      },
      presentation: {
        ...canonical.presentation,
        worldBounds: { ...canonical.presentation.worldBounds, maxZ: 12 },
        lightBounds: { ...canonical.presentation.lightBounds, maxZ: 11 },
      },
    },
  ],
}
