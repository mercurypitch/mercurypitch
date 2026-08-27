import { describe, expect, it } from 'vitest'
import { createTapLedger, nearestBeatDeviation, summariseTaps, } from './tap-input'

describe('tap ledger', () => {
  it('measures taps from the origin with the round trip subtracted', () => {
    const ledger = createTapLedger({ latencyMs: () => 80 })
    ledger.tap(1000) // unarmed: ignored
    ledger.arm(1000)
    ledger.tap(1690)
    ledger.tap(2310)
    expect(ledger.taps()).toEqual([610, 1230])
    expect(ledger.armed()).toBe(true)
    ledger.disarm()
    ledger.tap(3000)
    expect(ledger.taps()).toEqual([610, 1230])
  })

  it('subtracts nothing while the round trip is unmeasured', () => {
    const ledger = createTapLedger({ latencyMs: () => 0 })
    ledger.arm(500)
    ledger.tap(1100)
    expect(ledger.taps()).toEqual([600])
  })

  it('re-arming starts a fresh take', () => {
    const ledger = createTapLedger({ latencyMs: () => 0 })
    ledger.arm(0)
    ledger.tap(10)
    ledger.arm(100)
    expect(ledger.taps()).toEqual([])
  })
})

describe('nearestBeatDeviation', () => {
  it('signs early taps negative and late taps positive', () => {
    const beats = [0, 600, 1200]
    expect(nearestBeatDeviation(580, beats)).toBe(-20)
    expect(nearestBeatDeviation(1235, beats)).toBe(35)
    expect(nearestBeatDeviation(300, beats)).toBe(300)
    expect(nearestBeatDeviation(300, [])).toBeNull()
  })
})

describe('summariseTaps', () => {
  it('reports mean and spread over the taps that found a beat', () => {
    const beats = [0, 600, 1200, 1800]
    const summary = summariseTaps([-10, 590, 1230, 5000], beats, 150)
    expect(summary).not.toBeNull()
    expect(summary?.matched).toBe(3)
    expect(summary?.meanMs).toBeCloseTo((-10 - 10 + 30) / 3, 5)
    expect(summary?.spreadMs).toBeCloseTo(18.856, 2)
  })

  it('is null when no tap lands inside the window', () => {
    expect(summariseTaps([300], [0, 600], 100)).toBeNull()
    expect(summariseTaps([], [0, 600], 100)).toBeNull()
  })
})
