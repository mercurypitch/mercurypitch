// ============================================================
// Merc in the bay: on the voice, on the path, on the root
// ============================================================

import { describe, expect, it } from 'vitest'
import { STATES } from '@/lib/merc/constants'
import { PLAYHEAD_X, WAVE } from './bay-geometry'
import { ABOVE_CREST_W, MERC_INTRO_X, pitchY, UNDER_ROOT_W } from './bay-layout'
import { INTRO_HUM_LEVEL, introHum, RIDE_STATES, RIDE_TAU_SEC, rideStep, rideTarget, rideX, } from './bay-ride'

describe('where he rides', () => {
  it('follows the voice while it sounds: on the path, under it flat, over it sharp', () => {
    const root = 48
    const onPath = rideTarget(54, 54, root, 12)
    expect(onPath).toBeCloseTo(pitchY(54, root, 12), 9)
    expect(rideTarget(53.5, 54, root, 12)).toBeGreaterThan(onPath)
    expect(rideTarget(54.5, 54, root, 12)).toBeLessThan(onPath)
  })

  it('rides the path while the voice is quiet, and the root in a breath', () => {
    expect(rideTarget(null, 56, 48, 12)).toBeCloseTo(pitchY(56, 48, 12), 9)
    expect(rideTarget(null, null, 48, 12)).toBeCloseTo(WAVE.rootY, 9)
  })

  it('reaches the crest for a narrow voice: the path is the painted wave', () => {
    expect(rideTarget(58, 58, 48, 10)).toBeCloseTo(WAVE.crestY, 3)
  })

  it('stays near the wave however far the voice goes', () => {
    expect(rideTarget(90, 56, 48, 12)).toBeCloseTo(
      WAVE.crestY - ABOVE_CREST_W,
      9,
    )
    expect(rideTarget(20, 56, 48, 12)).toBeCloseTo(WAVE.rootY + UNDER_ROOT_W, 9)
  })
})

describe('his steps', () => {
  it('eases toward the target, most of the way within a few time constants', () => {
    expect(rideStep(1, 0, RIDE_TAU_SEC)).toBeCloseTo(Math.exp(-1), 9)
    expect(rideStep(1, 0, 5 * RIDE_TAU_SEC)).toBeLessThan(0.01)
    expect(rideStep(1, 0, 0)).toBe(1)
  })
})

describe('his states', () => {
  it('buzzes at the intro and rides every wave, sung or quiet', () => {
    expect(RIDE_STATES.intro).toBe('hum')
    expect(RIDE_STATES.waveVoiced).toBe('ride')
    expect(RIDE_STATES.waveQuiet).toBe('ride')
    expect(RIDE_STATES.resultBest).toBe('celebrate')
    for (const state of Object.values(RIDE_STATES)) {
      expect(STATES).toContain(state)
    }
  })

  it('buzzes the first root on his own at the intro', () => {
    expect(introHum(48)).toEqual({
      voiced: true,
      cents: 0,
      level: INTRO_HUM_LEVEL,
      steady: 1,
      midi: 48,
    })
  })
})

describe('his move to the playhead', () => {
  it('starts at the first root and reaches the playhead as the first wave starts', () => {
    expect(rideX(-2.5, 2.5)).toBeCloseTo(MERC_INTRO_X, 9)
    expect(rideX(0, 2.5)).toBe(PLAYHEAD_X)
    expect(rideX(12, 2.5)).toBe(PLAYHEAD_X)
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
})
