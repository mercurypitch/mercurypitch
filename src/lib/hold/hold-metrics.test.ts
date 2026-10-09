// ============================================================
// Hold metrics — run results from synthetic pitch tracks
// ============================================================
//
// Frames are 60 fps PitchFrames on the target A3 (MIDI 57). The first frame
// carries dt 0, so a run of N voiced frames spans (N - 1) / 60 seconds.

import { describe, expect, it } from 'vitest'
import { FPS, midiToF0, sequence, silence, tone } from '@/lib/glass/test-frames'
import { computeSteadiness } from '@/lib/mirror/metrics'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { runHold } from './hold-engine'
import { computeHoldResult } from './hold-metrics'

const TARGET = 57

/** A voiced track whose cents offset from TARGET follows `cents(t)`. */
function track(
  seconds: number,
  cents: (t: number) => number,
): (startT: number) => PitchFrame[] {
  return (startT) =>
    Array.from({ length: Math.round(seconds * FPS) }, (_, i) => ({
      t: startT + i / FPS,
      f0: midiToF0(TARGET + cents(i / FPS) / 100),
      conf: 0.9,
      rms: 0.6,
    }))
}

const held = (seconds: number) => (t: number) =>
  tone(TARGET, seconds, { startT: t })
const rest = (seconds: number) => (t: number) => silence(seconds, t)

function result(frames: PitchFrame[], durationMs = 8000) {
  return computeHoldResult({
    frames,
    state: runHold(frames, TARGET),
    targetMidi: TARGET,
    durationMs,
  })
}

describe('computeHoldResult', () => {
  it('scores a clean five-second hold at full steadiness with exact counts', () => {
    // Arrange
    const frames = sequence(held(5), rest(0.5))

    // Act
    const run = result(frames, 6200)

    // Assert
    expect(run).toMatchObject({ score: 100, locked: true })
    expect(run.metrics).toEqual({
      inBandSeconds: 4.983,
      holdSeconds: 4.983,
      longestLockSeconds: 4.983,
      timeToLockMs: 0,
      breaks: 0,
      targetMidi: 57,
      durationMs: 6200,
    })
  })

  it('times the scoop into the note and leaves it out of steadiness', () => {
    // Arrange: 0.8 s glide up from 300 cents flat, then 4 s on the note.
    // The centre (clamped to -100) first reads in band on frame 49, the
    // second frame on the note, so the band entry is frame 48's clock:
    // 800 ms. The note ends on frame 287: 287/60 - 48/60 = 3.983 s held.
    const glide = track(0.8, (t) => -300 + 375 * t)
    const frames = sequence(glide, held(4), rest(0.5))

    // Act
    const run = result(frames)
    const wholeTake = computeSteadiness(frames)

    // Assert
    expect(run.metrics.timeToLockMs).toBe(800)
    expect(run.metrics.holdSeconds).toBe(3.983)
    expect(run.score).toBe(100)
    expect(wholeTake?.score).toBeLessThan(100)
  })

  it('keeps a 5.5 Hz, +-40 cent vibrato locked and scores it as steady', () => {
    // Arrange
    const vibrato = track(6, (t) => 40 * Math.sin(2 * Math.PI * 5.5 * t))
    const frames = sequence(vibrato, rest(0.5))

    // Act
    const run = result(frames)

    // Assert
    expect(run.metrics.breaks).toBe(0)
    expect(run.metrics.longestLockSeconds).toBe(5.983)
    // The Mirror's 5-frame median filter trims the measured extent to 35 c.
    expect(run.steadiness?.vibrato).toEqual({ rateHz: 5.5, extentCents: 35 })
    // What survives the sinusoid fit is about 3 c of wobble: 98, not 100.
    expect(run.score).toBe(98)
  })

  it('stays locked through a slow wobble but scores it lower', () => {
    // Arrange: 1.3 Hz +-20 c plus 2.1 Hz +-15 c, below the vibrato band.
    // Residual SD about sqrt(20^2/2 + 15^2/2) = 17.7 c before the median
    // filter, so the Mirror's piecewise score lands in the 70s.
    const wobble = track(
      6,
      (t) =>
        20 * Math.sin(2 * Math.PI * 1.3 * t) +
        15 * Math.sin(2 * Math.PI * 2.1 * t),
    )
    const frames = sequence(wobble, rest(0.5))

    // Act
    const run = result(frames)

    // Assert
    expect(run.metrics.breaks).toBe(0)
    expect(run.metrics.inBandSeconds).toBe(5.983)
    expect(run.steadiness?.vibrato).toBeNull()
    expect(run.score).toBe(76)
  })

  it('counts no break for a 150 ms dropout and one for a 250 ms dropout', () => {
    // Arrange
    const short = sequence(held(2), rest(0.15), held(2), rest(0.5))
    const long = sequence(held(2), rest(0.25), held(2), rest(0.5))

    // Act
    const shortRun = result(short)
    const longRun = result(long)

    // Assert
    expect(shortRun.metrics.breaks).toBe(0)
    expect(shortRun.metrics.longestLockSeconds).toBe(4.133)
    expect(longRun.metrics.breaks).toBe(1)
    // The second lock: 120 frames, the first one back carrying dt 1/60.
    expect(longRun.metrics.longestLockSeconds).toBe(2)
  })

  it('shrugs off a two-frame octave flicker in counts and steadiness', () => {
    // Arrange
    const flicker = (t: number) => [
      ...tone(TARGET + 12, 2 / FPS, { startT: t }),
    ]
    const frames = sequence(held(2), flicker, held(2), rest(0.5))

    // Act
    const run = result(frames)

    // Assert
    expect(run.metrics).toMatchObject({
      breaks: 0,
      inBandSeconds: 4.017,
      longestLockSeconds: 4.017,
    })
    expect(run.score).toBe(100)
  })

  it('measures a run the room stopped mid-note up to the last voiced frame', () => {
    // Arrange
    const frames = held(3)(0)

    // Act
    const run = result(frames)

    // Assert
    expect(run.metrics.holdSeconds).toBe(2.983)
  })

  it('reports a never-locked run with no time to lock and a zero score', () => {
    // Arrange: 80 cents sharp the whole time.
    const frames = sequence(
      (t) => tone(TARGET, 2, { detuneCents: 80, startT: t }),
      rest(0.5),
    )

    // Act
    const run = result(frames, 2500)

    // Assert
    expect(run).toMatchObject({ score: 0, locked: false, steadiness: null })
    expect(run.metrics).toEqual({
      inBandSeconds: 0,
      holdSeconds: 0,
      longestLockSeconds: 0,
      breaks: 0,
      targetMidi: 57,
      durationMs: 2500,
    })
  })

  it('drops straight into the history store metrics type', () => {
    // Arrange
    const run = result(sequence(held(1), rest(0.5)))

    // Act
    const metrics: Record<string, number> = run.metrics

    // Assert
    expect(Object.values(metrics).every(Number.isFinite)).toBe(true)
  })
})
