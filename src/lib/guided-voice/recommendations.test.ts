// ============================================================
// Guided Voice recommendation policy tests — evidence and safety precedence
// ============================================================

import { describe, expect, it } from 'vitest'
import { buildGuidedComparisonFingerprint } from './comparison'
import type { GuidedAssessmentDefinition, GuidedDirectMeasurementEvidence, GuidedFinding, GuidedPracticeDose, GuidedPracticeRecommendation, GuidedQualityGateResult, GuidedRetakeProtocol, } from './contracts'
import { evaluateGuidedQualityGate } from './quality-gate'
import type { GuidedRecommendationPolicyInput, GuidedRecommendationRule, } from './recommendations'
import { resolveGuidedRecommendationOutcome, validateGuidedPracticeRecommendation, } from './recommendations'

const IDENTITY = {
  assessmentId: 'assessment.sample',
  protocolVersion: '1.0.0',
  instructionVersion: '1.0.0',
  targetVersion: '1.0.0',
  analysisVersion: '1.0.0',
  scoringVersion: '1.0.0',
} as const

const DEFINITION: GuidedAssessmentDefinition = {
  identity: IDENTITY,
  title: 'Sample assessment',
  evidenceClass: 'direct-measurement',
  requiredSignals: ['f0', 'confidence'],
  requiredQualityChecks: [
    { id: 'signal-coverage', failureDisposition: 'retry-recording' },
    { id: 'analysis-capability', failureDisposition: 'unavailable-here' },
  ],
  allowedFindingCodes: ['finding.held', 'finding.focus', 'finding.secondary'],
  recommendationRuleIds: [
    'rule.first',
    'rule.second',
    'rule.strict',
    'rule.increased',
    'rule.gentler',
  ],
  comparisonFamilies: ['pitch'],
}

const RETAKE_TASK: GuidedRetakeProtocol['task'] = {
  taskId: 'task.sample',
  cueId: 'cue.sample',
  comfortableRangeMidiCents: [4_800, 7_200],
  targetMidiCents: [6_000, 6_200],
  tempoBpm: null,
  durationMilliseconds: 30_000,
  repetitions: 3,
  parameters: { routeId: 'route.sample' },
}

const RETAKE: GuidedRetakeProtocol = {
  identity: IDENTITY,
  task: RETAKE_TASK,
  comparisonFingerprint: buildGuidedComparisonFingerprint({
    identity: IDENTITY,
    task: RETAKE_TASK,
  }),
}

const READY = evaluateGuidedQualityGate(DEFINITION.requiredQualityChecks, [
  { id: 'signal-coverage', status: 'pass', reasonCode: null },
  { id: 'analysis-capability', status: 'pass', reasonCode: null },
])

const DIRECT_EVIDENCE: GuidedDirectMeasurementEvidence = {
  id: 'evidence.primary',
  assessmentId: IDENTITY.assessmentId,
  measurementKey: 'sample.measurement',
  availability: 'available',
  evidenceClass: 'direct-measurement',
  comparisonFamily: 'pitch',
  measurement: { kind: 'scalar', value: 12, unit: 'cents' },
  confidence: 0.92,
  moments: [],
}

const FINDINGS: readonly GuidedFinding[] = [
  {
    id: 'finding-instance.held',
    assessmentId: IDENTITY.assessmentId,
    role: 'positive',
    findingCode: 'finding.held',
    evidenceId: DIRECT_EVIDENCE.id,
    confidence: 0.9,
  },
  {
    id: 'finding-instance.focus',
    assessmentId: IDENTITY.assessmentId,
    role: 'focus',
    findingCode: 'finding.focus',
    evidenceId: DIRECT_EVIDENCE.id,
    confidence: 0.88,
  },
]

function makeInput(
  overrides: Partial<GuidedRecommendationPolicyInput> = {},
): GuidedRecommendationPolicyInput {
  return {
    definition: DEFINITION,
    quality: READY,
    safety: { preCapture: 'proceed', singerEffort: 'workable' },
    evidence: [DIRECT_EVIDENCE],
    findings: FINDINGS,
    analysisFailureReasonCode: null,
    originatingCapture: {
      assessmentRunId: 'run.sample',
      protocol: RETAKE,
    },
    ...overrides,
  }
}

