// Solver state and positive-witness contracts exercise the actual simulation.
import { describe, expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { createGlassGame } from '../core/game'
import { generateGoalDirectedActions } from './macro-inputs'
import { proveReachability } from './reachability-prover'
import { proveSequenceBreakSecurity } from './sequence-break-prover'
import { testLevel } from './solver.test-fixtures'
import { StateLattice } from './state-lattice'
import { replayTrajectory } from './trajectory-stepper'

describe('bounded reachability evidence', () => {
  it('finds a nontrivial arrival route whose replay can actually start singing', () => {
    const target = GLASSWORKS.breakables[0]
    const proof = proveReachability(
      GLASSWORKS,
      { ...target, interactionRadius: 1.1 },
      { maxFrontierExpansions: 2000, macroTickDuration: 12 },
    )
    expect(proof.status).toBe('reachable')
    expect(proof.totalTicks).toBeGreaterThan(0)
    const replay = replayTrajectory(
      GLASSWORKS,
      undefined,
      proof.witnessInputSequence!,
    )
    expect(replay.fell).toBe(false)
    expect(replay.game.beginEncounter(target.id, 60)).toBe(true)
  })

  it('does not turn a finite negative sample into a mathematical security claim', () => {
    const proof = proveSequenceBreakSecurity(GLASSWORKS, 'arch-bridge', {
      approachRunTicks: 30,
      coyoteWindowTicks: 12,
    })
    expect(proof.gapWidthMetres).toBeCloseTo(1.9)
    expect(proof.status).toBe('inconclusive')
    expect(proof.secure).toBe(false)
    expect(proof.reachedBoundaryTrajectoriesCount).toBe(0)
  })

  it('reports expansion and replay budgets as inconclusive', () => {
    const level = testLevel()
    const target = { ...level.breakables[0], interactionRadius: 1.1 }
    expect(
      proveReachability(level, target, { maxFrontierExpansions: 0 }),
    ).toMatchObject({
      status: 'inconclusive',
      reason: expect.stringContaining('Expansion budget'),
    })
    expect(
      proveReachability(level, target, { maxSimulationTicks: 0 }),
    ).toMatchObject({
      status: 'inconclusive',
      reason: expect.stringContaining('Simulation tick budget'),
    })
  })

  it('requires an explicit position goal for a non-encounter waypoint', () => {
    const level = testLevel()
    const target = {
      id: 'waypoint',
      label: 'Waypoint',
      anchor: level.spawn.position,
      interactionRadius: 0.2,
    }
    expect(proveReachability(level, target)).toMatchObject({
      status: 'inconclusive',
      reachable: false,
    })
    expect(
      proveReachability(level, { ...target, kind: 'position' }),
    ).toMatchObject({ status: 'reachable', reachable: true })
  })

  it('distinguishes falling, speed, time, support and hidden movement history', () => {
    const lattice = new StateLattice()
    const player = createGlassGame(testLevel()).snapshot().player
    const context = { ticks: 12, inputHistory: '/0,1,0,12' }
    expect(lattice.add(player, ['floor'], context)).toBe(true)
    expect(lattice.add(player, ['floor'], context)).toBe(false)
    expect(
      lattice.add(
        { ...player, velocity: { x: 0, y: -1, z: 0 } },
        ['floor'],
        context,
      ),
    ).toBe(true)
    expect(
      lattice.add(
        { ...player, velocity: { x: 0, y: 0, z: 2 } },
        ['floor'],
        context,
      ),
    ).toBe(true)
    expect(lattice.add(player, ['floor'], { ...context, ticks: 24 })).toBe(true)
    expect(
      lattice.add(player, ['floor'], { ...context, inputHistory: '/0,1,1,12' }),
    ).toBe(true)
    expect(
      lattice.add(
        { ...player, supportPlatformId: 'ferry' },
        ['floor'],
        context,
      ),
    ).toBe(true)
    expect(
      lattice.add(player, ['floor'], {
        ...context,
        platformStates: [
          {
            id: 'ferry',
            offset: { x: 0, y: 0, z: 1 },
            phase: 'moving',
            phaseProgress: 0.5,
            collisionEnabled: true,
          },
        ],
      }),
    ).toBe(true)
  })

  it('samples waits and airborne presses for the real coyote/buffer windows', () => {
    const actions = generateGoalDirectedActions(
      { x: 0, z: 0 },
      { x: 0, z: 4 },
      false,
    )
    expect(
      actions.some((a) => a.moveX === 0 && a.moveZ === 0 && !a.jumpDown),
    ).toBe(true)
    expect(actions.some((a) => a.jumpDown)).toBe(true)
  })
})
