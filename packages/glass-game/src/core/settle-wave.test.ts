// Settle-wave sequencing — one comfortable hold unlocks a fresh, independent wave gesture.

import { describe, expect, it } from 'vitest'
import type { ChallengeDefinition, PitchObservation } from '../contracts'
import { createChallengeJudge } from './challenge'

const LESSON: ChallengeDefinition = {
  kind: 'settle-wave',
  step: {
    target: 'comfortable',
    hold: {
      requiredSeconds: 0.5,
      toleranceCents: 100,
      confidenceFloor: 0.5,
      dropoutGraceSeconds: 0.15,
      decayPerSecond: 0.25,
      maximumSampleGapSeconds: 0.1,
      maximumSampleAgeMs: 150,
    },
  },
  wave: {
    requiredCycles: 2,
    minimumExcursionCents: 35,
    maximumExcursionCents: 180,
    minimumCycleSeconds: 0.3,
    maximumCycleSeconds: 2.5,
    minimumWaveSeconds: 1.2,
    maximumCentsPerSecond: 2400,
    smoothingSeconds: 0.045,
  },
}

function frame(i: number, midi: number): PitchObservation {
  return {
    sequence: i,
    captureSeconds: i * 0.02,
    capturedAtMs: i * 20,
    midi,
    confidence: 0.9,
  }
}

function judge() {
  const result = createChallengeJudge(LESSON, { comfortable: 57 })
  if (!result.ok) throw new Error(result.reason)
  return result.judge
}
describe('settle then wave lesson', () => {
  it('a held note settles the first phase but cannot complete the second', () => {
    const lesson = judge()
    const events = Array.from({ length: 300 }, (_, i) =>
      lesson.feed(frame(i, 57), i * 20),
    ).flat()
    expect(events).toEqual([{ type: 'step-complete', completedSteps: 1 }])
    expect(lesson.snapshot()).toMatchObject({
      kind: 'settle-wave',
      stepIndex: 1,
      stepCount: 2,
      charge: 0.5,
    })
  })
  it('uses the settled pitch as its centre and completes only after two subsequent cycles', () => {
    const lesson = judge()
    const events = []
    for (let i = 0; i <= 25; i++)
      events.push(...lesson.feed(frame(i, 57.3), i * 20))
    expect(lesson.snapshot().targetMidi).toBeCloseTo(57.3)
    for (let i = 26; i < 155; i++) {
      const t = (i - 26) * 0.02
      events.push(
        ...lesson.feed(
          frame(i, 57.3 + 0.7 * Math.sin(t * 2 * Math.PI)),
          i * 20,
        ),
      )
    }
    expect(events).toEqual([
      { type: 'step-complete', completedSteps: 1 },
      { type: 'step-complete', completedSteps: 2 },
      { type: 'complete' },
    ])
    expect(lesson.snapshot().charge).toBe(1)
    expect(lesson.feed(frame(160, 57), 3200)).toEqual([])
  })
  it('retains the settled phase through a breath while clearing unfinished wave progress', () => {
    const lesson = judge()
    for (let i = 0; i <= 25; i++) lesson.feed(frame(i, 57), i * 20)
    for (let i = 26; i < 90; i++)
      lesson.feed(
        frame(i, 57 + 0.7 * Math.sin((i - 26) * 0.02 * 2 * Math.PI)),
        i * 20,
      )
    expect(lesson.snapshot().stepCharge).toBeGreaterThan(0)
    lesson.advanceTo(2300)
    expect(lesson.snapshot()).toMatchObject({
      stepIndex: 1,
      stepCharge: 0,
      charge: 0.5,
    })
    expect(lesson.feed(frame(500, 58), 2000)).toEqual([])
    expect(lesson.snapshot().stepCharge).toBe(0)
  })
  it('requires a calibrated target before starting', () => {
    expect(createChallengeJudge(LESSON, {})).toEqual({
      ok: false,
      reason: 'missing-target',
      target: 'comfortable',
    })
  })
})
