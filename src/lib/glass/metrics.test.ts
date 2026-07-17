// ============================================================
// Glass metrics — per-rep honesty numbers + shatter epicness.
// ============================================================

import { describe, expect, it } from 'vitest'
import { GLASS_CONFIG } from './config'
import { computeEpicness, computeRepMetrics, lockWindowMeanAbs, } from './metrics'
import { sequence, silence, tone } from './test-frames'

const TARGET = 67 // G4

describe('computeRepMetrics', () => {
  it('measures precision, lock and in-band share of a mixed take', () => {
    const frames = sequence(
      (t) => tone(TARGET, 1, { detuneCents: -120, startT: t }), // approach
      (t) => tone(TARGET, 2, { detuneCents: 10, startT: t }), // locked
      (t) => tone(TARGET, 1, { detuneCents: 80, startT: t }), // overshoot
    )
    const m = computeRepMetrics(frames, TARGET, 1, 0.7)
    expect(m.rep).toBe(1)
    expect(m.peakResonance).toBe(0.7)
    // 1s@120 + 2s@10 + 1s@80 → mean 55¢
    expect(m.meanAbsCents).toBeCloseTo(55, 0)
    expect(m.bestLockSec).toBeGreaterThan(1.8)
    expect(m.inBandPct).toBeCloseTo(0.5, 1)
  })

  it('breaks the lock run on an out-of-band excursion', () => {
    const frames = sequence(
      (t) => tone(TARGET, 1, { detuneCents: 0, startT: t }),
      (t) => tone(TARGET, 0.3, { detuneCents: 90, startT: t }),
      (t) => tone(TARGET, 0.8, { detuneCents: 0, startT: t }),
    )
    const m = computeRepMetrics(frames, TARGET, 1, 0)
    expect(m.bestLockSec).toBeLessThan(1.1)
    expect(m.bestLockSec).toBeGreaterThan(0.7)
  })

  it('returns null precision for a fully unvoiced take', () => {
    const m = computeRepMetrics(silence(3), TARGET, 2, 0.1)
    expect(m.meanAbsCents).toBeNull()
    expect(m.bestLockSec).toBe(0)
    expect(m.inBandPct).toBe(0)
  })
})

describe('lockWindowMeanAbs', () => {
  it('averages only the final contiguous in-band run', () => {
    const frames = sequence(
      (t) => tone(TARGET, 1, { detuneCents: 30, startT: t }), // earlier lock
      (t) => tone(TARGET, 0.5, { detuneCents: 120, startT: t }), // break
      (t) => tone(TARGET, 1, { detuneCents: 8, startT: t }), // winning lock
    )
    expect(lockWindowMeanAbs(frames, TARGET)).toBeCloseTo(8, 0)
  })

  it('returns null when the take does not end in band', () => {
    const frames = tone(TARGET, 1, { detuneCents: 200 })
    expect(lockWindowMeanAbs(frames, TARGET)).toBeNull()
  })
})

describe('computeEpicness', () => {
  it('rates a clean first-try lock as maximally cinematic', () => {
    const epic = computeEpicness({
      shatterRep: 1,
      fatigue: 0.05,
      lockMeanAbsCents: 4,
    })
    expect(epic).toBeGreaterThan(0.9)
  })

  it('rates a late fatigue-grind as quick and raw', () => {
    const raw = computeEpicness({
      shatterRep: 5,
      fatigue: 0.85,
      lockMeanAbsCents: 30,
    })
    expect(raw).toBeLessThan(0.2)
  })

  it('is monotonic in lock cleanliness', () => {
    const clean = computeEpicness({
      shatterRep: 2,
      fatigue: 0.3,
      lockMeanAbsCents: 5,
    })
    const sloppy = computeEpicness({
      shatterRep: 2,
      fatigue: 0.3,
      lockMeanAbsCents: 33,
    })
    expect(clean).toBeGreaterThan(sloppy)
  })

  it('treats a missing lock window as edge-of-band cleanliness', () => {
    const fallback = computeEpicness({
      shatterRep: 1,
      fatigue: 0,
      lockMeanAbsCents: null,
    })
    const edge = computeEpicness({
      shatterRep: 1,
      fatigue: 0,
      lockMeanAbsCents: GLASS_CONFIG.target.tolCents,
    })
    expect(fallback).toBe(edge)
  })
})
