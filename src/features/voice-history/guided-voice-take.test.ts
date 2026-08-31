// ============================================================
// Guided Voice Take persistence tests
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceTakeRecord } from '@/db/entities'
import { GUIDED_VOICE_TAKE_CONTEXT_VERSION, GUIDED_VOICE_TAKE_TITLE, isVoiceTakeComparisonEligible, keepGuidedVoiceTake, parseGuidedVoiceTakeContext, } from '@/features/voice-history/guided-voice-take'
import type { GuidedFocusReading, GuidedPersistedAssessmentContext, GuidedQualityObservation, } from '@/lib/guided-voice'
import { buildGuidedComparisonFingerprint, evaluateGuidedQualityGate, PITCH_CENTRE_PILOT_DEFINITION_V1, } from '@/lib/guided-voice'
import { assessPitchCentrePilot, createPitchCentrePilotProtocol, PITCH_CENTRE_PILOT_THRESHOLDS_V1, } from '@/lib/guided-voice/pitch-centre-assessment'
import type { F0Frame } from '@/lib/pitch-measurements'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'

const { saveVoiceTakeMock } = vi.hoisted(() => ({
  saveVoiceTakeMock: vi.fn(),
}))

vi.mock('@/db/services/voice-take-service', () => ({
  saveVoiceTake: saveVoiceTakeMock,
}))

const PROTOCOL = createPitchCentrePilotProtocol({
  comfortableRangeMidiCents: [5_700, 7_300],
  preferredMidiCents: 6_913,
})
const FINGERPRINT = PROTOCOL.comparisonFingerprint
const CAPTURE_DURATION_MS = PROTOCOL.task.durationMilliseconds
const HOP_SECONDS = 0.02

function centsToHz(cents: number): number {
  return 440 * 2 ** ((cents - 6_900) / 1_200)
}

function landingFrames(input: {
  startSeconds: number
  targetMidiCents: number
  initialOffsetCents?: number
}): F0Frame[] {
  return Array.from({ length: 90 }, (_, index) => ({
    t: input.startSeconds + index * HOP_SECONDS,
    f0: centsToHz(
      input.targetMidiCents + (index < 8 ? (input.initialOffsetCents ?? 0) : 0),
    ),
    conf: 0.95,
  }))
}

function qualityObservations(
  assessment: GuidedPersistedAssessmentContext,
  overrides: Partial<
    Record<GuidedQualityObservation['id'], GuidedQualityObservation>
  > = {},
): GuidedQualityObservation[] {
  return assessment.quality.observations.map(
    ({ id, status, reasonCode }) => overrides[id] ?? { id, status, reasonCode },
  )
}

function fixtures(
  noiseSeparation: 'sufficient' | 'insufficient' | 'unavailable' = 'sufficient',
  sungOffsetCents = 0,
): {
  assessment: GuidedPersistedAssessmentContext
  reading: GuidedFocusReading
} {
  const result = assessPitchCentrePilot({
    runId: 'pitch-centre.run-1',
    protocol: PROTOCOL,
    captureDurationMilliseconds: CAPTURE_DURATION_MS,
    landingWindows: PROTOCOL.task.targetMidiCents.map((target, index) => {
      const startSeconds =
        (index * PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds) /
        1000
      return {
        startSeconds,
        endSeconds:
          startSeconds +
          PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds / 1000,
        frames: landingFrames({
          startSeconds,
          targetMidiCents: target + sungOffsetCents,
          initialOffsetCents: index === 1 ? -80 : 0,
        }),
      }
    }),
    quality: {
      microphoneContinuous: true,
      clippingDetected: false,
      noiseSeparation,
      taskCompleted: true,
      analysisAvailable: true,
    },
    safety: { preCapture: 'proceed', singerEffort: 'workable' },
    captureContext: {
      inputContextKey: null,
      detectorId: 'yin',
      detectorVersion: '1.0.0',
      sampleRateHz: 48_000,
    },
  })
  if (result.persistedContext === null || result.reading === null) {
    throw new Error('Canonical Pitch Centre fixture did not produce a reading')
  }
  return {
    assessment: result.persistedContext,
    reading: result.reading,
  }
}

function recordFor(
  context: unknown,
  overrides: Partial<VoiceTakeRecord> = {},
): Pick<
  VoiceTakeRecord,
  | 'source'
  | 'comparisonKey'
  | 'contextVersion'
  | 'durationMs'
  | 'title'
  | 'contextJson'
> {
  return {
    source: 'guided',
    comparisonKey: FINGERPRINT,
    contextVersion: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
    durationMs: CAPTURE_DURATION_MS,
    title: GUIDED_VOICE_TAKE_TITLE,
    contextJson: JSON.stringify(context),
    ...overrides,
  }
}

