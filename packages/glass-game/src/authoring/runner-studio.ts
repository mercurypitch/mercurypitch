// Runner studio adapter: private editors compile exact source with the accepted responsive catalog.

import { compileSongRunnerCourseDocument, RUNNER_MAXIMUM_CHUNKS, } from '../runner/compile-course.ts'
import { SINGING_CURRENT_CATALOG, SINGING_CURRENT_SOURCE_DOCUMENT, } from '../runner/first-course.ts'
import { RUNNER_MAXIMUM_COUNT_IN_BEATS, RUNNER_MAXIMUM_COUNT_IN_SECONDS,RUNNER_MAXIMUM_COURSE_SECONDS,  } from '../runner/resource-limits.ts'

export const RUNNER_STUDIO_LIMITS = {
  maxBytes: 1_000_000,
  maxCourses: 8,
  maxChunks: RUNNER_MAXIMUM_CHUNKS,
  maxPhrases: 32,
  maxNotes: 16,
  maxTargets: 64,
  maxObstacles: 128,
  maxCheckpoints: 32,
  maxPickups: 128,
  maxCourseSeconds: RUNNER_MAXIMUM_COURSE_SECONDS,
  maxCountInBeats: RUNNER_MAXIMUM_COUNT_IN_BEATS,
  maxCountInSeconds: RUNNER_MAXIMUM_COUNT_IN_SECONDS,
} as const

/** Content fingerprint for catalog selection, not a security credential. */
function catalogFingerprint(): string {
  let hash = 2166136261
  for (const char of JSON.stringify(SINGING_CURRENT_CATALOG))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const RUNNER_STUDIO_CATALOG_ID = `singing-current-responsive-v3-${catalogFingerprint()}`

/** Snapshot includes only supported runtime profiles; future wall families remain plans. */
export function runnerStudioCatalog() {
  return structuredClone({
    schema: 'mercurypitch.runner-studio-catalog',
    version: 1,
    catalogId: RUNNER_STUDIO_CATALOG_ID,
    sourceSchema: 'mercurypitch.song-runner-course',
    sourceVersion: 1,
    profiles: SINGING_CURRENT_CATALOG,
    examples: [
      {
        id: 'singing-current',
        title: 'The Singing Current',
        document: SINGING_CURRENT_SOURCE_DOCUMENT,
      },
    ],
    limits: RUNNER_STUDIO_LIMITS,
  })
}

export function compileRunnerStudioDocument(
  raw: unknown,
  catalogId = RUNNER_STUDIO_CATALOG_ID,
) {
  if (catalogId !== RUNNER_STUDIO_CATALOG_ID)
    throw new Error(
      'The runner catalog changed. Reload the catalog before validating this source.',
    )
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('$ must be a runner source document.')
  const courses = (raw as Record<string, unknown>).courses
  if (
    !Array.isArray(courses) ||
    courses.length > RUNNER_STUDIO_LIMITS.maxCourses
  )
    throw new Error(
      `$.courses must contain at most ${RUNNER_STUDIO_LIMITS.maxCourses} courses.`,
    )
  return compileSongRunnerCourseDocument(raw, SINGING_CURRENT_CATALOG)
}

/** Compiler evidence does not certify art, microphone acoustics or physical-device feel. */
export function summarizeRunnerStudioDocument(
  raw: unknown,
  catalogId = RUNNER_STUDIO_CATALOG_ID,
) {
  return compileRunnerStudioDocument(raw, catalogId).map((course) => ({
    id: course.id,
    revision: course.revision,
    title: course.title,
    durationSeconds: course.lengthCourseSeconds,
    lengthMeters: course.lengthMeters,
    laneCenters: course.laneCenters,
    chunks: course.chunks.length,
    targets: course.targets,
    obstacles: course.obstacles,
    checkpoints: course.checkpoints,
    pickups: course.rewards.pickups,
  }))
}
