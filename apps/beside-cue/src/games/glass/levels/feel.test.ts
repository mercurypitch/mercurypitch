import { describe, expect, it } from 'vitest'
import { JOURNEY_CONFIG } from '../journey-config'
import { compileLevel } from './compile'
import { applyFeel } from './feel'
import { ODE_TO_JOY } from './ode-to-joy'

describe('applyFeel', () => {
  it('returns the defaults untouched when a level has no overlay', () => {
    expect(applyFeel(undefined)).toBe(JOURNEY_CONFIG)
  })

  it('merges leaves and keeps sibling defaults', () => {
    const feel = applyFeel({ land: { bandSemis: 0.9 } })
    expect(feel.land.bandSemis).toBe(0.9)
    expect(feel.land.dwellMs).toBe(JOURNEY_CONFIG.land.dwellMs)
    // untouched sections share the default object
    expect(feel.voice).toBe(JOURNEY_CONFIG.voice)
  })

  it('never mutates the defaults', () => {
    applyFeel({ land: { bandSemis: 0.9 }, fall: { catchable: false } })
    expect(JOURNEY_CONFIG.land.bandSemis).toBe(0.6)
    expect(JOURNEY_CONFIG.fall.catchable).toBe(true)
  })

  it('replaces arrays wholesale', () => {
    const feel = applyFeel({ bridge: { stepOffsets: [2, 4] } })
    expect(feel.bridge.stepOffsets).toEqual([2, 4])
    expect(feel.bridge.humSeconds).toBe(JOURNEY_CONFIG.bridge.humSeconds)
  })

  it('reaches nested per-mode pacing knobs', () => {
    const feel = applyFeel({ melody: { noteGap: { flow: 0.9 } } })
    expect(feel.melody.noteGap.flow).toBe(0.9)
    expect(feel.melody.noteGap.rhythm).toBe(
      JOURNEY_CONFIG.melody.noteGap.rhythm,
    )
  })

  it('compileLevel honors overlaid pacing', () => {
    const feel = applyFeel({ melody: { minWidth: 2.4 } })
    const cs = compileLevel(ODE_TO_JOY, { mode: 'flow', groundMidi: 57, feel })
    for (const p of cs.platforms) {
      expect(p.x1 - p.x0).toBeGreaterThanOrEqual(2.4 - 1e-9)
    }
  })
})
