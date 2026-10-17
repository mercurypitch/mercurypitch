// ============================================================
// A demo take in segments: sampling, the tracker, the voice line
// ============================================================

import { describe, expect, it } from 'vitest'
import { midiToFrequency } from '@/lib/frequency-to-note'
import type { DemoSegment } from './demo-segments'
import { eventAt, sampleSegments, segmentTracker, segmentVoice, } from './demo-segments'
import { VOICE_STEP } from './demo-voice'

const VIBRATO = { hz: 5.5, cents: 10, rampSec: 0.3 } as const

/** A breath, a scoop up onto the note, the note held, a drift sharp, a rest. */
const SCRIPT: readonly DemoSegment[] = [
  { kind: 'rest', until: 0.5 },
  { kind: 'sing', until: 0.7, cents: [-40, 0], level: [0.5, 0.8] },
  { kind: 'sing', until: 2, cents: [0, 0], level: [0.8, 0.8] },
  { kind: 'sing', until: 3, cents: [0, 60], level: [0.8, 0.9] },
  { kind: 'rest', until: Number.POSITIVE_INFINITY },
]

/** Cents of `f0` over `note`. */
const centsOver = (f0: number, note: number): number =>
  1200 * Math.log2(f0 / midiToFrequency(note))

describe('sampleSegments', () => {
  it('is silent in a rest and after the script', () => {
    const silent = { cents: 0, level: 0, onset: null }

    expect(sampleSegments(SCRIPT, 0.2)).toEqual(silent)
    expect(sampleSegments(SCRIPT, 5)).toEqual(silent)
    expect(
      sampleSegments(
        [{ kind: 'sing', until: 1, cents: [0, 0], level: [1, 1] }],
        2,
      ),
    ).toEqual(silent)
  })

  it('eases each stretch from its start to its end, smoothly', () => {
    const start = sampleSegments(SCRIPT, 0.5)
    const middle = sampleSegments(SCRIPT, 2.5)
    const quarter = sampleSegments(SCRIPT, 2.25)

    expect(start).toEqual({ cents: -40, level: 0.5, onset: 0.5 })
    expect(middle.cents).toBeCloseTo(30, 12)
    expect(middle.level).toBeCloseTo(0.85, 12)
    // smoothstep(0.25) = 0.15625
    expect(quarter.cents).toBeCloseTo(60 * 0.15625, 12)
  })

  it('dates every stretch of one run of singing from its first', () => {
    expect([0.6, 1.5, 2.9].map((t) => sampleSegments(SCRIPT, t).onset)).toEqual(
      [0.5, 0.5, 0.5],
    )
  })

  it('starts a new run of singing after a rest', () => {
    const twice: readonly DemoSegment[] = [
      { kind: 'sing', until: 1, cents: [0, 0], level: [0.8, 0.8] },
      { kind: 'rest', until: 1.5 },
      { kind: 'sing', until: 3, cents: [0, 0], level: [0.8, 0.8] },
    ]

    expect(sampleSegments(twice, 0.5).onset).toBe(0)
    expect(sampleSegments(twice, 2).onset).toBe(1.5)
  })

  it('holds a stretch with no end at its start', () => {
    const held: readonly DemoSegment[] = [
      { kind: 'rest', until: 1 },
      {
        kind: 'sing',
        until: Number.POSITIVE_INFINITY,
        cents: [-20, 50],
        level: [0.6, 0.9],
      },
    ]

    expect(sampleSegments(held, 30)).toEqual({
      cents: -20,
      level: 0.6,
      onset: 1,
    })
  })
})

