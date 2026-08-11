// ============================================================
// Guided Voice validation tests — invalid evidence fails closed
// ============================================================

import { describe, expect, it } from 'vitest'
import { buildGuidedComparisonFingerprint } from './comparison'
import type { GuidedDirectMeasurementEvidence, GuidedFocusReading, GuidedPracticeRecommendation, GuidedProtocolIdentity, GuidedTaskConfiguration, } from './contracts'
import { validateGuidedEvidenceContract, validateGuidedFocusReadingContract, } from './validation'

const ASSESSMENT_ID = 'pitch-centre'
const RETAKE_IDENTITY: GuidedProtocolIdentity = {
  assessmentId: ASSESSMENT_ID,
  protocolVersion: '1',
  instructionVersion: '1',
  targetVersion: '1',
  analysisVersion: '1',
  scoringVersion: '1',
}
const RETAKE_TASK: GuidedTaskConfiguration = {
  taskId: 'direct-landings',
  cueId: 'tone-v1',
  comfortableRangeMidiCents: [5_500, 6_700],
  targetMidiCents: [5_700, 6_000, 6_200],
  tempoBpm: null,
  durationMilliseconds: 6_000,
  repetitions: 3,
  parameters: { vowel: 'oo' },
}

function directEvidence(
  overrides: Partial<GuidedDirectMeasurementEvidence> = {},
): GuidedDirectMeasurementEvidence {
  return {
    id: 'landing-error',
    assessmentId: ASSESSMENT_ID,
    measurementKey: 'median-signed-error-cents',
    availability: 'available',
    evidenceClass: 'direct-measurement',
    comparisonFamily: 'pitch',
    measurement: { kind: 'scalar', value: 12, unit: 'cents' },
    confidence: 0.9,
    moments: [
      {
        id: 'settled-landing',
        startSeconds: 1.2,
        endSeconds: 1.6,
        labelId: 'evidence.settled-landing',
      },
    ],
    ...overrides,
  }
}

function recommendation(
  overrides: Partial<GuidedPracticeRecommendation> = {},
): GuidedPracticeRecommendation {
  return {
    id: 'pitch-centre-repeat-v1',
    version: '1',
    originatingAssessmentId: ASSESSMENT_ID,
    originatingEvidenceIds: ['landing-error'],
    exercise: {
      exerciseId: 'pitch-centre-repeat',
      exerciseVersion: '1',
      configuration: {
        configurationId: 'pitch-centre-repeat.standard',
        configurationVersion: '1',
      },
    },
    reasonId: 'landing-above-target',
    dose: {
      durationMilliseconds: 6_000,
      repetitions: 3,
      sets: 1,
      comfortableRangeMidiCents: [5_500, 6_700],
      demand: 'same',
    },
    stopRuleId: 'stop-on-discomfort-v1',
    alternativeRecommendationId: null,
    returnDestination: {
      kind: 'guided-focus-reading',
      assessmentRunId: 'run-1',
    },
    retake: {
      identity: RETAKE_IDENTITY,
      task: RETAKE_TASK,
      comparisonFingerprint: buildGuidedComparisonFingerprint({
        identity: RETAKE_IDENTITY,
        task: RETAKE_TASK,
      }),
    },
    ...overrides,
  }
}

function focusReading(
  overrides: Partial<GuidedFocusReading> = {},
): GuidedFocusReading {
  return {
    primaryEvidenceId: 'landing-error',
    positiveFinding: {
      id: 'positive-1',
      assessmentId: ASSESSMENT_ID,
      role: 'positive',
      findingCode: 'settled-on-target',
      evidenceId: 'landing-error',
      confidence: 0.9,
    },
    focusFinding: {
      id: 'focus-1',
      assessmentId: ASSESSMENT_ID,
      role: 'focus',
      findingCode: 'approach-from-above',
      evidenceId: 'landing-error',
      confidence: 0.85,
    },
    recommendation: recommendation(),
    ...overrides,
  }
}

