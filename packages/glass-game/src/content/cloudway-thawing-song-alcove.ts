// The Thawing Song: Curator Alcove — a separate optional-discovery variant of the five-note route.

import { compileCloudwayCourseDocument } from '../authoring/compile-cloudway-course.ts'
import { dressThawingSongAlcove } from './thawing-song-alcove-presentation.ts'
import { THAWING_SONG_ALCOVE_PROFILES } from './thawing-song-alcove-profiles.ts'
import { THAWING_SONG_ALCOVE_DOCUMENT, THAWING_SONG_ALCOVE_ID, } from './thawing-song-alcove-source.ts'

const course = compileCloudwayCourseDocument(
  THAWING_SONG_ALCOVE_DOCUMENT,
  THAWING_SONG_ALCOVE_PROFILES,
)[0]
if (course === undefined || course.id !== THAWING_SONG_ALCOVE_ID)
  throw new Error('The Thawing Song Curator Alcove course is missing.')

/** Optional preview; it has its own save identity and never changes canonical progress. */
export const CLOUDWAY_THAWING_SONG_ALCOVE = dressThawingSongAlcove(course)
