// Trajectory stepper — headless execution of quantized movement against createGlassGame.

import type { GlassGame, LevelDefinition, MovementInput, PlayerState, Vec3 } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import type { MacroInput } from './contracts'

export function distXZ(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.hypot(dx, dz)
}

export function isWithinInteraction(
  pos: Vec3,
  anchor: Vec3,
  radius: number = 1.1,
  elevationTolerance: number = 0.6,
): boolean {
  return (
    distXZ(pos, anchor) <= radius &&
    Math.abs(pos.y - anchor.y) <= elevationTolerance
  )
}

export interface StepMacroResult {
  fell: boolean
  landed: boolean
  player: PlayerState
}

export function executeMacro(
  game: GlassGame,
  macro: MacroInput,
): StepMacroResult {
  const stepInput: MovementInput = {
    moveX: macro.moveX,
    moveZ: macro.moveZ,
    jumpDown: macro.jumpDown,
  }

  let fell = false
  let landed = false

  for (let i = 0; i < macro.durationTicks; i++) {
    const events = game.step(stepInput, MOVEMENT.fixedStep)
    for (const ev of events) {
      if (ev.type === 'respawn') fell = true
      if (ev.type === 'landed') landed = true
    }
    if (fell) break
  }

  return {
    fell,
    landed,
    player: game.snapshot().player,
  }
}

export function replayTrajectory(
  level: LevelDefinition,
  savedProgress: unknown,
  inputs: readonly MovementInput[],
): { game: GlassGame; player: PlayerState; fell: boolean } {
  const game = createGlassGame(level, savedProgress)
  let fell = false

  for (const input of inputs) {
    const events = game.step(input, MOVEMENT.fixedStep)
    if (events.some((ev) => ev.type === 'respawn')) {
      fell = true
      break
    }
  }

  return {
    game,
    player: game.snapshot().player,
    fell,
  }
}