function makeRule(
  id: GuidedRecommendationRule['id'],
  order: number,
  demand: GuidedPracticeRecommendation['dose']['demand'] = 'same',
): GuidedRecommendationRule {
  return {
    id,
    version: '1.0.0',
    order,
    assessmentId: IDENTITY.assessmentId,
    primaryEvidenceId: DIRECT_EVIDENCE.id,
    evidenceRequirements: [
      {
        evidenceId: DIRECT_EVIDENCE.id,
        evidenceClass: 'direct-measurement',
        requiredFindingCodes: ['finding.held', 'finding.focus'],
      },
    ],
    positiveFinding: {
      evidenceId: DIRECT_EVIDENCE.id,
      findingCode: 'finding.held',
    },
    focusFinding: {
      evidenceId: DIRECT_EVIDENCE.id,
      findingCode: 'finding.focus',
    },
    recommendation: {
      id: `recommendation.${id}`,
      version: '1.0.0',
      exercise: {
        exerciseId: 'exercise.sample',
        exerciseVersion: '1.0.0',
        configuration: {
          configurationId: 'exercise-configuration.sample',
          configurationVersion: '1.0.0',
        },
      },
      reasonId: `reason.${id}`,
      dose: {
        durationMilliseconds: 30_000,
        repetitions: 3,
        sets: 1,
        comfortableRangeMidiCents: [4_800, 7_200],
        demand,
      },
      stopRuleId: 'stop.standard',
      alternativeRecommendationId: null,
    },
  }
}

function withDose(
  rule: GuidedRecommendationRule,
  dose: Partial<GuidedPracticeDose>,
): GuidedRecommendationRule {
  return {
    ...rule,
    recommendation: {
      ...rule.recommendation,
      dose: { ...rule.recommendation.dose, ...dose },
    },
  }
}

function expectRecommendationId(
  outcome: ReturnType<typeof resolveGuidedRecommendationOutcome>,
  recommendationId: string,
): void {
  expect(outcome.kind).toBe('focus-reading')
  if (outcome.kind !== 'focus-reading') return
  expect(outcome.reading.recommendation.id).toBe(recommendationId)
}