describe('guided voice-take persistence', () => {
  beforeEach(() => {
    saveVoiceTakeMock.mockReset()
    saveVoiceTakeMock.mockResolvedValue({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
  })

  it('keeps the exact assessment and Focus Reading with the dry capture', async () => {
    const { assessment, reading } = fixtures()
    const take = {
      blob: new Blob(['voice'], { type: 'audio/webm' }),
      durationMs: CAPTURE_DURATION_MS,
      peaks: new Float32Array([0.2, 0.8]),
      capturedAt: '2026-08-12T12:00:00.000Z',
      contour: encodeVoiceAtlasContour([], {
        source: 'f0-stream-yin-v1',
      }),
    }

    await keepGuidedVoiceTake({ take, assessment, reading })

    expect(saveVoiceTakeMock).toHaveBeenCalledWith({
      source: 'guided',
      comparisonKey: FINGERPRINT,
      contextVersion: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      capturedAt: take.capturedAt,
      durationMs: take.durationMs,
      blob: take.blob,
      peaks: take.peaks,
      contour: take.contour,
      title: GUIDED_VOICE_TAKE_TITLE,
      context: {
        kind: 'guided-focus-take',
        version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
        assessment,
        reading,
      },
    })
  })

  it('parses a complete valid Focus Take', () => {
    const { assessment, reading } = fixtures()
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment,
      reading,
    }

    expect(parseGuidedVoiceTakeContext(recordFor(context))).toEqual(context)
  })

  it('parses the pilot partial reading when noise separation is unavailable', () => {
    const { assessment, reading } = fixtures('unavailable')
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment,
      reading,
    }

    expect(assessment.quality).toMatchObject({
      outcome: 'partial',
      partialCheckIds: ['noise-separation'],
    })
    expect(parseGuidedVoiceTakeContext(recordFor(context))).toEqual(context)
  })

  it('parses the pilot refine reading when none of the landings settles', () => {
    const { assessment, reading } = fixtures('sufficient', -1_200)
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment,
      reading,
    }

    expect(reading.focusFinding.findingCode).toBe(
      'pitch-centre.finding.refine-centre',
    )
    expect(parseGuidedVoiceTakeContext(recordFor(context))).toEqual(context)
  })

  it('rejects quality metadata whose outcome contradicts its observations', () => {
    const { assessment, reading } = fixtures()
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment: {
        ...assessment,
        quality: { ...assessment.quality, outcome: 'partial' as const },
      },
      reading,
    }

    expect(parseGuidedVoiceTakeContext(recordFor(context))).toBeNull()
  })

  it('rejects a required failure omitted from the blocking checks', () => {
    const { assessment, reading } = fixtures()
    const failedQuality = evaluateGuidedQualityGate(
      PITCH_CENTRE_PILOT_DEFINITION_V1.requiredQualityChecks,
      qualityObservations(assessment, {
        'microphone-continuity': {
          id: 'microphone-continuity',
          status: 'fail',
          reasonCode: 'pitch-centre.microphone-interrupted',
        },
      }),
    )
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment: {
        ...assessment,
        quality: {
          ...failedQuality,
          blockingCheckIds: [],
        },
      },
      reading,
    }

    expect(parseGuidedVoiceTakeContext(recordFor(context))).toBeNull()
  })

  it('rejects a passing check forged into the blocking list', () => {
    const { assessment, reading } = fixtures()
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment: {
        ...assessment,
        quality: {
          ...assessment.quality,
          blockingCheckIds: ['microphone-continuity'] as const,
        },
      },
      reading,
    }

    expect(parseGuidedVoiceTakeContext(recordFor(context))).toBeNull()
  })

  it('rejects a required protocol check relabelled as optional', () => {
    const { assessment, reading } = fixtures()
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment: {
        ...assessment,
        quality: {
          ...assessment.quality,
          observations: assessment.quality.observations.map((observation) =>
            observation.id === 'signal-coverage'
              ? {
                  ...observation,
                  required: false,
                  failureDisposition: null,
                }
              : observation,
          ),
        },
      },
      reading,
    }

    expect(parseGuidedVoiceTakeContext(recordFor(context))).toBeNull()
  })

  it('rejects an optional quality problem omitted from the partial checks', () => {
    const { assessment, reading } = fixtures()
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment: {
        ...assessment,
        quality: {
          outcome: 'ready' as const,
          observations: assessment.quality.observations.map((observation) =>
            observation.id === 'noise-separation'
              ? {
                  ...observation,
                  status: 'unavailable' as const,
                  reasonCode: 'pitch-centre.noise-separation-unavailable',
                }
              : observation,
          ),
          blockingCheckIds: [],
          partialCheckIds: [],
        },
      },
      reading,
    }

    expect(parseGuidedVoiceTakeContext(recordFor(context))).toBeNull()
  })

  it('rejects a guided context without a Focus Reading', () => {
    const { assessment } = fixtures()
    const unavailableAssessment: GuidedPersistedAssessmentContext = {
      ...assessment,
      quality: evaluateGuidedQualityGate(
        PITCH_CENTRE_PILOT_DEFINITION_V1.requiredQualityChecks,
        qualityObservations(assessment, {
          'signal-coverage': {
            id: 'signal-coverage',
            status: 'fail',
            reasonCode: 'pitch-centre.signal-coverage-low',
          },
        }),
      ),
      evidence: [
        {
          id: 'landing-error',
          assessmentId: assessment.identity.assessmentId,
          measurementKey: 'median-absolute-error-cents',
          availability: 'unavailable',
          evidenceClass: 'direct-measurement',
          comparisonFamily: 'pitch',
          reason: 'insufficient-signal',
        },
      ],
      recommendation: null,
    }
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment: unavailableAssessment,
      reading: null,
    }

    expect(parseGuidedVoiceTakeContext(recordFor(context))).toBeNull()
  })

  it('rejects a row whose comparison key does not match its protocol', () => {
    const { assessment, reading } = fixtures()
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment,
      reading,
    }

    expect(
      parseGuidedVoiceTakeContext(
        recordFor(context, { comparisonKey: `${FINGERPRINT}:tampered` }),
      ),
    ).toBeNull()
  })

  it('rejects a stale protocol identity even with a matching fingerprint', () => {
    const { assessment, reading } = fixtures()
    const identity = { ...assessment.identity, protocolVersion: '0.9.0' }
    const comparisonFingerprint = buildGuidedComparisonFingerprint({
      identity,
      task: assessment.task,
    })
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment: {
        ...assessment,
        identity,
        comparisonFingerprint,
      },
      reading,
    }

    expect(
      parseGuidedVoiceTakeContext(
        recordFor(context, { comparisonKey: comparisonFingerprint }),
      ),
    ).toBeNull()
  })

  it('rejects a self-consistent non-pilot task and retake', () => {
    const { assessment, reading } = fixtures()
    const task = {
      ...assessment.task,
      taskId: 'pitch-centre.pilot-three-landings-altered',
    }
    const comparisonFingerprint = buildGuidedComparisonFingerprint({
      identity: assessment.identity,
      task,
    })
    const recommendation = {
      ...reading.recommendation,
      retake: {
        identity: assessment.identity,
        task,
        comparisonFingerprint,
      },
    }
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment: {
        ...assessment,
        task,
        comparisonFingerprint,
        recommendation,
      },
      reading: { ...reading, recommendation },
    }

    expect(
      parseGuidedVoiceTakeContext(
        recordFor(context, { comparisonKey: comparisonFingerprint }),
      ),
    ).toBeNull()
  })

  it('rejects a structurally valid recommendation not emitted by the pilot', () => {
    const { assessment, reading } = fixtures()
    const recommendation = {
      ...reading.recommendation,
      id: 'pitch-centre.recommendation.pitch-hold-custom',
      reasonId: 'pitch-centre.reason.custom',
    }
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment: { ...assessment, recommendation },
      reading: { ...reading, recommendation },
    }

    expect(parseGuidedVoiceTakeContext(recordFor(context))).toBeNull()
  })

  it('rejects evidence that no longer supports the persisted finding', () => {
    const { assessment, reading } = fixtures()
    const evidence = assessment.evidence.map((item) =>
      item.id === 'pitch-centre.evidence.median-absolute-error' &&
      item.availability === 'available' &&
      item.evidenceClass === 'direct-measurement' &&
      item.measurement.kind === 'scalar'
        ? {
            ...item,
            measurement: { ...item.measurement, value: 80 },
          }
        : item,
    )
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment: { ...assessment, evidence },
      reading,
    }

    expect(parseGuidedVoiceTakeContext(recordFor(context))).toBeNull()
  })

  it('keeps corrupt guided rows out of compatible comparisons', () => {
    const { assessment, reading } = fixtures()
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment,
      reading,
    }
    const valid = recordFor(context)
    const corrupt = recordFor(context, {
      comparisonKey: `${FINGERPRINT}:tampered`,
    })

    expect(isVoiceTakeComparisonEligible(valid)).toBe(true)
    expect(isVoiceTakeComparisonEligible(corrupt)).toBe(false)
    expect(
      isVoiceTakeComparisonEligible({ ...corrupt, source: 'freeform' }),
    ).toBe(true)
  })

  it('rejects a dangling Focus Reading instead of trusting stale advice', () => {
    const { assessment, reading } = fixtures()
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment,
      reading: {
        ...reading,
        primaryEvidenceId: 'missing-evidence',
      },
    }

    expect(parseGuidedVoiceTakeContext(recordFor(context))).toBeNull()
  })

  it.each([
    ['wrong source', { source: 'freeform' as const }],
    ['wrong version', { contextVersion: 2 }],
    ['wrong title', { title: 'Renamed' }],
    ['invalid JSON', { contextJson: '{' }],
  ])('fails closed for %s', (_label, overrides) => {
    const { assessment, reading } = fixtures()
    const context = {
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment,
      reading,
    }

    expect(
      parseGuidedVoiceTakeContext(recordFor(context, overrides)),
    ).toBeNull()
  })
})
