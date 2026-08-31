// ============================================================
// Pitch Centre pilot policy — versioned thresholds and recommendation rules
// ============================================================
//
// The neutral landing metric owns no public policy. This module keeps the
// reviewed pilot definition, thresholds, and practice route together so both
// live assessment and persisted-data validation use the exact same contract.

import type { GuidedAssessmentDefinition } from './contracts'
import type { PitchCentreLandingProtocol } from './pitch-centre'
import { freezeDeep } from './pitch-centre-assessment-utils'
import type { GuidedRecommendationRule } from './recommendations'

/** Every public pilot threshold is versioned here rather than in the UI. */
export const PITCH_CENTRE_PILOT_THRESHOLDS_V1 = freezeDeep({
  version: '1.0.0',
  repetitions: 3,
  targetOffsetsMidiCents: [-200, 0, 200] as const,
  minimumComfortableSpanMidiCents: 400,
  landingWindowMilliseconds: 1_800,
  minimumConfidentCoverageRatio: 0.55,
  reinforceSettledRepetitions: 3,
  reinforceMedianAbsoluteErrorCents: 25,
  practiceDurationMilliseconds: 5_000,
  measurement: {
    confidenceFloor: 0.6,
    medianWindow: 5,
    maxVoicedGapMilliseconds: 100,
    minimumObservationMilliseconds: 900,
    minimumConfidentFrames: 18,
    settleToleranceCents: 35,
    settleHoldMilliseconds: 300,
    minimumSettlingFrames: 10,
    approachDeadbandCents: 12,
    approachConsensusRatio: 0.7,
  } satisfies PitchCentreLandingProtocol,
})

export const PITCH_CENTRE_PILOT_IDENTITY_V1 = freezeDeep({
  assessmentId: 'pitch-centre',
  protocolVersion: PITCH_CENTRE_PILOT_THRESHOLDS_V1.version,
  instructionVersion: '1.0.0',
  targetVersion: '1.0.0',
  analysisVersion: '1.0.0',
  scoringVersion: 'score-free-1.0.0',
})

const REQUIRED_QUALITY_CHECKS = freezeDeep([
  { id: 'microphone-continuity', failureDisposition: 'retry-recording' },
  { id: 'clipping', failureDisposition: 'retry-recording' },
  { id: 'signal-coverage', failureDisposition: 'retry-recording' },
  { id: 'pitch-confidence', failureDisposition: 'retry-recording' },
  { id: 'task-completion', failureDisposition: 'retry-recording' },
  { id: 'duration', failureDisposition: 'retry-recording' },
  { id: 'repetitions', failureDisposition: 'retry-recording' },
  { id: 'analysis-capability', failureDisposition: 'unavailable-here' },
] as const)

// Landing windows originate from integer millisecond capture clocks but cross
// the public boundary as seconds. Allow only sub-microsecond representation
// error when comparing them back to the authored millisecond duration.
const DURATION_COMPARISON_EPSILON_MS = 0.001

export function meetsPitchCentreLandingWindowDuration(
  startSeconds: number,
  endSeconds: number,
): boolean {
  return (
    (endSeconds - startSeconds) * 1000 + DURATION_COMPARISON_EPSILON_MS >=
    PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds
  )
}

export const PITCH_CENTRE_PILOT_DEFINITION_V1: GuidedAssessmentDefinition =
  freezeDeep({
    identity: PITCH_CENTRE_PILOT_IDENTITY_V1,
    title: 'Pitch Centre',
    evidenceClass: 'direct-measurement',
    requiredSignals: ['f0', 'confidence', 'dry-audio'],
    requiredQualityChecks: REQUIRED_QUALITY_CHECKS,
    allowedFindingCodes: [
      'pitch-centre.finding.complete-landings',
      'pitch-centre.finding.reinforce-centre',
      'pitch-centre.finding.refine-centre',
    ],
    recommendationRuleIds: [
      'pitch-centre.rule.reinforce-centre',
      'pitch-centre.rule.refine-centre',
    ],
    comparisonFamilies: ['pitch', 'timing'],
  })

function recommendationRule(input: {
  id: string
  order: number
  focusFindingCode: string
  recommendationId: string
  reasonId: string
}): GuidedRecommendationRule {
  return {
    id: input.id,
    version: PITCH_CENTRE_PILOT_THRESHOLDS_V1.version,
    order: input.order,
    assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
    primaryEvidenceId: 'pitch-centre.evidence.settled-landings',
    evidenceRequirements: [
      {
        evidenceId: 'pitch-centre.evidence.measured-landings',
        evidenceClass: 'direct-measurement',
        requiredFindingCodes: ['pitch-centre.finding.complete-landings'],
      },
      {
        evidenceId: 'pitch-centre.evidence.settled-landings',
        evidenceClass: 'direct-measurement',
        requiredFindingCodes: [input.focusFindingCode],
      },
    ],
    positiveFinding: {
      evidenceId: 'pitch-centre.evidence.measured-landings',
      findingCode: 'pitch-centre.finding.complete-landings',
    },
    focusFinding: {
      evidenceId: 'pitch-centre.evidence.settled-landings',
      findingCode: input.focusFindingCode,
    },
    recommendation: {
      id: input.recommendationId,
      version: PITCH_CENTRE_PILOT_THRESHOLDS_V1.version,
      exercise: {
        exerciseId: 'pitch-hold',
        exerciseVersion: '1.0.0',
        configuration: {
          configurationId: 'pitch-hold.guided-pitch-centre',
          configurationVersion: '1.0.0',
        },
      },
      reasonId: input.reasonId,
      dose: {
        durationMilliseconds:
          PITCH_CENTRE_PILOT_THRESHOLDS_V1.practiceDurationMilliseconds,
        repetitions: PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions,
        sets: 1,
        comfortableRangeMidiCents: null,
        demand: 'same',
      },
      stopRuleId: 'guided.stop-on-discomfort-v1',
      alternativeRecommendationId: null,
    },
  }
}

export const PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1 = freezeDeep([
  recommendationRule({
    id: 'pitch-centre.rule.reinforce-centre',
    order: 10,
    focusFindingCode: 'pitch-centre.finding.reinforce-centre',
    recommendationId: 'pitch-centre.recommendation.pitch-hold-reinforce',
    reasonId: 'pitch-centre.reason.reinforce-centred-landings',
  }),
  recommendationRule({
    id: 'pitch-centre.rule.refine-centre',
    order: 20,
    focusFindingCode: 'pitch-centre.finding.refine-centre',
    recommendationId: 'pitch-centre.recommendation.pitch-hold-refine',
    reasonId: 'pitch-centre.reason.refine-centred-landings',
  }),
] as const)
