// Adventure movement — manual free-space intent with fixed-step jump forgiveness.

import type { CourseSolid, LevelMovementDefinition, MovementInput, PlayerState, Vec3, } from '../contracts'
import { LEVEL_MOVEMENT_LIMITS } from '../contracts'
import type { CourseCollider } from './collision'
import { FLAT_COURSE_COLLIDER } from './collision'

export const MOVEMENT = {
  speed: 1.15,
  accelerationSeconds: 0.14,
  jumpHeight: 0.5,
  gravity: 6.2,
  coyoteSeconds: 0.11,
  bufferSeconds: 0.13,
  maximumFallSpeed: 5.5,
  radius: 0.16,
  height: 0.5,
  fixedStep: 1 / 120,
  maximumSteps: 5,
} as const

const LEGACY_MOVEMENT: LevelMovementDefinition = {
  walkSpeed: MOVEMENT.speed,
  runSpeed: MOVEMENT.speed,
  runDelaySeconds: 0,
  runRampSeconds: 1,
}
const FULL_INTENT_THRESHOLD = 0.95
const REVERSAL_DOT_THRESHOLD = 0.25
const MINIMUM_PROGRESS_RATIO = 0.05

export interface MovementState extends PlayerState {
  coyoteLeft: number
  bufferedJump: number
  jumpWasDown: boolean
  requireJumpRelease: boolean
  /** Session-only run-up state; snapshots continue to expose PlayerState only. */
  runSeconds: number
  runDirection: { x: number; z: number } | null
}

function validMovement(
  movement: LevelMovementDefinition | undefined,
): movement is LevelMovementDefinition {
  return (
    movement !== undefined &&
    [
      movement.walkSpeed,
      movement.runSpeed,
      movement.runDelaySeconds,
      movement.runRampSeconds,
    ].every(Number.isFinite) &&
    movement.walkSpeed > 0 &&
    movement.runSpeed >= movement.walkSpeed &&
    movement.runSpeed <= LEVEL_MOVEMENT_LIMITS.maximumSpeed &&
    movement.runDelaySeconds >= 0 &&
    movement.runDelaySeconds <= LEVEL_MOVEMENT_LIMITS.maximumRunDelaySeconds &&
    movement.runRampSeconds > 0 &&
    movement.runRampSeconds <= LEVEL_MOVEMENT_LIMITS.maximumRunRampSeconds
  )
}

function resetRunUp(state: MovementState): void {
  state.runSeconds = 0
  state.runDirection = null
}

export function createMovement(
  position: Vec3,
  facingYaw: number,
): MovementState {
  return {
    position: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    grounded: true,
    facingYaw,
    coyoteLeft: MOVEMENT.coyoteSeconds,
    bufferedJump: 0,
    jumpWasDown: false,
    requireJumpRelease: false,
    runSeconds: 0,
    runDirection: null,
  }
}

export function releaseMovement(
  state: MovementState,
  preserveVertical = false,
): void {
  state.velocity = { x: 0, y: preserveVertical ? state.velocity.y : 0, z: 0 }
  state.bufferedJump = 0
  state.coyoteLeft = 0
  state.jumpWasDown = false
  state.requireJumpRelease = true
  resetRunUp(state)
}

