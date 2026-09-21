// Wave judge regressions — real capture timing, false positives and interrupted gestures.

import { describe, expect, it } from 'vitest'
import type { HoldDefinition, PitchObservation } from '../contracts'
import type { PitchWaveDefinition } from '../pitch-wave'
import { createWaveJudge } from './wave'

const EVIDENCE: HoldDefinition = {
  requiredSeconds: 1,
  toleranceCents: 100,
  confidenceFloor: 0.5,
  dropoutGraceSeconds: 0.15,
  decayPerSecond: 0.25,
  maximumSampleGapSeconds: 0.1,
  maximumSampleAgeMs: 150,
}
const WAVE: PitchWaveDefinition = {
  requiredCycles: 2,
  minimumExcursionCents: 35,
  maximumExcursionCents: 180,
  minimumCycleSeconds: 0.3,
  maximumCycleSeconds: 2.5,
  minimumWaveSeconds: 1.2,
  maximumCentsPerSecond: 2400,
  smoothingSeconds: 0.045,
}

function observation(
  sequence: number,
  seconds: number,
  cents: number | null,
): PitchObservation {
  return {
    sequence,
    captureSeconds: seconds,
    capturedAtMs: seconds * 1000,
    midi: cents === null ? null : 57 + cents / 100,
    confidence: 0.9,
  }
}

function glide(
  seconds: number,
  anchors: ReadonlyArray<readonly [seconds: number, cents: number]>,
): number {
  const after = anchors.findIndex(([at]) => at >= seconds)
  if (after <= 0) return anchors[Math.max(0, after)]?.[1] ?? 0
  const [fromTime, fromCents] = anchors[after - 1]
  const [toTime, toCents] = anchors[after]
  const mix = (seconds - fromTime) / (toTime - fromTime)
  return fromCents + (toCents - fromCents) * mix
}

