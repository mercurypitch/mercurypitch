// Continuous certificate tests — verify promised entry domains with the real movement solver.

import { describe, expect, it } from 'vitest'
import { compileSongRunnerCourseDocument } from './compile-course'
import { runnerReachableContinuousCorridor } from './continuous-certificates'
import type { CompiledRunnerBlocker, CompiledRunnerGap } from './contracts'
import { SINGING_CURRENT_CONTINUOUS_CATALOG, SINGING_CURRENT_CONTINUOUS_SOURCE_DOCUMENT, SINGING_CURRENT_CONTINUOUS_TRIAL, } from './first-course'
import { runnerFixedStepAtOrAfter } from './fixed-step'
import { createSongRunnerGame } from './game'
import { applyRunnerMovementInput, createRunnerMovementState, stepRunnerMovement, } from './movement'
import { runnerMovementCue, runnerUsefulJumpWindow } from './movement-cues'
import { runnerBeatToSeconds } from './tempo'

const course = SINGING_CURRENT_CONTINUOUS_TRIAL

function seconds(distance: number) {
  return runnerBeatToSeconds(
    course.tempoSegments,
    distance / course.metersPerBeat,
  )
}

function run(
  state: ReturnType<typeof createRunnerMovementState>,
  start: number,
  end: number,
) {
  let collided = false,
    fell = false
  for (let time = start; time < end - 1e-9; ) {
    const next = Math.min(end, time + course.movement.fixedStepSeconds)
    const result = stepRunnerMovement(course, state, time, next)
    collided ||= result.collided
    fell ||= result.fell
    time = next
  }
  return { collided, fell }
}

