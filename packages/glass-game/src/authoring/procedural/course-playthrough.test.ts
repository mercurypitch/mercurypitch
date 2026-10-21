// Generated course continuous route regressions from ordinary spawn and real encounter pitch boundaries.

import { expect, it } from 'vitest'
import type { GeneratedCourseResult } from './course-generator.ts'
import { generateProceduralCourse } from './course-generator.ts'
import type { CoursePlaythroughResult } from './course-playthrough.test-helpers.ts'
import { playGeneratedCourse, replayCourseWitness, } from './course-playthrough.test-helpers.ts'

const lessons = [
  'first-arc-v1',
  'sunlit-steps-v1',
  'gallery-arch-v1',
  'two-windows-v1',
] as const
const difficulties = ['gentle', 'balanced', 'virtuoso'] as const

function completionDiagnostic(result: CoursePlaythroughResult): string {
  const { witness, ...outcome } = result
  return JSON.stringify({
    ...outcome,
    witnessLength: witness?.length,
    reachedPlatforms: result.reachedPlatforms.slice(-6),
    recent: result.recent?.slice(-3),
  })
}

function expectAllRequiredEncounters(
  course: GeneratedCourseResult,
  result: CoursePlaythroughResult,
) {
  const required = course.compiledLevel.breakables
    .filter((item) => item.optional !== true)
    .map((item) => item.id)
  expect(required.length).toBeGreaterThan(1)
  expect([...result.completedEncounters].sort()).toEqual(required.sort())
}

it.each(
  lessons.flatMap((melodyLessonId) =>
    difficulties.map((difficulty) => ({ melodyLessonId, difficulty })),
  ),
)(
  'plays shared-pearl $melodyLessonId/$difficulty continuously from spawn through every required encounter and the exit',
  (options) => {
    const course = generateProceduralCourse({
      seed: 'shared-pearl',
      ...options,
    })
    const result = playGeneratedCourse(course)
    expect(result.completed, completionDiagnostic(result)).toBe(true)
    expect(result.respawns).toBe(0)
    expectAllRequiredEncounters(course, result)
  },
  20_000,
)

it('replays the recorded movement, encounter starts and pitch observations from a fresh unsaved spawn', () => {
  const course = generateProceduralCourse({
    seed: 'shared-pearl',
    melodyLessonId: 'first-arc-v1',
  })
  const result = playGeneratedCourse(course, 60_000, true)
  expect(result.completed, completionDiagnostic(result)).toBe(true)
  expect(result.respawns).toBe(0)
  expectAllRequiredEncounters(course, result)
  const replay = replayCourseWitness(course, result.witness!)
  expect(replay.respawns).toBe(0)
  expect(replay.ticks).toBe(result.ticks)
  expect(replay.snapshot.player).toEqual(result.player)
  expect(replay.progress).toMatchObject({
    finished: true,
    completedBreakableIds: result.completedEncounters,
    melodyAttempt: { rootMidi: 55, pace: 1.25 },
  })
}, 20_000)

it.each(
  lessons.flatMap((melodyLessonId) =>
    ['continuous-a', 'continuous-b'].map((seed) => ({ melodyLessonId, seed })),
  ),
)(
  'plays additional seed $seed / $melodyLessonId continuously',
  (options) => {
    const course = generateProceduralCourse(options)
    const result = playGeneratedCourse(course)
    expect(result.completed, completionDiagnostic(result)).toBe(true)
    expect(result.respawns).toBe(0)
    expectAllRequiredEncounters(course, result)
  },
  20_000,
)
