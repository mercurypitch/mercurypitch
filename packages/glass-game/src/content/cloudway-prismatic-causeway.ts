// The Prismatic Causeway — an ambitious multi-mechanic cloudway course featuring frost ice, timed crackle glass, moving aurora glide raft, living crystal interior and melody lesson.

import { compileCloudwayCourseDocument } from '../authoring/compile-cloudway-course.ts'
import { CLOUDWAY_STUDIO_PROFILES } from '../authoring/cloudway-studio.ts'
import courseDocument from './data/cloudway-prismatic-causeway.course.json' with { type: 'json' }
import type { LevelDefinition } from '../contracts.ts'

const courses = compileCloudwayCourseDocument(
  courseDocument,
  CLOUDWAY_STUDIO_PROFILES,
)
const course = courses[0]
if (course === undefined || course.id !== 'cloudway-prismatic-causeway') {
  throw new Error('The Prismatic Causeway course is missing.')
}

/** Ungraded preview and solver-verified multi-mechanic showcase level. */
export const CLOUDWAY_PRISMATIC_CAUSEWAY: LevelDefinition = course
