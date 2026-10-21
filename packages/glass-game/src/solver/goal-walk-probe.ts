// Goal walk probe — inexpensive positive witnesses before branching movement search.

import type { LevelDefinition, MovementInput } from '../contracts.ts'
import { createGlassGame } from '../core/game.ts'
import { MOVEMENT } from '../core/movement.ts'
import type { ReachabilityTarget } from './contracts.ts'
import { satisfiesTarget } from './trajectory-stepper.ts'

/** A stopped or fallen walk says nothing about the remaining jump and timing routes. */
export function probeGoalWalk(
  level: LevelDefinition,
  target: ReachabilityTarget,
  savedProgress: unknown,
  tickBudget: number,
): { inputs: MovementInput[]; reached: boolean } {
  const game = createGlassGame(level, savedProgress)
  const anchor =
    target.kind === 'position'
      ? target.anchor
      : level.breakables.find((candidate) => candidate.id === target.id)!.anchor
  const inputs: MovementInput[] = []
  let stoppedTicks = 0
  for (let tick = 0; tick < tickBudget; tick++) {
    const before = game.snapshot().player.position
    const dx = anchor.x - before.x
    const dz = anchor.z - before.z
    const divisor = Math.max(Math.hypot(dx, dz), 0.5)
    const input = { moveX: dx / divisor, moveZ: dz / divisor, jumpDown: false }
    inputs.push(input)
    if (
      game
        .step(input, MOVEMENT.fixedStep)
        .some((event) => event.type === 'respawn')
    )
      break
    const snapshot = game.snapshot()
    if (satisfiesTarget(snapshot, target)) return { inputs, reached: true }
    const after = snapshot.player.position
    stoppedTicks =
      Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z) <
      0.00001
        ? stoppedTicks + 1
        : 0
    if (stoppedTicks >= 12) break
  }
  return { inputs, reached: false }
}