describe('resolveGuidedRecommendationOutcome', () => {
  it('uses explicit rule order independent of registration order', () => {
    const first = makeRule('rule.first', 10)
    const second = makeRule('rule.second', 20)

    const forward = resolveGuidedRecommendationOutcome(makeInput(), [
      second,
      first,
    ])
    const reverse = resolveGuidedRecommendationOutcome(makeInput(), [
      first,
      second,
    ])

    expectRecommendationId(forward, 'recommendation.rule.first')
    expectRecommendationId(reverse, 'recommendation.rule.first')
    if (forward.kind === 'focus-reading') {
      expect(forward.reading.recommendation.version).toBe('1.0.0')
      expect(forward.reading.recommendation.originatingEvidenceIds).toEqual([
        DIRECT_EVIDENCE.id,
      ])
    }
  })

  it.each([
    [{ preCapture: 'stop', singerEffort: null } as const],
    [{ preCapture: 'proceed', singerEffort: 'uncomfortable' } as const],
  ])('lets a safety stop override quality, failure, and rules', (safety) => {
    const outcome = resolveGuidedRecommendationOutcome(
      makeInput({
        safety,
        quality: { ...READY, outcome: 'unavailable' },
        analysisFailureReasonCode: 'analysis.worker-failed',
      }),
      [makeRule('rule.first', 10)],
    )

    expect(outcome).toEqual({ kind: 'safety-stop' })
    expect(outcome).not.toHaveProperty('reading')
    expect(outcome).not.toHaveProperty('quality')
  })

  it('returns unavailable before retry or analysis interpretation', () => {
    const quality = evaluateGuidedQualityGate(
      DEFINITION.requiredQualityChecks,
      [
        { id: 'signal-coverage', status: 'pass', reasonCode: null },
        {
          id: 'analysis-capability',
          status: 'unavailable',
          reasonCode: 'analysis-not-supported',
        },
      ],
    )
    const outcome = resolveGuidedRecommendationOutcome(
      makeInput({
        quality,
        analysisFailureReasonCode: 'analysis.worker-failed',
      }),
      [makeRule('rule.first', 10)],
    )

    expect(outcome).toEqual({ kind: 'unavailable-here', quality })
  })

  it('requests a new recording before analysis interpretation', () => {
    const quality = evaluateGuidedQualityGate(
      DEFINITION.requiredQualityChecks,
      [
        {
          id: 'signal-coverage',
          status: 'fail',
          reasonCode: 'not-enough-signal',
        },
        { id: 'analysis-capability', status: 'pass', reasonCode: null },
      ],
    )
    const outcome = resolveGuidedRecommendationOutcome(
      makeInput({
        quality,
        analysisFailureReasonCode: 'analysis.worker-failed',
      }),
      [makeRule('rule.first', 10)],
    )

    expect(outcome).toEqual({ kind: 'needs-another-recording', quality })
  })

  it('recomputes required quality and rejects a forged ready summary', () => {
    const forgedReady: GuidedQualityGateResult = {
      outcome: 'ready',
      observations: [],
      blockingCheckIds: [],
      partialCheckIds: [],
    }
    const outcome = resolveGuidedRecommendationOutcome(
      makeInput({ quality: forgedReady }),
      [makeRule('rule.first', 10)],
    )

    expect(outcome.kind).toBe('unavailable-here')
    if (outcome.kind !== 'unavailable-here') return
    expect(outcome.quality.blockingCheckIds).toEqual([
      'signal-coverage',
      'analysis-capability',
    ])
  })

  it('returns an explicit analysis failure without fabricating advice', () => {
    const outcome = resolveGuidedRecommendationOutcome(
      makeInput({ analysisFailureReasonCode: 'analysis.worker-failed' }),
      [makeRule('rule.first', 10)],
    )

    expect(outcome).toEqual({
      kind: 'analysis-failed',
      reasonCode: 'analysis.worker-failed',
    })
  })

  it('constructs the retake from immutable originating capture provenance', () => {
    const outcome = resolveGuidedRecommendationOutcome(makeInput(), [
      makeRule('rule.first', 10),
    ])

    expect(outcome.kind).toBe('focus-reading')
    if (outcome.kind !== 'focus-reading') return
    expect(outcome.reading.recommendation.retake).toEqual(RETAKE)
    expect(outcome.reading.recommendation.retake).not.toBe(RETAKE)
    expect(outcome.reading.recommendation.retake.task).not.toBe(RETAKE.task)
  })

  it('refuses a capture basis whose fingerprint does not match its task', () => {
    const outcome = resolveGuidedRecommendationOutcome(
      makeInput({
        originatingCapture: {
          assessmentRunId: 'run.sample',
          protocol: {
            ...RETAKE,
            task: { ...RETAKE.task, repetitions: 4 },
          },
        },
      }),
      [makeRule('rule.first', 10)],
    )

    expect(outcome.kind).toBe('no-reliable-focus')
  })

  it('does not let contextual proxy evidence substitute for direct evidence', () => {
    const proxyEvidence = {
      ...DIRECT_EVIDENCE,
      evidenceClass: 'contextual-acoustic-proxy' as const,
      inputSensitivity: 'input-sensitive' as const,
      caveatId: 'caveat.input-sensitive',
    }
    const outcome = resolveGuidedRecommendationOutcome(
      makeInput({ evidence: [proxyEvidence] }),
      [makeRule('rule.first', 10)],
    )

    expect(outcome).toEqual({
      kind: 'no-reliable-focus',
      evidence: [proxyEvidence],
    })
  })

  it('does not let malformed numeric evidence drive a recommendation', () => {
    const malformed = {
      ...DIRECT_EVIDENCE,
      measurement: {
        kind: 'scalar' as const,
        value: Number.NaN,
        unit: 'cents' as const,
      },
    }
    const outcome = resolveGuidedRecommendationOutcome(
      makeInput({ evidence: [malformed] }),
      [makeRule('rule.first', 10)],
    )

    expect(outcome).toEqual({
      kind: 'no-reliable-focus',
      evidence: [malformed],
    })
  })

  it('allows a partial reading only when that rule has every exact input', () => {
    const strict = {
      ...makeRule('rule.strict', 10),
      evidenceRequirements: [
        ...makeRule('rule.strict', 10).evidenceRequirements,
        {
          evidenceId: 'evidence.secondary',
          evidenceClass: 'contextual-acoustic-proxy' as const,
          requiredFindingCodes: ['finding.secondary'],
        },
      ],
    }
    const directOnly = makeRule('rule.second', 20)
    const quality = evaluateGuidedQualityGate(
      DEFINITION.requiredQualityChecks,
      [
        {
          id: 'noise-separation',
          status: 'unavailable',
          reasonCode: 'noise-proxy-unavailable',
        },
        { id: 'signal-coverage', status: 'pass', reasonCode: null },
        { id: 'analysis-capability', status: 'pass', reasonCode: null },
      ],
    )
    const outcome = resolveGuidedRecommendationOutcome(makeInput({ quality }), [
      directOnly,
      strict,
    ])

    expectRecommendationId(outcome, 'recommendation.rule.second')
    if (outcome.kind === 'focus-reading') {
      expect(outcome.quality).toBe('partial')
    }
  })

  it('requires exact reviewed finding codes and evidence classes', () => {
    const wrongFinding = FINDINGS.map((finding) =>
      finding.role === 'focus'
        ? { ...finding, findingCode: 'finding.secondary' }
        : finding,
    )
    const outcome = resolveGuidedRecommendationOutcome(
      makeInput({ findings: wrongFinding }),
      [makeRule('rule.first', 10)],
    )

    expect(outcome.kind).toBe('no-reliable-focus')
  })

  it('skips increased demand after effort and selects a gentler eligible rule', () => {
    const increased = makeRule('rule.increased', 10, 'increased')
    const gentler = makeRule('rule.gentler', 20, 'gentler')
    const outcome = resolveGuidedRecommendationOutcome(
      makeInput({
        safety: { preCapture: 'proceed', singerEffort: 'effortful' },
      }),
      [gentler, increased],
    )

    expectRecommendationId(outcome, 'recommendation.rule.gentler')
  })

  it('returns no reliable focus when no safe eligible rule remains', () => {
    const increased = makeRule('rule.increased', 10, 'increased')
    const outcome = resolveGuidedRecommendationOutcome(
      makeInput({
        safety: { preCapture: 'proceed', singerEffort: 'effortful' },
      }),
      [increased],
    )

    expect(outcome.kind).toBe('no-reliable-focus')
  })

  const effortIncreases: readonly [string, Partial<GuidedPracticeDose>][] = [
    ['duration', { durationMilliseconds: 30_001, demand: 'same' }],
    ['repetitions', { repetitions: 4, demand: 'same' }],
    ['sets', { sets: 2, demand: 'same' }],
    [
      'comfortable range',
      { comfortableRangeMidiCents: [4_700, 7_200], demand: 'same' },
    ],
    [
      'upward range shift',
      { comfortableRangeMidiCents: [4_900, 7_300], demand: 'same' },
    ],
  ]

  it.each(effortIncreases)(
    'rejects a same-labelled %s increase after effort',
    (_label, dose) => {
      const candidate = withDose(makeRule('rule.gentler', 10), dose)
      const outcome = resolveGuidedRecommendationOutcome(
        makeInput({
          safety: { preCapture: 'proceed', singerEffort: 'effortful' },
        }),
        [candidate],
      )

      expect(outcome.kind).toBe('no-reliable-focus')
    },
  )

  it('fails closed on duplicate rule identities', () => {
    const first = makeRule('rule.first', 10)
    const duplicate = {
      ...makeRule('rule.first', 20),
      recommendation: {
        ...makeRule('rule.first', 20).recommendation,
        id: 'recommendation.duplicate',
      },
    }
    const outcome = resolveGuidedRecommendationOutcome(makeInput(), [
      first,
      duplicate,
    ])

    expect(outcome.kind).toBe('no-reliable-focus')
  })
})

