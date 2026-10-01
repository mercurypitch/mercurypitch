// ============================================================
// Song runner movement tests — continuous collision, support, and certified jumps.
// ============================================================

import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT } from './first-course'
import { applyRunnerMovementInput, createRunnerMovementState, runnerHasGroundSupport, stepRunnerMovement, } from './movement'
import { runnerBeatToSeconds } from './tempo'

const course = SINGING_CURRENT

function secondsAtDistance(distanceMeters: number): number {
  return runnerBeatToSeconds(
    course.tempoSegments,
    distanceMeters / course.metersPerBeat,
  )
}

describe('song runner movement', () => {
  it('treats each full-width gap as one span without lane-boundary seams', () => {
    const gaps = course.obstacles.filter((obstacle) => obstacle.kind === 'gap')
    expect(gaps).toHaveLength(2)
    for (const gap of gaps) {
      const midpoint =
        (gap.minCourseDistanceMeters + gap.maxCourseDistanceMeters) / 2
      expect(gap.lateralSpans).toEqual([{ minLateralX: -3, maxLateralX: 3 }])
      expect(runnerHasGroundSupport(course, midpoint, -1)).toBe(false)
      expect(runnerHasGroundSupport(course, midpoint, 1)).toBe(false)
      expect(runnerHasGroundSupport(course, midpoint, 0)).toBe(false)
      expect(runnerHasGroundSupport(course, midpoint, 2.8)).toBe(true)
    }
  })

  it.each(['first-jump', 'second-jump'])(
    '%s keeps a walker falling after the far edge',
    (gapId) => {
      const gap = course.obstacles.find(
        (obstacle) => obstacle.kind === 'gap' && obstacle.id === gapId,
      )!
      const state = createRunnerMovementState(course, 1)
      let time = secondsAtDistance(
        gap.minCourseDistanceMeters - course.movement.bodyRadius - 0.05,
      )
      const end =
        secondsAtDistance(
          gap.maxCourseDistanceMeters + course.movement.bodyRadius + 0.05,
        ) + 1.5
      let leftFloor = false
      let fell = false
      while (time < end && !fell) {
        const next = Math.min(end, time + course.movement.fixedStepSeconds)
        const result = stepRunnerMovement(course, state, time, next)
        leftFloor ||= !state.grounded
        if (leftFloor) expect(state.grounded).toBe(false)
        fell = result.fell
        time = next
      }
      expect(leftFloor).toBe(true)
      expect(fell).toBe(true)
      expect(state.feetY).toBeLessThan(course.fallBelowFeetY)
    },
  )

  it.each(['first-jump', 'second-jump'])(
    '%s lands from a certified jump',
    (gapId) => {
      const gap = course.obstacles.find(
        (obstacle) => obstacle.kind === 'gap' && obstacle.id === gapId,
      )!
      const action = gap.certifiedActions[0]!
      const launch =
        (action.launchOpenCourseSeconds + action.launchCloseCourseSeconds) / 2
      const end = action.landingCloseCourseSeconds + 0.5
      const state = createRunnerMovementState(course, 1)
      applyRunnerMovementInput(course, state, 'jump', launch)
      let time = launch
      let peak = state.feetY
      while (time < end) {
        const next = Math.min(end, time + course.movement.fixedStepSeconds)
        const result = stepRunnerMovement(course, state, time, next)
        expect(result.collided).toBe(false)
        expect(result.fell).toBe(false)
        peak = Math.max(peak, state.feetY)
        time = next
      }
      expect(peak).toBeGreaterThan(course.groundFeetY + 0.65)
      expect(state.grounded).toBe(true)
      expect(state.feetY).toBe(course.groundFeetY)
    },
  )

  it('sweeps the continuous body through blocker volume without nearest-lane rounding', () => {
    const blocker = course.obstacles.find(
      (obstacle) =>
        obstacle.kind === 'blocker' && obstacle.id === 'first-lane-gate',
    )!
    const start = secondsAtDistance(
      blocker.minCourseDistanceMeters - course.movement.bodyRadius - 0.05,
    )
    const end = secondsAtDistance(
      blocker.maxCourseDistanceMeters + course.movement.bodyRadius + 0.05,
    )
    const blocked = createRunnerMovementState(course, 1)
    const safe = createRunnerMovementState(course, 2)
    expect(stepRunnerMovement(course, blocked, start, end).collided).toBe(true)
    expect(stepRunnerMovement(course, safe, start, end).collided).toBe(false)
  })
})
