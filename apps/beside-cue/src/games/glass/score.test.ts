import { describe, expect, it } from 'vitest'
import type { ScoreConfig } from './score'
import { computeRunScore, emptyTally, qualityFromCents, qualityFromOffset, } from './score'

const S: ScoreConfig = {
  passPct: 75,
  greatPct: 90,
  centsPerfect: 10,
  centsZero: 70,
  fallPenaltyPct: 4,
  listenWrongPenalty: 0.5,
}

describe('qualityFromCents', () => {
  it('maps the perfect-to-zero band linearly', () => {
    expect(qualityFromCents(10, S)).toBe(1)
    expect(qualityFromCents(5, S)).toBe(1)
    expect(qualityFromCents(70, S)).toBe(0)
    expect(qualityFromCents(120, S)).toBe(0)
    expect(qualityFromCents(40, S)).toBeCloseTo(0.5)
  })
})

describe('qualityFromOffset', () => {
  it('is 1 on the beat, 0 at the window edge, sign-blind', () => {
    expect(qualityFromOffset(0, 200)).toBe(1)
    expect(qualityFromOffset(200, 200)).toBe(0)
    expect(qualityFromOffset(-100, 200)).toBeCloseTo(0.5)
    expect(qualityFromOffset(400, 200)).toBe(0)
  })
})

describe('computeRunScore', () => {
  it('returns null when nothing was scoreable', () => {
    expect(computeRunScore('flow', emptyTally(), S)).toBeNull()
  })

  it('sung: averages note quality, charges falls, reports cents', () => {
    const t = emptyTally()
    t.quality.set(1, 1)
    t.quality.set(2, 0.8)
    t.quality.set(3, 0.6)
    t.centsMeans.push(8, 22, 34)
    t.falls = 2
    const sc = computeRunScore('flow', t, S)
    expect(sc).not.toBeNull()
    // mean 0.8 -> 80, minus 2 falls * 4
    expect(sc?.pct).toBe(72)
    expect(sc?.passed).toBe(false)
    expect(sc?.detail).toBe('about 21¢ off target, fell 2×')
  })

  it('sung: a clean run passes and the fall clause disappears', () => {
    const t = emptyTally()
    t.quality.set(1, 0.9)
    t.quality.set(2, 0.9)
    t.centsMeans.push(15, 15)
    const sc = computeRunScore('platformer', t, S)
    expect(sc?.pct).toBe(90)
    expect(sc?.passed).toBe(true)
    expect(sc?.great).toBe(true)
    expect(sc?.detail).toBe('about 15¢ off target')
  })

  it('rhythm: median of absolute offsets, misses called out', () => {
    const t = emptyTally()
    t.quality.set(1, 0.9)
    t.quality.set(2, 0.7)
    t.quality.set(3, 0)
    t.offsetsMs.push(20, -40)
    const sc = computeRunScore('rhythm', t, S)
    expect(sc?.detail).toBe('median 30 ms off the beat, 1 missed')
    expect(sc?.pct).toBe(53)
  })

  it('rhythm: an all-miss run still produces a line', () => {
    const t = emptyTally()
    t.quality.set(1, 0)
    const sc = computeRunScore('rhythm', t, S)
    expect(sc?.pct).toBe(0)
    expect(sc?.detail).toBe('1 missed')
  })

  it('listen: counts first-try answers', () => {
    const t = emptyTally()
    t.quality.set(1, 1)
    t.quality.set(2, 1)
    t.quality.set(3, 0.5)
    const sc = computeRunScore('listen', t, S)
    expect(sc?.detail).toBe('2 of 3 first-try')
    expect(sc?.pct).toBe(83)
    expect(sc?.passed).toBe(true)
  })

  it('clamps the pct floor at zero under heavy fall penalties', () => {
    const t = emptyTally()
    t.quality.set(1, 0.1)
    t.centsMeans.push(65)
    t.falls = 10
    expect(computeRunScore('flow', t, S)?.pct).toBe(0)
  })
})