describe('validateGuidedPracticeRecommendation', () => {
  it('rejects missing provenance, stop, return, and retake handoffs', () => {
    const rule = makeRule('rule.first', 10)
    const invalid: GuidedPracticeRecommendation = {
      ...rule.recommendation,
      originatingAssessmentId: IDENTITY.assessmentId,
      originatingEvidenceIds: ['evidence.missing'],
      stopRuleId: '',
      returnDestination: {
        kind: 'guided-focus-reading',
        assessmentRunId: '',
      },
      retake: {
        ...RETAKE,
        comparisonFingerprint: '',
      },
    }

    expect(
      validateGuidedPracticeRecommendation(invalid, [DIRECT_EVIDENCE]),
    ).toEqual(
      expect.arrayContaining([
        'unknown-originating-evidence',
        'missing-stop-rule-id',
        'missing-return-destination',
        'invalid-retake-protocol',
      ]),
    )
  })

  it('rejects prose in reviewed reason and stop identifier fields', () => {
    const rule = makeRule('rule.first', 10)
    const invalid: GuidedPracticeRecommendation = {
      ...rule.recommendation,
      originatingAssessmentId: IDENTITY.assessmentId,
      originatingEvidenceIds: [DIRECT_EVIDENCE.id],
      reasonId: 'Try to sing this more gently',
      stopRuleId: 'Stop if this feels uncomfortable',
      returnDestination: {
        kind: 'guided-focus-reading',
        assessmentRunId: 'run.sample',
      },
      retake: RETAKE,
    }

    expect(
      validateGuidedPracticeRecommendation(invalid, [DIRECT_EVIDENCE]),
    ).toEqual(
      expect.arrayContaining(['invalid-reason-id', 'invalid-stop-rule-id']),
    )
  })

  it('rejects an arbitrary exercise configuration payload', () => {
    const rule = makeRule('rule.first', 10)
    const invalid = {
      ...rule.recommendation,
      originatingAssessmentId: IDENTITY.assessmentId,
      originatingEvidenceIds: [DIRECT_EVIDENCE.id],
      exercise: {
        ...rule.recommendation.exercise,
        configuration: { intensity: 10, direction: 'higher' },
      },
      returnDestination: {
        kind: 'guided-focus-reading',
        assessmentRunId: 'run.sample',
      },
      retake: RETAKE,
    } as unknown as GuidedPracticeRecommendation

    expect(
      validateGuidedPracticeRecommendation(invalid, [DIRECT_EVIDENCE]),
    ).toContain('invalid-exercise-configuration')
  })

  it('rejects a retake fingerprint that does not match its exact task', () => {
    const rule = makeRule('rule.first', 10)
    const invalid: GuidedPracticeRecommendation = {
      ...rule.recommendation,
      originatingAssessmentId: IDENTITY.assessmentId,
      originatingEvidenceIds: [DIRECT_EVIDENCE.id],
      returnDestination: {
        kind: 'guided-focus-reading',
        assessmentRunId: 'run.sample',
      },
      retake: {
        ...RETAKE,
        comparisonFingerprint: `${RETAKE.comparisonFingerprint}-other`,
      },
    }

    expect(
      validateGuidedPracticeRecommendation(invalid, [DIRECT_EVIDENCE]),
    ).toContain('invalid-retake-protocol')
  })

  it('rejects an empty or unknown-demand practice dose', () => {
    const rule = makeRule('rule.first', 10)
    const recommendation: GuidedPracticeRecommendation = {
      ...rule.recommendation,
      originatingAssessmentId: IDENTITY.assessmentId,
      originatingEvidenceIds: [DIRECT_EVIDENCE.id],
      returnDestination: {
        kind: 'guided-focus-reading',
        assessmentRunId: 'run.sample',
      },
      retake: RETAKE,
    }
    const emptyDose: GuidedPracticeRecommendation = {
      ...recommendation,
      dose: {
        durationMilliseconds: null,
        repetitions: null,
        sets: null,
        comfortableRangeMidiCents: null,
        demand: 'same',
      },
    }
    const unknownDemand = {
      ...recommendation,
      dose: { ...recommendation.dose, demand: 'unknown' },
    } as unknown as GuidedPracticeRecommendation

    expect(
      validateGuidedPracticeRecommendation(emptyDose, [DIRECT_EVIDENCE]),
    ).toContain('invalid-dose')
    expect(
      validateGuidedPracticeRecommendation(unknownDemand, [DIRECT_EVIDENCE]),
    ).toContain('invalid-dose')
  })
})
