// ============================================================
// Drum performance take — frozen summary projection for Hear Yourself
// ============================================================
//
// The replay owns live-kit audio only. Its comparison and metrics are derived
// exclusively from Drum Night's validated scalar summary: no new score,
// accuracy, grade, raw hit, microphone, or device evidence is introduced.

import type { SaveVoiceTakeResult } from '@/db/services/voice-take-service'
import type { KeepInstrumentNightTakeInput, PreparedPerformanceTakeAudio, } from '@/lib/domain/performance-take'
import { keepInstrumentNightTake } from '@/lib/domain/performance-take'
import type { DrumTakeSummary } from './drum-take-summary'
import { validateDrumTakeSummary } from './drum-take-summary'

export interface KeepDrumPerformanceTakeInput {
  readonly summary: DrumTakeSummary
  readonly projectTitle: string
  readonly audio: PreparedPerformanceTakeAudio
}

export type SaveDrumPerformanceTake = (
  input: KeepInstrumentNightTakeInput,
) => Promise<SaveVoiceTakeResult>

/** Stable across attempts against the same saved groove and practiced range. */
export function drumPerformanceTakeComparisonKey(
  summary: DrumTakeSummary,
): string {
  const frozen = validateDrumTakeSummary(summary)
  return [
    'drum-night',
    'v1',
    frozen.projectFingerprint,
    frozen.variationId,
    frozen.startBeat,
    frozen.endBeat,
  ].join(':')
}

export function drumPerformanceTakeContext(
  summary: DrumTakeSummary,
): Record<string, unknown> {
  const frozen = validateDrumTakeSummary(summary)
  return {
    kind: 'drum-night-take-summary',
    summarySchemaVersion: frozen.schemaVersion,
    summaryId: frozen.id,
    projectId: frozen.projectId,
    projectRevision: frozen.projectRevision,
    projectFingerprint: frozen.projectFingerprint,
    variationId: frozen.variationId,
    startBeat: frozen.startBeat,
    endBeat: frozen.endBeat,
    tempoBpm: frozen.tempoBpm,
    speedScale: frozen.speedScale,
    inputSources: frozen.inputSources,
    evidencePolicy: frozen.evidencePolicy,
  }
}

export function drumPerformanceTakeMetrics(
  summary: DrumTakeSummary,
): Record<string, number | string | boolean | null> {
  const frozen = validateDrumTakeSummary(summary)
  return {
    status: frozen.status,
    evidenceScope: frozen.evidenceScope,
    confidence: frozen.confidence,
    targetHitCount: frozen.targetHitCount,
    capturedHitCount: frozen.capturedHitCount,
    omittedCaptureHitCount: frozen.omittedCaptureHitCount,
    matchedHitCount: frozen.matchedHitCount,
    unmatchedTargetCount: frozen.unmatchedTargetCount,
    unmatchedCaptureCount: frozen.unmatchedCaptureCount,
    uncertainTimingCount: frozen.uncertainTimingCount,
    earlyCount: frozen.earlyCount,
    centredCount: frozen.centredCount,
    lateCount: frozen.lateCount,
    meanTimingOffsetMs: frozen.meanTimingOffsetMs,
    meanAbsoluteTimingOffsetMs: frozen.meanAbsoluteTimingOffsetMs,
    meanVelocityOffset: frozen.meanVelocityOffset,
    meanAbsoluteVelocityOffset: frozen.meanAbsoluteVelocityOffset,
    recoveryFocus: frozen.recovery?.focus ?? null,
    recoveryBarNumber: frozen.recovery?.barNumber ?? null,
  }
}

export function keepDrumPerformanceTake(
  input: KeepDrumPerformanceTakeInput,
  save: SaveDrumPerformanceTake = keepInstrumentNightTake,
): Promise<SaveVoiceTakeResult> {
  const summary = validateDrumTakeSummary(input.summary)
  return save({
    source: 'drum-night',
    comparisonKey: drumPerformanceTakeComparisonKey(summary),
    title: input.projectTitle,
    audio: input.audio,
    context: drumPerformanceTakeContext(summary),
    metrics: drumPerformanceTakeMetrics(summary),
  })
}
