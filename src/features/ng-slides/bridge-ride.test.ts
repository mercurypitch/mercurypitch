// ============================================================
// Merc on the bridge: on the voice, on the path, on the stone
// ============================================================

import { describe, expect, it } from 'vitest'
import { STATES } from '@/lib/merc/constants'
import { ARCH, PLAYHEAD_X } from './bridge-geometry'
import { MERC_INTRO_X, pitchY } from './bridge-layout'
import { INTRO_HUM_LEVEL, introHum, RIDE_STATES, RIDE_TAU_SEC, rideStep, rideTarget, rideX, } from './bridge-ride'

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
  it('hums at the intro and rides every slide, sung or quiet', () => {
    expect(RIDE_STATES.intro).toBe('hum')
    expect(RIDE_STATES.slideVoiced).toBe('ride')
    expect(RIDE_STATES.slideQuiet).toBe('ride')
    for (const state of Object.values(RIDE_STATES)) {
      expect(STATES).toContain(state)
    }
  })

  it('hums the first root on his own at the intro, so his rings show', () => {
    expect(introHum(43)).toEqual({
      voiced: true,
      cents: 0,
      level: INTRO_HUM_LEVEL,
      steady: 1,
      midi: 43,
    })
  })
})

describe('his walk to the playhead', () => {
  it('starts on the pier and ends at the playhead as the first slide starts', () => {
    expect(rideX(-1.7, 1.7)).toBeCloseTo(MERC_INTRO_X, 9)
    expect(rideX(0, 1.7)).toBe(PLAYHEAD_X)
    expect(rideX(12, 1.7)).toBe(PLAYHEAD_X)
  })

  it('moves one way only, and gently at both ends', () => {
    let last = rideX(-2, 2)
    for (let t = -2; t <= 0; t += 0.05) {
      const x = rideX(t, 2)
      expect(x).toBeGreaterThanOrEqual(last - 1e-12)
      last = x
    }
    expect(rideX(-1.95, 2) - rideX(-2, 2)).toBeLessThan(0.002)
    expect(rideX(-1, 2)).toBeCloseTo((MERC_INTRO_X + PLAYHEAD_X) / 2, 9)
  })

  it('stays at the playhead when there is no count-in', () => {
    expect(rideX(-0.5, 0)).toBe(PLAYHEAD_X)
  })
})
