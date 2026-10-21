// Trajectory stepper — headless execution of quantized movement against createGlassGame.

import type { GameSnapshot, GlassGame, LevelDefinition, MovementInput, PlayerState, Vec3, } from '../contracts.ts'
import { BREAKABLE_INTERACTION_RADIUS, isAtBreakableInteractionElevation, } from '../core/exhibit-interaction.ts'
import { createGlassGame } from '../core/game.ts'
import { MOVEMENT } from '../core/movement.ts'
import type { MacroInput, MovementRouteResult, ReachabilityTarget, } from './contracts.ts'
import { assertMacro, assertReplay, boundedInteger, MAX_REPLAY_TICKS, } from './limits.ts'

export function distXZ(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.hypot(dx, dz)
}

export function isWithinInteraction(
  pos: Vec3,
  anchor: Vec3,
  radius: number = BREAKABLE_INTERACTION_RADIUS,
): boolean {
  return (
    distXZ(pos, anchor) <= radius &&
    isAtBreakableInteractionElevation(pos, anchor)
  )
}

/** The game, rather than a second copy of its eligibility rules, decides interaction. */
export function satisfiesTarget(
  snapshot: GameSnapshot,
  target: ReachabilityTarget,
): boolean {
  if (
    !(target.requiresCompleted ?? []).every((id) =>
      snapshot.completedBreakableIds.includes(id),
    )
  )
    return false
  if (target.kind !== 'position')
    return snapshot.nearbyBreakableId === target.id
  return (
    snapshot.player.grounded &&
    !snapshot.paused &&
    !snapshot.activeEncounter &&
    isWithinInteraction(
      snapshot.player.position,
      target.anchor,
      target.interactionRadius,
    )
  )
}

/** Advances the supplied live game; callers may complete real encounters between route legs. */
export function verifyMovementRoute(
  game: GlassGame,
  inputs: readonly MovementInput[],
  targets: readonly ReachabilityTarget[],
  maxTicks = 7200,
): MovementRouteResult {
  assertReplay(inputs)
  if (!boundedInteger(maxTicks, 0, MAX_REPLAY_TICKS))
    throw new RangeError('Route tick budget must be a finite bounded integer.')
  const reachedTargetIds: string[] = []
  let ticks = 0
  const observe = () => {
    while (
      reachedTargetIds.length < targets.length &&
      satisfiesTarget(game.snapshot(), targets[reachedTargetIds.length])
    ) {
      reachedTargetIds.push(targets[reachedTargetIds.length].id)
    }
  }
  observe()
  if (reachedTargetIds.length === targets.length)
    return { status: 'reached', reachedTargetIds, totalTicks: 0, fell: false }
  for (const input of inputs) {
    if (ticks >= maxTicks) break
    ticks++
    if (
      game
        .step(input, MOVEMENT.fixedStep)
        .some((event) => event.type === 'respawn')
    ) {
      return {
        status: 'inconclusive',
        reachedTargetIds,
        totalTicks: ticks,
        fell: true,
        reason: 'Route respawned before all ordered targets were reached.',
      }
    }
    observe()
    if (reachedTargetIds.length === targets.length)
      return {
        status: 'reached',
        reachedTargetIds,
        totalTicks: ticks,
        fell: false,
      }
  }
  return {
    status: 'inconclusive',
    reachedTargetIds,
    totalTicks: ticks,
    fell: false,
    reason:
      ticks < inputs.length
        ? 'Route tick budget exhausted.'
        : 'Witness ended before all ordered targets were reached.',
  }
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
  assertMacro(macro)
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
  assertReplay(inputs)
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
