// Hurdle game integration — complete authored routes at real frame rates, hitches and restart epochs.

import { describe, expect, it } from 'vitest'
import { compileSongRunnerCourseDocument } from './compile-course'
import type { CompiledRunnerBlocker, CompiledRunnerCourse, RunnerInput, SongRunnerGame, } from './contracts'
import { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY, SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_CATALOG, SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_SOURCE_DOCUMENT, SINGING_CURRENT_CRYSTAL_STUDY, SINGING_CURRENT_CRYSTAL_STUDY_CATALOG, SINGING_CURRENT_CRYSTAL_STUDY_SOURCE_DOCUMENT, } from './crystal-obstacle-study'
import { createSongRunnerGame } from './game'

const variants = [
  [
    'lanes',
    SINGING_CURRENT_CRYSTAL_STUDY,
    SINGING_CURRENT_CRYSTAL_STUDY_SOURCE_DOCUMENT,
    SINGING_CURRENT_CRYSTAL_STUDY_CATALOG,
  ],
  [
    'continuous',
    SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY,
    SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_SOURCE_DOCUMENT,
    SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_CATALOG,
  ],
] as const
type ScheduledInput = { atCourseSeconds: number } & (
  | { action: 'lane-left' | 'lane-right' | 'jump' }
  | { action: 'steer'; axis: number }
)

function hurdle(course: CompiledRunnerCourse): CompiledRunnerBlocker {
  return course.obstacles.find(
    (o): o is CompiledRunnerBlocker =>
      o.kind === 'blocker' && o.traversal?.kind === 'jump-over',
  )!
}

function queueRoute(
  game: SongRunnerGame,
  course: CompiledRunnerCourse,
  epoch: string,
  from = 0,
  hurdleLaunch?: number,
) {
  const schedule: ScheduledInput[] = []
  const firstBlocker = course.obstacles.find((o) => o.id === 'first-lane-gate')!
  const firstGap = course.obstacles.find((o) => o.id === 'first-jump')!
  const needsReturn =
    firstBlocker.certifiedActions[0]!.launchCloseCourseSeconds >= from
  for (const obstacle of course.obstacles) {
    const action = obstacle.certifiedActions[0]!
    if (action.launchCloseCourseSeconds < from) continue
    const midpoint =
      (action.launchOpenCourseSeconds + action.launchCloseCourseSeconds) / 2
    if (action.kind === 'jump')
      schedule.push({
        atCourseSeconds:
          obstacle.id === 'rose-jump-hurdle'
            ? (hurdleLaunch ?? midpoint)
            : midpoint,
        action: 'jump',
      })
    else if (course.movement.kind !== 'continuous')
      schedule.push({ atCourseSeconds: midpoint, action: 'lane-right' })
    else {
      schedule.push({ atCourseSeconds: midpoint, action: 'steer', axis: 1 })
      schedule.push({ atCourseSeconds: midpoint + 1, action: 'steer', axis: 0 })
    }
  }
  if (needsReturn) {
    const returnAt =
      firstGap.certifiedActions[0]!.landingCloseCourseSeconds + 0.02
    if (course.movement.kind !== 'continuous')
      schedule.push({ atCourseSeconds: returnAt, action: 'lane-left' })
    else {
      const movement = course.movement
      const distance = 2.72
      const speed = movement.maxLateralSpeedMetersPerSecond
      const accelerate =
        speed / movement.lateralAccelerationMetersPerSecondSquared
      const brake = speed / movement.lateralBrakingMetersPerSecondSquared
      const coast = (distance - (speed * (accelerate + brake)) / 2) / speed
      schedule.push({ atCourseSeconds: returnAt, action: 'steer', axis: -1 })
      schedule.push({
        atCourseSeconds: returnAt + accelerate + coast,
        action: 'steer',
        axis: 0,
      })
    }
  }
  schedule.sort((a, b) => a.atCourseSeconds - b.atCourseSeconds)
  for (const [index, input] of schedule.entries())
    expect(
      game.input({ ...input, epoch, sequence: index + 1 } as RunnerInput),
    ).toBe(true)
}

function advance(
  game: SongRunnerGame,
  course: CompiledRunnerCourse,
  epoch: string,
  hz: number,
  end: number,
  hitch = false,
) {
  const obstacle = hurdle(course)
  let observedClear = false
  let time = game.snapshot().courseSeconds
  let hitched = false
  while (time < end - 1e-9 && game.snapshot().status === 'running') {
    const dt =
      hitch &&
      !hitched &&
      time >= obstacle.certifiedActions[0]!.launchOpenCourseSeconds - 0.075
        ? 0.2
        : 1 / hz
    if (dt === 0.2) hitched = true
    time = Math.min(end, time + dt)
    game.advanceTo(epoch, time)
    const snapshot = game.snapshot()
    if (
      snapshot.courseDistanceMeters >= obstacle.minCourseDistanceMeters &&
      snapshot.courseDistanceMeters <= obstacle.maxCourseDistanceMeters
    ) {
      expect(Math.abs(snapshot.player.lateralX)).toBeLessThan(0.5)
      expect(snapshot.player.feetY).toBeGreaterThan(obstacle.maxY)
      observedClear = true
    }
  }
  return { observedClear, hitched }
}

