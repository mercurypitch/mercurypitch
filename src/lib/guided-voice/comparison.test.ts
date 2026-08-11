// ============================================================
// Guided Voice comparison tests — compatibility before direction
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuidedComparisonBasis } from './comparison'
import { buildGuidedComparisonFingerprint, compareGuidedMeasurement, guidedComparisonEligibility, } from './comparison'
import type { GuidedCaptureContext, GuidedContextualProxyEvidence, GuidedDirectMeasurementEvidence, GuidedProtocolIdentity, GuidedSingerReportEvidence, GuidedTaskConfiguration, } from './contracts'

const IDENTITY: GuidedProtocolIdentity = {
  assessmentId: 'pitch-centre',
  protocolVersion: '1',
  instructionVersion: '1',
  targetVersion: '1',
  analysisVersion: '1',
  scoringVersion: '1',
}

const TASK: GuidedTaskConfiguration = {
  taskId: 'direct-landings',
  cueId: 'tone-v1',
  comfortableRangeMidiCents: [5_500, 6_700],
  targetMidiCents: [5_700, 6_000, 6_200],
  tempoBpm: null,
  durationMilliseconds: 6_000,
  repetitions: 3,
  parameters: { vowel: 'oo', toleranceCents: 35 },
}

const CAPTURE_A: GuidedCaptureContext = {
  inputContextKey: 'local-input-a',
  detectorId: 'yin',
  detectorVersion: '1',
  sampleRateHz: 48_000,
}

function evidence(
  value: number,
  family: GuidedDirectMeasurementEvidence['comparisonFamily'] = 'pitch',
): GuidedDirectMeasurementEvidence {
  return {
    id: `evidence-${value}`,
    assessmentId: 'pitch-centre',
    measurementKey: 'median-error-cents',
    evidenceClass: 'direct-measurement',
    comparisonFamily: family,
    availability: 'available',
    measurement: { kind: 'scalar', value, unit: 'cents' },
    confidence: 0.9,
    moments: [],
  }
}

function proxyEvidence(
  value: number,
  inputSensitivity: GuidedContextualProxyEvidence['inputSensitivity'],
): GuidedContextualProxyEvidence {
  return {
    ...evidence(value),
    evidenceClass: 'contextual-acoustic-proxy',
    caveatId: 'input-context-caveat',
    inputSensitivity,
  }
}

describe('buildGuidedComparisonFingerprint', () => {
  it('is stable across parameter insertion order', () => {
    const first = buildGuidedComparisonFingerprint({
      identity: IDENTITY,
      task: TASK,
    })
    const second = buildGuidedComparisonFingerprint({
      identity: { ...IDENTITY },
      task: {
        ...TASK,
        parameters: { toleranceCents: 35, vowel: 'oo' },
      },
    })
    expect(second).toBe(first)
  })

  it('changes for every material protocol or task parameter', () => {
    const baseline = buildGuidedComparisonFingerprint({
      identity: IDENTITY,
      task: TASK,
    })
    const materialChanges: GuidedComparisonBasis[] = [
      { identity: { ...IDENTITY, assessmentId: 'steady-sound' }, task: TASK },
      {
        identity: { ...IDENTITY, protocolVersion: '2' },
        task: TASK,
      },
      {
        identity: { ...IDENTITY, instructionVersion: '2' },
        task: TASK,
      },
      { identity: { ...IDENTITY, targetVersion: '2' }, task: TASK },
      { identity: { ...IDENTITY, analysisVersion: '2' }, task: TASK },
      { identity: { ...IDENTITY, scoringVersion: '2' }, task: TASK },
      { identity: IDENTITY, task: { ...TASK, taskId: 'other-task' } },
      { identity: IDENTITY, task: { ...TASK, cueId: 'other-cue' } },
      {
        identity: IDENTITY,
        task: {
          ...TASK,
          comfortableRangeMidiCents: [5_600, 6_700],
        },
      },
      {
        identity: IDENTITY,
        task: { ...TASK, targetMidiCents: [5_700, 6_000, 6_400] },
      },
      { identity: IDENTITY, task: { ...TASK, tempoBpm: 72 } },
      {
        identity: IDENTITY,
        task: { ...TASK, durationMilliseconds: 7_000 },
      },
      { identity: IDENTITY, task: { ...TASK, repetitions: 5 } },
      {
        identity: IDENTITY,
        task: {
          ...TASK,
          parameters: { ...TASK.parameters, toleranceCents: 30 },
        },
      },
    ]
    for (const changed of materialChanges) {
      expect(buildGuidedComparisonFingerprint(changed)).not.toBe(baseline)
    }
  })
})

