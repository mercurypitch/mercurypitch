// ============================================================
// V2 onboarding platter motion — deterministic rigid-spin and stop math
// ============================================================
//
// The preview turns at 30 rpm. A stop preserves the current angle and
// velocity, then applies one constant deceleration until the next strict
// whole-turn endpoint so the authored stopped plate can replace it cleanly.

export const V2_PLATTER_TURN_RADIANS = Math.PI * 2
export const V2_PLATTER_ANGULAR_VELOCITY_RAD_PER_SECOND = Math.PI
export const V2_PLATTER_CANONICAL_EPSILON_RAD = 1e-6

export interface V2PlatterStopMotion {
  readonly initialAngleRad: number
  readonly endpointAngleRad: number
  readonly distanceRad: number
  readonly durationSeconds: number
  readonly angularVelocityRadPerSecond: number
  readonly angularAccelerationRadPerSecondSquared: number
}

export interface V2PlatterStopSample {
  readonly angleRad: number
  readonly angularVelocityRadPerSecond: number
  readonly completed: boolean
}

function finiteNumber(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`)
  }
  return value
}

/** Advances a rigid 30 rpm spin without imposing a presentation frame rate. */
export function advanceV2PlatterSpinAngle(
  angleRad: number,
  elapsedSeconds: number,
): number {
  const angle = finiteNumber(angleRad, 'angleRad')
  const elapsed = finiteNumber(elapsedSeconds, 'elapsedSeconds')
  if (elapsed < 0) {
    throw new RangeError('elapsedSeconds must not be negative.')
  }

  return angle + V2_PLATTER_ANGULAR_VELOCITY_RAD_PER_SECOND * elapsed
}

/**
 * Builds the unique constant-deceleration stop from the current angle to the
 * next strict 2pi endpoint. An already canonical angle therefore travels one
 * more full turn instead of completing ambiguously at time zero.
 */
export function createV2PlatterStopMotion(
  initialAngleRad: number,
): V2PlatterStopMotion {
  const initialAngle = finiteNumber(initialAngleRad, 'initialAngleRad')
  const endpointAngleRad =
    Math.ceil(
      (initialAngle + V2_PLATTER_CANONICAL_EPSILON_RAD) /
        V2_PLATTER_TURN_RADIANS,
    ) * V2_PLATTER_TURN_RADIANS
  const distanceRad = endpointAngleRad - initialAngle
  const angularVelocityRadPerSecond = V2_PLATTER_ANGULAR_VELOCITY_RAD_PER_SECOND
  const durationSeconds = (2 * distanceRad) / angularVelocityRadPerSecond
  const angularAccelerationRadPerSecondSquared =
    -(angularVelocityRadPerSecond ** 2) / (2 * distanceRad)

  return {
    initialAngleRad: initialAngle,
    endpointAngleRad,
    distanceRad,
    durationSeconds,
    angularVelocityRadPerSecond,
    angularAccelerationRadPerSecondSquared,
  }
}

/** Samples a stop, clamping before its start and exactly onto its endpoint. */
export function sampleV2PlatterStopMotion(
  motion: V2PlatterStopMotion,
  elapsedSeconds: number,
): V2PlatterStopSample {
  const elapsed = finiteNumber(elapsedSeconds, 'elapsedSeconds')
  const clampedElapsed = Math.min(motion.durationSeconds, Math.max(0, elapsed))
  const completed = clampedElapsed >= motion.durationSeconds

  if (completed) {
    return {
      angleRad: motion.endpointAngleRad,
      angularVelocityRadPerSecond: 0,
      completed: true,
    }
  }

  return {
    angleRad:
      motion.initialAngleRad +
      motion.angularVelocityRadPerSecond * clampedElapsed +
      0.5 * motion.angularAccelerationRadPerSecondSquared * clampedElapsed ** 2,
    angularVelocityRadPerSecond: Math.max(
      0,
      motion.angularVelocityRadPerSecond +
        motion.angularAccelerationRadPerSecondSquared * clampedElapsed,
    ),
    completed: false,
  }
}
