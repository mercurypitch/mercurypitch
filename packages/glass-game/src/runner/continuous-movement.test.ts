// Continuous movement regression tests — physical travel, reversals, contacts and support.

import { describe, expect, it } from 'vitest'
import type { ContinuousRunnerMovementProfile } from './continuous-lateral'
import { advanceRunnerLateral } from './continuous-lateral'
import { continuousRunnerSweepIntersectsCircle } from './continuous-movement'
import type { CompiledRunnerCourse, CompiledRunnerGap } from './contracts'
import { SINGING_CURRENT, SINGING_CURRENT_CONTINUOUS_TRIAL, } from './first-course'
import { applyRunnerMovementInput, createRunnerMovementState, runnerHasGroundSupport, stepRunnerMovement, } from './movement'
import { runnerBeatToSeconds } from './tempo'
import { runnerBodyLateralBounds } from './track-bounds'

const course = SINGING_CURRENT_CONTINUOUS_TRIAL
const profile = course.movement as ContinuousRunnerMovementProfile
const bounds = runnerBodyLateralBounds(course)
const empty: CompiledRunnerCourse = { ...course, obstacles: [] }

function seconds(distance: number) {
  return runnerBeatToSeconds(
    course.tempoSegments,
    distance / course.metersPerBeat,
  )
}

function runMove(
  c: CompiledRunnerCourse,
  state: ReturnType<typeof createRunnerMovementState>,
  start: number,
  end: number,
) {
  let collided = false,
    fell = false
  for (let time = start; time < end - 1e-9; ) {
    const next = Math.min(end, time + c.movement.fixedStepSeconds)
    const result = stepRunnerMovement(c, state, time, next)
    collided ||= result.collided
    fell ||= result.fell
    time = next
  }
  return { collided, fell }
}

