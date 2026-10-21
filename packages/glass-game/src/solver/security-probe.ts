// Security probe — finite physical crossing samples with supported downstream witnesses only.
import type { LevelDefinition, MovementInput, Vec3 } from '../contracts.ts'
import { MOVEMENT } from '../core/movement.ts'
import type { SequenceBreakProof } from './contracts.ts'
import { boundedInteger, validReplay } from './limits.ts'
import { replayTrajectory } from './trajectory-stepper.ts'

export interface SequenceBreakOptions {
  /** Maximum ticks allowed to reach the real near edge, not a substitute for reaching it. */
  approachRunTicks?: number
  coyoteWindowTicks?: number
  angleSpreadDeg?: number
  maxTrajectoryTicks?: number
  savedProgress?: unknown
  /** Replayed from the runtime's spawn/checkpoint; never a teleport. */
  approachInputSequence?: readonly MovementInput[]
  /** World-space crossing direction; useful for oblique or unusual layouts. */
  direction?: { x: number; z: number }
}

export function securityOptionsError(
  options: SequenceBreakOptions,
): string | undefined {
  for (const [value, maximum] of [
    [options.approachRunTicks, 7200],
    [options.coyoteWindowTicks, 60],
    [options.maxTrajectoryTicks, 7200],
  ] as const) {
    if (value !== undefined && !boundedInteger(value, 0, maximum))
      return 'Probe budgets must be finite bounded integer ticks.'
  }
  if (
    options.angleSpreadDeg !== undefined &&
    (!Number.isFinite(options.angleSpreadDeg) ||
      options.angleSpreadDeg < 0 ||
      options.angleSpreadDeg > 89)
  )
    return 'Probe angle spread must be finite and within 0–89 degrees.'
  if (!validReplay(options.approachInputSequence ?? [], 7200))
    return 'Approach witness must contain at most 7200 finite movement inputs.'
  if (
    options.direction !== undefined &&
    (!Number.isFinite(options.direction.x) ||
      !Number.isFinite(options.direction.z) ||
      Math.hypot(options.direction.x, options.direction.z) === 0)
  )
    return 'Probe direction must be a finite nonzero vector.'
  return undefined
}

export interface ProbeBoundary {
  normal: { x: number; z: number }
  near: number
  far: number
  jumpBefore: number
}

export function inconclusiveSecurity(
  id: string,
  reason: string,
  gapWidthMetres = 0,
): SequenceBreakProof {
  return {
    bridgeOrGateId: id,
    secure: false,
    status: 'inconclusive',
    reason,
    gapWidthMetres,
    maximumReachMetres: 0,
    clearanceMarginMetres: -gapWidthMetres,
    testedTrajectoriesCount: 0,
    reachedBoundaryTrajectoriesCount: 0,
  }
}

export function project(
  position: Pick<Vec3, 'x' | 'z'>,
  normal: ProbeBoundary['normal'],
): number {
  return position.x * normal.x + position.z * normal.z
}

export function probeBoundary(
  level: LevelDefinition,
  id: string,
  boundary: ProbeBoundary,
  options: SequenceBreakOptions,
): SequenceBreakProof {
  const error = securityOptionsError(options)
  if (error !== undefined) return inconclusiveSecurity(id, error)
  const prefix = [...(options.approachInputSequence ?? [])]
  const first = replayTrajectory(level, options.savedProgress, prefix)
  const start = project(first.player.position, boundary.normal)
  const width = boundary.far - boundary.near
  if (
    first.fell ||
    !first.player.grounded ||
    start >= boundary.near - MOVEMENT.radius
  ) {
    return inconclusiveSecurity(
      id,
      'A supported upstream start and a non-respawning approach witness are required.',
      width,
    )
  }
  const spread = Math.max(0, Math.min(89, options.angleSpreadDeg ?? 30))
  const angles = [...new Set([0, -spread / 2, spread / 2, -spread, spread])]
  const maxCoyote = Math.max(
    0,
    Math.min(
      60,
      Math.floor(
        options.coyoteWindowTicks ??
          Math.ceil(MOVEMENT.coyoteSeconds / MOVEMENT.fixedStep),
      ),
    ),
  )
  const delays: (number | null)[] = [null] // Walking bypass is also a progression exploit.
  for (let delay = 0; delay <= maxCoyote; delay += 2) delays.push(delay)
  const maxTicks = Math.max(
    0,
    Math.min(7200, Math.floor(options.maxTrajectoryTicks ?? 2400)),
  )
  const approachBudget = Math.max(0, options.approachRunTicks ?? maxTicks)
  let maximumReach = 0
  let tested = 0
  let reachedBoundary = 0
  for (const angle of angles) {
    const radians = (angle * Math.PI) / 180
    const moveX =
      boundary.normal.x * Math.cos(radians) -
      boundary.normal.z * Math.sin(radians)
    const moveZ =
      boundary.normal.z * Math.cos(radians) +
      boundary.normal.x * Math.sin(radians)
    for (const delay of delays) {
      tested++
      const { game } = replayTrajectory(level, options.savedProgress, prefix)
      const inputs = [...prefix]
      let triggerTick: number | undefined
      let crossedNear = false
      let approached = false
      for (let tick = 0; tick < maxTicks; tick++) {
        const before = game.snapshot().player
        const distance = project(before.position, boundary.normal)
        if (
          triggerTick === undefined &&
          distance >= boundary.near - boundary.jumpBefore
        )
          triggerTick = tick
        if (triggerTick === undefined && tick >= approachBudget) break
        const jumpDown =
          delay !== null &&
          triggerTick !== undefined &&
          tick >= triggerTick + delay
        const input = { moveX, moveZ, jumpDown }
        inputs.push(input)
        const events = game.step(input, MOVEMENT.fixedStep)
        if (events.some((event) => event.type === 'respawn')) break
        const player = game.snapshot().player
        const progress = project(player.position, boundary.normal)
        if (progress >= boundary.near - boundary.jumpBefore && !approached) {
          approached = true
          reachedBoundary++
        }
        if (distance < boundary.near && progress >= boundary.near)
          crossedNear = true
        maximumReach = Math.max(maximumReach, progress - boundary.near)
        // Crossing a plane while airborne is not a landing. The feet must have real
        // runtime support wholly beyond the far boundary before the witness succeeds.
        if (
          crossedNear &&
          player.grounded &&
          progress >= boundary.far + MOVEMENT.radius
        ) {
          return {
            bridgeOrGateId: id,
            secure: false,
            status: 'exploit-found',
            reason:
              'A continuous runtime trajectory reached supported ground downstream while the obstacle remained locked.',
            gapWidthMetres: width,
            maximumReachMetres: maximumReach,
            clearanceMarginMetres: maximumReach - width,
            testedTrajectoriesCount: tested,
            reachedBoundaryTrajectoriesCount: reachedBoundary,
            exploitWitnessSequence: inputs,
          }
        }
      }
    }
  }
  return {
    bridgeOrGateId: id,
    secure: false,
    status: 'inconclusive',
    reason:
      reachedBoundary === 0
        ? 'No sampled trajectory reached the obstacle within the approach budget.'
        : 'No supported downstream witness in the sampled trajectories; unsampled paths remain unknown.',
    gapWidthMetres: width,
    maximumReachMetres: maximumReach,
    clearanceMarginMetres: maximumReach - width,
    testedTrajectoriesCount: tested,
    reachedBoundaryTrajectoriesCount: reachedBoundary,
  }
}
