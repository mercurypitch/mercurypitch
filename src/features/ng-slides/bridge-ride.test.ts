// ============================================================
// Merc on the bridge: on the voice, on the path, on the stone
// ============================================================

import { describe, expect, it } from 'vitest'
import { STATES } from '@/lib/merc/constants'
import { ARCH } from './bridge-geometry'
import { pitchY } from './bridge-layout'
import { RIDE_STATES, RIDE_TAU_SEC, rideStep, rideTarget } from './bridge-ride'

describe('where his feet go', () => {
  it('follows the voice while it sounds: on the line, under it flat, over it sharp', () => {
    const root = 45
    const onLine = rideTarget(48, 48, root)
    expect(onLine).toBeCloseTo(pitchY(48, root), 9)
    expect(rideTarget(47.5, 48, root)).toBeGreaterThan(onLine)
    expect(rideTarget(48.5, 48, root)).toBeLessThan(onLine)
  })

  it('walks the path while the voice is quiet, and the stone in a breath', () => {
    expect(rideTarget(null, 50, 45)).toBeCloseTo(pitchY(50, 45), 9)
    expect(rideTarget(null, null, 45)).toBeCloseTo(ARCH.deckY, 9)
  })

  it('stays near the bridge however far the voice goes', () => {
    expect(rideTarget(70, 50, 45)).toBeGreaterThan(ARCH.apexY - 0.13)
    expect(rideTarget(20, 50, 45)).toBeLessThan(ARCH.deckY + 0.09)
  })
})

describe('his steps', () => {
  it('eases toward the target, most of the way within a few time constants', () => {
    const y = rideStep(1, 0, RIDE_TAU_SEC)
    expect(y).toBeCloseTo(Math.exp(-1), 9)
    expect(rideStep(1, 0, 5 * RIDE_TAU_SEC)).toBeLessThan(0.01)
    expect(rideStep(1, 0, 0)).toBe(1)
  })
})

describe('his states', () => {
  it('uses only states he already has (hum and ride are PR 8)', () => {
    for (const state of Object.values(RIDE_STATES)) {
      expect(STATES).toContain(state)
    }
  })
})
