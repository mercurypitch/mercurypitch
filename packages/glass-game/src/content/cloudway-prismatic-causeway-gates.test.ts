// Authored showcase gate regressions replay a real walking bypass from saved court progress.
import { describe, expect, it } from 'vitest'
import type { LevelDefinition, MovementInput } from '../contracts'
import { createGlassGame } from '../core/game'
import { resolveMelodyAttempt } from '../core/melody-attempt'
import { MOVEMENT } from '../core/movement'
import { replayTrajectory, verifyMovementRoute, } from '../solver/trajectory-stepper'
import { CLOUDWAY_PRISMATIC_CAUSEWAY as level } from './cloudway-prismatic-causeway'

const gateId = 'prisma-gate-rise'

function progress(completedBreakableIds = ['prisma-note-home']) {
  return {
    version: 3,
    levelId: level.id,
    checkpointId: 'prisma-save-court',
    completedBreakableIds,
    melodyAttempt: resolveMelodyAttempt(level, {
      attemptId: 'closed-gate-audit',
      comfortableMidi: 60,
    }).identity,
  }
}

/** Reconstruct the recorded 864-tick bypass against the original stock collision. */
function stockGateWitness(
  stock: LevelDefinition,
  side: -1 | 1,
): MovementInput[] {
  const game = createGlassGame(stock, progress())
  const inputs: MovementInput[] = []
  const waypoints = [
    { x: 1.96, z: 13.5 + side * 1.54 },
    { x: 5.74, z: 13.5 + side * 1.54 },
    { x: 5.74, z: 13.5 },
  ]
  for (const target of waypoints) {
    let reached = false
    for (let tick = 0; tick < 720; tick++) {
      const position = game.snapshot().player.position
      const dx = target.x - position.x,
        dz = target.z - position.z
      const divisor = Math.max(Math.hypot(dx, dz), 0.5)
      const input = {
        moveX: dx / divisor,
        moveZ: dz / divisor,
        jumpDown: false,
      }
      inputs.push(input)
      expect(
        game
          .step(input, MOVEMENT.fixedStep)
          .some((event) => event.type === 'respawn'),
      ).toBe(false)
      const player = game.snapshot().player
      if (
        Math.hypot(player.position.x - target.x, player.position.z - target.z) <
          0.005 &&
        Math.hypot(player.velocity.x, player.velocity.z) < 0.03
      ) {
        reached = true
        break
      }
    }
    expect(reached).toBe(true)
  }
  expect(inputs).toHaveLength(864)
  expect(game.snapshot().player).toMatchObject({
    grounded: true,
    supportPlatformId: 'prisma-court2-east-6',
  })
  expect(game.snapshot().completedBreakableIds).not.toContain(gateId)
  return inputs
}

describe('Celestial Promenade rise gate local traversal', () => {
  it.each([-1, 1] as const)(
    'blocks the recorded side %s walking bypass with visible permanent wings',
    (side) => {
      const stock = {
        ...level,
        solids: level.solids?.filter(
          (solid) => !solid.id.startsWith(`barrier:${gateId}:court-`),
        ),
      }
      const witness = stockGateWitness(stock, side)
      const replay = replayTrajectory(level, progress(), witness)
      expect(replay.fell).toBe(false)
      expect(replay.player.grounded).toBe(true)
      expect(replay.player.position.x).toBeLessThan(4.59)
      expect(replay.game.snapshot().completedBreakableIds).not.toContain(gateId)
      const wings =
        level.solids?.filter((solid) =>
          solid.id.startsWith(`barrier:${gateId}:court-`),
        ) ?? []
      expect(wings).toHaveLength(2)
      for (const wing of wings) {
        expect(wing).toMatchObject({
          kind: 'prop',
          shape: 'box',
          presentation: { role: 'wall', material: 'stone' },
        })
        expect(wing.activation).toBeUndefined()
        if (wing.kind !== 'prop')
          throw new Error('Court wings must be solid props.')
        expect(wing.fallback).toBeUndefined()
      }
    },
  )

  it('retains the center passage after singing, from the actual saved court checkpoint', () => {
    const game = createGlassGame(level, progress(['prisma-note-home', gateId]))
    expect(game.snapshot().player.position).toEqual({ x: 1.96, y: 0, z: 13.5 })
    const target = {
      id: 'post-rise-court',
      label: 'Post-rise court',
      kind: 'position' as const,
      anchor: { x: 5.74, y: 0, z: 13.5 },
      interactionRadius: 0.05,
    }
    const result = verifyMovementRoute(
      game,
      Array.from({ length: 600 }, () => ({
        moveX: 1,
        moveZ: 0,
        jumpDown: false,
      })),
      [target],
    )
    expect(result.status).toBe('reached')
    expect(result.fell).toBe(false)
    expect(game.snapshot().player.supportPlatformId).toBe(
      'prisma-court2-east-6',
    )
  })
})
