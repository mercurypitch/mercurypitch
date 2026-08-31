// ============================================================
// Pitch Centre assessment quality — capture normalization and gate observations
// ============================================================
//
// This module translates one pilot capture into clock-normalized landing
// windows and explicit quality observations before any recommendation is made.

import type { F0Frame } from '@/lib/pitch-measurements'
import type { GuidedCaptureContext, GuidedQualityObservation, GuidedSafetyContext, GuidedTaskConfiguration, } from './contracts'
import type { PitchCentreLandingResult } from './pitch-centre'
import { meetsPitchCentreLandingWindowDuration, PITCH_CENTRE_PILOT_THRESHOLDS_V1, } from './pitch-centre-assessment-policy'
import type { PitchCentrePilotCaptureQuality, PitchCentrePilotLandingWindow, } from './pitch-centre-assessment-types'

export function validCaptureContext(context: GuidedCaptureContext): boolean {
  return (
    context.detectorId.trim().length > 0 &&
    context.detectorVersion.trim().length > 0 &&
    (context.inputContextKey === null ||
      context.inputContextKey.trim().length > 0) &&
    (context.sampleRateHz === null ||
      (Number.isFinite(context.sampleRateHz) && context.sampleRateHz > 0))
  )
}

export function validSafetyContext(safety: GuidedSafetyContext): boolean {
  return (
    (safety.preCapture === 'proceed' || safety.preCapture === 'stop') &&
    (safety.singerEffort === null ||
      safety.singerEffort === 'easy' ||
      safety.singerEffort === 'workable' ||
      safety.singerEffort === 'effortful' ||
      safety.singerEffort === 'uncomfortable')
  )
}

export interface NormalizedLandingWindow {
  valid: boolean
  startSeconds: number
  endSeconds: number
  frames: readonly F0Frame[]
}

export function normalizeLandingWindow(
  window: PitchCentrePilotLandingWindow,
  captureDurationSeconds: number,
): NormalizedLandingWindow {
  const valid =
    Number.isFinite(window.startSeconds) &&
    Number.isFinite(window.endSeconds) &&
    window.startSeconds >= 0 &&
    window.endSeconds > window.startSeconds &&
    window.endSeconds <= captureDurationSeconds &&
    Array.isArray(window.frames)
  if (!valid) {
    return { valid: false, startSeconds: 0, endSeconds: 0, frames: [] }
  }

  const windowDurationSeconds = window.endSeconds - window.startSeconds
  const usesLocalClock = window.frames.every(
    (frame) => frame.t >= 0 && frame.t <= windowDurationSeconds,
  )

  return {
    valid: true,
    startSeconds: window.startSeconds,
    endSeconds: window.endSeconds,
    frames: usesLocalClock
      ? window.frames.map((frame) => ({ ...frame }))
      : window.frames
          .filter(
            (frame) =>
              frame.t >= window.startSeconds && frame.t < window.endSeconds,
          )
          .map((frame) => ({ ...frame, t: frame.t - window.startSeconds })),
  }
}

function observedStatus(
  value: boolean,
  passWhen: boolean,
): GuidedQualityObservation['status'] {
  if (typeof value !== 'boolean') return 'unavailable'
  return value === passWhen ? 'pass' : 'fail'
}

function reasonForStatus(
  status: GuidedQualityObservation['status'],
  failureReasonCode: string,
  unavailableReasonCode = failureReasonCode,
): string | null {
  if (status === 'pass') return null
  return status === 'fail' ? failureReasonCode : unavailableReasonCode
}

