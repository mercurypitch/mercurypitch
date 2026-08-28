// ============================================================
// Pitch Centre assessment types — public pilot input and result contracts
// ============================================================
//
// Keeping these data shapes independent lets capture, quality evaluation, and
// persistence validation share them without importing the assessment facade.

import type { F0Frame } from '@/lib/pitch-measurements'
import type { GuidedAssessmentDefinition, GuidedAssessmentOutcome, GuidedCaptureContext, GuidedEvidence, GuidedFinding, GuidedFocusReading, GuidedPersistedAssessmentContext, GuidedQualityGateResult, GuidedRetakeProtocol, GuidedSafetyContext, } from './contracts'
import type { PitchCentreLandingAggregate, PitchCentreLandingResult, } from './pitch-centre'

export interface CreatePitchCentrePilotProtocolInput {
  comfortableRangeMidiCents: readonly [number, number]
  preferredMidiCents: number
}

export interface PitchCentrePilotLandingWindow {
  /** Start of this scored window on the full dry recording clock. */
  startSeconds: number
  /** End of this scored window on the full dry recording clock. */
  endSeconds: number
  /** Raw detector frames may use this window's local clock or the full take clock. */
  frames: readonly F0Frame[]
}

export interface PitchCentrePilotCaptureQuality {
  microphoneContinuous: boolean
  clippingDetected: boolean | 'unavailable'
  noiseSeparation: 'sufficient' | 'insufficient' | 'unavailable'
  taskCompleted: boolean
  analysisAvailable: boolean
}

export interface PitchCentrePilotAssessmentInput {
  runId: string
  protocol: Readonly<GuidedRetakeProtocol>
  captureDurationMilliseconds: number
  landingWindows: readonly PitchCentrePilotLandingWindow[]
  quality: PitchCentrePilotCaptureQuality
  safety: GuidedSafetyContext
  captureContext: GuidedCaptureContext
}

export interface PitchCentrePilotAssessmentResult {
  definition: GuidedAssessmentDefinition
  protocol: Readonly<GuidedRetakeProtocol>
  landings: readonly PitchCentreLandingResult[]
  aggregate: PitchCentreLandingAggregate
  quality: GuidedQualityGateResult
  evidence: readonly GuidedEvidence[]
  findings: readonly GuidedFinding[]
  outcome: GuidedAssessmentOutcome
  /** Null means no guided assessment context is safe to persist. */
  persistedContext: GuidedPersistedAssessmentContext | null
  /** Present only when the validated outcome contains a Focus reading. */
  reading: GuidedFocusReading | null
}