describe('validateGuidedEvidenceContract', () => {
  it('accepts finite direct evidence inside capture bounds', () => {
    expect(
      validateGuidedEvidenceContract({
        assessmentId: ASSESSMENT_ID,
        captureDurationSeconds: 2,
        evidence: [directEvidence()],
      }),
    ).toEqual({ valid: true, violations: [] })
  })

  it('rejects nonfinite scalar values and confidence', () => {
    const result = validateGuidedEvidenceContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [
        directEvidence({
          measurement: { kind: 'scalar', value: Number.NaN, unit: 'cents' },
          confidence: Number.POSITIVE_INFINITY,
        }),
      ],
    })

    expect(result.violations).toEqual([
      {
        code: 'nonfinite-measurement',
        path: 'evidence[0].measurement.value',
      },
      { code: 'invalid-confidence', path: 'evidence[0].confidence' },
    ])
  })

  it('rejects scalar and fraction measurements without valid units', () => {
    const scalarWithoutUnit = directEvidence({
      measurement: { kind: 'scalar', value: 12 } as never,
    })
    const fractionWithoutDenominatorUnit = directEvidence({
      id: 'coverage',
      measurement: {
        kind: 'fraction',
        numerator: 4,
        denominator: 5,
        numeratorUnit: 'frames',
      } as never,
    })
    const result = validateGuidedEvidenceContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [scalarWithoutUnit, fractionWithoutDenominatorUnit],
    })

    expect(result.violations).toContainEqual({
      code: 'invalid-measurement-unit',
      path: 'evidence[0].measurement.unit',
    })
    expect(result.violations).toContainEqual({
      code: 'invalid-fraction',
      path: 'evidence[1].measurement',
    })
  })

  it.each([
    { numerator: -1, denominator: 5 },
    { numerator: 6, denominator: 5 },
    { numerator: 1, denominator: 0 },
    { numerator: 1, denominator: Number.NaN },
  ])('rejects an invalid fraction: %o', ({ numerator, denominator }) => {
    const result = validateGuidedEvidenceContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [
        directEvidence({
          measurement: {
            kind: 'fraction',
            numerator,
            denominator,
            numeratorUnit: 'frames',
            denominatorUnit: 'frames',
          },
        }),
      ],
    })

    expect(result.violations).toContainEqual({
      code: 'invalid-fraction',
      path: 'evidence[0].measurement',
    })
  })

  it('requires an explicit caveat on contextual acoustic proxies', () => {
    const base = directEvidence()
    const result = validateGuidedEvidenceContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [
        {
          ...base,
          evidenceClass: 'contextual-acoustic-proxy',
          caveatId: ' ',
          inputSensitivity: 'input-sensitive',
        },
      ],
    })

    expect(result.violations).toContainEqual({
      code: 'missing-proxy-caveat',
      path: 'evidence[0].caveatId',
    })
  })

  it('validates comparison family and proxy input sensitivity at runtime', () => {
    const base = directEvidence()
    const result = validateGuidedEvidenceContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [
        {
          ...base,
          evidenceClass: 'contextual-acoustic-proxy',
          comparisonFamily: 'anatomy',
          caveatId: 'input-sensitive-v1',
          inputSensitivity: 'unknown',
        } as never,
      ],
    })

    expect(result.violations).toEqual([
      {
        code: 'invalid-comparison-family',
        path: 'evidence[0].comparisonFamily',
      },
      {
        code: 'invalid-proxy-input-sensitivity',
        path: 'evidence[0].inputSensitivity',
      },
    ])
  })

  it('rejects duplicate evidence IDs and timestamps outside capture bounds', () => {
    const result = validateGuidedEvidenceContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [
        directEvidence({
          moments: [
            {
              id: 'late',
              startSeconds: 1.8,
              endSeconds: 2.2,
              labelId: 'evidence.outside-capture',
            },
          ],
        }),
        directEvidence(),
      ],
    })

    expect(result.violations).toEqual([
      { code: 'invalid-evidence-moment', path: 'evidence[0].moments[0]' },
      { code: 'duplicate-evidence-id', path: 'evidence[1].id' },
    ])
  })

  it('rejects duplicate moment IDs within one evidence item', () => {
    const moment = directEvidence().moments[0]!
    const result = validateGuidedEvidenceContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [directEvidence({ moments: [moment, { ...moment }] })],
    })

    expect(result.violations).toContainEqual({
      code: 'duplicate-evidence-moment-id',
      path: 'evidence[0].moments[1].id',
    })
  })

  it('accepts every valid evidence availability and class shape', () => {
    const result = validateGuidedEvidenceContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [
        {
          id: 'singer-effort',
          assessmentId: ASSESSMENT_ID,
          measurementKey: 'singer-effort',
          availability: 'available',
          evidenceClass: 'singer-report',
          comparisonFamily: null,
          value: 'workable',
          moments: [],
        },
        {
          id: 'missing-pitch',
          assessmentId: ASSESSMENT_ID,
          measurementKey: 'pitch-centre',
          availability: 'unavailable',
          evidenceClass: 'direct-measurement',
          comparisonFamily: 'pitch',
          reason: 'insufficient-signal',
        },
        {
          id: 'unsupported-anatomy',
          assessmentId: ASSESSMENT_ID,
          measurementKey: 'laryngeal-state',
          availability: 'unavailable',
          evidenceClass: 'not-measured',
          comparisonFamily: null,
          reason: 'unsupported-construct',
        },
      ],
    })

    expect(result).toEqual({ valid: true, violations: [] })
  })

  it('rejects invalid availability and evidence-class combinations', () => {
    const base = {
      assessmentId: ASSESSMENT_ID,
      measurementKey: 'shape-check',
    }
    const result = validateGuidedEvidenceContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [
        {
          ...base,
          id: 'available-not-measured',
          availability: 'available',
          evidenceClass: 'not-measured',
          comparisonFamily: null,
          reason: 'outside-task-contract',
          moments: [],
        },
        {
          ...base,
          id: 'unavailable-singer-report',
          availability: 'unavailable',
          evidenceClass: 'singer-report',
          comparisonFamily: null,
          reason: 'quality-gate',
        },
        {
          ...base,
          id: 'invalid-availability',
          availability: 'pending',
          evidenceClass: 'direct-measurement',
        },
        {
          ...base,
          id: 'invalid-singer-report',
          availability: 'available',
          evidenceClass: 'singer-report',
          comparisonFamily: 'pitch',
          value: 'diagnosed',
          moments: [],
        },
        {
          ...base,
          id: 'invalid-not-measured',
          availability: 'unavailable',
          evidenceClass: 'not-measured',
          comparisonFamily: 'spectrum',
          reason: 'quality-gate',
        },
      ],
    })

    expect(result.violations).toContainEqual({
      code: 'invalid-evidence',
      path: 'evidence[0].evidenceClass',
    })
    expect(result.violations).toContainEqual({
      code: 'invalid-evidence',
      path: 'evidence[1].evidenceClass',
    })
    expect(result.violations).toContainEqual({
      code: 'invalid-evidence',
      path: 'evidence[2].availability',
    })
    expect(result.violations).toContainEqual({
      code: 'invalid-comparison-family',
      path: 'evidence[3].comparisonFamily',
    })
    expect(result.violations).toContainEqual({
      code: 'invalid-evidence',
      path: 'evidence[3].value',
    })
    expect(result.violations).toContainEqual({
      code: 'invalid-comparison-family',
      path: 'evidence[4].comparisonFamily',
    })
    expect(result.violations).toContainEqual({
      code: 'invalid-evidence',
      path: 'evidence[4].reason',
    })
  })

  it('never throws when evidence entries are malformed parsed JSON', () => {
    const malformedEvidence: readonly unknown[] = [
      null,
      'not-an-object',
      42,
      false,
      [],
    ]

    expect(
      validateGuidedEvidenceContract({
        assessmentId: ASSESSMENT_ID,
        captureDurationSeconds: 2,
        evidence: malformedEvidence,
      }),
    ).toEqual({
      valid: false,
      violations: malformedEvidence.map((_, index) => ({
        code: 'invalid-evidence',
        path: `evidence[${index}]`,
      })),
    })
  })
})

