// ============================================================
// Hold steadiness — realistic takes, against the Voice Mirror's score
// ============================================================

import { describe, expect, it } from 'vitest'
import { silence } from '@/lib/glass/test-frames'
import { computeSteadiness } from '@/lib/mirror/metrics'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { runHold } from './hold-engine'
import { computeHoldResult } from './hold-metrics'
import { fitSteadiness, holdSteadiness, liveSteadiness, } from './hold-steadiness'
import type { TakeShape } from './test-takes'
import { realisticTake } from './test-takes'

const TARGET = 57

/** One singer: a slow wander and the tracker's jitter. */
const PRACTISED: TakeShape = {
  seconds: 24,
  wanderCents: 4,
  wanderSeconds: 0.4,
  jitterCents: 3,
}

/** A take, released at the end, through the engine and the result. */
function scored(shape: TakeShape): number {
  const take = realisticTake(TARGET, shape)
  const frames: PitchFrame[] = [
    ...take,
    ...silence(0.6, take[take.length - 1].t + 1 / 60),
  ]
  return computeHoldResult({
    frames,
    state: runHold(frames, TARGET),
    targetMidi: TARGET,
    durationMs: 25_000,
  }).score
}

describe('holdSteadiness', () => {
  it('leaves a natural vibrato out of a long hold, its rate breathing', () => {
    // Arrange: the same practised singer, straight and with a vibrato
    // whose rate wanders by a quarter hertz and depth by 12%, as a real
    // one does. One sine over 24 s loses it: the Mirror scored this 68.
    const straight = scored({ ...PRACTISED, seed: 11 })

    for (const [hz, depth] of [
      [5.5, 35],
      [6, 60],
    ]) {
      // Act
      const vibrato = scored({
        ...PRACTISED,
        vibratoHz: hz,
        vibratoCents: depth,
        seed: 11,
      })

      // Assert
      expect(vibrato).toBeGreaterThanOrEqual(93)
      expect(Math.abs(vibrato - straight)).toBeLessThanOrEqual(4)
    }
  })

  it('names the vibrato it took out, at about its rate and depth', () => {
    const steadiness = holdSteadiness(
      realisticTake(TARGET, {
        ...PRACTISED,
        vibratoHz: 5.5,
        vibratoCents: 35,
        seed: 3,
      }),
    )
    expect(steadiness?.vibrato?.rateHz).toBeGreaterThan(5)
    expect(steadiness?.vibrato?.rateHz).toBeLessThan(6)
    // The median of five trims a little off the top of each swing.
    expect(steadiness?.vibrato?.extentCents).toBeGreaterThan(25)
    expect(steadiness?.vibrato?.extentCents).toBeLessThan(40)
  })

  it('scores a wobble, a shake and a sway as the Voice Mirror does', () => {
    // No vibrato in these: whatever the second-by-second fit takes out, it
    // must not be a real unsteadiness.
    for (const shape of [
      { wanderCents: 25, wanderSeconds: 0.2, jitterCents: 5, seed: 19 },
      { wanderCents: 15, wanderSeconds: 0.2, jitterCents: 4, seed: 18 },
      { wanderCents: 15, wanderSeconds: 0.04, jitterCents: 3, seed: 26 },
      { wanderCents: 15, wanderSeconds: 1, jitterCents: 3, seed: 27 },
      { driftCents: -45, wanderCents: 5, jitterCents: 3, seed: 16 },
    ]) {
      const frames = realisticTake(TARGET, { seconds: 24, ...shape })
      const ours = holdSteadiness(frames)?.score ?? -1
      const mirror = computeSteadiness(frames)?.score ?? -1
      expect(Math.abs(ours - mirror)).toBeLessThanOrEqual(1)
    }
    // And the wobbly one stays well down the scale.
    expect(
      scored({ seconds: 24, wanderCents: 25, jitterCents: 5 }),
    ).toBeLessThan(70)
  })

  it('needs five points over 0.3 s, as the Mirror does', () => {
    const points = (n: number, step: number) =>
      Array.from({ length: n }, (_, i) => ({ t: i * step, cents: 0 }))
    expect(fitSteadiness(points(4, 0.1))).toBeNull()
    expect(fitSteadiness(points(10, 0.02))).toBeNull()
    expect(fitSteadiness(points(10, 0.05))?.score).toBe(100)
  })

  it('reads a one-frame octave slip in the live window as no wobble', () => {
    // Two seconds dead on the note, one frame clamped 100 c off.
    const points = Array.from({ length: 120 }, (_, i) => ({
      t: i / 60,
      cents: i === 60 ? 100 : 0,
    }))
    expect(liveSteadiness(points)).toBe(100)
    expect(fitSteadiness(points)?.score).toBeLessThan(100)
  })
})
