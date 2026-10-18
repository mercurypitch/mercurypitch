// Sequence-break prover — adversarial boundary fan-out bounding maximum kinematic jump reach across gaps.

import type { LevelDefinition, MovementInput } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import type { SequenceBreakProof } from './contracts'
import { replayTrajectory } from './trajectory-stepper'

export interface SequenceBreakOptions {
  approachRunTicks?: number
  coyoteWindowTicks?: number
  angleSpreadDeg?: number
}

/**
 * Tests whether an unbridged progression gap can be crossed before its unlock condition is met.
 */
export function proveSequenceBreakSecurity(
  level: LevelDefinition,
  bridgePlatformId: string,
  options: SequenceBreakOptions = {},
): SequenceBreakProof {
  const bridge = level.platforms.find((p) => p.id === bridgePlatformId)
  if (!bridge) {
    throw new Error(`Platform "${bridgePlatformId}" not found in level platforms.`)
  }

  // The span is the physical length of the bridge along its primary axis
  const spanX = bridge.maxX - bridge.minX
  const spanZ = bridge.maxZ - bridge.minZ
  const isAxisZ = spanZ >= spanX
  const gapWidthMetres = isAxisZ ? spanZ : spanX

  // Game with bridge disabled (fresh progress)
  const initialGame = createGlassGame(level)
  const snapshot = initialGame.snapshot()
  if (snapshot.enabledPlatformIds.includes(bridgePlatformId)) {
    throw new Error(`Platform "${bridgePlatformId}" is unexpectedly enabled at spawn.`)
  }

  // Sample trajectories: run-up into edge departure with varied coyote delays (0 to 14 ticks)
  let maximumReach = 0
  let testedCount = 0
  let exploitWitness: MovementInput[] | undefined

  const coyoteTicksMax = options.coyoteWindowTicks ?? Math.ceil(MOVEMENT.coyoteSeconds / MOVEMENT.fixedStep)
  const angles = [-30, -15, 0, 15, 30] // diagonal sprint approaches

  for (const angle of angles) {
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const moveX = isAxisZ ? sin : cos
    const moveZ = isAxisZ ? cos : sin

    for (let coyoteDelay = 0; coyoteDelay <= coyoteTicksMax; coyoteDelay += 2) {
      testedCount++
      const inputs: MovementInput[] = []

      // 1. Approach run-up (sustained input to reach full velocity)
      const runTicks = options.approachRunTicks ?? 40
      for (let t = 0; t < runTicks; t++) {
        inputs.push({ moveX, moveZ, jumpDown: false })
      }

      // 2. Coyote delay frames (running off ledge before jump press)
      for (let t = 0; t < coyoteDelay; t++) {
        inputs.push({ moveX, moveZ, jumpDown: false })
      }

      // 3. Jump press & hold through entire flight
      const flightTicks = 45 // ~0.375s full jump arc
      for (let t = 0; t < flightTicks; t++) {
        inputs.push({ moveX, moveZ, jumpDown: true })
      }

      const replay = replayTrajectory(level, undefined, inputs)
      const startPos = level.spawn.position
      const finalPos = replay.player.position
      const reach = isAxisZ
        ? Math.abs(finalPos.z - startPos.z)
        : Math.abs(finalPos.x - startPos.x)

      if (reach > maximumReach) {
        maximumReach = reach
      }

      // If the player somehow did not fall and reached downstream deck, record exploit
      if (!replay.fell && reach >= gapWidthMetres) {
        exploitWitness = inputs
        break
      }
    }
    if (exploitWitness) break
  }

  const clearanceMargin = maximumReach - gapWidthMetres

  return {
    bridgeOrGateId: bridgePlatformId,
    secure: clearanceMargin < 0 && exploitWitness === undefined,
    gapWidthMetres,
    maximumReachMetres: Number(maximumReach.toFixed(3)),
    clearanceMarginMetres: Number(clearanceMargin.toFixed(3)),
    testedTrajectoriesCount: testedCount,
    exploitWitnessSequence: exploitWitness,
  }
}

/**
 * Tests whether an unbroken sanctuary barrier blocks all sprint, coyote, and diagonal jump trajectories from crossing past its threshold.
 */
export function proveBarrierSecurity(
  level: LevelDefinition,
  gateEncounterId: string,
  spawnPosition: { x: number; y: number; z: number },
  options: SequenceBreakOptions = {},
): SequenceBreakProof {
  const gate = level.breakables.find((b) => b.id === gateEncounterId)
  if (!gate) {
    throw new Error(`Breakable gate "${gateEncounterId}" not found in level.`)
  }

  const dx = gate.position.x - spawnPosition.x
  const dz = gate.position.z - spawnPosition.z
  const isAxisZ = Math.abs(dz) >= Math.abs(dx)
  const dirSign = (isAxisZ ? dz : dx) >= 0 ? 1 : -1
  const distanceToGate = Math.abs(isAxisZ ? dz : dx)
  // Crossing past the barrier means advancing >= 0.45m past the barrier plane
  const crossThreshold = distanceToGate + 0.45

  const testLevel: LevelDefinition = {
    ...level,
    spawn: {
      ...level.spawn,
      position: spawnPosition,
    },
  }

  let maximumReach = 0
  let testedCount = 0
  let exploitWitness: MovementInput[] | undefined

  const coyoteTicksMax =
    options.coyoteWindowTicks ??
    Math.ceil(MOVEMENT.coyoteSeconds / MOVEMENT.fixedStep)
  const angles = [-30, -15, 0, 15, 30]

  for (const angle of angles) {
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad) * dirSign
    const sin = Math.sin(rad)
    const moveX = isAxisZ ? sin : cos
    const moveZ = isAxisZ ? cos : sin

    for (let coyoteDelay = 0; coyoteDelay <= coyoteTicksMax; coyoteDelay += 3) {
      testedCount++
      const inputs: MovementInput[] = []
      const runTicks = options.approachRunTicks ?? 36
      for (let t = 0; t < runTicks + coyoteDelay; t++) {
        inputs.push({ moveX, moveZ, jumpDown: false })
      }
      for (let t = 0; t < 40; t++) {
        inputs.push({ moveX, moveZ, jumpDown: true })
      }

      const replay = replayTrajectory(testLevel, undefined, inputs)
      const finalPos = replay.player.position
      const progress = isAxisZ
        ? (finalPos.z - spawnPosition.z) * dirSign
        : (finalPos.x - spawnPosition.x) * dirSign

      if (progress > maximumReach) {
        maximumReach = progress
      }
      if (!replay.fell && progress >= crossThreshold) {
        exploitWitness = inputs
        break
      }
    }
    if (exploitWitness) break
  }

  const clearanceMargin = maximumReach - crossThreshold
  return {
    bridgeOrGateId: gateEncounterId,
    secure: clearanceMargin < 0 && exploitWitness === undefined,
    gapWidthMetres: Number(crossThreshold.toFixed(3)),
    maximumReachMetres: Number(maximumReach.toFixed(3)),
    clearanceMarginMetres: Number(clearanceMargin.toFixed(3)),
    testedTrajectoriesCount: testedCount,
    exploitWitnessSequence: exploitWitness,
  }
}
