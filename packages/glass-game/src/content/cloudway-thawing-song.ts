// The Thawing Song — a saved five-note garden journey and freshly sung portrait finale.

import { compileCloudwayCourseDocument } from '../authoring/compile-cloudway-course.ts'
import courseDocument from './data/cloudway-thawing-song.course.json' with { type: 'json' }
import { dressThawingSong } from './thawing-song-presentation.ts'
import { THAWING_SONG_PROFILES } from './thawing-song-profiles.ts'

const course = compileCloudwayCourseDocument(courseDocument, THAWING_SONG_PROFILES)[0]
if (course === undefined || course.id !== 'cloudway-thawing-song-audition')
  throw new Error('The Thawing Song course is missing.')

/** Ungraded preview; completion does not alter campaign stars or unlocks. */
export const CLOUDWAY_THAWING_SONG = dressThawingSong(course)
