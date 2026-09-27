// Thawing Song alcove profiles — reuse certified floors and two shipped vessel recipes.

import type { CloudwayCourseProfileCatalog } from '../authoring/cloudway-course-profiles.ts'
import { THAWING_SONG_PROFILES } from './thawing-song-profiles.ts'

export const THAWING_SONG_ALCOVE_PROFILES = {
  ...THAWING_SONG_PROFILES,
  encounterVariants: [
    ...THAWING_SONG_PROFILES.encounterVariants,
    'goblet',
    'coupe',
  ],
} as const satisfies CloudwayCourseProfileCatalog
