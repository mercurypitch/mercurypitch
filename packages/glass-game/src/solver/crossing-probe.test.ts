// Crossing controls — actual gap departures, rotated courses and grounded downstream landings.
import { describe, expect, it } from 'vitest'
import type { LevelDefinition, MovementInput } from '../contracts'
import { createGlassGame } from '../core/game'
import { proveBarrierSecurity, proveSequenceBreakSecurity, } from './sequence-break-prover'
import { deck, testLevel } from './solver.test-fixtures'
import { replayTrajectory, verifyMovementRoute } from './trajectory-stepper'

function gapLevel(width: number): LevelDefinition {
  return testLevel({
    platforms: [
      deck('upstream', -2, 1),
      deck('locked', 1, 1 + width, { kind: 'bridge', unlockAfter: 'target' }),
      deck('downstream', 1 + width, 6),
    ],
  })
}

function rotate(level: LevelDefinition, turn: number): LevelDefinition {
  const point = (x: number, z: number) => ({
    x: Math.round((x * Math.cos(turn) - z * Math.sin(turn)) * 1e8) / 1e8,
    z: Math.round((z * Math.cos(turn) + x * Math.sin(turn)) * 1e8) / 1e8,
  })
  return {
    ...level,
    platforms: level.platforms.map((p) => {
      const corners = [
        point(p.minX, p.minZ),
        point(p.minX, p.maxZ),
        point(p.maxX, p.minZ),
        point(p.maxX, p.maxZ),
      ]
      return {
        ...p,
        minX: Math.min(...corners.map((c) => c.x)),
        maxX: Math.max(...corners.map((c) => c.x)),
        minZ: Math.min(...corners.map((c) => c.z)),
        maxZ: Math.max(...corners.map((c) => c.z)),
      }
    }),
  }
}

function gateLevel(halfWidth = 2): LevelDefinition {
  const base = testLevel()
  return {
    ...base,
    breakables: [{ ...base.breakables[0], position: { x: 0, y: 0, z: 1.1 } }],
    solids: [
      {
        id: 'barrier:target:pane',
        kind: 'prop',
        shape: 'box',
        minX: -halfWidth,
        maxX: halfWidth,
        minZ: 1,
        maxZ: 1.2,
        top: 2,
        thickness: 2,
        activation: { noneCompleted: ['target'] },
      },
    ],
  }
}

const forward: MovementInput = { moveX: 0, moveZ: 1, jumpDown: false }
const downstream = {
  id: 'downstream',
  label: 'Downstream',
  kind: 'position' as const,
  anchor: { x: 0, y: 0, z: 2 },
  interactionRadius: 0.2,
}

describe('physical crossing probes', () => {
  it.each([0, Math.PI / 2, Math.PI, Math.PI * 1.5])(
    'finds and replays a genuine gap jump at rotation %s',
    (yaw) => {
      const level = rotate(gapLevel(0.5), yaw)
      const proof = proveSequenceBreakSecurity(level, 'locked', {
        angleSpreadDeg: 0,
        coyoteWindowTicks: 4,
        maxTrajectoryTicks: 600,
      })
      expect(proof.status).toBe('exploit-found')
      expect(proof.reachedBoundaryTrajectoriesCount).toBeGreaterThan(0)
      const replay = replayTrajectory(
        level,
        undefined,
        proof.exploitWitnessSequence!,
      )
      expect(replay.fell).toBe(false)
      expect(replay.player.grounded).toBe(true)
      expect(replay.player.supportPlatformId).toBe('downstream')
      expect(replay.game.snapshot().enabledPlatformIds).not.toContain('locked')
    },
  )

  it('keeps a wide gap inconclusive and never accepts airborne plane crossing', () => {
    const blocked = proveSequenceBreakSecurity(gapLevel(3), 'locked', {
      angleSpreadDeg: 0,
      coyoteWindowTicks: 4,
      maxTrajectoryTicks: 600,
    })
    expect(blocked.status).toBe('inconclusive')
    expect(blocked.reachedBoundaryTrajectoriesCount).toBeGreaterThan(0)
    const noLanding = {
      ...gapLevel(0.2),
      platforms: gapLevel(0.2).platforms.filter((p) => p.id !== 'downstream'),
    }
    const airborne = proveSequenceBreakSecurity(noLanding, 'locked', {
      angleSpreadDeg: 0,
      coyoteWindowTicks: 4,
      maxTrajectoryTicks: 600,
    })
    expect(airborne.maximumReachMetres).toBeGreaterThan(0.2)
    expect(airborne.exploitWitnessSequence).toBeUndefined()
  })

  it('finds the original false-secure walking bypass with a real full approach', () => {
    const level = testLevel({
      platforms: [
        deck('floor', -2, 10),
        deck('locked', 5, 7, { kind: 'bridge', unlockAfter: 'target' }),
      ],
    })
    const proof = proveSequenceBreakSecurity(level, 'locked', {
      angleSpreadDeg: 0,
      coyoteWindowTicks: 0,
      maxTrajectoryTicks: 1000,
    })
    expect(proof.status).toBe('exploit-found')
    expect(
      replayTrajectory(level, undefined, proof.exploitWitnessSequence!).player
        .position.z,
    ).toBeGreaterThanOrEqual(7.16)
  })

  it('checks blocked and open gate controls on one real walking route', () => {
    const level = gateLevel()
    const closed = proveBarrierSecurity(level, 'target', level.spawn.position, {
      angleSpreadDeg: 30,
      coyoteWindowTicks: 4,
      maxTrajectoryTicks: 360,
    })
    expect(closed.status).toBe('inconclusive')
    expect(closed.reachedBoundaryTrajectoriesCount).toBeGreaterThan(0)
    const inputs = Array.from({ length: 300 }, () => forward)
    expect(
      verifyMovementRoute(createGlassGame(level), inputs, [downstream]).status,
    ).toBe('inconclusive')
    const progress = {
      version: 2,
      levelId: level.id,
      checkpointId: '',
      completedBreakableIds: ['target'],
    }
    expect(
      verifyMovementRoute(createGlassGame(level, progress), inputs, [
        downstream,
      ]).status,
    ).toBe('reached')
  })

  it('uses angleSpreadDeg to find a side bypass rather than only testing the center', () => {
    const level = gateLevel(0.2)
    const options = { maxTrajectoryTicks: 360, coyoteWindowTicks: 0 }
    expect(
      proveBarrierSecurity(level, 'target', level.spawn.position, {
        ...options,
        angleSpreadDeg: 0,
      }).status,
    ).toBe('inconclusive')
    expect(
      proveBarrierSecurity(level, 'target', level.spawn.position, {
        ...options,
        angleSpreadDeg: 45,
      }).status,
    ).toBe('exploit-found')
  })

  it('refuses an assumed local start which the runtime checkpoint would override', () => {
    const level = gateLevel()
    expect(
      proveBarrierSecurity(level, 'target', { x: 0, y: 0, z: 0.5 }),
    ).toMatchObject({
      status: 'inconclusive',
      testedTrajectoriesCount: 0,
      reason: expect.stringContaining('actual runtime checkpoint'),
    })
    expect(
      proveBarrierSecurity(level, 'missing', level.spawn.position).status,
    ).toBe('inconclusive')
  })
})