describe('hurdle study fixed-clock routes', () => {
  it.each(variants)(
    'finishes the complete %s study at 20/30/60/120 Hz and a 200ms hurdle hitch',
    (_mode, course) => {
      let reference: ReturnType<SongRunnerGame['snapshot']> | undefined
      for (const hz of [20, 30, 60, 120]) {
        const game = createSongRunnerGame(course, { comfortableMidi: 60 })
        expect(game.beginEpoch('route')).toMatchObject({ ok: true })
        queueRoute(game, course, 'route')
        expect(
          advance(game, course, 'route', hz, course.lengthCourseSeconds + 0.01)
            .observedClear,
        ).toBe(true)
        const snapshot = game.snapshot()
        expect(snapshot.status).toBe('finished')
        expect(
          game
            .drainEvents()
            .some((event) => event.type === 'recovery-required'),
        ).toBe(false)
        reference ??= snapshot
        expect(snapshot.player).toEqual(reference.player)
      }
      const hitched = createSongRunnerGame(course, { comfortableMidi: 60 })
      hitched.beginEpoch('hitch')
      queueRoute(hitched, course, 'hitch')
      expect(
        advance(
          hitched,
          course,
          'hitch',
          60,
          course.lengthCourseSeconds + 0.01,
          true,
        ),
      ).toEqual({ observedClear: true, hitched: true })
      expect(hitched.snapshot().status).toBe('finished')
      expect(hitched.snapshot().player).toEqual(reference!.player)
    },
  )

  it.each(variants)(
    'survives early and late certified launches through the full %s route at 20 Hz',
    (_mode, course) => {
      const action = hurdle(course).certifiedActions[0]!
      for (const launch of [
        action.launchOpenCourseSeconds,
        action.launchCloseCourseSeconds,
      ]) {
        const game = createSongRunnerGame(course, { comfortableMidi: 60 })
        game.beginEpoch('limit')
        queueRoute(game, course, 'limit', 0, launch)
        expect(
          advance(game, course, 'limit', 20, course.lengthCourseSeconds + 0.01)
            .observedClear,
        ).toBe(true)
        expect(game.snapshot().status).toBe('finished')
      }
    },
  )

  it.each(variants)(
    'replays the hurdle from a reached checkpoint with a new %s clock epoch',
    (_mode, _original, document, catalog) => {
      const source = structuredClone(document)
      const courseSource = source.courses[0]!
      const withCheckpoint = {
        ...source,
        courses: [
          {
            ...courseSource,
            checkpoints: [
              courseSource.checkpoints[0]!,
              {
                id: 'hurdle-clock',
                atBeat: 24,
                respawnLane: 1 as const,
                countInBeats: 4,
              },
              ...courseSource.checkpoints.slice(1),
            ],
          },
        ],
      }
      const course = compileSongRunnerCourseDocument(
        withCheckpoint,
        catalog,
      )[0]!
      const checkpoint = course.checkpoints.find(
        (c) => c.id === 'hurdle-clock',
      )!
      const game = createSongRunnerGame(course, { comfortableMidi: 60 })
      game.beginEpoch('before')
      queueRoute(game, course, 'before')
      advance(game, course, 'before', 30, checkpoint.courseSeconds + 0.1)
      game.pause()
      expect(game.beginEpoch('after', checkpoint.id)).toMatchObject({
        ok: true,
        startCourseSeconds: checkpoint.courseSeconds,
      })
      queueRoute(game, course, 'after', checkpoint.courseSeconds)
      expect(
        advance(game, course, 'after', 20, course.lengthCourseSeconds + 0.01)
          .observedClear,
      ).toBe(true)
      expect(game.snapshot().status).toBe('finished')
    },
  )

  it.each(variants)(
    'recovers from an over-budget %s hitch before the hurdle and clears the held input',
    (_mode, course) => {
      const game = createSongRunnerGame(course, { comfortableMidi: 60 })
      game.beginEpoch('too-long')
      queueRoute(game, course, 'too-long')
      const until =
        hurdle(course).certifiedActions[0]!.launchOpenCourseSeconds - 0.1
      advance(game, course, 'too-long', 60, until)
      game.advanceTo('too-long', until + 0.3)
      expect(game.snapshot().status).toBe('recovering')
      expect(game.snapshot().player.lateralVelocityMetersPerSecond).toBe(0)
      expect(game.beginEpoch('too-long', 'start')).toEqual({
        ok: false,
        reason: 'epoch-reused',
      })
    },
  )
})
