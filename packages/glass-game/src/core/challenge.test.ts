// Pitch challenge tests — held-note parity and ordered pairs share fresh capture evidence.

import { describe, expect, it } from 'vitest'
import type { ChallengeDefinition, HoldDefinition, PitchObservation, } from '../contracts'
import { createChallengeJudge } from './challenge'
import { createHoldJudge } from './hold'

const HOLD: HoldDefinition = {
  requiredSeconds: 0.1,
  toleranceCents: 40,
  confidenceFloor: 0.5,
  dropoutGraceSeconds: 0.1,
  decayPerSecond: 0.25,
  maximumSampleGapSeconds: 0.05,
  maximumSampleAgeMs: 150,
}

const COMFORTABLE: ChallengeDefinition = {
  kind: 'hold',
  step: { target: 'comfortable', hold: HOLD },
}

function pair(
  first: 'low' | 'high',
  second: 'low' | 'high',
): ChallengeDefinition {
  return {
    kind: 'ordered-pair',
    steps: [
      { target: first, hold: HOLD },
      { target: second, hold: HOLD },
    ],
    wrongOrder: 'reset',
  }
}

function frame(
  sequence: number,
  midi: number | null,
  overrides: Partial<PitchObservation> = {},
): PitchObservation {
  return {
    sequence,
    captureSeconds: sequence * 0.025,
    capturedAtMs: sequence * 25,
    midi,
    confidence: midi === null ? 0 : 0.9,
    ...overrides,
  }
}

describe('pitch challenges', () => {
  it('preserves the held-note judge result and charge for the same frames', () => {
    const result = createChallengeJudge(COMFORTABLE, 57)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hold = createHoldJudge(HOLD, 57)

    for (let sequence = 0; sequence <= 4; sequence++) {
      const observation = frame(sequence, 57)
      const complete = hold.feed(observation, sequence * 25)
      const events = result.judge.feed(observation, sequence * 25)
      expect(events.some((event) => event.type === 'complete')).toBe(complete)
      expect(result.judge.snapshot().charge).toBeCloseTo(hold.charge())
    }
    expect(result.judge.snapshot()).toMatchObject({
      kind: 'hold',
      stepIndex: 0,
      stepCount: 1,
      stepCharge: 1,
      charge: 1,
      target: 'comfortable',
      targetMidi: 57,
    })
  })

  it.each([
    ['low', 'high', 57, 60],
    ['high', 'low', 60, 57],
  ] as const)(
    'completes a stabilized %s then %s response',
    (first, second, firstMidi, secondMidi) => {
      const result = createChallengeJudge(pair(first, second), {
        low: 57,
        high: 60,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const firstEvents = Array.from({ length: 5 }, (_, index) =>
        result.judge.feed(frame(index, firstMidi), index * 25),
      ).flat()
      expect(firstEvents).toEqual([
        { type: 'step-complete', completedSteps: 1 },
      ])
      expect(result.judge.snapshot()).toMatchObject({
        stepIndex: 1,
        stepCount: 2,
        stepCharge: 0,
        charge: 0.5,
        target: second,
        targetMidi: secondMidi,
      })

      const secondEvents = Array.from({ length: 5 }, (_, offset) => {
        const sequence = offset + 5
        return result.judge.feed(frame(sequence, secondMidi), sequence * 25)
      }).flat()
      expect(secondEvents).toEqual([
        { type: 'step-complete', completedSteps: 2 },
        { type: 'complete' },
      ])
      expect(result.judge.snapshot().charge).toBe(1)
    },
  )

  it('resets only after a stabilized wrong-order note', () => {
    const result = createChallengeJudge(pair('low', 'high'), {
      low: 57,
      high: 60,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const resetEvents = [0, 1, 2, 3, 4].flatMap((sequence) =>
      result.judge.feed(frame(sequence, 60), sequence * 25),
    )
    expect(resetEvents).toEqual([{ type: 'reset', reason: 'wrong-order' }])
    expect(result.judge.snapshot()).toMatchObject({
      stepIndex: 0,
      stepCharge: 0,
      charge: 0,
      target: 'low',
    })
    for (const sequence of [0, 1, 2, 3, 4])
      expect(result.judge.feed(frame(sequence, 60), sequence * 25)).toEqual([])
    expect(result.judge.snapshot().charge).toBe(0)
  })

  it('lets the completed first note trail off without forcing a transition tempo', () => {
    const result = createChallengeJudge(pair('low', 'high'), {
      low: 57,
      high: 60,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const firstEvents = [0, 1, 2, 3, 4].flatMap((sequence) =>
      result.judge.feed(frame(sequence, 57), sequence * 25),
    )
    expect(firstEvents).toEqual([{ type: 'step-complete', completedSteps: 1 }])
    const trailingEvents = [5, 6, 7, 8, 9, 10, 11, 12].flatMap((sequence) =>
      result.judge.feed(frame(sequence, 57), sequence * 25),
    )
    expect(trailingEvents).toEqual([])
    expect(result.judge.snapshot()).toMatchObject({
      stepIndex: 1,
      charge: 0.5,
      target: 'high',
    })

    result.judge.feed(frame(13, null), 325)
    const restarted = [14, 15, 16, 17, 18].flatMap((sequence) =>
      result.judge.feed(frame(sequence, 57), sequence * 25),
    )
    expect(restarted).toEqual([{ type: 'reset', reason: 'wrong-order' }])
  })

  it('rejects missing, invalid and overlapping calibrated targets', () => {
    expect(createChallengeJudge(pair('low', 'high'), { low: 57 })).toEqual({
      ok: false,
      reason: 'missing-target',
      target: 'high',
    })
    expect(
      createChallengeJudge(pair('low', 'high'), {
        low: 57,
        high: Number.NaN,
      }),
    ).toEqual({ ok: false, reason: 'invalid-target', target: 'high' })
    expect(
      createChallengeJudge(pair('low', 'high'), { low: 57, high: 57.5 }),
    ).toEqual({
      ok: false,
      reason: 'ambiguous-targets',
      targets: ['low', 'high'],
    })
  })

  it('cannot score silence, stale evidence or duplicate capture frames', () => {
    const result = createChallengeJudge(pair('low', 'high'), {
      low: 57,
      high: 60,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (let sequence = 0; sequence < 20; sequence++) {
      const stale = frame(sequence, 57, { capturedAtMs: -1000 })
      result.judge.feed(stale, sequence * 25)
      result.judge.feed(stale, sequence * 25)
      result.judge.feed(frame(sequence + 100, null), sequence * 25)
    }
    expect(result.judge.snapshot()).toMatchObject({
      stepIndex: 0,
      stepCharge: 0,
      charge: 0,
    })
  })
})