describe('guidedComparisonEligibility', () => {
  const fingerprint = buildGuidedComparisonFingerprint({
    identity: IDENTITY,
    task: TASK,
  })

  it('suppresses level and spectrum deltas across input changes', () => {
    expect(
      guidedComparisonEligibility({
        earlierFingerprint: fingerprint,
        laterFingerprint: fingerprint,
        family: 'spectrum',
        earlierCapture: CAPTURE_A,
        laterCapture: { ...CAPTURE_A, inputContextKey: 'local-input-b' },
      }),
    ).toBe('suppressed-input-change')
  })

  it('keeps pitch comparable but names an input caveat', () => {
    expect(
      guidedComparisonEligibility({
        earlierFingerprint: fingerprint,
        laterFingerprint: fingerprint,
        family: 'pitch',
        earlierCapture: CAPTURE_A,
        laterCapture: { ...CAPTURE_A, inputContextKey: 'local-input-b' },
      }),
    ).toBe('comparable-with-input-caveat')
  })

  it('lets an explicit proxy sensitivity override its metric family', () => {
    expect(
      guidedComparisonEligibility({
        earlierFingerprint: fingerprint,
        laterFingerprint: fingerprint,
        family: 'pitch',
        earlierCapture: CAPTURE_A,
        laterCapture: { ...CAPTURE_A, inputContextKey: 'local-input-b' },
        inputSensitivity: 'input-sensitive',
      }),
    ).toBe('suppressed-input-change')
  })
})

