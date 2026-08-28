// ============================================================
// Pitch Centre pilot assessment — one bounded route from capture to practice
// ============================================================
//
// The neutral landing metric deliberately owns no public policy. This facade
// coordinates the versioned protocol, capture-quality, evidence, persistence,
// and recommendation modules while preserving the pilot's public API.

import type { GuidedPersistedAssessmentContext, GuidedQualityGateResult, GuidedRetakeProtocol, } from './contracts'
import { isGuidedIdentifier } from './identifiers'
import { aggregatePitchCentreLandings, measurePitchCentreLanding, } from './pitch-centre'
import { buildPitchCentreEvidence, buildPitchCentreFindings, } from './pitch-centre-assessment-evidence'
import { PITCH_CENTRE_PILOT_DEFINITION_V1, PITCH_CENTRE_PILOT_IDENTITY_V1, PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1, PITCH_CENTRE_PILOT_THRESHOLDS_V1, } from './pitch-centre-assessment-policy'
import { isPitchCentrePilotProtocol } from './pitch-centre-assessment-protocol'
import { captureQualityObservations, normalizeLandingWindow, validCaptureContext, validSafetyContext, } from './pitch-centre-assessment-quality'
import type { PitchCentrePilotAssessmentInput, PitchCentrePilotAssessmentResult, } from './pitch-centre-assessment-types'
import { cloneProtocol, freezeDeep } from './pitch-centre-assessment-utils'
import { evaluateGuidedQualityGate } from './quality-gate'
import { resolveGuidedRecommendationOutcome } from './recommendations'
import { validateGuidedEvidenceContract, validateGuidedFocusReadingContract, } from './validation'

export {
  PITCH_CENTRE_PILOT_DEFINITION_V1,
  PITCH_CENTRE_PILOT_IDENTITY_V1,
  PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1,
  PITCH_CENTRE_PILOT_THRESHOLDS_V1,
} from './pitch-centre-assessment-policy'
export {
  createPitchCentrePilotProtocol,
  isPitchCentrePilotProtocol,
} from './pitch-centre-assessment-protocol'
export { isPersistedPitchCentrePilotFocus } from './pitch-centre-assessment-persistence'
export type {
  CreatePitchCentrePilotProtocolInput,
  PitchCentrePilotAssessmentInput,
  PitchCentrePilotAssessmentResult,
  PitchCentrePilotCaptureQuality,
  PitchCentrePilotLandingWindow,
} from './pitch-centre-assessment-types'

function unavailableQuality(): GuidedQualityGateResult {
  return evaluateGuidedQualityGate(
    PITCH_CENTRE_PILOT_DEFINITION_V1.requiredQualityChecks,
    [],
  )
}

function failedAssessment(
  protocol: Readonly<GuidedRetakeProtocol>,
  reasonCode: string,
): PitchCentrePilotAssessmentResult {
  return freezeDeep({
    definition: PITCH_CENTRE_PILOT_DEFINITION_V1,
    protocol: cloneProtocol(protocol),
    landings: [],
    aggregate: aggregatePitchCentreLandings([]),
    quality: unavailableQuality(),
    evidence: [],
    findings: [],
    outcome: { kind: 'analysis-failed', reasonCode },
    persistedContext: null,
    reading: null,
  })
}

/**
 * Resolve one complete pilot run. All frame times are normalized per landing
 * before measurement, then converted back to full-recording evidence moments.
 */
export function assessPitchCentrePilot(
  input: PitchCentrePilotAssessmentInput,
): PitchCentrePilotAssessmentResult {
  if (
    !isGuidedIdentifier(input.runId) ||
    !isPitchCentrePilotProtocol(input.protocol) ||
    !Number.isFinite(input.captureDurationMilliseconds) ||
    input.captureDurationMilliseconds <= 0 ||
    !validCaptureContext(input.captureContext) ||
    !validSafetyContext(input.safety)
  ) {
    return failedAssessment(
      input.protocol,
      'pitch-centre.invalid-assessment-input',
    )
  }

  try {
    const protocol = cloneProtocol(input.protocol)
    const captureDurationSeconds = input.captureDurationMilliseconds / 1000
    const normalized = input.landingWindows.map((window) =>
      normalizeLandingWindow(window, captureDurationSeconds),
    )
    const landings = normalized.map((window, index) =>
      measurePitchCentreLanding(
        window.frames,
        protocol.task.targetMidiCents[index] ?? 0,
        PITCH_CENTRE_PILOT_THRESHOLDS_V1.measurement,
      ),
    )
    const aggregate = aggregatePitchCentreLandings(landings)
    const quality = evaluateGuidedQualityGate(
      PITCH_CENTRE_PILOT_DEFINITION_V1.requiredQualityChecks,
      captureQualityObservations({
        facts: input.quality,
        normalized,
        landings,
        captureDurationMilliseconds: input.captureDurationMilliseconds,
        task: protocol.task,
      }),
    )
    const evidence = buildPitchCentreEvidence({
      normalized,
      aggregate,
      landings,
    })
    const findings = buildPitchCentreFindings(input.runId, aggregate)
    const outcome = resolveGuidedRecommendationOutcome(
      {
        definition: PITCH_CENTRE_PILOT_DEFINITION_V1,
        quality,
        safety: input.safety,
        evidence,
        findings,
        analysisFailureReasonCode: null,
        originatingCapture: {
          assessmentRunId: input.runId,
          protocol,
        },
      },
      PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1,
    )
    const evidenceValidation = validateGuidedEvidenceContract({
      assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
      captureDurationSeconds,
      evidence,
    })
    const reading = outcome.kind === 'focus-reading' ? outcome.reading : null
    const readingValidation =
      reading === null
        ? null
        : validateGuidedFocusReadingContract({
            assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
            captureDurationSeconds,
            evidence,
            reading,
          })
    if (
      !evidenceValidation.valid ||
      (readingValidation !== null && !readingValidation.valid)
    ) {
      return failedAssessment(
        input.protocol,
        'pitch-centre.contract-validation-failed',
      )
    }

    const persistedContext: GuidedPersistedAssessmentContext | null =
      outcome.kind === 'focus-reading'
        ? {
            runId: input.runId,
            identity: { ...protocol.identity },
            task: protocol.task,
            captureSource: 'dry-microphone',
            comparisonFingerprint: protocol.comparisonFingerprint,
            quality,
            evidence,
            recommendation: outcome.reading.recommendation,
            singerEffort: input.safety.singerEffort,
            captureContext: { ...input.captureContext },
          }
        : null

    return freezeDeep({
      definition: PITCH_CENTRE_PILOT_DEFINITION_V1,
      protocol,
      landings,
      aggregate,
      quality,
      evidence,
      findings,
      outcome,
      persistedContext,
      reading,
    })
  } catch {
    return failedAssessment(input.protocol, 'pitch-centre.analysis-failed')
  }
}