export function captureQualityObservations(input: {
  facts: PitchCentrePilotCaptureQuality
  normalized: readonly NormalizedLandingWindow[]
  landings: readonly PitchCentreLandingResult[]
  captureDurationMilliseconds: number
  task: GuidedTaskConfiguration
}): GuidedQualityObservation[] {
  const coverage = input.landings.reduce(
    (total, landing) => ({
      numerator: total.numerator + landing.confidentCoverage.numeratorFrames,
      denominator:
        total.denominator + landing.confidentCoverage.denominatorFrames,
    }),
    { numerator: 0, denominator: 0 },
  )
  const coverageRatio =
    coverage.denominator > 0 ? coverage.numerator / coverage.denominator : 0
  const exactRepetitionCount =
    input.normalized.length === PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions
  const windowsInOrder = input.normalized.every(
    (window, index) =>
      index === 0 ||
      window.startSeconds >= input.normalized[index - 1].endSeconds,
  )
  const validWindowDuration =
    exactRepetitionCount &&
    windowsInOrder &&
    input.normalized.every(
      (window) =>
        window.valid &&
        meetsPitchCentreLandingWindowDuration(
          window.startSeconds,
          window.endSeconds,
        ),
    )
  const durationSufficient =
    Number.isFinite(input.captureDurationMilliseconds) &&
    input.captureDurationMilliseconds >= input.task.durationMilliseconds &&
    validWindowDuration
  const noiseStatus =
    input.facts.noiseSeparation === 'sufficient'
      ? 'pass'
      : input.facts.noiseSeparation === 'insufficient'
        ? 'fail'
        : 'unavailable'
  const clippingStatus =
    input.facts.clippingDetected === 'unavailable'
      ? 'unavailable'
      : observedStatus(input.facts.clippingDetected, false)
  const signalCoverageStatus = observedStatus(
    coverageRatio >=
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.minimumConfidentCoverageRatio,
    true,
  )
  const pitchConfidenceStatus = observedStatus(
    exactRepetitionCount &&
      input.landings.every((landing) => landing.kind === 'measured'),
    true,
  )
  const taskCompletionStatus = observedStatus(
    input.facts.taskCompleted === true && exactRepetitionCount,
    true,
  )
  const durationStatus = observedStatus(durationSufficient, true)
  const repetitionStatus = observedStatus(exactRepetitionCount, true)
  const analysisStatus =
    typeof input.facts.analysisAvailable !== 'boolean' ||
    !input.facts.analysisAvailable
      ? 'unavailable'
      : 'pass'

  return [
    {
      id: 'microphone-continuity',
      status: observedStatus(input.facts.microphoneContinuous, true),
      reasonCode:
        input.facts.microphoneContinuous === true
          ? null
          : 'pitch-centre.microphone-interrupted',
    },
    {
      id: 'clipping',
      status: clippingStatus,
      reasonCode: reasonForStatus(
        clippingStatus,
        'pitch-centre.clipping-detected',
        'pitch-centre.clipping-unavailable',
      ),
    },
    {
      id: 'noise-separation',
      status: noiseStatus,
      reasonCode: reasonForStatus(
        noiseStatus,
        'pitch-centre.noise-separation-low',
        'pitch-centre.noise-separation-unavailable',
      ),
    },
    {
      id: 'signal-coverage',
      status: signalCoverageStatus,
      reasonCode: reasonForStatus(
        signalCoverageStatus,
        'pitch-centre.signal-coverage-low',
      ),
    },
    {
      id: 'pitch-confidence',
      status: pitchConfidenceStatus,
      reasonCode: reasonForStatus(
        pitchConfidenceStatus,
        'pitch-centre.pitch-confidence-low',
      ),
    },
    {
      id: 'task-completion',
      status: taskCompletionStatus,
      reasonCode: reasonForStatus(
        taskCompletionStatus,
        'pitch-centre.task-incomplete',
      ),
    },
    {
      id: 'duration',
      status: durationStatus,
      reasonCode: reasonForStatus(
        durationStatus,
        'pitch-centre.duration-insufficient',
      ),
    },
    {
      id: 'repetitions',
      status: repetitionStatus,
      reasonCode: reasonForStatus(
        repetitionStatus,
        'pitch-centre.repetitions-incomplete',
      ),
    },
    {
      id: 'analysis-capability',
      status: analysisStatus,
      reasonCode: reasonForStatus(
        analysisStatus,
        'pitch-centre.analysis-unavailable',
      ),
    },
  ]
}