describe('compareGuidedMeasurement', () => {
  const fingerprint = buildGuidedComparisonFingerprint({
    identity: IDENTITY,
    task: TASK,
  })

  it('calls a delta inside the validated uncertainty similar', () => {
    const result = compareGuidedMeasurement({
      earlier: evidence(18),
      later: evidence(15),
      earlierFingerprint: fingerprint,
      laterFingerprint: fingerprint,
      earlierCapture: CAPTURE_A,
      laterCapture: CAPTURE_A,
      uncertainty: 5,
    })
    expect(result).toMatchObject({
      status: 'similar',
      direction: 'similar',
      delta: -3,
    })
  })

  it('reports a larger change neutrally without calling it improvement', () => {
    const result = compareGuidedMeasurement({
      earlier: evidence(18),
      later: evidence(9),
      earlierFingerprint: fingerprint,
      laterFingerprint: fingerprint,
      earlierCapture: CAPTURE_A,
      laterCapture: CAPTURE_A,
      uncertainty: 5,
    })
    expect(result).toMatchObject({
      status: 'changed',
      direction: 'lower',
      delta: -9,
    })
    expect(JSON.stringify(result)).not.toContain('improv')
  })

  it('reports only a raw difference when uncertainty is not validated', () => {
    expect(
      compareGuidedMeasurement({
        earlier: evidence(18),
        later: evidence(9),
        earlierFingerprint: fingerprint,
        laterFingerprint: fingerprint,
        earlierCapture: CAPTURE_A,
        laterCapture: CAPTURE_A,
        uncertainty: null,
      }),
    ).toMatchObject({
      status: 'raw-difference',
      delta: -9,
      direction: null,
      uncertainty: null,
    })
  })

  it('refuses comparison across incompatible task fingerprints', () => {
    const other = buildGuidedComparisonFingerprint({
      identity: IDENTITY,
      task: { ...TASK, repetitions: 5 },
    })
    expect(
      compareGuidedMeasurement({
        earlier: evidence(18),
        later: evidence(9),
        earlierFingerprint: fingerprint,
        laterFingerprint: other,
        earlierCapture: CAPTURE_A,
        laterCapture: CAPTURE_A,
        uncertainty: 5,
      }),
    ).toEqual({
      status: 'incompatible',
      eligibility: 'incompatible-protocol',
      reason: 'protocol-mismatch',
    })
  })

  it('suppresses spectral deltas when input context is unknown', () => {
    expect(
      compareGuidedMeasurement({
        earlier: evidence(10, 'spectrum'),
        later: evidence(12, 'spectrum'),
        earlierFingerprint: fingerprint,
        laterFingerprint: fingerprint,
        earlierCapture: { ...CAPTURE_A, inputContextKey: null },
        laterCapture: CAPTURE_A,
        uncertainty: 1,
      }),
    ).toMatchObject({
      status: 'suppressed',
      reason: 'input-context-unknown',
    })
  })

  it('suppresses an input-sensitive pitch proxy across input changes', () => {
    expect(
      compareGuidedMeasurement({
        earlier: proxyEvidence(10, 'input-sensitive'),
        later: proxyEvidence(12, 'input-sensitive'),
        earlierFingerprint: fingerprint,
        laterFingerprint: fingerprint,
        earlierCapture: CAPTURE_A,
        laterCapture: { ...CAPTURE_A, inputContextKey: 'local-input-b' },
        uncertainty: 1,
      }),
    ).toMatchObject({
      status: 'suppressed',
      reason: 'input-context-changed',
    })
  })

  it('refuses singer reports instead of treating availability as numeric', () => {
    const singerReport: GuidedSingerReportEvidence = {
      id: 'effort-report',
      assessmentId: 'pitch-centre',
      measurementKey: 'singer-effort',
      availability: 'available',
      evidenceClass: 'singer-report',
      comparisonFamily: null,
      value: 'easy',
      moments: [],
    }
    expect(
      compareGuidedMeasurement({
        earlier: singerReport,
        later: singerReport,
        earlierFingerprint: fingerprint,
        laterFingerprint: fingerprint,
        earlierCapture: CAPTURE_A,
        laterCapture: CAPTURE_A,
        uncertainty: null,
      }),
    ).toEqual({
      status: 'unavailable',
      eligibility: 'comparable',
      reason: 'evidence-unavailable',
    })
  })

  it('reports a protocol mismatch before unavailable or invalid evidence', () => {
    const other = buildGuidedComparisonFingerprint({
      identity: IDENTITY,
      task: { ...TASK, repetitions: 5 },
    })
    const singerReport: GuidedSingerReportEvidence = {
      id: 'effort-report',
      assessmentId: 'pitch-centre',
      measurementKey: 'singer-effort',
      availability: 'available',
      evidenceClass: 'singer-report',
      comparisonFamily: null,
      value: 'easy',
      moments: [],
    }
    const malformed = {
      ...evidence(18),
      measurement: {
        kind: 'scalar' as const,
        value: Number.NaN,
        unit: 'cents' as const,
      },
    }

    for (const candidate of [singerReport, malformed]) {
      expect(
        compareGuidedMeasurement({
          earlier: candidate,
          later: candidate,
          earlierFingerprint: fingerprint,
          laterFingerprint: other,
          earlierCapture: CAPTURE_A,
          laterCapture: CAPTURE_A,
          uncertainty: null,
        }),
      ).toEqual({
        status: 'incompatible',
        eligibility: 'incompatible-protocol',
        reason: 'protocol-mismatch',
      })
    }
  })
})