export function stepMovement(
  state: MovementState,
  input: MovementInput,
  dt: number,
  platforms: readonly CourseSolid[],
  collider: CourseCollider = FLAT_COURSE_COLLIDER,
  configuredMovement?: LevelMovementDefinition,
): { jumped: boolean; landed: boolean; support: CourseSolid | null } {
  const movement = validMovement(configuredMovement)
    ? configuredMovement
    : LEGACY_MOVEMENT
  let x = Number.isFinite(input.moveX) ? input.moveX : 0
  let z = Number.isFinite(input.moveZ) ? input.moveZ : 0
  const magnitude = Math.hypot(x, z)
  if (magnitude > 1) {
    x /= magnitude
    z /= magnitude
  }
  const intentMagnitude = Math.min(1, magnitude)
  const direction =
    intentMagnitude > 0
      ? { x: x / intentMagnitude, z: z / intentMagnitude }
      : null
  const canRun =
    movement.runSpeed > movement.walkSpeed &&
    intentMagnitude >= FULL_INTENT_THRESHOLD &&
    direction !== null
  if (!canRun) resetRunUp(state)
  else {
    if (
      state.runDirection !== null &&
      direction.x * state.runDirection.x + direction.z * state.runDirection.z <
        REVERSAL_DOT_THRESHOLD
    )
      resetRunUp(state)
    state.runDirection ??= direction
  }
  const runProgress = canRun
    ? Math.max(
        0,
        Math.min(
          1,
          (state.runSeconds - movement.runDelaySeconds) /
            movement.runRampSeconds,
        ),
      )
    : 0
  const speed =
    movement.walkSpeed + (movement.runSpeed - movement.walkSpeed) * runProgress
  const desiredX = x * speed
  const desiredZ = z * speed
  const deltaX = desiredX - state.velocity.x
  const deltaZ = desiredZ - state.velocity.z
  const difference = Math.hypot(deltaX, deltaZ)
  const currentSpeed = Math.hypot(state.velocity.x, state.velocity.z)
  const desiredSpeed = Math.hypot(desiredX, desiredZ)
  // Keep fine movement's familiar walk response, while preserving the same
  // bounded stopping time after the higher configured run speed is reached.
  const responseSpeed =
    desiredSpeed >= currentSpeed ? movement.walkSpeed : movement.runSpeed
  const acceleration = (responseSpeed / MOVEMENT.accelerationSeconds) * dt
  const mix = difference > acceleration ? acceleration / difference : 1
  state.velocity.x += deltaX * mix
  state.velocity.z += deltaZ * mix
  if (Math.hypot(state.velocity.x, state.velocity.z) > 0.01)
    state.facingYaw = Math.atan2(-state.velocity.x, -state.velocity.z)

  if (!input.jumpDown) state.requireJumpRelease = false
  const pressed =
    input.jumpDown && !state.jumpWasDown && !state.requireJumpRelease
  state.jumpWasDown = input.jumpDown
  state.bufferedJump = pressed
    ? MOVEMENT.bufferSeconds
    : Math.max(0, state.bufferedJump - dt)
  const jumped =
    state.bufferedJump > 0 && (state.grounded || state.coyoteLeft > 0)
  if (jumped) {
    state.velocity.y = Math.sqrt(2 * MOVEMENT.gravity * MOVEMENT.jumpHeight)
    state.grounded = false
    state.coyoteLeft = 0
    state.bufferedJump = 0
  }
  const wasGrounded = state.grounded
  state.velocity.y = Math.max(
    -MOVEMENT.maximumFallSpeed,
    state.velocity.y - MOVEMENT.gravity * dt,
  )
  const previousX = state.position.x
  const previousZ = state.position.z
  const collision = collider.move(
    state.position,
    {
      x: state.velocity.x * dt,
      y: state.velocity.y * dt,
      z: state.velocity.z * dt,
    },
    platforms,
    MOVEMENT,
  )
  state.position = collision.position
  if (collision.blockedX) state.velocity.x = 0
  if (collision.blockedZ) state.velocity.z = 0
  if (collision.ceiling || collision.support !== null) state.velocity.y = 0
  if (canRun && direction !== null) {
    const progress =
      (state.position.x - previousX) * direction.x +
      (state.position.z - previousZ) * direction.z
    const minimumProgress =
      movement.walkSpeed * intentMagnitude * dt * MINIMUM_PROGRESS_RATIO
    if (progress >= minimumProgress)
      state.runSeconds = Math.min(
        movement.runDelaySeconds + movement.runRampSeconds,
        state.runSeconds + dt,
      )
    else resetRunUp(state)
  }
  state.grounded = collision.support !== null
  state.coyoteLeft = state.grounded
    ? MOVEMENT.coyoteSeconds
    : Math.max(0, state.coyoteLeft - dt)
  return {
    jumped,
    landed: !wasGrounded && state.grounded,
    support: collision.support,
  }
}
