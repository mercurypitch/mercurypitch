// ============================================================
// Pitch Centre assessment evidence — moments, findings, and measurements
// ============================================================
//
// This module turns neutral landing aggregates into the bounded evidence and
// finding codes allowed by the versioned Pitch Centre pilot definition.

import type { GuidedDirectMeasurementEvidence, GuidedEvidence, GuidedEvidenceMoment, GuidedFinding, GuidedUnavailableEvidence, } from './contracts'
import type { PitchCentreLandingAggregate, PitchCentreLandingResult, } from './pitch-centre'
import { PITCH_CENTRE_PILOT_IDENTITY_V1, PITCH_CENTRE_PILOT_THRESHOLDS_V1, } from './pitch-centre-assessment-policy'
import type { NormalizedLandingWindow } from './pitch-centre-assessment-quality'

function fullWindowMoments(
  normalized: readonly NormalizedLandingWindow[],
): GuidedEvidenceMoment[] {
  return normalized
    .filter((window) => window.valid)
    .map((window, index) => ({
      id: `pitch-centre.moment.landing-${index + 1}`,
      startSeconds: window.startSeconds,
      endSeconds: window.endSeconds,
      labelId: 'pitch-centre.evidence.landing-window',
    }))
}

function settlingMoments(
  normalized: readonly NormalizedLandingWindow[],
  landings: readonly PitchCentreLandingResult[],
): GuidedEvidenceMoment[] {
  const moments: GuidedEvidenceMoment[] = []
  for (const [index, landing] of landings.entries()) {
    if (landing.kind !== 'measured') continue
    const window = normalized[index]
    if (window === undefined || !window.valid) continue
    for (const [momentIndex, moment] of landing.evidenceMoments.entries()) {
      moments.push({
        id: `pitch-centre.moment.${index + 1}-${moment.kind}-${momentIndex + 1}`,
        startSeconds: window.startSeconds + moment.startMilliseconds / 1000,
        endSeconds: window.startSeconds + moment.endMilliseconds / 1000,
        labelId: `pitch-centre.evidence.${moment.kind}`,
      })
    }
  }
  return moments
}

function unavailablePitchEvidence(
  id: string,
  measurementKey: string,
): GuidedUnavailableEvidence {
  return {
    id,
    assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
    measurementKey,
    availability: 'unavailable',
    evidenceClass: 'direct-measurement',
    comparisonFamily: 'pitch',
    reason: 'insufficient-signal',
  }
}

