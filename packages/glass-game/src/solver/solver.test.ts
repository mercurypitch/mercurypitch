// Integration test for the reachability & sequence-break solver suite.

import { describe, expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { BREAKABLE_INTERACTION_RADIUS } from '../core/exhibit-interaction'
import { proveReachability } from './reachability-prover'
import { proveSequenceBreakSecurity } from './sequence-break-prover'
import { StateLattice } from './state-lattice'

describe('Glassworks reachability and sequence-break solver', () => {
  it('deduplicates spatial positions within lattice bins', () => {
    const lattice = new StateLattice(0.10, 0.05)
    const playerA = {
      position: { x: 1.02, y: 0.01, z: 2.01 },
      velocity: { x: 0.5, y: 0, z: 0 },
      grounded: true,
      facingYaw: 0,
    }
    const playerB = {
      position: { x: 1.04, y: 0.02, z: 2.03 }, // within 10cm horizontal, 5cm vertical
      velocity: { x: 0.6, y: 0, z: 0 }, // same velocity sign
      grounded: true,
      facingYaw: 0,
    }
    const playerC = {
      position: { x: 1.35, y: 0.01, z: 2.01 }, // outside horizontal bin (> 10cm away)
      velocity: { x: 0.5, y: 0, z: 0 },
      grounded: true,
      facingYaw: 0,
    }

    expect(lattice.add(playerA, ['solid-1'])).toBe(true)
    expect(lattice.add(playerB, ['solid-1'])).toBe(false) // duplicate bin
    expect(lattice.add(playerC, ['solid-1'])).toBe(true) // distinct bin
    expect(lattice.size).toBe(2)
  })

  it('proves that the arrival exhibit (goblet) is physically reachable from spawn', () => {
    const goblet = GLASSWORKS.breakables[0]
    expect(goblet.id).toBe('glassworks.first-goblet')

    const proof = proveReachability(
      GLASSWORKS,
      {
        id: goblet.id,
        label: goblet.label,
        anchor: goblet.anchor,
        interactionRadius: BREAKABLE_INTERACTION_RADIUS,
      },
      {
        maxFrontierExpansions: 2000,
        macroTickDuration: 12,
      },
    )

    expect(proof.reachable).toBe(true)
    expect(proof.elapsedSeconds).toBeDefined()
    expect(proof.elapsedSeconds!).toBeGreaterThan(0)
    expect(proof.witnessInputSequence).toBeDefined()
    expect(proof.witnessInputSequence!.length).toBeGreaterThan(0)
  })

  it('proves that the locked arch-bridge gap is mathematically secure against sequence-break skips', () => {
    const proof = proveSequenceBreakSecurity(GLASSWORKS, 'arch-bridge', {
      approachRunTicks: 30,
      coyoteWindowTicks: 12,
    })

    // The gap across arch-bridge is 1.9m, while max jump reach is < 1.2m
    expect(proof.gapWidthMetres).toBeCloseTo(1.9, 1)
    expect(proof.secure).toBe(true)
    expect(proof.clearanceMarginMetres).toBeLessThan(0)
    expect(proof.exploitWitnessSequence).toBeUndefined()
  })
})
