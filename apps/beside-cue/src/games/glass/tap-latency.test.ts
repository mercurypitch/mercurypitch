import { describe, expect, it } from 'vitest'
import { computeTapLatency, tapOffsets } from './tap-latency'

const BEAT = 60 / 90 // 90 bpm, seconds

describe('tapOffsets', () => {
  it('measures signed offsets against the nearest tick', () => {
    const t0 = 1.2
    const taps = [t0 + 0.06, t0 + BEAT - 0.04, t0 + 2 * BEAT + 0.05]
    const offs = tapOffsets(taps, t0, BEAT, 0.45)
    expect(offs.map((o) => Math.round(o))).toEqual([60, -40, 50])
  })

  it('drops wild taps instead of averaging them in', () => {
    const t0 = 0
    // one honest tap, one knock exactly between beats
    const offs = tapOffsets([t0 + 0.05, t0 + BEAT / 2], t0, BEAT, 0.45)
    expect(offs).toHaveLength(1)
  })
})

describe('computeTapLatency', () => {
  const OPTS = { minTaps: 8, maxOffFrac: 0.45, clampMs: 400 }

  it('returns the median offset over a full run', () => {
    const t0 = 2
    const taps = Array.from({ length: 10 }, (_, i) => t0 + i * BEAT + 0.063)
    const lat = computeTapLatency(taps, t0, BEAT, OPTS)
    expect(lat).not.toBeNull()
    expect(lat?.offsetMs).toBe(63)
    expect(lat?.taps).toBe(10)
  })

  it('is robust to a few wild taps', () => {
    const t0 = 0
    const good = Array.from({ length: 9 }, (_, i) => t0 + i * BEAT + 0.04)
    const wild = [t0 + 3.5 * BEAT, t0 + 5.5 * BEAT]
    const lat = computeTapLatency([...good, ...wild], t0, BEAT, OPTS)
    expect(lat?.offsetMs).toBe(40)
    expect(lat?.taps).toBe(9)
  })

  it('too few on-grid taps = no measurement', () => {
    const t0 = 0
    const taps = Array.from({ length: 5 }, (_, i) => t0 + i * BEAT + 0.02)
    expect(computeTapLatency(taps, t0, BEAT, OPTS)).toBeNull()
  })

  it('clamps a pathological median', () => {
    const t0 = 0
    const beat = 2 // slow grid so a huge offset stays "on grid"
    const taps = Array.from({ length: 8 }, (_, i) => t0 + i * beat + 0.8)
    const lat = computeTapLatency(taps, t0, beat, OPTS)
    expect(lat?.offsetMs).toBe(400)
  })

  it('early tappers get a negative offset', () => {
    const t0 = 1
    const taps = Array.from({ length: 8 }, (_, i) => t0 + i * BEAT - 0.03)
    expect(computeTapLatency(taps, t0, BEAT, OPTS)?.offsetMs).toBe(-30)
  })
})
