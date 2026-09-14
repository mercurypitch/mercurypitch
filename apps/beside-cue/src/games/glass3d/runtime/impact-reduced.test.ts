// The break under prefers-reduced-motion (P6), as the timeline sees it.
// The stage's half -- the taps sent, no refit, the shards' clock doubled
// -- is render/stage-impact.test.ts.

import { describe, expect, it } from 'vitest'
import { WORLD3D_CONFIG } from '../world3d-config'
import type { ImpactConfig } from './impact'
import { burstAt, presentTimeAt, reducedImpact, shakeAt, tapsBetween, timeScaleAt, } from './impact'

const CFG: ImpactConfig = WORLD3D_CONFIG.impact
const R = reducedImpact(CFG)
const moments = Array.from({ length: 151 }, (_, i) => i / 100)

describe('reducedImpact', () => {
  it('plays the break at the speed it happens: no hitstop, no slow motion', () => {
    for (const t of moments) {
      expect(timeScaleAt(t, R)).toBe(1)
      expect(presentTimeAt(t, R)).toBeCloseTo(t, 12)
    }
  })

  it('never shakes and never steps the pixel ratio', () => {
    for (const t of moments) {
      expect(shakeAt(t, R)).toEqual({ yaw: 0, pitch: 0, roll: 0 })
      expect(burstAt(t, R)).toBe(false)
    }
  })

  it('keeps the taps exactly where they were', () => {
    expect(tapsBetween(-1, 2, R)).toEqual(tapsBetween(-1, 2, CFG))
    expect(tapsBetween(-1, 2, R)).toEqual(['heavy', 'light', 'light', 'light'])
  })

  // The dials hold the full break; the reduced one is derived from them
  // every frame, never written back.
  it('leaves the config it was given alone', () => {
    expect(CFG.hitstopSeconds).toBe(0.1)
    expect(CFG.shakeSeconds).toBe(0.4)
    expect(CFG.burstSeconds).toBe(1.2)
  })
})
