// Macro inputs — discrete action generator for heading, run acceleration, and jump timing.

import type { MovementInput } from '../contracts'
import type { MacroInput } from './contracts'

export const DIRECTIONS_16: readonly { moveX: number; moveZ: number; angleDeg: number }[] = [
  { moveX: 0, moveZ: -1, angleDeg: 0 },         // North (-Z)
  { moveX: 0.38, moveZ: -0.92, angleDeg: 22.5 },
  { moveX: 0.71, moveZ: -0.71, angleDeg: 45 },  // North-East
  { moveX: 0.92, moveZ: -0.38, angleDeg: 67.5 },
  { moveX: 1, moveZ: 0, angleDeg: 90 },         // East (+X)
  { moveX: 0.92, moveZ: 0.38, angleDeg: 112.5 },
  { moveX: 0.71, moveZ: 0.71, angleDeg: 135 },   // South-East
  { moveX: 0.38, moveZ: 0.92, angleDeg: 157.5 },
  { moveX: 0, moveZ: 1, angleDeg: 180 },        // South (+Z)
  { moveX: -0.38, moveZ: 0.92, angleDeg: 202.5 },
  { moveX: -0.71, moveZ: 0.71, angleDeg: 225 }, // South-West
  { moveX: -0.92, moveZ: 0.38, angleDeg: 247.5 },
  { moveX: -1, moveZ: 0, angleDeg: 270 },        // West (-X)
  { moveX: -0.92, moveZ: -0.38, angleDeg: 292.5 },
  { moveX: -0.71, moveZ: -0.71, angleDeg: 315 },// North-West
  { moveX: -0.38, moveZ: -0.92, angleDeg: 337.5 },
]

export const CARDINAL_DIRECTIONS = [
  { moveX: 0, moveZ: -1 }, // North
  { moveX: 1, moveZ: 0 },  // East
  { moveX: 0, moveZ: 1 },  // South
  { moveX: -1, moveZ: 0 }, // West
] as const

export function generateGoalDirectedActions(
  fromPos: { x: number; z: number },
  toPos: { x: number; z: number },
  grounded: boolean,
  durationTicks: number = 10,
): MacroInput[] {
  const dx = toPos.x - fromPos.x
  const dz = toPos.z - fromPos.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.001) {
    return [{ moveX: 0, moveZ: 0, jumpDown: false, durationTicks }]
  }

  const nx = dx / dist
  const nz = dz / dist
  const baseAngle = Math.atan2(nz, nx)

  const spreadAngles = [0, -0.35, 0.35, -0.7, 0.7]
  const actions: MacroInput[] = []

  for (const spread of spreadAngles) {
    const a = baseAngle + spread
    const mx = Math.cos(a)
    const mz = Math.sin(a)
    actions.push({ moveX: mx, moveZ: mz, jumpDown: false, durationTicks })
    if (grounded) {
      actions.push({ moveX: mx, moveZ: mz, jumpDown: true, durationTicks })
    }
  }

  for (const dir of CARDINAL_DIRECTIONS) {
    actions.push({ moveX: dir.moveX, moveZ: dir.moveZ, jumpDown: false, durationTicks })
  }

  return actions
}

export function generateCandidateActions(
  grounded: boolean,
  durationTicks: number = 8,
): MacroInput[] {
  const actions: MacroInput[] = []

  // Cardinal + Ordinal movements
  for (const dir of DIRECTIONS_16) {
    actions.push({
      moveX: dir.moveX,
      moveZ: dir.moveZ,
      jumpDown: false,
      durationTicks,
    })

    if (grounded) {
      actions.push({
        moveX: dir.moveX,
        moveZ: dir.moveZ,
        jumpDown: true,
        durationTicks,
      })
    }
  }

  actions.push({
    moveX: 0,
    moveZ: 0,
    jumpDown: false,
    durationTicks,
  })

  return actions
}

export function expandMacroToInputs(macro: MacroInput): MovementInput[] {
  const stepInput: MovementInput = {
    moveX: macro.moveX,
    moveZ: macro.moveZ,
    jumpDown: macro.jumpDown,
  }
  return Array.from({ length: macro.durationTicks }, () => stepInput)
}
