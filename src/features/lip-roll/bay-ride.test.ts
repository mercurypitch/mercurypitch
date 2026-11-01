// ============================================================
// Merc in the bay: on the voice, on the path, on the root
// ============================================================

import { describe, expect, it } from 'vitest'
import { lipRollPath } from '@/lib/glide/glide-path'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import { STATES } from '@/lib/merc/constants'
import { PLAYHEAD_X, WAVE } from './bay-geometry'
import { ABOVE_CREST_W, MERC_INTRO_X, pitchY, UNDER_ROOT_W } from './bay-layout'
import { BUZZ_RIDE_TAU_SEC, INTRO_HUM_LEVEL, introHum, RIDE_STATES, rideFeet, rideTarget, rideX, rideXOn, } from './bay-ride'
import { createBayScroll, holdCamera } from './bay-scroll'

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
  it('stands on the wave the voice follows, and eases its distance from it at a lip roll’s pace', () => {
    // On the path: wherever it goes, so are his feet.
    expect(rideFeet(0, 0.3, 0.3, 1 / 60, BUZZ_RIDE_TAU_SEC)).toEqual({
      offset: 0,
      y: 0.3,
    })
    // Off it: a time constant takes him most of the way.
    const off = rideFeet(0, 0.4, 0.3, BUZZ_RIDE_TAU_SEC, BUZZ_RIDE_TAU_SEC)
    expect(off.y - 0.3).toBeCloseTo(0.1 * (1 - Math.exp(-1)), 9)
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

describe('his place under a held camera (the demo)', () => {
  const path = lipRollPath([48], 12, LIP_ROLL_LEVELS.learning)
  const scroll = createBayScroll(path, 2.8)
  const held = holdCamera(scroll, { from: 1.5, to: 2.95 })

  it('is the playhead on a run: its camera is where the voice is sung', () => {
    for (const t of [-2.8, -1, 0, 2, 5]) {
      expect(rideXOn(scroll, t)).toBeCloseTo(rideX(t, 2.8), 12)
    }
  })

  it('rides on past the playhead as far as the camera stood still', () => {
    expect(rideXOn(held, 1)).toBeCloseTo(PLAYHEAD_X, 12)
    for (const t of [2, 3, 4, 5.2]) {
      expect(rideXOn(held, t)).toBeCloseTo(
        PLAYHEAD_X + scroll.at(t) - held.camera(t),
        12,
      )
    }
    // Down the far side of the wave, on the screen, by its far foot.
    const atEnd = rideXOn(held, path.arches[0].end)
    expect(atEnd).toBeGreaterThan(0.75)
    expect(atEnd).toBeLessThan(0.9)
  })
})
