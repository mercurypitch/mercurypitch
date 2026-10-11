// ============================================================
// Hold steadiness — realistic takes, scored as the web Long note scores
// ============================================================

import { describe, expect, it } from 'vitest'
import { FPS, midiToF0, silence } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { hzToCents } from '@/lib/pitch-measurements'
import { LANTERN_LEVELS, runHold } from './hold-engine'
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

/**
 * The web Long note's score (use-long-note-controller.ts): 100 less twice
 * the standard deviation of the cents, on the held frames the result keeps
 * (the onset's 0.4 s and the release's 0.2 s trimmed, as the Mirror trims).
 */
function webScore(frames: readonly PitchFrame[]): number {
  const voiced = frames.filter((frame) => frame.f0 > 0)
  const first = voiced[0].t + 0.4
  const last = voiced[voiced.length - 1].t - 0.2
  const cents = voiced
    .filter((frame) => frame.t >= first && frame.t <= last)
    .map((frame) => hzToCents(frame.f0) - TARGET * 100)
  const mean = cents.reduce((sum, c) => sum + c, 0) / cents.length
  const sd = Math.sqrt(
    cents.reduce((sum, c) => sum + (c - mean) ** 2, 0) / cents.length,
  )
  return Math.round(Math.max(0, 100 - 2 * sd))
}

/** 24 s on A3 swinging `depth` cents either side at `hz`, with grain. */
function swing(depth: number, hz: number): PitchFrame[] {
  const grain = realisticTake(TARGET, { seconds: 24, jitterCents: 1, seed: 5 })
  return grain.map((frame) => ({
    ...frame,
    f0: midiToF0(
      TARGET +
        (hzToCents(frame.f0) - TARGET * 100) / 100 +
        (depth * Math.sin(2 * Math.PI * hz * frame.t)) / 100,
    ),
  }))
}

describe('holdSteadiness', () => {
  it('counts a natural vibrato against steadiness, as the web Long note does', () => {
    // Arrange: the same practised singer, straight and with a vibrato
    // whose rate wanders by a quarter hertz and depth by 12%, as a real
    // one does. Round 4 took the vibrato out and scored both 96 to 97.
    const straight = scored({ ...PRACTISED, seed: 11 })

    for (const [hz, depth] of [
      [5.5, 35],
      [6, 60],
    ]) {
      // Act
      const shape = { ...PRACTISED, vibratoHz: hz, vibratoCents: depth }
      const vibrato = scored({ ...shape, seed: 11 })

      // Assert: the swing costs what the web Long note says it costs, to
      // a point (a reading past a semitone counts as a semitone here).
      const web = webScore(realisticTake(TARGET, { ...shape, seed: 11 }))
      expect(Math.abs(vibrato - web)).toBeLessThanOrEqual(1)
      expect(straight - vibrato).toBeGreaterThanOrEqual(40)
    }
    expect(straight).toBeGreaterThanOrEqual(85)
  })

  it('scores 100 less twice the spread of the held note, a wobble, a sway and a drift alike', () => {
    for (const shape of [
      { wanderCents: 25, wanderSeconds: 0.2, jitterCents: 5, seed: 19 },
      { wanderCents: 15, wanderSeconds: 0.2, jitterCents: 4, seed: 18 },
      { wanderCents: 15, wanderSeconds: 0.04, jitterCents: 3, seed: 26 },
      { wanderCents: 15, wanderSeconds: 1, jitterCents: 3, seed: 27 },
      { driftCents: -45, wanderCents: 5, jitterCents: 3, seed: 16 },
    ]) {
      // Arrange
      const frames = realisticTake(TARGET, { seconds: 24, ...shape })

      // Act
      const ours = holdSteadiness(frames, TARGET)?.score ?? -1

      // Assert: to a point, as above.
      expect(Math.abs(ours - webScore(frames))).toBeLessThanOrEqual(1)
    }
  })

  it('costs a fast shake no less than a slow one of the same depth', () => {
    // A median of five over 60 frames a second takes the top off every
    // swing faster than about 6 Hz: round 4 scored a 10 Hz shake of 20 c
    // close to a straight tone, and a 2 Hz one in the seventies.
    for (const depth of [10, 20, 30]) {
      // Act
      const scores = [1.5, 5.5, 10, 12].map(
        (hz) => holdSteadiness(swing(depth, hz), TARGET)?.score ?? -1,
      )

      // Assert: each faster swing costs at least as much as the slower.
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1] + 1)
      }
      expect(scores[3]).toBeLessThanOrEqual(100 - 2 * (depth / Math.SQRT2) + 2)
    }
  })

  it('needs five points over 0.3 s, as the Mirror does', () => {
    const points = (n: number, step: number) =>
      Array.from({ length: n }, (_, i) => ({ t: i * step, cents: 0 }))
    expect(fitSteadiness(points(4, 0.1))).toBeNull()
    expect(fitSteadiness(points(10, 0.02))).toBeNull()
    expect(fitSteadiness(points(10, 0.05))?.score).toBe(100)
  })

  it('reads an octave slip in the live window as no wobble, and a real excursion as one', () => {
    // Two seconds dead on the note, and four frames (67 ms) in the middle
    // an octave off, where the tracker slipped, or 80 c sharp, where the
    // voice went.
    const window = (cents: number): { t: number; cents: number }[] =>
      Array.from({ length: 2 * FPS }, (_, i) => ({
        t: i / FPS,
        cents: i >= 60 && i < 64 ? cents : 0,
      }))
    expect(liveSteadiness(window(1200))).toBe(100)
    expect(liveSteadiness(window(-1200))).toBe(100)
    expect(liveSteadiness(window(80))).toBeLessThan(80)
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

/** The lantern's run of a take at Singer, and what its result scores. */
function lanternRun(frames: PitchFrame[]): { brim: boolean; score: number } {
  const state = runHold(frames, TARGET, LANTERN_LEVELS.singer)
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
