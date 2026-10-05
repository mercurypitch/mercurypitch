// Cloudway studio adapter — bounded external documents use the game's authoritative compiler.

import { CLOUDWAY_FOG_DEFAULTS, CLOUDWAY_FOG_LIMITS, } from '../content/cloudway-visibility.ts'
import { crystalInteriorStudySource } from '../content/crystal-interior-study.ts'
import promenade from '../content/data/cloudway-crystal-promenade.course.json' with { type: 'json' }
import thawing from '../content/data/cloudway-thawing-song.course.json' with { type: 'json' }
import { glassMelody } from '../content/melodies.ts'
import { THAWING_SONG_ALCOVE_PROFILES } from '../content/thawing-song-alcove-profiles.ts'
import { THAWING_SONG_ALCOVE_DOCUMENT } from '../content/thawing-song-alcove-source.ts'
import { THAWING_SONG_PROFILES } from '../content/thawing-song-profiles.ts'
import type { CloudwayCourseProfileCatalog } from './cloudway-course-profiles'
import { compileCloudwayCourseDocument } from './compile-cloudway-course.ts'

export const CLOUDWAY_STUDIO_LIMITS = {
  maxBytes: 1_000_000,
  maxCourses: 8,
  maxPlatforms: 256,
  maxEncounters: 128,
  maxCheckpoints: 128,
  maxGaps: 512,
  maxCameraSections: 256,
} as const

const baseLesson = THAWING_SONG_PROFILES.melodyLessons['sunlit-steps-v1']

/** Profiles own judging policy; editable JSON only selects certified choices. */
export const CLOUDWAY_STUDIO_PROFILES: CloudwayCourseProfileCatalog = {
  ...THAWING_SONG_ALCOVE_PROFILES,
  melodyLessons: {
    ...THAWING_SONG_PROFILES.melodyLessons,
    'first-arc-v1': { ...baseLesson, melody: glassMelody('first-arc') },
    'gallery-arch-v1': { ...baseLesson, melody: glassMelody('gallery-arch') },
    'two-windows-v1': { ...baseLesson, melody: glassMelody('two-windows') },
  },
}

/** A fresh JSON-safe snapshot; private UI never needs to import runtime modules. */
export function cloudwayStudioCatalog() {
  const profiles = CLOUDWAY_STUDIO_PROFILES
  return structuredClone({
    schema: 'mercurypitch.cloudway-studio-catalog',
    version: 1,
    courseSchemaVersions: [2, 3, 4],
    visibility: {
      defaults: CLOUDWAY_FOG_DEFAULTS,
      limits: CLOUDWAY_FOG_LIMITS,
    },
    platforms: Object.values(profiles.platforms),
    barriers: Object.values(profiles.barriers),
    encounterVariants: profiles.encounterVariants,
    melodyLessons: Object.entries(profiles.melodyLessons ?? {}).map(
      ([id, profile]) => ({ id, ...profile }),
    ),
    examples: [
      { id: 'thawing-song', title: 'The Thawing Song', document: thawing },
      {
        id: 'crystal-promenade',
        title: 'Crystal Promenade',
        document: promenade,
      },
      {
        id: 'pearl-alcove',
        title: 'The pearl alcove',
        document: THAWING_SONG_ALCOVE_DOCUMENT,
      },
      {
        id: 'crystal-interiors',
        title: 'The living crystal',
        document: crystalInteriorStudySource(),
      },
    ],
    limits: CLOUDWAY_STUDIO_LIMITS,
  })
}

function boundedArray(
  value: unknown,
  maximum: number,
  path: string,
): unknown[] {
  if (!Array.isArray(value) || value.length > maximum)
    throw new Error(`${path} must be an array with at most ${maximum} items.`)
  return value
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${path} must be an object.`)
  return value as Record<string, unknown>
}

/** Limits precede graph validation, so imported graphs cannot exhaust the compiler. */
export function compileStudioDocument(raw: unknown) {
  const document = object(raw, 'courseDocument')
  const courses = boundedArray(
    document.courses,
    CLOUDWAY_STUDIO_LIMITS.maxCourses,
    'courses',
  )
  if (courses.length === 0) throw new Error('At least one course is required.')
  for (const [index, rawCourse] of courses.entries()) {
    const course = object(rawCourse, `courses[${index}]`)
    for (const [key, max] of [
      ['platforms', CLOUDWAY_STUDIO_LIMITS.maxPlatforms],
      ['encounters', CLOUDWAY_STUDIO_LIMITS.maxEncounters],
      ['checkpoints', CLOUDWAY_STUDIO_LIMITS.maxCheckpoints],
      ['gaps', CLOUDWAY_STUDIO_LIMITS.maxGaps],
    ] as const)
      boundedArray(course[key], max, `courses[${index}].${key}`)
    boundedArray(
      object(course.camera, `courses[${index}].camera`).sections,
      CLOUDWAY_STUDIO_LIMITS.maxCameraSections,
      `courses[${index}].camera.sections`,
    )
  }
  return compileCloudwayCourseDocument(document, CLOUDWAY_STUDIO_PROFILES)
}

/** Does not claim reachability, playability or art approval; those require a playtest. */
export function summarizeStudioDocument(raw: unknown) {
  return compileStudioDocument(raw).map((level) => ({
    id: level.id,
    title: level.title,
    platforms: level.platforms.length,
    encounters: level.breakables.length,
    checkpoints: level.checkpoints.length,
    ...(level.melodyLesson ? { melodyLessonId: level.melodyLesson.id } : {}),
  }))
}