describe('continuous course safety', () => {
  it.each(
    course.obstacles.filter(
      (o): o is CompiledRunnerBlocker => o.kind === 'blocker',
    ),
  )(
    'certifies $id from every extreme entry velocity and position at the last input time',
    (obstacle) => {
      const action = obstacle.certifiedActions[0]!
      const certificate = action.continuous!
      expect(action.kind).toBe('continuous-steer')
      expect(certificate.version).toBe(1)
      for (const checkpoint of course.checkpoints.filter(
        (c) => c.courseSeconds <= action.launchOpenCourseSeconds,
      )) {
        const launch = runnerFixedStepAtOrAfter(
          action.launchCloseCourseSeconds,
          checkpoint.courseSeconds,
          course.movement.fixedStepSeconds,
        )
        const end = seconds(
          obstacle.maxCourseDistanceMeters + course.movement.bodyRadius + 0.02,
        )
        for (let i = 0; i <= 10; i++)
          for (const velocity of [-5, -2.5, 0, 2.5, 5]) {
            const state = createRunnerMovementState(course, 1)
            state.lateralX =
              certificate.entry.minLateralX +
              ((certificate.entry.maxLateralX - certificate.entry.minLateralX) *
                i) /
                10
            state.lateralVelocityMetersPerSecond = velocity
            const corridor = runnerReachableContinuousCorridor(
              course,
              obstacle,
              state.lateralX,
              velocity,
              action.launchCloseCourseSeconds,
            )
            expect(
              corridor,
              `${obstacle.id} x=${state.lateralX} v=${velocity}`,
            ).not.toBeNull()
            applyRunnerMovementInput(
              course,
              state,
              'steer',
              launch,
              corridor!.axis,
            )
            expect(run(state, launch, end)).toEqual({
              collided: false,
              fell: false,
            })
            expect(state.lateralX).toBeGreaterThanOrEqual(corridor!.minLateralX)
            expect(state.lateralX).toBeLessThanOrEqual(corridor!.maxLateralX)
          }
      }
    },
  )

  it.each(
    course.obstacles.filter((o): o is CompiledRunnerGap => o.kind === 'gap'),
  )(
    'lands $id at both cue limits, every edge and full lateral reversal',
    (gap) => {
      const action = gap.certifiedActions[0]!
      const useful = runnerUsefulJumpWindow(course, gap)!
      const certificate = action.continuous!
      expect(useful.launchOpenCourseSeconds).toBeGreaterThan(
        action.launchOpenCourseSeconds,
      )
      expect(useful.launchCloseCourseSeconds).toBeLessThan(
        action.launchCloseCourseSeconds,
      )
      for (const checkpoint of course.checkpoints.filter(
        (c) => c.courseSeconds <= action.launchOpenCourseSeconds,
      ))
        for (const chosen of [
          useful.launchOpenCourseSeconds,
          useful.launchCloseCourseSeconds,
        ])
          for (const x of [
            certificate.entry.minLateralX,
            0,
            certificate.entry.maxLateralX,
          ])
            for (const velocity of [-5, 0, 5]) {
              const launch = runnerFixedStepAtOrAfter(
                chosen,
                checkpoint.courseSeconds,
                course.movement.fixedStepSeconds,
              )
              const state = createRunnerMovementState(course, 1)
              state.lateralX = x
              state.lateralVelocityMetersPerSecond = velocity
              applyRunnerMovementInput(course, state, 'jump', launch)
              applyRunnerMovementInput(
                course,
                state,
                'steer',
                launch,
                -Math.sign(velocity),
              )
              expect(
                run(state, launch, action.landingCloseCourseSeconds + 0.02),
              ).toEqual({ collided: false, fell: false })
              expect(state.grounded).toBe(true)
            }
    },
  )

  it('uses actual position and momentum, and never offers an unreachable safe-side cue', () => {
    const obstacle = course.obstacles.find(
      (o): o is CompiledRunnerBlocker =>
        o.kind === 'blocker' && o.authoredLaneMask.length === 2,
    )!
    const snapshot = createSongRunnerGame(course, {
      comfortableMidi: 60,
    }).snapshot()
    const action = obstacle.certifiedActions[0]!
    const before = {
      ...snapshot,
      courseSeconds: action.launchOpenCourseSeconds,
      courseDistanceMeters: obstacle.minCourseDistanceMeters - 4,
      player: {
        ...snapshot.player,
        targetLane: 2 as const,
        lateralX: -2,
        lateralVelocityMetersPerSecond: -5,
      },
    }
    expect(runnerMovementCue(course, before)).toEqual({
      obstacleId: obstacle.id,
      stage: 'change-lane',
      direction: 'right',
    })
    expect(
      runnerMovementCue(course, {
        ...before,
        courseSeconds:
          seconds(
            obstacle.minCourseDistanceMeters - course.movement.bodyRadius,
          ) - 0.01,
      }),
    ).toBeNull()
  })

  it('rejects insufficient telegraph time rather than reusing a lane certificate', () => {
    const catalog = structuredClone(SINGING_CURRENT_CONTINUOUS_CATALOG)
    // A .32s lane hop can fit this lead; reversing a continuous body from the far edge cannot.
    const changed = {
      ...catalog,
      obstacleProfiles: {
        ...catalog.obstacleProfiles,
        'runner-lane-gate-training-v1': {
          ...catalog.obstacleProfiles['runner-lane-gate-training-v1'],
          telegraphLeadBeats: 1.4,
        },
      },
    }
    expect(() =>
      compileSongRunnerCourseDocument(
        SINGING_CURRENT_CONTINUOUS_SOURCE_DOCUMENT,
        changed,
      ),
    ).toThrow('certified')
  })

  it('rejects a jump whose authored landing runway cannot contain the certified flight', () => {
    const catalog = SINGING_CURRENT_CONTINUOUS_CATALOG
    const changed = {
      ...catalog,
      obstacleProfiles: {
        ...catalog.obstacleProfiles,
        'runner-gap-catch-training-v1': {
          ...catalog.obstacleProfiles['runner-gap-catch-training-v1'],
          landingRunwayMeters: 0.05,
        },
      },
    }
    expect(() =>
      compileSongRunnerCourseDocument(
        SINGING_CURRENT_CONTINUOUS_SOURCE_DOCUMENT,
        changed,
      ),
    ).toThrow('landing runway')
  })

  it.each([NaN, 0, -1, Infinity])(
    'rejects malformed continuous acceleration %s',
    (acceleration) => {
      const catalog = SINGING_CURRENT_CONTINUOUS_CATALOG
      const changed = {
        ...catalog,
        movementProfiles: {
          ...catalog.movementProfiles,
          'runner-continuous-study-v1': {
            ...catalog.movementProfiles['runner-continuous-study-v1'],
            lateralAccelerationMetersPerSecondSquared: acceleration,
          },
        },
      }
      expect(() =>
        compileSongRunnerCourseDocument(
          SINGING_CURRENT_CONTINUOUS_SOURCE_DOCUMENT,
          changed,
        ),
      ).toThrow('continuous steering')
    },
  )

  it('rejects a capability identifier instead of silently falling back to lanes', () => {
    const catalog = SINGING_CURRENT_CONTINUOUS_CATALOG
    const changed = {
      ...catalog,
      movementProfiles: {
        ...catalog.movementProfiles,
        'runner-continuous-study-v1': {
          ...catalog.movementProfiles['runner-continuous-study-v1'],
          kind: 'flying',
        },
      },
    }
    expect(() =>
      compileSongRunnerCourseDocument(
        SINGING_CURRENT_CONTINUOUS_SOURCE_DOCUMENT,
        changed as unknown as typeof catalog,
      ),
    ).toThrow('movement capability')
  })
})
