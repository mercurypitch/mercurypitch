// ============================================================
// Song runner movement — fixed-step lanes, jump support, and swept collisions.
// ============================================================

import { stepContinuousRunnerMovement } from './continuous-movement'
import type { CompiledRunnerBlocker, CompiledRunnerCourse, RunnerInput, RunnerLane, } from './contracts'
import type { LaneTransition, RunnerMovementState, RunnerMovementStepResult, } from './movement-contracts'
import { runnerBeatToDistance, runnerSecondsToBeat } from './tempo'
import { runnerTrackBounds } from './track-bounds'

export type {
  RunnerMovementState,
  RunnerMovementStepResult,
} from './movement-contracts'

const EPSILON = 1e-9

interface Interval {
  start: number
  end: number
}

function courseDistanceAt(
  course: CompiledRunnerCourse,
  courseSeconds: number,
): number {
  return runnerBeatToDistance(
    runnerSecondsToBeat(course.tempoSegments, courseSeconds),
    course.metersPerBeat,
  )
}

function axisIntersection(
  start: number,
  end: number,
  minimum: number,
  maximum: number,
): Interval | null {
  const delta = end - start
  if (Math.abs(delta) <= EPSILON)
    return start >= minimum - EPSILON && start <= maximum + EPSILON
      ? { start: 0, end: 1 }
      : null
  const first = (minimum - start) / delta
  const second = (maximum - start) / delta
  return {
    start: Math.max(0, Math.min(first, second)),
    end: Math.min(1, Math.max(first, second)),
  }
}

function sweptBlockerCollision(
  blocker: CompiledRunnerBlocker,
  course: CompiledRunnerCourse,
  startDistance: number,
  endDistance: number,
  startX: number,
  endX: number,
  startFeetY: number,
  endFeetY: number,
): boolean {
  const intervals = [
    axisIntersection(
      startDistance,
      endDistance,
      blocker.minCourseDistanceMeters - course.movement.bodyRadius,
      blocker.maxCourseDistanceMeters + course.movement.bodyRadius,
    ),
    axisIntersection(
      startX,
      endX,
      blocker.minLateralX - course.movement.bodyRadius,
      blocker.maxLateralX + course.movement.bodyRadius,
    ),
    axisIntersection(
      startFeetY,
      endFeetY,
      blocker.minY - course.movement.bodyHeight,
      blocker.maxY,
    ),
  ]
  if (intervals.some((interval) => interval === null)) return false
  const entry = Math.max(...intervals.map((interval) => interval!.start))
  const exit = Math.min(...intervals.map((interval) => interval!.end))
  return entry <= exit + EPSILON
}

/** A circular foot remains supported while any part still touches solid floor. */
export function runnerHasGroundSupport(
  course: CompiledRunnerCourse,
  courseDistanceMeters: number,
  lateralX: number,
): boolean {
  const radius = course.movement.bodyRadius
  const track =
    course.movement.kind === 'continuous' ? runnerTrackBounds(course) : null
  for (const obstacle of course.obstacles) {
    if (obstacle.kind !== 'gap') continue
    if (
      courseDistanceMeters <=
        obstacle.minCourseDistanceMeters + radius + EPSILON ||
      courseDistanceMeters >=
        obstacle.maxCourseDistanceMeters - radius - EPSILON
    )
      continue
    if (
      obstacle.lateralSpans.some(
        (span) =>
          ((track !== null && span.minLateralX <= track.left + EPSILON) ||
            lateralX > span.minLateralX + radius + EPSILON) &&
          ((track !== null && span.maxLateralX >= track.right - EPSILON) ||
            lateralX < span.maxLateralX - radius - EPSILON),
      )
    )
      return false
  }
  return true
}

export function createRunnerMovementState(
  course: CompiledRunnerCourse,
  lane: RunnerLane,
  feetY = course.groundFeetY,
): RunnerMovementState {
  return {
    targetLane: lane,
    lateralX: course.laneCenters[lane],
    lateralVelocityMetersPerSecond: 0,
    steeringAxis: 0,
    feetY,
    verticalVelocityMetersPerSecond: 0,
    grounded: true,
    coyoteRemainingSeconds: course.movement.coyoteSeconds,
    jumpBufferRemainingSeconds: 0,
    laneTransition: null,
  }
}

function lateralXAt(transition: LaneTransition, courseSeconds: number): number {
  if (courseSeconds >= transition.endCourseSeconds - EPSILON)
    return transition.toX
  const progress = Math.max(
    0,
    Math.min(
      1,
      (courseSeconds - transition.startCourseSeconds) /
        (transition.endCourseSeconds - transition.startCourseSeconds),
    ),
  )
  return transition.fromX + (transition.toX - transition.fromX) * progress
}