describe('continuous runner physics', () => {
  it('preserves the accepted profile and gives the study a new capability and save identity', () => {
    expect(SINGING_CURRENT.version).toBe(1)
    expect(SINGING_CURRENT.movement.kind).toBeUndefined()
    expect(course.version).toBe(2)
    expect(course.id).not.toBe(SINGING_CURRENT.id)
    expect(course.targets).toEqual(
      SINGING_CURRENT.targets.map((target) => ({
        ...target,
        chunkId: target.chunkId.replace(SINGING_CURRENT.id, course.id),
      })),
    )
    expect(
      course.rewards.finishRewardIds.some((id) =>
        SINGING_CURRENT.rewards.finishRewardIds.includes(id),
      ),
    ).toBe(false)
    expect(
      course.rewards.pickups.some((p) =>
        SINGING_CURRENT.rewards.pickups.some((a) => a.id === p.id),
      ),
    ).toBe(false)
  })

  it('integrates held and partial input from the pre-input origin without snapping', () => {
    const state = createRunnerMovementState(empty, 1)
    applyRunnerMovementInput(empty, state, 'steer', 0, 0.5)
    runMove(empty, state, 0, 0.5)
    expect(state.lateralX).toBeCloseTo(1.09375, 8)
    expect(state.lateralVelocityMetersPerSecond).toBe(2.5)
    expect(state.lateralX).not.toBe(course.laneCenters[state.targetLane])
    applyRunnerMovementInput(empty, state, 'steer', 0.5, 0)
    runMove(empty, state, 0.5, 1)
    expect(state.lateralX).toBeCloseTo(1.09375 + 2.5 ** 2 / 56, 8)
    expect(state.lateralVelocityMetersPerSecond).toBe(0)
  })

  it('reverses with finite acceleration, then clamps the whole body at each edge', () => {
    const state = createRunnerMovementState(empty, 1)
    state.lateralVelocityMetersPerSecond = 5
    applyRunnerMovementInput(empty, state, 'steer', 0, -1)
    runMove(empty, state, 0, 0.25)
    expect(state.lateralX).toBeCloseTo(0.625, 8)
    expect(state.lateralVelocityMetersPerSecond).toBeCloseTo(0, 8)
    runMove(empty, state, 0.25, 2)
    expect(state.lateralX).toBe(bounds.minLateralX)
    expect(state.lateralVelocityMetersPerSecond).toBe(0)
    applyRunnerMovementInput(empty, state, 'steer', 2, 1)
    runMove(empty, state, 2, 4)
    expect(state.lateralX).toBe(bounds.maxLateralX)
    expect(state.lateralVelocityMetersPerSecond).toBe(0)
  })

  it('splits a large step at the reversal extremum instead of tunnelling through a blocker', () => {
    const blocker = {
      kind: 'blocker',
      id: 'turn-contact',
      chunkId: 'test',
      profileId: 'test',
      telegraphFromCourseSeconds: 0,
      minCourseDistanceMeters: 0,
      maxCourseDistanceMeters: 10,
      minLateralX: 0.65,
      maxLateralX: 0.7,
      minY: 0,
      maxY: 2,
      authoredLaneMask: [1],
      certifiedActions: [],
    } as const
    const state = createRunnerMovementState(empty, 1)
    state.lateralVelocityMetersPerSecond = 5
    state.steeringAxis = -1
    expect(
      stepRunnerMovement({ ...empty, obstacles: [blocker] }, state, 0, 0.5)
        .collided,
    ).toBe(true)
    expect(state.lateralX).toBeCloseTo(0, 8)
  })

  it('detects an unsupported interval even when both ends of a lateral sweep have floor', () => {
    const gap: CompiledRunnerGap = {
      kind: 'gap',
      id: 'side-hole',
      chunkId: 'test',
      profileId: 'test',
      telegraphFromCourseSeconds: 0,
      minCourseDistanceMeters: 0,
      maxCourseDistanceMeters: 10,
      lateralSpans: [{ minLateralX: -0.5, maxLateralX: 0.5 }],
      landingStartCourseDistanceMeters: 10,
      landingEndCourseDistanceMeters: 12,
      certifiedActions: [],
    }
    const c = { ...empty, obstacles: [gap] }
    const state = createRunnerMovementState(c, 1)
    state.lateralX = -1
    state.lateralVelocityMetersPerSecond = 5
    state.steeringAxis = 1
    expect(runnerHasGroundSupport(c, 1, -1)).toBe(true)
    expect(runnerHasGroundSupport(c, 2.04, 1)).toBe(true)
    stepRunnerMovement(c, state, seconds(1), seconds(1) + 0.4)
    expect(state.lateralX).toBeCloseTo(1, 8)
    expect(state.grounded).toBe(false)
    expect(state.feetY).toBeLessThan(c.groundFeetY)
  })

  it.each([bounds.minLateralX, 0, bounds.maxLateralX])(
    'cannot walk the full-width gap using a phantom floor outside the deck at %s',
    (x) => {
      const gap = course.obstacles.find((o) => o.kind === 'gap')!
      const state = createRunnerMovementState(course, 1)
      state.lateralX = x
      const result = runMove(
        course,
        state,
        seconds(gap.minCourseDistanceMeters - 1),
        seconds(gap.maxCourseDistanceMeters + 1) + 2,
      )
      expect(result.fell).toBe(true)
    },
  )

  it.each([-1, 0, 1])(
    'has full steering control through a certified gap jump (axis %s)',
    (axis) => {
      const gap = course.obstacles.find((o) => o.kind === 'gap')!
      const action = gap.certifiedActions[0]!
      const start =
        (action.launchOpenCourseSeconds + action.launchCloseCourseSeconds) / 2
      const state = createRunnerMovementState(course, 1)
      applyRunnerMovementInput(course, state, 'jump', start)
      applyRunnerMovementInput(course, state, 'steer', start, axis)
      const result = runMove(
        course,
        state,
        start,
        action.landingCloseCourseSeconds + 0.2,
      )
      expect(result).toEqual({ collided: false, fell: false })
      expect(state.grounded).toBe(true)
      expect(state.lateralX).toBeCloseTo(axis * bounds.maxLateralX, 8)
    },
  )

  it('detects a pickup on the curved turning path even with coincident sweep endpoints', () => {
    const path = advanceRunnerLateral(profile, bounds, 0, 5, -1, 0.5)
    expect(path.lateralX).toBeCloseTo(0, 8)
    expect(
      path.segments.some((segment) =>
        continuousRunnerSweepIntersectsCircle(
          segment,
          segment.startSeconds,
          1,
          0.25,
          0.625,
          0.01,
        ),
      ),
    ).toBe(true)
    expect(
      path.segments.some((segment) =>
        continuousRunnerSweepIntersectsCircle(
          segment,
          segment.startSeconds,
          1,
          0.25,
          0.9,
          0.01,
        ),
      ),
    ).toBe(false)
  })
})
