// Goal walk regressions — cheap positive routes still obey runtime eligibility and all budgets.

import { afterEach, describe, expect, it, vi } from 'vitest'
import * as gameModule from '../core/game'
import { proveReachability } from './reachability-prover'
import { deck, testLevel } from './solver.test-fixtures'
import { replayTrajectory } from './trajectory-stepper'

afterEach(() => vi.restoreAllMocks())

function fixture() {
  const level = testLevel()
  const target = {
    ...level.breakables[0],
    anchor: { x: 0, y: 0, z: 5 },
    position: { x: 0, y: 0, z: 5.5 },
  }
  return { level: { ...level, breakables: [target] }, target }
}

describe('positive goal walk before branching search', () => {
  it('finds and replays a long straight encounter approach with one search expansion available', () => {
    const { level, target } = fixture()
    const proof = proveReachability(
      level,
      { ...target, interactionRadius: 1.1 },
      { maxFrontierExpansions: 1, macroTickDuration: 12 },
    )
    expect(proof.status).toBe('reachable')
    expect(proof.exploredStatesCount).toBe(1)
    expect(proof.totalTicks).toBeGreaterThan(12)
    const replay = replayTrajectory(
      level,
      undefined,
      proof.witnessInputSequence!,
    )
    expect(replay.fell).toBe(false)
    expect(replay.game.beginEncounter(target.id, 60)).toBe(true)
  })

  it.each([0, 10, 80])(
    'counts the walk against a %s-tick total simulation budget',
    (maxSimulationTicks) => {
      const { level, target } = fixture()
      const create = gameModule.createGlassGame
      let simulated = 0
      vi.spyOn(gameModule, 'createGlassGame').mockImplementation((...args) => {
        const game = create(...args)
        return {
          ...game,
          step: (...input) => {
            simulated++
            return game.step(...input)
          },
        }
      })
      const proof = proveReachability(
        level,
        { ...target, interactionRadius: 1.1 },
        { maxSimulationTicks },
      )
      expect(proof.status).toBe('inconclusive')
      expect(simulated).toBeLessThanOrEqual(maxSimulationTicks)
    },
  )

  it('respects a shorter trajectory horizon and zero expansion allowance', () => {
    const { level, target } = fixture()
    for (const options of [
      { maxTrajectoryTicks: 12 },
      { maxFrontierExpansions: 0 },
    ]) {
      expect(
        proveReachability(level, { ...target, interactionRadius: 1.1 }, options)
          .status,
      ).toBe('inconclusive')
    }
  })

  it('shares the simulation allowance between a blocked walk and branching replays', () => {
    const { level, target } = fixture()
    const blocked = {
      ...level,
      solids: [
        {
          id: 'wall',
          kind: 'prop' as const,
          shape: 'box' as const,
          minX: -2,
          maxX: 2,
          minZ: 0.45,
          maxZ: 0.65,
          top: 2,
          thickness: 2,
        },
      ],
    }
    const create = gameModule.createGlassGame
    const stepsByGame: number[] = []
    vi.spyOn(gameModule, 'createGlassGame').mockImplementation((...args) => {
      const game = create(...args)
      const index = stepsByGame.push(0) - 1
      return {
        ...game,
        step: (...input) => {
          stepsByGame[index]++
          return game.step(...input)
        },
      }
    })
    const proof = proveReachability(
      blocked,
      { ...target, interactionRadius: 1.1 },
      { maxSimulationTicks: 80 },
    )
    expect(proof.status).toBe('inconclusive')
    expect(stepsByGame.filter((ticks) => ticks > 0).length).toBeGreaterThan(1)
    expect(
      stepsByGame.reduce((sum, ticks) => sum + ticks, 0),
    ).toBeLessThanOrEqual(80)
  })

  it('does not turn a walk across a real void into a reachable encounter', () => {
    const { level, target } = fixture()
    const separated = {
      ...level,
      platforms: [deck('start', -2, 0.5), deck('destination', 4, 8)],
    }
    const proof = proveReachability(
      separated,
      { ...target, interactionRadius: 1.1 },
      { maxFrontierExpansions: 1 },
    )
    expect(proof.status).toBe('inconclusive')
    expect(proof.witnessInputSequence).toBeUndefined()
  })
})
