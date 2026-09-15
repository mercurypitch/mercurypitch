// Hold tests — real capture timing must determine credit, never render repetition.

import { describe, expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { PitchObservation } from '../contracts'
import { createHoldJudge } from './hold'

const config = GLASSWORKS.breakables[0].hold

function frame(
  n: number,
  overrides: Partial<PitchObservation> = {},
): PitchObservation {
  return {
    sequence: n,
    captureSeconds: n * 0.025,
    capturedAtMs: n * 25,
    midi: 57,
    confidence: 0.9,
    ...overrides,
  }
}

describe('fresh held-note capture', () => {
  it('earns exactly captured time and breaks without vibrato', () => {
    const judge = createHoldJudge(config, 57)
    for (let n = 0; n < 48; n++)
      expect(judge.feed(frame(n), n * 25)).toBe(false)
    expect(judge.feed(frame(48), 1200)).toBe(true)
    expect(judge.charge()).toBeCloseTo(1)
  })

  it('cannot charge by polling one frame, duplicate timestamps or out-of-order samples', () => {
    const judge = createHoldJudge(config, 57)
    judge.feed(frame(10), 250)
    for (let n = 0; n < 100; n++) {
      judge.feed(frame(10), 250)
      judge.feed(frame(9), 250)
      judge.feed(frame(11, { captureSeconds: 0.25 }), 275)
    }
    expect(judge.charge()).toBe(0)
    judge.feed(frame(12), 300)
    expect(judge.charge()).toBeCloseTo(0.05 / 1.2)
  })

  it.each([
    { midi: null },
    { confidence: 0.49 },
    { midi: 69 },
    { midi: NaN },
    { capturedAtMs: -1000 },
    { capturedAtMs: 10000 },
  ])('rejects silence, weak, wrong or stale evidence: %o', (overrides) => {
    const judge = createHoldJudge(config, 57)
    for (let n = 0; n < 100; n++) judge.feed(frame(n, overrides), n * 25)
    expect(judge.charge()).toBe(0)
  })

  it('does not credit a missing capture interval and gently loses charge after a breath', () => {
    const judge = createHoldJudge(config, 57)
    for (let n = 0; n <= 24; n++) judge.feed(frame(n), n * 25)
    expect(judge.charge()).toBeCloseTo(0.5)
    judge.tick(0.15)
    expect(judge.charge()).toBeCloseTo(0.5)
    judge.tick(1)
    expect(judge.charge()).toBeCloseTo(0.25)
    judge.feed(frame(100), 2500)
    // The next callback also accounts for silence since the last visual tick.
    expect(judge.charge()).toBeCloseTo(0.0625)
    judge.feed(frame(101), 2525)
    expect(judge.charge()).toBeGreaterThan(0.0625)
  })

  it('accepts fresh delayed delivery without manufacturing extra duration', () => {
    const judge = createHoldJudge(config, 57)
    for (let n = 0; n <= 24; n++) {
      judge.tick(0.025)
      judge.feed(frame(n), n * 25 + 100)
    }
    expect(judge.charge()).toBeCloseTo(0.5)
  })

  it('does not double-count the rAF interval after fresh audio callbacks between slow frames', () => {
    const judge = createHoldJudge(config, 57)
    for (let n = 0; n <= 48; n++) {
      judge.feed(frame(n), n * 25)
      if (n % 13 === 0) judge.advanceTo(n * 25)
    }
    expect(judge.charge()).toBeCloseTo(1)
  })

  it('decays through silence on capture callbacks even with no render ticks', () => {
    const judge = createHoldJudge(config, 57)
    for (let n = 0; n <= 24; n++) judge.feed(frame(n), n * 25)
    for (let n = 25; n <= 70; n++)
      judge.feed(frame(n, { midi: null, confidence: 0 }), n * 25)
    expect(judge.charge()).toBeCloseTo(0.25)
    judge.advanceTo(1750)
    expect(judge.charge()).toBeCloseTo(0.25)
  })
})
