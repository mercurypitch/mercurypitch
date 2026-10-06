// Continuous runner movement — ordered support events and curved swept body contacts.

import type { RunnerLateralSegment } from './continuous-lateral.ts'
import { advanceRunnerLateral, runnerLateralPosition, runnerQuadraticRoots, } from './continuous-lateral.ts'
import type { CompiledRunnerBlocker, CompiledRunnerCourse, } from './contracts.ts'
import type { RunnerMovementState, RunnerMovementStepResult, } from './movement-contracts.ts'
import { runnerBodyLateralBounds } from './track-bounds.ts'

const EPSILON = 1e-9

interface MotionPiece {
  duration: number
  x: number
  vx: number
  ax: number
  z: number
  vz: number
  y: number
  vy: number
  ay: number
}

function bodyHitsBlocker(
  course: CompiledRunnerCourse,
  blocker: CompiledRunnerBlocker,
  piece: MotionPiece,
): boolean {
  const radius = course.movement.bodyRadius
  if (
    piece.z > blocker.maxCourseDistanceMeters + radius + EPSILON ||
    piece.z + piece.vz * piece.duration <
      blocker.minCourseDistanceMeters - radius - EPSILON
  )
    return false
  const axes = [
    [
      piece.x,
      piece.vx,
      piece.ax,
      blocker.minLateralX - course.movement.bodyRadius,
      blocker.maxLateralX + course.movement.bodyRadius,
    ],
    [
      piece.z,
      piece.vz,
      0,
      blocker.minCourseDistanceMeters - course.movement.bodyRadius,
      blocker.maxCourseDistanceMeters + course.movement.bodyRadius,
    ],
    [
      piece.y,
      piece.vy,
      piece.ay,
      blocker.minY - course.movement.bodyHeight,
      blocker.maxY,
    ],
  ] as const
  const boundaries = [0, piece.duration]
  for (const [position, velocity, acceleration, min, max] of axes)
    for (const edge of [min, max])
      boundaries.push(
        ...runnerQuadraticRoots(
          acceleration / 2,
          velocity,
          position - edge,
        ).filter((t) => t > 0 && t < piece.duration),
      )
  boundaries.sort((a, b) => a - b)
  const within = (t: number) =>
    axes.every(([position, velocity, acceleration, min, max]) => {
      const value = position + velocity * t + (acceleration * t * t) / 2
      return value >= min - EPSILON && value <= max + EPSILON
    })
  return boundaries.some(
    (t, i) => within(t) || (i > 0 && within((t + boundaries[i - 1]!) / 2)),
  )
}

function supportBoundaries(
  course: CompiledRunnerCourse,
  segment: RunnerLateralSegment,
  startDistance: number,
  speed: number,
): number[] {
  const boundaries = [0, segment.durationSeconds]
  const radius = course.movement.bodyRadius
  for (const obstacle of course.obstacles) {
    if (obstacle.kind !== 'gap') continue
    if (
      startDistance > obstacle.maxCourseDistanceMeters - radius ||
      startDistance + speed * segment.durationSeconds <
        obstacle.minCourseDistanceMeters + radius
    )
      continue
    for (const distance of [
      obstacle.minCourseDistanceMeters + radius,
      obstacle.maxCourseDistanceMeters - radius,
    ]) {
      const t = (distance - startDistance) / speed
      if (t > 0 && t < segment.durationSeconds) boundaries.push(t)
    }
    for (const span of obstacle.lateralSpans)
      for (const x of [span.minLateralX + radius, span.maxLateralX - radius])
        boundaries.push(
          ...runnerQuadraticRoots(
            segment.acceleration / 2,
            segment.startVelocity,
            segment.startX - x,
          ).filter((t) => t > 0 && t < segment.durationSeconds),
        )
  }
  return [...new Set(boundaries)].sort((a, b) => a - b)
}

