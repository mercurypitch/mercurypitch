// ============================================================
// The demo's voice: wander, vibrato, grain and frames
// ============================================================

import { describe, expect, it } from 'vitest'
import { levelFromRms } from '@/components/room-kit/voice-level'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { FRAME_SECONDS, grainFor, rmsForLevel, silentFrame, vibratoCents, VOICE_STEP, voicedFrame, wanderFor, } from './demo-voice'

const VIBRATO = { hz: 5.5, cents: 14, rampSec: 0.35 } as const

/** Cents of `f0` over `note`. */
const centsOver = (f0: number, note: number): number =>
  1200 * Math.log2(f0 / midiToFrequency(note))

describe('wanderFor', () => {
  it('wanders the same way for the same seed, and another way for another', () => {
    const times = Array.from({ length: 50 }, (_, i) => i * 0.1)

    const a = times.map(wanderFor(0x10ce))
    const again = times.map(wanderFor(0x10ce))
    const other = times.map(wanderFor(0x10cf))

    expect(again).toEqual(a)
    expect(other).not.toEqual(a)
  })

  it('stays within a few cents, and moves slowly', () => {
    const wander = wanderFor(0xec40)
    const values = Array.from({ length: 600 }, (_, i) => wander(i / 60))
    const steps = values.slice(1).map((v, i) => Math.abs(v - values[i]))

    expect(Math.max(...values.map(Math.abs))).toBeLessThanOrEqual(2.6)
    // At most 0.8 Hz over 2.6 cents: well under half a cent a frame.
    expect(Math.max(...steps)).toBeLessThan(0.25)
  })
})

describe('vibratoCents', () => {
  it('is still at the onset and before it', () => {
    // Zero, signed as the sine is at that moment.
    expect(Math.abs(vibratoCents(VIBRATO, 1, 1))).toBe(0)
    expect(Math.abs(vibratoCents(VIBRATO, 0.5, 1))).toBe(0)
  })

  it('grows in over rampSec, then swings its full width', () => {
    const onset = 1
    const half = onset + VIBRATO.rampSec / 2
    const sine = (t: number): number => Math.sin(2 * Math.PI * VIBRATO.hz * t)

    expect(vibratoCents(VIBRATO, half, onset)).toBeCloseTo(
      VIBRATO.cents * 0.5 * sine(half),
      12,
    )
    const grown = Array.from({ length: 400 }, (_, i) => onset + 0.5 + i / 400)
    const widest = Math.max(
      ...grown.map((t) => Math.abs(vibratoCents(VIBRATO, t, onset))),
    )
    expect(widest).toBeLessThanOrEqual(VIBRATO.cents)
    expect(widest).toBeGreaterThan(VIBRATO.cents * 0.99)
  })
})

describe('rmsForLevel', () => {
  it("is levelFromRms's inverse across the voice's loudness", () => {
    for (const level of [0.1, 0.25, 0.5, 0.7, 0.8, 1]) {
      expect(levelFromRms(rmsForLevel(level))).toBeCloseTo(level, 6)
    }
  })
})

describe('grainFor', () => {
  it('is a seeded sequence, within 1.2 cents either side', () => {
    const grain = grainFor(0x1a77)
    const again = grainFor(0x1a77)
    const draws = Array.from({ length: 500 }, () => grain())

    expect(Array.from({ length: 500 }, () => again())).toEqual(draws)
    expect(Math.max(...draws.map(Math.abs))).toBeLessThan(1.2)
    expect(new Set(draws).size).toBe(draws.length)
  })

  it("is seeded apart from the take's wander", () => {
    const grain = grainFor(0x4e40)
    const other = grainFor(0x4e41)

    expect(Array.from({ length: 20 }, () => grain())).not.toEqual(
      Array.from({ length: 20 }, () => other()),
    )
  })
})

describe('the frames', () => {
  it("puts a voiced frame `cents` off its note, at the tracker's confidence", () => {
    const frame = voicedFrame(0.5, 57, 100, 0.8)

    expect(frame.t).toBe(0.5)
    expect(centsOver(frame.f0, 57)).toBeCloseTo(100, 9)
    expect(frame.conf).toBe(0.92)
    expect(frame.rms).toBe(rmsForLevel(0.8))
  })

  it('gives a silent frame no pitch and the quiet floor', () => {
    expect(silentFrame(1.25)).toEqual({ t: 1.25, f0: 0, conf: 0, rms: 0.001 })
  })

  it("runs at the tracker's 60 frames a second, the voice line at 40 points", () => {
    expect(FRAME_SECONDS * 60).toBeCloseTo(1, 12)
    expect(VOICE_STEP * 40).toBeCloseTo(1, 12)
  })
})
