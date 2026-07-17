// ============================================================
// Glass physics — resonance charge, cumulative fatigue, cracks
// and the shatter condition, ticked over synthetic time.
// ============================================================

import { describe, expect, it } from 'vitest'
import { GLASS_CONFIG } from './config'
import type { GlassPhysicsState } from './resonance'
import { initialPhysics, shatterReady, shatterThreshold, startRep, tickPhysics, } from './resonance'

const DT = 1 / 60

/** Tick `seconds` of a constant input. */
function run(
  state: GlassPhysicsState,
  seconds: number,
  offCents: number | null,
  level = 0.6,
): GlassPhysicsState {
  let s = state
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    s = tickPhysics(s, { offCents, level, dt: DT })
  }
  return s
}

describe('tickPhysics', () => {
  it('fills resonance and earns the shatter on a sustained perfect lock', () => {
    let s = initialPhysics()
    s = run(s, 3.5, 0)
    expect(s.resonance).toBeGreaterThan(0.9)
    expect(s.lockRun).toBeGreaterThan(GLASS_CONFIG.resonance.lockForShatterSec)
    expect(shatterReady(s)).toBe(true)
  })

  it('charges slower at the edge of the band than dead-center', () => {
    const center = run(initialPhysics(), 1.5, 0)
    const edge = run(initialPhysics(), 1.5, GLASS_CONFIG.target.tolCents - 1)
    expect(edge.resonance).toBeLessThan(center.resonance)
    expect(edge.resonance).toBeGreaterThan(0)
  })

  it('decays resonance and resets the lock when the singer leaves the band', () => {
    let s = run(initialPhysics(), 2, 0)
    const charged = s.resonance
    s = run(s, 1, 200)
    expect(s.resonance).toBeLessThan(charged)
    expect(s.lockRun).toBe(0)
  })

  it('decays but never damages while unvoiced', () => {
    let s = run(initialPhysics(), 2, 0)
    const fatigueBefore = s.fatigue
    s = run(s, 2, null)
    expect(s.fatigue).toBe(fatigueBefore)
    expect(s.resonance).toBe(0)
  })

  it('accumulates more fatigue from near-misses than from far wandering', () => {
    const near = run(initialPhysics(), 5, 50) // 50¢ off — a real close call
    const far = run(initialPhysics(), 5, 260) // barely inside the stress floor
    expect(near.fatigue).toBeGreaterThan(far.fatigue * 3)
    expect(far.fatigue).toBeGreaterThan(0)
  })

  it('spawns cracks at each fatigue threshold exactly once', () => {
    let s = initialPhysics()
    let spawned = 0
    for (let i = 0; i < 60 * 60; i++) {
      const next = tickPhysics(s, { offCents: 20, level: 0.9, dt: DT })
      spawned += next.crackStep - s.crackStep
      s = next
      if (s.fatigue >= 1) break
    }
    expect(spawned).toBe(GLASS_CONFIG.fatigue.crackSteps.length)
    expect(s.crackStep).toBe(GLASS_CONFIG.fatigue.crackSteps.length)
  })

  it('keeps fatigue across reps while resetting the charge', () => {
    // 10 s of 40¢-off singing: enough stress to cross the first crack step.
    let s = run(initialPhysics(), 10, 40)
    expect(s.fatigue).toBeGreaterThan(0)
    const damage = s.fatigue
    s = startRep(s)
    expect(s.resonance).toBe(0)
    expect(s.lockRun).toBe(0)
    expect(s.fatigue).toBe(damage)
    expect(s.crackStep).toBeGreaterThan(0)
  })

  it('lowers the shatter wall as the glass fatigues — persistence wins', () => {
    expect(shatterThreshold(0)).toBe(1)
    expect(shatterThreshold(1)).toBeCloseTo(1 - GLASS_CONFIG.fatigue.assist)

    // A mediocre singer who can only reach ~0.8 resonance: fresh glass
    // survives, a damaged glass gives way to the same singing.
    const fresh: GlassPhysicsState = {
      resonance: 0.8,
      lockRun: 2,
      fatigue: 0,
      crackStep: 0,
    }
    expect(shatterReady(fresh)).toBe(false)
    expect(shatterReady({ ...fresh, fatigue: 0.8, crackStep: 4 })).toBe(true)
  })
})