export function stepContinuousRunnerMovement(
  course: CompiledRunnerCourse,
  state: RunnerMovementState,
  duration: number,
  startDistance: number,
  endDistance: number,
  hasSupport: (distance: number, lateralX: number) => boolean,
): RunnerMovementStepResult {
  if (course.movement.kind !== 'continuous')
    throw new Error('Continuous movement requires its compiled profile.')
  const lateral = advanceRunnerLateral(
    course.movement,
    runnerBodyLateralBounds(course),
    state.lateralX,
    state.lateralVelocityMetersPerSecond,
    state.steeringAxis,
    duration,
  )
  const speed = (endDistance - startDistance) / duration
  let collided = false
  for (const segment of lateral.segments) {
    const segmentDistance = startDistance + speed * segment.startSeconds
    const boundaries = supportBoundaries(
      course,
      segment,
      segmentDistance,
      speed,
    )
    for (let i = 1; i < boundaries.length; i++) {
      let t = boundaries[i - 1]!
      const end = boundaries[i]!
      // Horizontal support is constant strictly inside each partition.
      const supported = hasSupport(
        segmentDistance + speed * ((t + end) / 2),
        runnerLateralPosition(segment, (t + end) / 2),
      )
      if (state.grounded && !supported) {
        state.grounded = false
        state.coyoteRemainingSeconds = course.movement.coyoteSeconds
      }
      if (
        state.jumpBufferRemainingSeconds > EPSILON &&
        (state.grounded || state.coyoteRemainingSeconds > EPSILON)
      ) {
        state.grounded = false
        state.verticalVelocityMetersPerSecond =
          course.movement.jumpVelocityMetersPerSecond
        state.jumpBufferRemainingSeconds = 0
        state.coyoteRemainingSeconds = 0
      }
      while (t < end - EPSILON) {
        let dt = end - t
        const gravity = state.grounded
          ? 0
          : course.movement.gravityMetersPerSecondSquared
        if (
          !state.grounded &&
          supported &&
          state.feetY >= course.groundFeetY - EPSILON
        ) {
          const landing = runnerQuadraticRoots(
            -gravity / 2,
            state.verticalVelocityMetersPerSecond,
            state.feetY - course.groundFeetY,
          )
            .filter(
              (root) =>
                root > EPSILON &&
                root <= dt + EPSILON &&
                state.verticalVelocityMetersPerSecond - gravity * root <= 0,
            )
            .sort((a, b) => a - b)[0]
          if (landing !== undefined) dt = Math.min(dt, landing)
          else if (
            state.feetY <= course.groundFeetY + EPSILON &&
            state.verticalVelocityMetersPerSecond <= 0
          ) {
            state.grounded = true
            state.feetY = course.groundFeetY
            state.verticalVelocityMetersPerSecond = 0
            continue
          }
        }
        const piece = {
          duration: dt,
          x: runnerLateralPosition(segment, t),
          vx: segment.startVelocity + segment.acceleration * t,
          ax: segment.acceleration,
          z: segmentDistance + speed * t,
          vz: speed,
          y: state.feetY,
          vy: state.verticalVelocityMetersPerSecond,
          ay: -gravity,
        }
        collided ||= course.obstacles.some(
          (obstacle) =>
            obstacle.kind === 'blocker' &&
            bodyHitsBlocker(course, obstacle, piece),
        )
        state.feetY +=
          state.verticalVelocityMetersPerSecond * dt - (gravity * dt * dt) / 2
        state.verticalVelocityMetersPerSecond -= gravity * dt
        state.coyoteRemainingSeconds = state.grounded
          ? course.movement.coyoteSeconds
          : Math.max(0, state.coyoteRemainingSeconds - dt)
        state.jumpBufferRemainingSeconds = Math.max(
          0,
          state.jumpBufferRemainingSeconds - dt,
        )
        t += dt
        if (
          !state.grounded &&
          supported &&
          state.feetY >= course.groundFeetY - EPSILON &&
          state.feetY <= course.groundFeetY + EPSILON &&
          state.verticalVelocityMetersPerSecond <= 0
        ) {
          state.grounded = true
          state.feetY = course.groundFeetY
          state.verticalVelocityMetersPerSecond = 0
          state.coyoteRemainingSeconds = course.movement.coyoteSeconds
        }
      }
    }
  }
  state.lateralX = lateral.lateralX
  state.lateralVelocityMetersPerSecond = lateral.velocity
  state.targetLane = course.laneCenters.reduce<0 | 1 | 2>(
    (nearest, x, index) =>
      Math.abs(x - state.lateralX) <
      Math.abs(course.laneCenters[nearest] - state.lateralX)
        ? (index as 0 | 1 | 2)
        : nearest,
    0,
  )
  return {
    collided,
    fell: state.feetY < course.fallBelowFeetY - EPSILON,
    lateralSegments: lateral.segments,
  }
}

/** Curved X / linear course sweep; minima of squared distance are cubic roots. */
export function continuousRunnerSweepIntersectsCircle(
  segment: RunnerLateralSegment,
  startDistance: number,
  forwardSpeed: number,
  centerDistance: number,
  centerX: number,
  radius: number,
): boolean {
  const x = segment.startX - centerX
  const z = startDistance - centerDistance
  const v = segment.startVelocity
  const a = segment.acceleration
  const derivative = (t: number) =>
    (x + v * t + (a * t * t) / 2) * (v + a * t) +
    (z + forwardSpeed * t) * forwardSpeed
  const boundaries = [
    0,
    segment.durationSeconds,
    ...runnerQuadraticRoots(
      1.5 * a * a,
      3 * a * v,
      v * v + a * x + forwardSpeed * forwardSpeed,
    ).filter((t) => t > 0 && t < segment.durationSeconds),
  ].sort((a, b) => a - b)
  const candidates = [...boundaries]
  for (let i = 1; i < boundaries.length; i++) {
    let left = boundaries[i - 1]!,
      right = boundaries[i]!
    if (derivative(left) * derivative(right) >= 0) continue
    for (let iteration = 0; iteration < 40; iteration++) {
      const middle = (left + right) / 2
      if (derivative(left) * derivative(middle) <= 0) right = middle
      else left = middle
    }
    candidates.push((left + right) / 2)
  }
  return candidates.some(
    (t) =>
      (runnerLateralPosition(segment, t) - centerX) ** 2 +
        (startDistance + forwardSpeed * t - centerDistance) ** 2 <=
      radius ** 2 + EPSILON,
  )
}
