// ============================================================
// Hold steadiness — realistic takes, against the Voice Mirror's score
// ============================================================

import { describe, expect, it } from 'vitest'
import { silence } from '@/lib/glass/test-frames'
import { computeSteadiness } from '@/lib/mirror/metrics'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { HOLD_PRESETS, runHold } from './hold-engine'
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
      TARGET,
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
      const ours = holdSteadiness(frames, TARGET)?.score ?? -1
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

// ── The tracker's octave slip, live and in the result ───────────
//
// Review A of PR 973 (M1), its slip.ts: a steady 26 s take on A3 with the
// tracker's +-3 c grain, and `slip` frames 10 s in read an octave off. The
// detector's own filter passes a run of three, and the median of five
// stops at two. The room clamped the slip and brimmed; the result read it
// at 1200 cents and scored 29.

/** The review's generator: a seeded LCG, so every run is the same take. */
function lcg(seed: number): () => number {
  let x = seed >>> 0
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0
    return x / 2 ** 32
  }
}

/**
 * Half a second of room, 26 s on A3, then a breath. `slip` frames 10 s
 * into the note read an octave `sign` of it; `off` adds cents to the
 * frames from `offFrom` for `offSeconds`, a real stretch off the note.
 */
function slipTake(
  slip: number,
  sign: 1 | -1,
  off: { cents: number; from: number; seconds: number } | null = null,
): PitchFrame[] {
  const next = lcg(9)
  const lead = 0.5
  const seconds = 26
  const at = Math.round((lead + 10) * 60)
  const frames: PitchFrame[] = []
  for (let i = 0; ; i++) {
    const t = i / 60
    if (t > lead + seconds + 0.8) break
    const voiced = t >= lead && t < lead + seconds
    let cents = (next() - 0.5) * 6
    if (i >= at && i < at + slip) cents += 1200 * sign
    if (off !== null && t >= off.from && t < off.from + off.seconds) {
      cents += off.cents
    }
    frames.push({
      t,
      f0: voiced ? 440 * 2 ** ((TARGET + cents / 100 - 69) / 12) : 0,
      conf: voiced ? 0.92 : 0,
      rms: voiced ? 0.05 : 0.001,
    })
  }
  return frames
}

/** The lantern's run of a take, and what its result scores. */
function lanternRun(frames: PitchFrame[]): { brim: boolean; score: number } {
  const state = runHold(frames, TARGET, HOLD_PRESETS.lantern)
  const { score } = computeHoldResult({
    frames,
    state,
    targetMidi: TARGET,
    durationMs: 1,
  })
  return { brim: state.brimReached, score }
}

describe('an octave slip of the tracker', () => {
  it('costs the result no more than it cost the room', () => {
    // Arrange: the clean take brims and scores 99.
    const clean = lanternRun(slipTake(0, 1))
    expect(clean.brim).toBe(true)

    for (const sign of [1, -1] as const) {
      for (const slip of [2, 3, 4]) {
        // Act
        const run = lanternRun(slipTake(slip, sign))

        // Assert: the room brims as before, and the result agrees with it
        // to within a couple of points.
        expect(run.brim).toBe(true)
        expect(Math.abs(run.score - clean.score)).toBeLessThanOrEqual(2)
      }
    }
  })

  it('still costs a real stretch off the note, however far off it goes', () => {
    const clean = lanternRun(slipTake(0, 1)).score
    // A second 60 c sharp, inside the reading's range; a second 300 c
    // sharp, past it; two seconds a semitone and a half flat.
    for (const off of [
      { cents: 60, from: 15, seconds: 1 },
      { cents: 300, from: 15, seconds: 1 },
      { cents: -150, from: 15, seconds: 2 },
    ]) {
      const { score } = lanternRun(slipTake(0, 1, off))
      expect(clean - score).toBeGreaterThanOrEqual(10)
    }
  })
})
