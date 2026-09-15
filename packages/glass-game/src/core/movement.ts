// Adventure movement — manual free-space intent with fixed-step jump forgiveness.

import type { MovementInput, PlatformDefinition, PlayerState, Vec3, } from '../contracts'
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

export interface MovementState extends PlayerState {
  coyoteLeft: number
  bufferedJump: number
  jumpWasDown: boolean
  requireJumpRelease: boolean
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
}

export function stepMovement(
  state: MovementState,
  input: MovementInput,
  dt: number,
  platforms: readonly PlatformDefinition[],
  collider: CourseCollider = FLAT_COURSE_COLLIDER,
): { jumped: boolean; landed: boolean; support: PlatformDefinition | null } {
  let x = Number.isFinite(input.moveX) ? input.moveX : 0
  let z = Number.isFinite(input.moveZ) ? input.moveZ : 0
  const magnitude = Math.hypot(x, z)
  if (magnitude > 1) {
    x /= magnitude
    z /= magnitude
  }
  const deltaX = x * MOVEMENT.speed - state.velocity.x
  const deltaZ = z * MOVEMENT.speed - state.velocity.z
  const difference = Math.hypot(deltaX, deltaZ)
  const acceleration = (MOVEMENT.speed / MOVEMENT.accelerationSeconds) * dt
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
