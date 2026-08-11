// ============================================================
// Guided Voice quality gate tests — poor input is never a low result
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuidedQualityCheckId, GuidedQualityObservation, GuidedQualityRequirement, } from './contracts'
import { evaluateGuidedQualityGate, guidedQualityAllowsReading, } from './quality-gate'

const REQUIRED: readonly GuidedQualityRequirement[] = [
  {
    id: 'microphone-continuity',
    failureDisposition: 'retry-recording',
  },
  { id: 'signal-coverage', failureDisposition: 'retry-recording' },
  { id: 'analysis-capability', failureDisposition: 'unavailable-here' },
]

function pass(id: GuidedQualityCheckId): GuidedQualityObservation {
  return {
    id,
    status: 'pass',
    reasonCode: null,
  }
}

describe('evaluateGuidedQualityGate', () => {
  it('is ready only when every required observation passes', () => {
    const result = evaluateGuidedQualityGate(
      REQUIRED,
      REQUIRED.map((requirement) => pass(requirement.id)),
    )
    expect(result.outcome).toBe('ready')
    expect(result.blockingCheckIds).toEqual([])
    expect(guidedQualityAllowsReading(result)).toBe(true)
  })

  it('requests another recording for a retryable required failure', () => {
    const result = evaluateGuidedQualityGate(REQUIRED, [
      pass('microphone-continuity'),
      {
        id: 'signal-coverage',
        status: 'fail',
        reasonCode: 'too-little-confident-voice',
      },
      pass('analysis-capability'),
    ])
    expect(result.outcome).toBe('needs-another-recording')
    expect(result.blockingCheckIds).toEqual(['signal-coverage'])
    expect(guidedQualityAllowsReading(result)).toBe(false)
  })

  it.each([
    'microphone-continuity',
    'clipping',
    'noise-separation',
    'signal-coverage',
    'pitch-confidence',
    'task-completion',
    'duration',
    'repetitions',
  ] as const)(
    'keeps a retryable %s failure out of the performance result',
    (id) => {
      const result = evaluateGuidedQualityGate(
        [{ id, failureDisposition: 'retry-recording' }],
        [
          {
            id,
            status: 'fail',
            reasonCode: `retry-${id}`,
          },
        ],
      )
      expect(result.outcome).toBe('needs-another-recording')
      expect(result.blockingCheckIds).toEqual([id])
      expect(result).not.toHaveProperty('score')
    },
  )

  it('marks an unsupported analysis capability unavailable here', () => {
    const result = evaluateGuidedQualityGate(
      [
        {
          id: 'analysis-capability',
          failureDisposition: 'unavailable-here',
        },
      ],
      [
        {
          id: 'analysis-capability',
          status: 'unavailable',
          reasonCode: 'detector-not-supported',
        },
      ],
    )
    expect(result.outcome).toBe('unavailable')
    expect(result.blockingCheckIds).toEqual(['analysis-capability'])
  })

  it('fails closed when a required capability observation is missing', () => {
    const result = evaluateGuidedQualityGate(REQUIRED, [
      pass('microphone-continuity'),
      pass('signal-coverage'),
    ])
    expect(result.outcome).toBe('unavailable')
    expect(result.blockingCheckIds).toEqual(['analysis-capability'])
    expect(result.observations).toContainEqual(
      expect.objectContaining({
        id: 'analysis-capability',
        reasonCode: 'missing-quality-observation',
      }),
    )
  })

  it('keeps a reading partial when only optional evidence is unavailable', () => {
    const result = evaluateGuidedQualityGate(REQUIRED, [
      ...REQUIRED.map((requirement) => pass(requirement.id)),
      {
        id: 'noise-separation',
        status: 'unavailable',
        reasonCode: 'noise-floor-not-calibrated',
      },
    ])
    expect(result.outcome).toBe('partial')
    expect(result.partialCheckIds).toEqual(['noise-separation'])
    expect(guidedQualityAllowsReading(result)).toBe(true)
  })

  it('treats duplicate observations as unavailable instead of choosing one', () => {
    const result = evaluateGuidedQualityGate(REQUIRED, [
      ...REQUIRED.map((requirement) => pass(requirement.id)),
      {
        id: 'signal-coverage',
        status: 'fail',
        reasonCode: 'conflicting-result',
      },
    ])
    expect(result.outcome).toBe('unavailable')
    expect(result.observations).toContainEqual(
      expect.objectContaining({
        id: 'signal-coverage',
        reasonCode: 'duplicate-quality-observation',
      }),
    )
  })

  it('fails closed on a malformed required observation status', () => {
    const result = evaluateGuidedQualityGate(REQUIRED, [
      pass('microphone-continuity'),
      {
        id: 'signal-coverage',
        status: 'unknown',
        reasonCode: null,
      } as unknown as GuidedQualityObservation,
      pass('analysis-capability'),
    ])

    expect(result.outcome).toBe('unavailable')
    expect(result.observations).toContainEqual(
      expect.objectContaining({
        id: 'signal-coverage',
        status: 'unavailable',
        reasonCode: 'invalid-quality-observation',
      }),
    )
  })

  it('fails closed on a malformed requirement disposition', () => {
    const requirements = [
      {
        id: 'signal-coverage',
        failureDisposition: 'ignore',
      },
    ] as unknown as readonly GuidedQualityRequirement[]
    const result = evaluateGuidedQualityGate(requirements, [
      pass('signal-coverage'),
    ])

    expect(result.outcome).toBe('unavailable')
    expect(result.observations).toContainEqual(
      expect.objectContaining({
        id: 'signal-coverage',
        status: 'unavailable',
        reasonCode: 'invalid-quality-requirement',
      }),
    )
  })
})