describe('segmentTracker', () => {
  it('hears silence in the rests and the note, a few cents off, in the singing', () => {
    const frameAt = segmentTracker(57, 0x10ce, VIBRATO)
    const frames = Array.from({ length: 240 }, (_, i) =>
      frameAt(SCRIPT, i / 60),
    )
    const rests = frames.filter((f) => f.t < 0.5 || f.t >= 3)
    const held = frames.filter((f) => f.t >= 0.8 && f.t < 2)

    expect(rests.every((f) => f.f0 === 0 && f.conf === 0)).toBe(true)
    // The wander (2.6), the vibrato (10) and the grain (1.2) at most.
    for (const frame of held) {
      expect(Math.abs(centsOver(frame.f0, 57))).toBeLessThan(13.8)
      expect(frame.conf).toBe(0.92)
    }
  })

  it('hears a stretch sung at no loudness as silence', () => {
    const frameAt = segmentTracker(57, 0x10ce, VIBRATO)
    const mute: readonly DemoSegment[] = [
      { kind: 'sing', until: 1, cents: [0, 0], level: [0, 0] },
    ]

    expect(frameAt(mute, 0.5)).toEqual({ t: 0.5, f0: 0, conf: 0, rms: 0.001 })
  })

  it('draws its grain only on a voiced frame', () => {
    const early = segmentTracker(57, 0x1a77, VIBRATO)
    const late = segmentTracker(57, 0x1a77, VIBRATO)
    // `early` hears the breath first; `late` comes in on the voice.
    for (let i = 0; i < 30; i++) early(SCRIPT, i / 60)

    const fromEarly = early(SCRIPT, 1)
    const fromLate = late(SCRIPT, 1)

    expect(fromEarly).toEqual(fromLate)
  })

  it('carries the vibrato from each run of singing on', () => {
    const plain = segmentTracker(57, 0xec40, { ...VIBRATO, cents: 0 })
    const sung = segmentTracker(57, 0xec40, VIBRATO)

    for (const t of [0.6, 0.75, 1.1, 1.9]) {
      const gap =
        centsOver(sung(SCRIPT, t).f0, 57) - centsOver(plain(SCRIPT, t).f0, 57)
      const grown = Math.min(1, (t - 0.5) / VIBRATO.rampSec)
      expect(gap).toBeCloseTo(
        VIBRATO.cents * grown * Math.sin(2 * Math.PI * VIBRATO.hz * t),
        6,
      )
    }
  })
})

describe('segmentVoice', () => {
  it("draws the line every VOICE_STEP to the take's length, silent in the rests", () => {
    const points = segmentVoice(SCRIPT, 0x10ce, 3.5, (wall) => wall)

    expect(points).toHaveLength(Math.ceil(3.5 / VOICE_STEP) + 1)
    expect(points[4].t).toBeCloseTo(4 * VOICE_STEP, 12)
    expect(points.filter((p) => p.t < 0.5).every((p) => p.level === 0)).toBe(
      true,
    )
    const held = points.filter((p) => p.t >= 0.8 && p.t < 2)
    expect(held.every((p) => p.level === 0.8 && Math.abs(p.cents) <= 2.6)).toBe(
      true,
    )
  })

  it('reads the script on its own clock, through `engineAt`', () => {
    // Twice as fast: wall 1 s is script 2 s.
    const points = segmentVoice(SCRIPT, 0x10ce, 2, (wall) => wall * 2)
    const at = (t: number) => points.find((p) => Math.abs(p.t - t) < 1e-9)

    expect(at(0.2)?.level).toBe(0)
    expect(at(1.25)?.level).toBeCloseTo(0.8 + 0.1 * 0.5, 12)
  })
})

describe('eventAt', () => {
  const events = [
    { type: 'lock', at: 1.5 },
    { type: 'goal', at: 6 },
    { type: 'lock', at: 9 },
  ] as const

  it('is the first time the event fired', () => {
    expect(eventAt(events, 'lock', 'Long note')).toBe(1.5)
  })

  it('throws, naming the room, when the script never reaches it', () => {
    expect(() =>
      eventAt<'lock' | 'goal' | 'brim'>(events, 'brim', 'Long note'),
    ).toThrow("Long note demo: the script never reaches 'brim'")
  })
})
