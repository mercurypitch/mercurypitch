// Angular response regression — turns stay bounded and agree across render cadences.

import { describe, expect, it } from 'vitest'
import { shortestAngleDelta, stepAngularResponse } from './angular-response'

const LIMITS = {
  maximumSpeed: 2.8,
  maximumAcceleration: 14,
  completeRadians: 0.003,
}

function turnFor(fps: number, seconds: number) {
  const state = { angle: 0, velocity: 0 }
  const dt = 1 / fps
  for (let elapsed = 0; elapsed < seconds - dt / 2; elapsed += dt)
    stepAngularResponse(state, Math.PI / 2, dt, LIMITS)
  return state
}

describe('bounded angular response', () => {
  it('matches the same turn at 30, 60 and 120 Hz', () => {
    const thirty = turnFor(30, 0.6)
    const sixty = turnFor(60, 0.6)
    const oneTwenty = turnFor(120, 0.6)

    expect(thirty.angle).toBeCloseTo(sixty.angle, 8)
    expect(oneTwenty.angle).toBeCloseTo(sixty.angle, 8)
    expect(thirty.velocity).toBeCloseTo(sixty.velocity, 8)
    expect(oneTwenty.velocity).toBeCloseTo(sixty.velocity, 8)
  })

  it('ramps into a turn and bounds one delayed frame', () => {
    const state = { angle: 0, velocity: 0 }
    stepAngularResponse(state, Math.PI / 2, 0.05, LIMITS)

    expect(state.angle).toBeGreaterThan(0)
    expect(state.angle).toBeLessThanOrEqual(
      (LIMITS.maximumAcceleration * 0.05 ** 2) / 2 + 1e-8,
    )
    expect(state.velocity).toBeLessThanOrEqual(
      LIMITS.maximumAcceleration * 0.05 + 1e-8,
    )
  })

  it('takes the shortest path through a reversal without overshooting', () => {
    const state = { angle: Math.PI - 0.1, velocity: 0 }
    let previousError = Math.abs(
      shortestAngleDelta(state.angle, -Math.PI + 0.2),
    )
    for (let frame = 0; frame < 240; frame++) {
      stepAngularResponse(state, -Math.PI + 0.2, 1 / 120, LIMITS)
      const error = Math.abs(shortestAngleDelta(state.angle, -Math.PI + 0.2))
      expect(error).toBeLessThanOrEqual(previousError + 1e-8)
      previousError = error
    }
    expect(previousError).toBeLessThan(0.003)
  })
})
