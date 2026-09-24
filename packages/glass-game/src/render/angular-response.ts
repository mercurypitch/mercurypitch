// Bounded angular response — smooth, fixed-step turns shared by Merc and the chase camera.

const RESPONSE_STEP_SECONDS = 1 / 240
const MAXIMUM_ELAPSED_SECONDS = 0.05

export interface AngularResponseState {
  angle: number
  velocity: number
}

export interface AngularResponseLimits {
  maximumSpeed: number
  maximumAcceleration: number
  completeRadians?: number
}

export function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

function moveToward(current: number, target: number, maximumDelta: number) {
  if (Math.abs(target - current) <= maximumDelta) return target
  return current + Math.sign(target - current) * maximumDelta
}

/**
 * Advance an angle with bounded speed and acceleration.
 *
 * The small internal fixed step makes equal wall-clock spans agree at
 * 30/60/120 Hz while still accepting a render delta. Trapezoidal integration
 * starts a turn from zero velocity instead of applying the old full-rate first
 * frame, and the stopping-speed target brakes before the requested heading.
 */
export function stepAngularResponse(
  state: AngularResponseState,
  target: number,
  elapsedSeconds: number,
  limits: AngularResponseLimits,
): boolean {
  if (
    !Number.isFinite(target) ||
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds <= 0 ||
    !Number.isFinite(limits.maximumSpeed) ||
    limits.maximumSpeed <= 0 ||
    !Number.isFinite(limits.maximumAcceleration) ||
    limits.maximumAcceleration <= 0
  )
    return false
  const completeRadians = Math.max(0, limits.completeRadians ?? 0.003)
  let remaining = Math.min(elapsedSeconds, MAXIMUM_ELAPSED_SECONDS)
  let settled = false
  while (remaining > 1e-9) {
    const step = Math.min(RESPONSE_STEP_SECONDS, remaining)
    const error = shortestAngleDelta(state.angle, target)
    const speedThatCanStop = Math.sqrt(
      2 * limits.maximumAcceleration * Math.abs(error),
    )
    const desiredVelocity =
      Math.sign(error) * Math.min(limits.maximumSpeed, speedThatCanStop)
    const nextVelocity = moveToward(
      state.velocity,
      desiredVelocity,
      limits.maximumAcceleration * step,
    )
    const displacement = ((state.velocity + nextVelocity) * step) / 2
    if (
      Math.sign(displacement) === Math.sign(error) &&
      Math.abs(displacement) >= Math.abs(error)
    ) {
      state.angle += error
      state.velocity = 0
      settled = true
      break
    }
    state.angle += displacement
    state.velocity = nextVelocity
    remaining -= step
    if (
      Math.abs(shortestAngleDelta(state.angle, target)) <= completeRadians &&
      Math.abs(state.velocity) <= limits.maximumAcceleration * step
    ) {
      state.angle += shortestAngleDelta(state.angle, target)
      state.velocity = 0
      settled = true
      break
    }
  }
  return settled
}

export function stopAngularResponse(
  state: AngularResponseState,
  angle = state.angle,
): void {
  state.angle = angle
  state.velocity = 0
}