describe('validateGuidedFocusReadingContract', () => {
  it('accepts a complete evidence-linked focus reading', () => {
    expect(
      validateGuidedFocusReadingContract({
        assessmentId: ASSESSMENT_ID,
        captureDurationSeconds: 2,
        evidence: [directEvidence()],
        reading: focusReading(),
      }),
    ).toEqual({ valid: true, violations: [] })
  })

  it('rejects missing reading parts and a non-direct primary measurement', () => {
    const direct = directEvidence()
    const result = validateGuidedFocusReadingContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [
        {
          ...direct,
          evidenceClass: 'contextual-acoustic-proxy',
          caveatId: 'input-sensitive-v1',
          inputSensitivity: 'input-sensitive',
        },
      ],
      reading: {
        primaryEvidenceId: 'landing-error',
        positiveFinding: null,
        focusFinding: focusReading().focusFinding,
        recommendation: recommendation(),
      },
    })

    expect(result.violations).toContainEqual({
      code: 'invalid-primary-evidence',
      path: 'reading.primaryEvidenceId',
    })
    expect(result.violations).toContainEqual({
      code: 'malformed-focus-reading',
      path: 'reading.positiveFinding',
    })
  })

  it('rejects dangling finding and recommendation evidence references', () => {
    const reading = focusReading({
      focusFinding: {
        ...focusReading().focusFinding,
        evidenceId: 'missing-focus-evidence',
      },
      recommendation: recommendation({
        originatingEvidenceIds: ['missing-recommendation-evidence'],
      }),
    })
    const result = validateGuidedFocusReadingContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [directEvidence()],
      reading,
    })

    expect(result.violations).toContainEqual({
      code: 'dangling-evidence-reference',
      path: 'reading.focusFinding.evidenceId',
    })
    expect(result.violations).toContainEqual({
      code: 'dangling-evidence-reference',
      path: 'reading.recommendation.originatingEvidenceIds[0]',
    })
  })

  it('rejects unavailable evidence as finding and recommendation support', () => {
    const unavailableEvidence = {
      id: 'unavailable-landing',
      assessmentId: ASSESSMENT_ID,
      measurementKey: 'median-signed-error-cents',
      availability: 'unavailable',
      evidenceClass: 'direct-measurement',
      comparisonFamily: 'pitch',
      reason: 'insufficient-signal',
    } as const
    const reading = focusReading({
      focusFinding: {
        ...focusReading().focusFinding,
        evidenceId: unavailableEvidence.id,
      },
      recommendation: recommendation({
        originatingEvidenceIds: [unavailableEvidence.id],
      }),
    })
    const result = validateGuidedFocusReadingContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [directEvidence(), unavailableEvidence],
      reading,
    })

    expect(result.violations).toContainEqual({
      code: 'unavailable-evidence-reference',
      path: 'reading.focusFinding.evidenceId',
    })
    expect(result.violations).toContainEqual({
      code: 'unavailable-evidence-reference',
      path: 'reading.recommendation.originatingEvidenceIds[0]',
    })
  })

  it('never throws while indexing malformed evidence for a reading', () => {
    const result = validateGuidedFocusReadingContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [null, 'not-an-object'],
      reading: focusReading(),
    })

    expect(result.valid).toBe(false)
    expect(result.violations).toContainEqual({
      code: 'invalid-evidence',
      path: 'evidence[0]',
    })
    expect(result.violations).toContainEqual({
      code: 'invalid-evidence',
      path: 'evidence[1]',
    })
    expect(result.violations).toContainEqual({
      code: 'dangling-evidence-reference',
      path: 'reading.primaryEvidenceId',
    })
  })

  it('rejects a malformed recommendation inside an otherwise valid reading', () => {
    const reading = focusReading()
    const result = validateGuidedFocusReadingContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [directEvidence()],
      reading: {
        ...reading,
        recommendation: { ...reading.recommendation, stopRuleId: '' },
      },
    })

    expect(result.violations).toContainEqual({
      code: 'malformed-recommendation',
      path: 'reading.recommendation',
    })
  })

  it('rejects a self-referential alternative recommendation', () => {
    const reading = focusReading()
    const result = validateGuidedFocusReadingContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [directEvidence()],
      reading: {
        ...reading,
        recommendation: {
          ...reading.recommendation,
          alternativeRecommendationId: reading.recommendation.id,
        },
      },
    })

    expect(result.violations).toContainEqual({
      code: 'malformed-recommendation',
      path: 'reading.recommendation',
    })
  })

  it('rejects an unreviewed exercise configuration payload', () => {
    const reading = focusReading()
    const result = validateGuidedFocusReadingContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [directEvidence()],
      reading: {
        ...reading,
        recommendation: {
          ...reading.recommendation,
          exercise: {
            ...reading.recommendation.exercise,
            configuration: { intensity: 10, direction: 'higher' },
          },
        },
      },
    })

    expect(result.violations).toContainEqual({
      code: 'malformed-recommendation',
      path: 'reading.recommendation',
    })
  })

  it('requires every retake identity version and complete task configuration', () => {
    const reading = focusReading()
    const result = validateGuidedFocusReadingContract({
      assessmentId: ASSESSMENT_ID,
      captureDurationSeconds: 2,
      evidence: [directEvidence()],
      reading: {
        ...reading,
        recommendation: {
          ...reading.recommendation,
          retake: {
            ...reading.recommendation.retake,
            identity: {
              ...reading.recommendation.retake.identity,
              scoringVersion: '',
            },
            task: {
              ...reading.recommendation.retake.task,
              durationMilliseconds: 0,
            },
          },
        },
      },
    })

    expect(result.violations).toContainEqual({
      code: 'malformed-recommendation',
      path: 'reading.recommendation',
    })
  })
})