export function buildPitchCentreEvidence(input: {
  normalized: readonly NormalizedLandingWindow[]
  aggregate: PitchCentreLandingAggregate
  landings: readonly PitchCentreLandingResult[]
}): GuidedEvidence[] {
  const coverageFrames = input.landings.reduce(
    (total, landing) => ({
      numerator: total.numerator + landing.confidentCoverage.numeratorFrames,
      denominator:
        total.denominator + landing.confidentCoverage.denominatorFrames,
    }),
    { numerator: 0, denominator: 0 },
  )
  const coverageConfidence =
    coverageFrames.denominator > 0
      ? coverageFrames.numerator / coverageFrames.denominator
      : 0
  const windowMoments = fullWindowMoments(input.normalized)
  const localSettlingMoments = settlingMoments(input.normalized, input.landings)
  const measuredEvidence: GuidedDirectMeasurementEvidence = {
    id: 'pitch-centre.evidence.measured-landings',
    assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
    measurementKey: 'pitch-centre.measured-landings',
    availability: 'available',
    evidenceClass: 'direct-measurement',
    comparisonFamily: 'pitch',
    measurement: {
      kind: 'fraction',
      numerator: input.aggregate.measuredRepetitions,
      denominator: Math.max(
        PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions,
        input.aggregate.totalRepetitions,
      ),
      numeratorUnit: 'repetitions',
      denominatorUnit: 'repetitions',
    },
    confidence: coverageConfidence,
    moments: windowMoments,
  }
  const settledEvidence: GuidedDirectMeasurementEvidence = {
    id: 'pitch-centre.evidence.settled-landings',
    assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
    measurementKey: 'pitch-centre.settled-landings',
    availability: 'available',
    evidenceClass: 'direct-measurement',
    comparisonFamily: 'pitch',
    measurement: {
      kind: 'fraction',
      numerator: input.aggregate.settledCoverage.numeratorRepetitions,
      denominator: Math.max(
        PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions,
        input.aggregate.settledCoverage.denominatorRepetitions,
      ),
      numeratorUnit: 'repetitions',
      denominatorUnit: 'repetitions',
    },
    confidence: coverageConfidence,
    moments: localSettlingMoments,
  }
  const medianErrorEvidence: GuidedEvidence =
    input.aggregate.medianAbsoluteErrorCents === null
      ? unavailablePitchEvidence(
          'pitch-centre.evidence.median-absolute-error',
          'pitch-centre.median-absolute-error',
        )
      : {
          id: 'pitch-centre.evidence.median-absolute-error',
          assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
          measurementKey: 'pitch-centre.median-absolute-error',
          availability: 'available',
          evidenceClass: 'direct-measurement',
          comparisonFamily: 'pitch',
          measurement: {
            kind: 'scalar',
            value: input.aggregate.medianAbsoluteErrorCents,
            unit: 'cents',
          },
          confidence: coverageConfidence,
          moments: localSettlingMoments,
        }
  const settlingTimeEvidence: GuidedEvidence =
    input.aggregate.medianSettledAtMilliseconds === null
      ? unavailablePitchEvidence(
          'pitch-centre.evidence.median-settling-time',
          'pitch-centre.median-settling-time',
        )
      : {
          id: 'pitch-centre.evidence.median-settling-time',
          assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
          measurementKey: 'pitch-centre.median-settling-time',
          availability: 'available',
          evidenceClass: 'direct-measurement',
          comparisonFamily: 'timing',
          measurement: {
            kind: 'scalar',
            value: input.aggregate.medianSettledAtMilliseconds,
            unit: 'milliseconds',
          },
          confidence: coverageConfidence,
          moments: localSettlingMoments,
        }

  return [
    measuredEvidence,
    settledEvidence,
    medianErrorEvidence,
    settlingTimeEvidence,
  ]
}

export function shouldReinforcePitchCentre(
  settledRepetitions: number,
  medianAbsoluteErrorCents: number | null,
): boolean {
  return (
    settledRepetitions >=
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.reinforceSettledRepetitions &&
    medianAbsoluteErrorCents !== null &&
    medianAbsoluteErrorCents <=
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.reinforceMedianAbsoluteErrorCents
  )
}

export function buildPitchCentrePilotFindings(
  runId: string,
  reinforce: boolean,
): GuidedFinding[] {
  return [
    {
      id: `${runId}.finding.complete-landings`,
      assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
      role: 'positive',
      findingCode: 'pitch-centre.finding.complete-landings',
      evidenceId: 'pitch-centre.evidence.measured-landings',
      confidence: 1,
    },
    {
      id: `${runId}.finding.${reinforce ? 'reinforce' : 'refine'}-centre`,
      assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
      role: 'focus',
      findingCode: reinforce
        ? 'pitch-centre.finding.reinforce-centre'
        : 'pitch-centre.finding.refine-centre',
      evidenceId: 'pitch-centre.evidence.settled-landings',
      confidence: 1,
    },
  ]
}

export function buildPitchCentreFindings(
  runId: string,
  aggregate: PitchCentreLandingAggregate,
): GuidedFinding[] {
  return buildPitchCentrePilotFindings(
    runId,
    shouldReinforcePitchCentre(
      aggregate.settledRepetitions,
      aggregate.medianAbsoluteErrorCents,
    ),
  )
}
