// ============================================================
// Pitch Centre — exact, score-free pitch-landing measurements
// ============================================================
//
// This module measures only what the configured landing protocol observed.
// It deliberately does not octave-fold errors, choose public thresholds, or
// turn missing voice into a zero performance score.

import type { F0Frame, VoicedFrame } from '@/lib/pitch-measurements'
import { DEFAULT_HOP_SEC, median, preprocessF0Frames, } from '@/lib/pitch-measurements'

export interface PitchCentreLandingProtocol {
  confidenceFloor: number
  medianWindow: number
  maxVoicedGapMilliseconds: number
  minimumObservationMilliseconds: number
  minimumConfidentFrames: number
  settleToleranceCents: number
  settleHoldMilliseconds: number
  minimumSettlingFrames: number
  approachDeadbandCents: number
  approachConsensusRatio: number
}

export interface PitchCentreCoverage {
  numeratorFrames: number
  denominatorFrames: number
}

export type PitchCentreApproach =
  | 'below'
  | 'above'
  | 'direct'
  | 'mixed'
  | 'unavailable'

export interface PitchCentreEvidenceMoment {
  kind: 'approach' | 'settling-window'
  startMilliseconds: number
  endMilliseconds: number
}

export interface MeasuredPitchCentreLanding {
  kind: 'measured'
  targetMidiCents: number
  confidentCoverage: PitchCentreCoverage
  settled: boolean
  /** Start of the first retrospectively confirmed settling window. */
  settledAtMilliseconds: number | null
  medianSignedErrorCents: number | null
  medianAbsoluteErrorCents: number | null
  approach: PitchCentreApproach
  evidenceMoments: readonly PitchCentreEvidenceMoment[]
}

export interface InsufficientPitchCentreLanding {
  kind: 'insufficient-evidence'
  targetMidiCents: number
  reason: 'no-confident-voice' | 'too-short' | 'ambiguous'
  confidentCoverage: PitchCentreCoverage
}

export type PitchCentreLandingResult =
  | MeasuredPitchCentreLanding
  | InsufficientPitchCentreLanding

export interface PitchCentreLandingAggregate {
  kind: 'aggregate'
  totalRepetitions: number
  measuredRepetitions: number
  settledRepetitions: number
  settledCoverage: {
    numeratorRepetitions: number
    denominatorRepetitions: number
  }
  medianSignedErrorCents: number | null
  medianAbsoluteErrorCents: number | null
  signedErrorMedianAbsoluteDeviationCents: number | null
  medianSettledAtMilliseconds: number | null
  approachCounts: Readonly<Record<PitchCentreApproach, number>>
}

function requireFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Pitch Centre ${name} must be finite`)
  }
}

function validateProtocol(protocol: PitchCentreLandingProtocol): void {
  requireFinite('confidence floor', protocol.confidenceFloor)
  requireFinite('maximum voiced gap', protocol.maxVoicedGapMilliseconds)
  requireFinite(
    'minimum observation duration',
    protocol.minimumObservationMilliseconds,
  )
  requireFinite('settle tolerance', protocol.settleToleranceCents)
  requireFinite('settle hold', protocol.settleHoldMilliseconds)
  requireFinite('approach deadband', protocol.approachDeadbandCents)
  requireFinite('approach consensus', protocol.approachConsensusRatio)

  if (protocol.confidenceFloor < 0 || protocol.confidenceFloor > 1) {
    throw new Error('Pitch Centre confidence floor must be within [0, 1]')
  }
  if (
    !Number.isSafeInteger(protocol.medianWindow) ||
    protocol.medianWindow < 1 ||
    protocol.medianWindow % 2 === 0
  ) {
    throw new Error('Pitch Centre median window must be a positive odd integer')
  }
  if (protocol.maxVoicedGapMilliseconds <= 0) {
    throw new Error('Pitch Centre maximum voiced gap must be positive')
  }
  if (protocol.minimumObservationMilliseconds <= 0) {
    throw new Error(
      'Pitch Centre minimum observation duration must be positive',
    )
  }
  if (
    !Number.isInteger(protocol.minimumConfidentFrames) ||
    protocol.minimumConfidentFrames < 1
  ) {
    throw new Error(
      'Pitch Centre minimum confident frames must be a positive integer',
    )
  }
  if (protocol.settleToleranceCents <= 0) {
    throw new Error('Pitch Centre settle tolerance must be positive')
  }
  if (protocol.settleHoldMilliseconds <= 0) {
    throw new Error('Pitch Centre settle hold must be positive')
  }
  if (
    !Number.isInteger(protocol.minimumSettlingFrames) ||
    protocol.minimumSettlingFrames < 1
  ) {
    throw new Error(
      'Pitch Centre minimum settling frames must be a positive integer',
    )
  }
  if (
    protocol.approachDeadbandCents < 0 ||
    protocol.approachDeadbandCents > protocol.settleToleranceCents
  ) {
    throw new Error(
      'Pitch Centre approach deadband must be within the settle tolerance',
    )
  }
  if (
    protocol.approachConsensusRatio <= 0.5 ||
    protocol.approachConsensusRatio > 1
  ) {
    throw new Error('Pitch Centre approach consensus must be within (0.5, 1]')
  }
}

function coverage(
  confidentFrames: number,
  totalFrames: number,
): PitchCentreCoverage {
  return {
    numeratorFrames: confidentFrames,
    denominatorFrames: totalFrames,
  }
}

function classifyApproach(
  frames: readonly VoicedFrame[],
  targetMidiCents: number,
  deadbandCents: number,
  consensusRatio: number,
): Exclude<PitchCentreApproach, 'unavailable'> {
  if (frames.length === 0) return 'direct'

  let below = 0
  let above = 0
  for (const frame of frames) {
    const error = frame.cents - targetMidiCents
    if (error < -deadbandCents) below += 1
    else if (error > deadbandCents) above += 1
  }

  const directional = below + above
  if (directional === 0) return 'direct'
  if (below === above) return 'mixed'
  if (below / directional >= consensusRatio) return 'below'
  if (above / directional >= consensusRatio) return 'above'
  return 'mixed'
}

interface SettlingWindow {
  startIndex: number
  confirmationEndIndex: number
  measurementEndIndex: number
  segmentStartIndex: number
}

function continuousFrameHopSeconds(
  frames: readonly { t: number }[],
  maximumGapSeconds: number,
): number {
  const continuousGaps: number[] = []
  for (let index = 1; index < frames.length; index += 1) {
    const gap = frames[index].t - frames[index - 1].t
    if (gap > 0 && gap <= maximumGapSeconds) continuousGaps.push(gap)
  }
  return continuousGaps.length > 0
    ? median(continuousGaps)
    : Math.min(DEFAULT_HOP_SEC, maximumGapSeconds)
}

function sampledDurationMilliseconds(
  frames: readonly { t: number }[],
  maximumGapSeconds: number,
): number {
  if (frames.length === 0) return 0
  const frameHopSeconds = continuousFrameHopSeconds(frames, maximumGapSeconds)
  let durationSeconds = frameHopSeconds
  for (let index = 1; index < frames.length; index += 1) {
    const gap = frames[index].t - frames[index - 1].t
    durationSeconds +=
      gap > 0 && gap <= maximumGapSeconds ? gap : frameHopSeconds
  }
  return durationSeconds * 1000
}

function findSettlingWindow(
  frames: readonly VoicedFrame[],
  targetMidiCents: number,
  protocol: PitchCentreLandingProtocol,
): SettlingWindow | null {
  const maximumGapSeconds = protocol.maxVoicedGapMilliseconds / 1000
  const frameHopSeconds = continuousFrameHopSeconds(frames, maximumGapSeconds)
  let segmentStartIndex = 0
  let candidateStartIndex: number | null = null

  for (let index = 0; index < frames.length; index += 1) {
    if (
      index > 0 &&
      frames[index].t - frames[index - 1].t > maximumGapSeconds
    ) {
      segmentStartIndex = index
      candidateStartIndex = null
    }

    const isWithinTolerance =
      Math.abs(frames[index].cents - targetMidiCents) <=
      protocol.settleToleranceCents
    if (!isWithinTolerance) {
      candidateStartIndex = null
      continue
    }
    candidateStartIndex ??= index

    const candidateFrames = index - candidateStartIndex + 1
    const candidateDurationMilliseconds =
      (frames[index].t - frames[candidateStartIndex].t + frameHopSeconds) * 1000
    if (
      candidateFrames >= protocol.minimumSettlingFrames &&
      candidateDurationMilliseconds >= protocol.settleHoldMilliseconds
    ) {
      let measurementEndIndex = index
      while (
        measurementEndIndex + 1 < frames.length &&
        frames[measurementEndIndex + 1].t - frames[measurementEndIndex].t <=
          maximumGapSeconds
      ) {
        measurementEndIndex += 1
      }
      return {
        startIndex: candidateStartIndex,
        confirmationEndIndex: index,
        measurementEndIndex,
        segmentStartIndex,
      }
    }
  }

  return null
}

/**
 * Measure one configured landing against the exact target register. Caller
 * configuration is mandatory so this neutral layer never invents a public
 * tolerance, confidence floor, or task dose.
 */
export function measurePitchCentreLanding(
  frames: readonly F0Frame[],
  targetMidiCents: number,
  protocol: PitchCentreLandingProtocol,
): PitchCentreLandingResult {
  requireFinite('target', targetMidiCents)
  if (!Number.isInteger(targetMidiCents)) {
    throw new Error('Pitch Centre target must use integer MIDI-cents')
  }
  validateProtocol(protocol)

  if (
    frames.some(
      (frame) =>
        !Number.isFinite(frame.t) ||
        frame.t < 0 ||
        !Number.isFinite(frame.f0) ||
        frame.f0 < 0 ||
        !Number.isFinite(frame.conf) ||
        frame.conf < 0 ||
        frame.conf > 1,
    )
  ) {
    return {
      kind: 'insufficient-evidence',
      targetMidiCents,
      reason: 'ambiguous',
      confidentCoverage: coverage(0, frames.length),
    }
  }

  const ordered = [...frames].sort((left, right) => left.t - right.t)
  if (
    ordered.some(
      (frame, index) => index > 0 && frame.t === ordered[index - 1].t,
    )
  ) {
    return {
      kind: 'insufficient-evidence',
      targetMidiCents,
      reason: 'ambiguous',
      confidentCoverage: coverage(0, ordered.length),
    }
  }

  if (ordered.length < 2) {
    return {
      kind: 'insufficient-evidence',
      targetMidiCents,
      reason: 'too-short',
      confidentCoverage: coverage(0, ordered.length),
    }
  }

  const observedDurationMilliseconds = sampledDurationMilliseconds(
    ordered,
    protocol.maxVoicedGapMilliseconds / 1000,
  )
  const voiced = preprocessF0Frames(ordered, {
    confidenceFloor: protocol.confidenceFloor,
    medianWindow: protocol.medianWindow,
    maxVoicedGapSeconds: protocol.maxVoicedGapMilliseconds / 1000,
  })
  const confidentCoverage = coverage(voiced.length, ordered.length)

  if (observedDurationMilliseconds < protocol.minimumObservationMilliseconds) {
    return {
      kind: 'insufficient-evidence',
      targetMidiCents,
      reason: 'too-short',
      confidentCoverage,
    }
  }
  if (voiced.length < protocol.minimumConfidentFrames) {
    return {
      kind: 'insufficient-evidence',
      targetMidiCents,
      reason: 'no-confident-voice',
      confidentCoverage,
    }
  }

  const settlingWindow = findSettlingWindow(voiced, targetMidiCents, protocol)
  if (settlingWindow === null) {
    return {
      kind: 'measured',
      targetMidiCents,
      confidentCoverage,
      settled: false,
      settledAtMilliseconds: null,
      medianSignedErrorCents: null,
      medianAbsoluteErrorCents: null,
      approach: 'unavailable',
      evidenceMoments: [],
    }
  }

  const settledFrames = voiced.slice(
    settlingWindow.startIndex,
    settlingWindow.measurementEndIndex + 1,
  )
  const signedErrors = settledFrames.map(
    (frame) => frame.cents - targetMidiCents,
  )
  const approachFrames = voiced.slice(
    settlingWindow.segmentStartIndex,
    settlingWindow.startIndex,
  )
  const evidenceMoments: PitchCentreEvidenceMoment[] = []
  if (approachFrames.length > 0) {
    evidenceMoments.push({
      kind: 'approach',
      startMilliseconds: approachFrames[0].t * 1000,
      endMilliseconds: approachFrames[approachFrames.length - 1].t * 1000,
    })
  }
  evidenceMoments.push({
    kind: 'settling-window',
    startMilliseconds: settledFrames[0].t * 1000,
    endMilliseconds: voiced[settlingWindow.confirmationEndIndex].t * 1000,
  })

  return {
    kind: 'measured',
    targetMidiCents,
    confidentCoverage,
    settled: true,
    settledAtMilliseconds: settledFrames[0].t * 1000,
    medianSignedErrorCents: median(signedErrors),
    medianAbsoluteErrorCents: median(
      signedErrors.map((error) => Math.abs(error)),
    ),
    approach: classifyApproach(
      approachFrames,
      targetMidiCents,
      protocol.approachDeadbandCents,
      protocol.approachConsensusRatio,
    ),
    evidenceMoments,
  }
}

/** Aggregate direct repetition evidence without producing a composite score. */
export function aggregatePitchCentreLandings(
  results: readonly PitchCentreLandingResult[],
): PitchCentreLandingAggregate {
  const measured = results.filter(
    (result): result is MeasuredPitchCentreLanding =>
      result.kind === 'measured',
  )
  const settled = measured.filter(
    (result) =>
      result.settled &&
      result.medianSignedErrorCents !== null &&
      result.medianAbsoluteErrorCents !== null &&
      result.settledAtMilliseconds !== null,
  )
  const signedErrors = settled.map(
    (result) => result.medianSignedErrorCents as number,
  )
  const medianSignedErrorCents =
    signedErrors.length > 0 ? median(signedErrors) : null
  const approachCounts: Record<PitchCentreApproach, number> = {
    below: 0,
    above: 0,
    direct: 0,
    mixed: 0,
    unavailable: 0,
  }
  for (const result of measured) approachCounts[result.approach] += 1

  return {
    kind: 'aggregate',
    totalRepetitions: results.length,
    measuredRepetitions: measured.length,
    settledRepetitions: settled.length,
    settledCoverage: {
      numeratorRepetitions: settled.length,
      denominatorRepetitions: results.length,
    },
    medianSignedErrorCents,
    medianAbsoluteErrorCents:
      settled.length > 0
        ? median(
            settled.map((result) => result.medianAbsoluteErrorCents as number),
          )
        : null,
    signedErrorMedianAbsoluteDeviationCents:
      medianSignedErrorCents === null
        ? null
        : median(
            signedErrors.map((error) =>
              Math.abs(error - medianSignedErrorCents),
            ),
          ),
    medianSettledAtMilliseconds:
      settled.length > 0
        ? median(
            settled.map((result) => result.settledAtMilliseconds as number),
          )
        : null,
    approachCounts,
  }
}
