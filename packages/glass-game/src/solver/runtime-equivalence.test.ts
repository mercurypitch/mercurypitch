// Solver regressions — reject claims which the actual encounter controller rejects.
import { describe, expect, it } from 'vitest'
import { createGlassGame } from '../core/game'
import { proveReachability } from './reachability-prover'
import { proveSequenceBreakSecurity } from './sequence-break-prover'
import { deck, testLevel } from './solver.test-fixtures'

function atSpawn(extra = {}) {
  const base = testLevel()
  const target = {
    ...base.breakables[0],
    anchor: { x: 0, y: 0, z: 0 },
    ...extra,
  }
  return testLevel({ breakables: [target] })
}

function prove(level: ReturnType<typeof testLevel>) {
  const target = level.breakables[0]
  return proveReachability(
    level,
    { ...target, interactionRadius: 1.1 },
    { maxFrontierExpansions: 1 },
  )
}

describe('runtime-equivalent encounter goals', () => {
  it('does not accept a target 30cm above the player', () => {
    const level = atSpawn({ anchor: { x: 0, y: 0.3, z: 0 } })
    expect(createGlassGame(level).beginEncounter('target', 60)).toBe(false)
    expect(prove(level).reachable).toBe(false)
  })

  it('does not interact on a bridge or over a deck edge', () => {
    for (const platform of [
      deck('bridge', -2, 8, { kind: 'bridge' }),
      deck('edge', 0, 8),
    ]) {
      const level = { ...atSpawn(), platforms: [platform] }
      expect(createGlassGame(level).beginEncounter('target', 60)).toBe(false)
      expect(
        proveReachability(
          level,
          { ...level.breakables[0], interactionRadius: 1.1 },
          { maxFrontierExpansions: 0 },
        ).reachable,
      ).toBe(false)
    }
  })

  it('honors required completions before claiming interaction', () => {
    const level = atSpawn({ requiresCompleted: ['unplayed'] })
    expect(createGlassGame(level).beginEncounter('target', 60)).toBe(false)
    expect(prove(level).reachable).toBe(false)
  })

  it('does not declare a gap secure before any sampled trajectory gets there', () => {
    const level = testLevel({
      platforms: [
        deck('floor', -2, 10),
        deck('locked', 5, 7, { kind: 'bridge', unlockAfter: 'target' }),
      ],
    })
    const proof = proveSequenceBreakSecurity(level, 'locked', {
      approachRunTicks: 30,
      coyoteWindowTicks: 0,
    })
    expect(proof.secure).toBe(false)
  })
})
