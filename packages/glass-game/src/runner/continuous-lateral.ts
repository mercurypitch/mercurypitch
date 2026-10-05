// Continuous runner steering — exact acceleration segments, reversals and contained deck edges.

import type { CompiledRunnerMovementProfile, RunnerLateralCorridor, } from './contracts.ts'

export type ContinuousRunnerMovementProfile = Extract<
  CompiledRunnerMovementProfile,
  { kind: 'continuous' }
>
export interface RunnerLateralSegment {
  readonly startSeconds: number
  readonly durationSeconds: number
  readonly startX: number
  readonly startVelocity: number
  readonly acceleration: number
}
const EPSILON = 1e-10

export function runnerQuadraticRoots(
  a: number,
  b: number,
  c: number,
): number[] {
  if (Math.abs(a) < EPSILON) return Math.abs(b) < EPSILON ? [] : [-c / b]
  const discriminant = b * b - 4 * a * c
  if (discriminant < -EPSILON) return []
  const sqrt = Math.sqrt(Math.max(0, discriminant))
  return [(-b - sqrt) / (2 * a), (-b + sqrt) / (2 * a)]
}

export function runnerLateralPosition(
  segment: RunnerLateralSegment,
  seconds: number,
): number {
  return (
    segment.startX +
    segment.startVelocity * seconds +
    (segment.acceleration * seconds * seconds) / 2
  )
}

/** Segments split at velocity extrema, target velocity and track contact. */
export function advanceRunnerLateral(
  profile: ContinuousRunnerMovementProfile,
  bounds: RunnerLateralCorridor,
  startX: number,
  startVelocity: number,
  axis: number,
  durationSeconds: number,
): {
  lateralX: number
  velocity: number
  segments: readonly RunnerLateralSegment[]
} {
  const target = axis * profile.maxLateralSpeedMetersPerSecond
  const rate =
    axis === 0
      ? profile.lateralBrakingMetersPerSecondSquared
      : profile.lateralAccelerationMetersPerSecondSquared
  let x = Math.max(bounds.minLateralX, Math.min(bounds.maxLateralX, startX))
  let velocity = startVelocity
  let elapsed = 0
  const segments: RunnerLateralSegment[] = []
  while (elapsed < durationSeconds - EPSILON) {
    if (
      (x >= bounds.maxLateralX - EPSILON && velocity > 0) ||
      (x <= bounds.minLateralX + EPSILON && velocity < 0)
    )
      velocity = 0
    let acceleration =
      Math.abs(target - velocity) < EPSILON
        ? 0
        : Math.sign(target - velocity) * rate
    if (
      (x >= bounds.maxLateralX - EPSILON &&
        velocity >= 0 &&
        acceleration > 0) ||
      (x <= bounds.minLateralX + EPSILON && velocity <= 0 && acceleration < 0)
    )
      acceleration = 0
    let span = durationSeconds - elapsed
    if (acceleration !== 0) {
      span = Math.min(span, Math.abs((target - velocity) / acceleration))
      const zeroAt = -velocity / acceleration
      if (zeroAt > EPSILON) span = Math.min(span, zeroAt)
    }
    for (const edge of [bounds.minLateralX, bounds.maxLateralX]) {
      for (const root of runnerQuadraticRoots(
        acceleration / 2,
        velocity,
        x - edge,
      ))
        if (root > EPSILON && root < span) span = root
    }
    const segment = {
      startSeconds: elapsed,
      durationSeconds: span,
      startX: x,
      startVelocity: velocity,
      acceleration,
    }
    segments.push(segment)
    x = Math.max(
      bounds.minLateralX,
      Math.min(bounds.maxLateralX, runnerLateralPosition(segment, span)),
    )
    velocity += acceleration * span
    if (Math.abs(velocity - target) < EPSILON) velocity = target
    elapsed += span
  }
  if (
    (x >= bounds.maxLateralX - EPSILON && velocity > 0) ||
    (x <= bounds.minLateralX + EPSILON && velocity < 0)
  )
    velocity = 0
  return { lateralX: x, velocity, segments }
}

/** Conservative free-space bound: begin moving away at maximum speed, then hold toward the corridor. */
export function runnerContinuousReachSeconds(
  profile: ContinuousRunnerMovementProfile,
  distance: number,
  initialVelocity = -profile.maxLateralSpeedMetersPerSecond,
): number {
  const speed = profile.maxLateralSpeedMetersPerSecond
  const acceleration = profile.lateralAccelerationMetersPerSecondSquared
  const rampSeconds = (speed - initialVelocity) / acceleration
  const rampDistance =
    initialVelocity * rampSeconds + (acceleration * rampSeconds ** 2) / 2
  if (distance <= rampDistance) {
    return (
      (-initialVelocity +
        Math.sqrt(
          initialVelocity ** 2 + 2 * acceleration * Math.max(0, distance),
        )) /
      acceleration
    )
  }
  return rampSeconds + (distance - rampDistance) / speed
}