describe('capture-clock pitch waves', () => {
  it.each([0.02, 0.04, 0.075])(
    'accepts the demo gesture of two centre-started cycles and a centre return at %s-second sampling',
    (step) => {
      const judge = createWaveJudge(WAVE, EVIDENCE, 57)
      let finishedAt = Infinity
      for (let i = 0; i <= Math.ceil(2.2 / step); i++) {
        const t = i * step
        const cents = t <= 2 ? 70 * Math.sin(2 * Math.PI * t) : 0
        if (judge.feed(observation(i, t, cents), t * 1000)) {
          finishedAt = t
          break
        }
      }
      expect(finishedAt).toBeGreaterThanOrEqual(1.9)
      expect(finishedAt).toBeLessThanOrEqual(2.2)
      expect(judge.charge()).toBe(1)
    },
  )

  it('accepts two deliberate whole-tone cycles through a brief detector dropout and latches on the fresh return to the centre band', () => {
    const judge = createWaveJudge(
      { ...WAVE, maximumExcursionCents: 225 },
      EVIDENCE,
      57,
    )
    const anchors = [
      [0, 0],
      [0.35, 200],
      [0.7, 0],
      [1.05, -200],
      [1.4, 0],
      [1.75, 200],
      [2.1, 0],
      [2.45, -200],
      [2.8, 0],
    ] as const
    let completedAt = Infinity
    for (let sequence = 0; sequence <= 112; sequence++) {
      const seconds = sequence * 0.025
      const cents =
        sequence === 52 || sequence === 53 ? null : glide(seconds, anchors)
      if (judge.feed(observation(sequence, seconds, cents), seconds * 1000)) {
        completedAt = seconds
        break
      }
    }
    expect(completedAt).toBeGreaterThanOrEqual(2.75)
    expect(completedAt).toBeLessThanOrEqual(2.8)
    expect(judge.charge()).toBe(1)
    expect(judge.feed(observation(113, 2.825, null), 2825)).toBe(true)
    expect(judge.charge()).toBe(1)
  })

  it('does not invent voiced gesture time across a tolerated detector dropout', () => {
    const judge = createWaveJudge(
      {
        ...WAVE,
        requiredCycles: 1,
        minimumCycleSeconds: 0.2,
        minimumWaveSeconds: 0.25,
      },
      EVIDENCE,
      57,
    )
    expect(judge.feed(observation(0, 0, 70), 0)).toBe(false)
    expect(judge.feed(observation(1, 0.1, 0), 100)).toBe(false)
    expect(judge.feed(observation(2, 0.125, null), 125)).toBe(false)
    expect(judge.feed(observation(3, 0.2, -70), 200)).toBe(false)
    expect(judge.feed(observation(4, 0.3, 0), 300)).toBe(false)
    expect(judge.charge()).toBe(0)
  })

  it('does not accept one centre-started cycle', () => {
    const judge = createWaveJudge(WAVE, EVIDENCE, 57)
    for (let i = 0; i <= 60; i++) {
      const t = i * 0.02
      const cents = t <= 1 ? 70 * Math.sin(2 * Math.PI * t) : 0
      expect(judge.feed(observation(i, t, cents), t * 1000)).toBe(false)
    }
    expect(judge.charge()).toBeGreaterThan(0)
    expect(judge.charge()).toBeLessThan(1)
  })

  it('does not count two same-side excursions as two wave cycles', () => {
    const judge = createWaveJudge(WAVE, EVIDENCE, 57)
    for (let i = 0; i <= 100; i++) {
      const seconds = i * 0.02
      const cents = 70 * Math.abs(Math.sin(seconds * Math.PI))
      expect(judge.feed(observation(i, seconds, cents), seconds * 1000)).toBe(
        false,
      )
    }
    expect(judge.charge()).toBe(0)
  })

  it('does not accumulate rapid alternating detector chatter', () => {
    const judge = createWaveJudge(WAVE, EVIDENCE, 57)
    for (let i = 0; i < 40; i++) {
      const t = i * 0.1
      expect(
        judge.feed(observation(i, t, i % 2 === 0 ? 70 : -70), t * 1000),
      ).toBe(false)
    }
    expect(judge.charge()).toBeLessThan(1)
  })

  it.each([
    ['a steady note', () => 0],
    ['small pitch jitter', (i: number) => (i % 2 ? 12 : -12)],
    ['rapid large tracker jumps', (i: number) => (i % 2 ? 110 : -110)],
    ['octave tracking errors', (i: number) => (i % 2 ? 1200 : 0)],
    ['silence', () => null],
  ] as const)('does not pass %s', (_label, pitch) => {
    const judge = createWaveJudge(WAVE, EVIDENCE, 57)
    for (let i = 0; i < 250; i++)
      expect(judge.feed(observation(i, i * 0.02, pitch(i)), i * 20)).toBe(false)
    expect(judge.charge()).toBe(0)
  })

  it('cannot assemble a wave from stale, weak, duplicate or reordered frames', () => {
    for (const mode of ['stale', 'weak', 'duplicate', 'reordered'] as const) {
      const judge = createWaveJudge(WAVE, EVIDENCE, 57)
      for (let i = 0; i < 200; i++) {
        const frame = observation(
          i,
          i * 0.02,
          70 * Math.sin(i * 0.02 * 2 * Math.PI),
        )
        if (mode === 'stale') frame.capturedAtMs -= 1000
        if (mode === 'weak') frame.confidence = 0.1
        if (mode === 'duplicate') frame.sequence = 1
        if (mode === 'reordered') frame.captureSeconds = 10 - i * 0.02
        expect(judge.feed(frame, i * 20)).toBe(false)
      }
      expect(judge.charge()).toBe(0)
    }
  })

  it('ignores a duplicate callback but clears partial progress on fresh stale evidence', () => {
    const judge = createWaveJudge(WAVE, EVIDENCE, 57)
    for (let i = 0; i <= 65; i++) {
      const seconds = i * 0.02
      judge.feed(
        observation(i, seconds, 70 * Math.sin(seconds * 2 * Math.PI)),
        seconds * 1000,
      )
    }
    const partial = judge.charge()
    expect(partial).toBeGreaterThan(0)
    expect(
      judge.feed(
        {
          ...observation(65, 1.3, null),
          capturedAtMs: -1000,
        },
        1300,
      ),
    ).toBe(false)
    expect(judge.charge()).toBe(partial)
    expect(
      judge.feed(
        {
          ...observation(66, 1.32, 0),
          capturedAtMs: 0,
        },
        1320,
      ),
    ).toBe(false)
    expect(judge.charge()).toBe(0)
  })

  it('clears partial progress when an observed pitch dropout exceeds its grace', () => {
    const judge = createWaveJudge(WAVE, EVIDENCE, 57)
    for (let i = 0; i <= 65; i++) {
      const seconds = i * 0.02
      judge.feed(
        observation(i, seconds, 70 * Math.sin(seconds * 2 * Math.PI)),
        seconds * 1000,
      )
    }
    expect(judge.charge()).toBeGreaterThan(0)
    for (let i = 66; i <= 74; i++)
      judge.feed(observation(i, i * 0.02, null), i * 20)
    expect(judge.charge()).toBe(0)
  })

  it('clears partial wave progress after capture interruption, without crediting render time', () => {
    const judge = createWaveJudge(WAVE, EVIDENCE, 57)
    for (let i = 0; i <= 65; i++)
      judge.feed(
        observation(i, i * 0.02, 70 * Math.sin(i * 0.02 * 2 * Math.PI)),
        i * 20,
      )
    expect(judge.charge()).toBeGreaterThan(0)
    judge.advanceTo(1800)
    expect(judge.charge()).toBe(0)
    for (let i = 100; i < 160; i++)
      expect(
        judge.feed(
          observation(i, i * 0.02, 70 * Math.sin(i * 0.02 * 2 * Math.PI)),
          i * 20,
        ),
      ).toBe(false)
    expect(judge.charge()).toBeLessThan(1)
  })

  it('does not bridge large capture gaps even when delivery timestamps are fresh', () => {
    const judge = createWaveJudge(WAVE, EVIDENCE, 57)
    for (let i = 0; i < 20; i++) {
      const t = i * 0.2
      expect(judge.feed(observation(i, t, i % 2 ? 70 : -70), t * 1000)).toBe(
        false,
      )
    }
    expect(judge.charge()).toBe(0)
  })
})