export function applyRunnerMovementInput(
  course: CompiledRunnerCourse,
  state: RunnerMovementState,
  action: RunnerInput['action'],
  atCourseSeconds: number,
  axis = 0,
): void {
  if (action === 'steer') {
    if (course.movement.kind === 'continuous') state.steeringAxis = axis
    return
  }
  if (action === 'jump') {
    state.jumpBufferRemainingSeconds = course.movement.jumpBufferSeconds
    return
  }
  if (course.movement.kind === 'continuous') return
  const delta = action === 'lane-left' ? -1 : 1
  const targetLane = Math.max(
    0,
    Math.min(2, state.targetLane + delta),
  ) as RunnerLane
  if (targetLane === state.targetLane) return
  if (state.laneTransition !== null)
    state.lateralX = lateralXAt(state.laneTransition, atCourseSeconds)
  state.targetLane = targetLane
  state.laneTransition = {
    fromX: state.lateralX,
    toX: course.laneCenters[targetLane],
    startCourseSeconds: atCourseSeconds,
    endCourseSeconds: atCourseSeconds + course.movement.laneChangeSeconds,
  }
}

export function stepRunnerMovement(
  course: CompiledRunnerCourse,
  state: RunnerMovementState,
  startCourseSeconds: number,
  endCourseSeconds: number,
): RunnerMovementStepResult {
  const deltaSeconds = endCourseSeconds - startCourseSeconds
  const startDistance = courseDistanceAt(course, startCourseSeconds)
  const endDistance = courseDistanceAt(course, endCourseSeconds)
  if (course.movement.kind === 'continuous')
    return stepContinuousRunnerMovement(
      course,
      state,
      deltaSeconds,
      startDistance,
      endDistance,
      (distance, x) => runnerHasGroundSupport(course, distance, x),
    )
  const startX = state.lateralX
  const startFeetY = state.feetY

  if (state.laneTransition !== null) {
    state.lateralX = lateralXAt(state.laneTransition, endCourseSeconds)
    if (endCourseSeconds >= state.laneTransition.endCourseSeconds - EPSILON) {
      state.lateralX = state.laneTransition.toX
      state.laneTransition = null
    }
  }

  const supportedAtStart = runnerHasGroundSupport(course, startDistance, startX)
  if (state.grounded && !supportedAtStart) {
    state.grounded = false
    state.coyoteRemainingSeconds = course.movement.coyoteSeconds
  }
  if (state.grounded)
    state.coyoteRemainingSeconds = course.movement.coyoteSeconds
  else
    state.coyoteRemainingSeconds = Math.max(
      0,
      state.coyoteRemainingSeconds - deltaSeconds,
    )

  if (
    state.jumpBufferRemainingSeconds > 0 &&
    (state.grounded || state.coyoteRemainingSeconds > 0)
  ) {
    state.grounded = false
    state.verticalVelocityMetersPerSecond =
      course.movement.jumpVelocityMetersPerSecond
    state.jumpBufferRemainingSeconds = 0
    state.coyoteRemainingSeconds = 0
  }

  if (!state.grounded) {
    const velocity = state.verticalVelocityMetersPerSecond
    state.feetY +=
      velocity * deltaSeconds -
      0.5 * course.movement.gravityMetersPerSecondSquared * deltaSeconds ** 2
    state.verticalVelocityMetersPerSecond =
      velocity - course.movement.gravityMetersPerSecondSquared * deltaSeconds
    const supportedAtEnd = runnerHasGroundSupport(
      course,
      endDistance,
      state.lateralX,
    )
    if (
      supportedAtEnd &&
      state.verticalVelocityMetersPerSecond <= 0 &&
      startFeetY >= course.groundFeetY - EPSILON &&
      state.feetY <= course.groundFeetY + EPSILON
    ) {
      state.feetY = course.groundFeetY
      state.verticalVelocityMetersPerSecond = 0
      state.grounded = true
      state.coyoteRemainingSeconds = course.movement.coyoteSeconds
    }
  } else {
    state.feetY = course.groundFeetY
    state.verticalVelocityMetersPerSecond = 0
  }
  state.jumpBufferRemainingSeconds = Math.max(
    0,
    state.jumpBufferRemainingSeconds - deltaSeconds,
  )

  const collided = course.obstacles.some(
    (obstacle) =>
      obstacle.kind === 'blocker' &&
      sweptBlockerCollision(
        obstacle,
        course,
        startDistance,
        endDistance,
        startX,
        state.lateralX,
        startFeetY,
        state.feetY,
      ),
  )
  return {
    collided,
    fell: state.feetY < course.fallBelowFeetY - EPSILON,
  }
}

export function runnerSweepIntersectsCircle(
  startDistance: number,
  endDistance: number,
  startX: number,
  endX: number,
  centerDistance: number,
  centerX: number,
  combinedRadius: number,
): boolean {
  const deltaDistance = endDistance - startDistance
  const deltaX = endX - startX
  const denominator = deltaDistance ** 2 + deltaX ** 2
  const projected =
    denominator <= EPSILON
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((centerDistance - startDistance) * deltaDistance +
              (centerX - startX) * deltaX) /
              denominator,
          ),
        )
  const nearestDistance = startDistance + deltaDistance * projected
  const nearestX = startX + deltaX * projected
  return (
    (nearestDistance - centerDistance) ** 2 + (nearestX - centerX) ** 2 <=
    combinedRadius ** 2 + EPSILON
  )
}

export function runnerCourseDistanceAt(
  course: CompiledRunnerCourse,
  courseSeconds: number,
): number {
  return courseDistanceAt(course, courseSeconds)
}
