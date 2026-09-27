// Thawing Song profiles — certified contacts and one versioned, reusable musical lesson.

import type { CloudwayCourseProfileCatalog } from '../authoring/cloudway-course-profiles'
import { CLOUDWAY_LABORATORY_COURSE_PROFILES } from './cloudway-laboratory-profiles.ts'
import { glassMelody } from './melodies.ts'
import { DEFAULT_EXHIBIT_MOUNT_HEIGHT, PORTRAIT_EXHIBIT_ENVELOPE } from './solid-props.ts'

export const THAWING_SONG_PROFILES = {
  ...CLOUDWAY_LABORATORY_COURSE_PROFILES,
  encounterVariants: ['cloudway-lab-voice', 'portrait-awakened-muse'],
  intactExhibits: {
    'portrait-awakened-muse': { ...PORTRAIT_EXHIBIT_ENVELOPE, mountHeight: DEFAULT_EXHIBIT_MOUNT_HEIGHT },
  },
  melodyLessons: {
    'sunlit-steps-v1': {
      melody: glassMelody('sunlit-steps'),
      comfortableOffsetSemitones: 2,
      defaultPace: 1.25,
      allowedPaces: [0.8, 1, 1.25],
      allowedRange: {minimumMidi: 36, maximumMidi: 84},
      // Matches the validated Merc lyric's consonant gaps, with heard-anchor evidence.
      judgePolicy: {dropoutGraceSeconds: 0.4, minimumAnchorEvidenceSeconds: 0.12},
      referenceProfileId: 'merc-encore-v6',
    },
  },
} as const satisfies CloudwayCourseProfileCatalog
