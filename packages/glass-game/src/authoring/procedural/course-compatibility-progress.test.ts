// Shared course save compatibility — retain genuinely earned progress after a fixed v1 recipe is reopened.

import { expect, it } from 'vitest'
import { createGlassGame } from '../../core/game.ts'
import { generateProceduralCourse } from './course-generator.ts'
import { decodeProceduralCourseCode, encodeProceduralCourseCode, } from './course-options.ts'
import { playGeneratedCourse, replayCourseWitness, } from './course-playthrough.test-helpers.ts'
import fixture from './fixtures/course-v1.compatibility.json'

it('restores a completed fixed v1 course from JSON without leaking its progress to another recipe', () => {
  const savedRecipe = fixture.courses.find(
    (course) => course.label === 'first-arc-v1/balanced',
  )!
  const options = decodeProceduralCourseCode(savedRecipe.code)
  expect(options.seed).toBe('shared-pearl')
  expect(options.difficulty).toBe('balanced')
  const course = generateProceduralCourse(options)
  expect(course.compiledLevel.id).toBe(savedRecipe.courseId)
  const expectedCompletedIds = course.compiledLevel.breakables
    .filter((encounter) => !encounter.optional)
    .map((encounter) => encounter.id)
    .sort()

  // Both passes start unsaved. The witness contains only ordinary movement,
  // encounter requests and pitch samples; no checkpoint or completion writes.
  const played = playGeneratedCourse(course, 60_000, true)
  expect(played.completed, played.failure).toBe(true)
  expect(played.respawns).toBe(0)
  expect(played.ticks).toBeGreaterThan(0)
  expect(played.ticks).toBeLessThanOrEqual(60_000)
  expect([...played.completedEncounters].sort()).toEqual(expectedCompletedIds)
  expect(played.witness).toBeDefined()
  const replay = replayCourseWitness(course, played.witness!)
  expect(replay.snapshot.complete).toBe(true)
  expect(replay.respawns).toBe(0)
  expect(replay.ticks).toBe(played.ticks)
  expect(replay.snapshot.player).toEqual(played.player)
  expect([...replay.progress.completedBreakableIds].sort()).toEqual(
    expectedCompletedIds,
  )
  expect(replay.progress).toMatchObject({
    version: 3,
    levelId: savedRecipe.courseId,
    finished: true,
    melodyAttempt: { attemptId: 'continuous-course', rootMidi: 55, pace: 1.25 },
  })

  const savedJson = JSON.stringify(replay.progress)
  const loadedProgress: unknown = JSON.parse(savedJson)
  const reopened = generateProceduralCourse(
    decodeProceduralCourseCode(savedRecipe.code),
  )
  const level = reopened.compiledLevel
  expect(level.id).toBe(savedRecipe.courseId)
  const checkpoint = level.checkpoints.find(
    (point) => point.id === replay.progress.checkpointId,
  )!
  expect(checkpoint).toBeDefined()
  expect(checkpoint.id).toBe(level.checkpoints.at(-1)!.id)
  expect(checkpoint.id).not.toBe(level.spawn.checkpointId)

  const restored = createGlassGame(level, loadedProgress)
  const snapshot = restored.snapshot()
  expect(snapshot.checkpointId).toBe(replay.progress.checkpointId)
  expect(snapshot.player.position).toEqual(checkpoint.position)
  expect(snapshot.player.facingYaw).toBe(checkpoint.facingYaw)
  expect(snapshot.player.grounded).toBe(true)
  const support = level.platforms.find(
    (platform) => platform.id === snapshot.player.supportPlatformId,
  )!
  expect(support).toBeDefined()
  expect(snapshot.enabledPlatformIds).toContain(support.id)
  expect(support.behavior).toBeUndefined()
  expect(checkpoint.position.y).toBeCloseTo(support.top, 8)
  expect(checkpoint.position.x).toBeGreaterThanOrEqual(support.minX)
  expect(checkpoint.position.x).toBeLessThanOrEqual(support.maxX)
  expect(checkpoint.position.z).toBeGreaterThanOrEqual(support.minZ)
  expect(checkpoint.position.z).toBeLessThanOrEqual(support.maxZ)
  expect([...snapshot.completedBreakableIds].sort()).toEqual(
    expectedCompletedIds,
  )
  expect(
    snapshot.breakables
      .filter((encounter) => encounter.phase === 'complete')
      .map((encounter) => encounter.id)
      .sort(),
  ).toEqual(expectedCompletedIds)
  expect(snapshot.melodyAttempt).toEqual(replay.progress.melodyAttempt)
  expect(snapshot.nextRequiredBreakableId).toBeNull()
  expect(snapshot.complete).toBe(true)
  expect(restored.saveProgress()).toEqual(replay.progress)

  // The same numeric spelling with different seed types is a different recipe,
  // as is a difficulty change with the original seed. All reject the old save.
  const alternatives = [
    { ...options, seed: 7 },
    { ...options, seed: '7' },
    { ...options, difficulty: 'gentle' as const },
  ]
  const identities = new Set([level.id])
  for (const alternative of alternatives) {
    const code = encodeProceduralCourseCode(alternative)
    expect(code).not.toBe(savedRecipe.code)
    const decoded = decodeProceduralCourseCode(code)
    expect(decoded.seed).toBe(alternative.seed)
    const different = generateProceduralCourse(decoded).compiledLevel
    expect(identities.has(different.id)).toBe(false)
    identities.add(different.id)
    const fresh = createGlassGame(different)
    const withForeignSave = createGlassGame(different, JSON.parse(savedJson))
    const isolated = withForeignSave.snapshot()
    expect(isolated.player).toEqual(fresh.snapshot().player)
    expect(isolated.player.grounded).toBe(true)
    expect(isolated.checkpointId).toBe(different.spawn.checkpointId)
    expect(isolated.completedBreakableIds).toEqual([])
    expect(isolated.melodyAttempt).toBeNull()
    expect(isolated.complete).toBe(false)
    expect(withForeignSave.saveProgress()).toEqual(fresh.saveProgress())
  }
}, 20_000)
