// Solver budget regressions — invalid options stop before replay or allocation.
import { describe, expect, it, vi } from 'vitest'
import type { GlassGame, MovementInput } from '../contracts'
import { createGlassGame } from '../core/game'
import { expandMacroToInputs } from './macro-inputs'
import { proveReachability } from './reachability-prover'
import { proveBarrierSecurity, proveSequenceBreakSecurity, } from './sequence-break-prover'
import { testLevel } from './solver.test-fixtures'
import { executeMacro, replayTrajectory, verifyMovementRoute, } from './trajectory-stepper'

const idle = { moveX: 0, moveZ: 0, jumpDown: false }
const invalidNumbers = [Infinity, -Infinity, NaN, -1, 0.5]

describe('finite solver budgets', () => {
  it.each([
    ['maxFrontierExpansions', 10_001],
    ['macroTickDuration', 241],
    ['maxTrajectoryTicks', 7201],
    ['maxSimulationTicks', 10_000_001],
    ['maxFrontierSize', 5001],
  ] as const)(
    'rejects invalid %s without exploring the level',
    (name, overLimit) => {
      const level = testLevel()
      const target = { ...level.breakables[0], interactionRadius: 1.1 }
      for (const value of [...invalidNumbers, overLimit]) {
        expect(
          proveReachability(level, target, { [name]: value }),
        ).toMatchObject({
          status: 'inconclusive',
          reachable: false,
          exploredStatesCount: 0,
          reason: expect.stringContaining('Invalid search budget'),
        })
      }
    },
  )

  it.each([Infinity, NaN, 0, -1])(
    'rejects an invalid target radius %s',
    (interactionRadius) => {
      const level = testLevel()
      expect(
        proveReachability(level, { ...level.breakables[0], interactionRadius }),
      ).toMatchObject({
        status: 'inconclusive',
        exploredStatesCount: 0,
        reason: 'Invalid target geometry.',
      })
    },
  )

  it.each([
    ['approachRunTicks', 7201],
    ['coyoteWindowTicks', 61],
    ['maxTrajectoryTicks', 7201],
    ['angleSpreadDeg', 90],
  ] as const)(
    'rejects invalid probe option %s before any trajectories',
    (name, overLimit) => {
      const level = testLevel()
      const values =
        name === 'angleSpreadDeg'
          ? [Infinity, -Infinity, NaN, -1, overLimit]
          : [...invalidNumbers, overLimit]
      for (const value of values) {
        for (const proof of [
          proveSequenceBreakSecurity(level, 'missing-bridge', {
            [name]: value,
          }),
          proveBarrierSecurity(level, 'target', level.spawn.position, {
            [name]: value,
          }),
        ]) {
          expect(proof).toMatchObject({
            status: 'inconclusive',
            secure: false,
            testedTrajectoriesCount: 0,
          })
          expect(proof.reason).toMatch(/Probe (budgets|angle spread)/)
        }
      }
    },
  )

  it('rejects oversized, nonfinite and sparse approach histories before replay', () => {
    const level = testLevel()
    const histories: MovementInput[][] = [
      Array.from({ length: 7201 }, () => idle),
      [{ ...idle, moveX: NaN }],
      [{ ...idle, moveZ: Infinity }],
      new Array<MovementInput>(1),
    ]
    for (const approachInputSequence of histories) {
      for (const proof of [
        proveSequenceBreakSecurity(level, 'missing-bridge', {
          approachInputSequence,
        }),
        proveBarrierSecurity(level, 'target', level.spawn.position, {
          approachInputSequence,
        }),
      ]) {
        expect(proof).toMatchObject({
          status: 'inconclusive',
          testedTrajectoriesCount: 0,
          reason: expect.stringContaining('Approach witness'),
        })
      }
    }
  })

  it('rejects invalid macro durations before executing a step or allocating inputs', () => {
    const step = vi.fn()
    const game = { step } as unknown as GlassGame
    for (const durationTicks of [...invalidNumbers, 0, 241]) {
      const macro = { ...idle, durationTicks }
      expect(() => expandMacroToInputs(macro)).toThrow(RangeError)
      expect(() => executeMacro(game, macro)).toThrow(RangeError)
    }
    expect(step).not.toHaveBeenCalled()
    expect(expandMacroToInputs({ ...idle, durationTicks: 240 })).toHaveLength(
      240,
    )
  })

  it('caps exported replay and live route APIs before advancing the game', () => {
    const level = testLevel()
    const game = createGlassGame(level)
    const step = vi.spyOn(game, 'step')
    for (const inputs of [
      Array.from({ length: 14_401 }, () => idle),
      [{ ...idle, moveX: Infinity }],
      new Array<MovementInput>(1),
    ]) {
      expect(() => replayTrajectory(level, undefined, inputs)).toThrow(
        RangeError,
      )
      expect(() => verifyMovementRoute(game, inputs, [])).toThrow(RangeError)
    }
    for (const maxTicks of [...invalidNumbers, 14_401]) {
      expect(() => verifyMovementRoute(game, [idle], [], maxTicks)).toThrow(
        RangeError,
      )
    }
    expect(step).not.toHaveBeenCalled()
    expect(verifyMovementRoute(game, [idle], [], 0)).toMatchObject({
      status: 'reached',
      totalTicks: 0,
    })
  })
})
