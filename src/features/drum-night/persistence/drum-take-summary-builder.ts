// ============================================================
// Drum take summary builder — scalar evidence at an explicit finish boundary
// ============================================================
//
// The builder reuses the live coach's evidence policy, then projects only
// bounded aggregate measurements into the local persistence DTO. Raw hits,
// matches, device identity, copy, and microphone evidence never cross it.

import type { DrumCapturedDirectHit, DrumCapturedHit, DrumCoachingOptions, DrumScoreIndex, DrumSessionDocument, } from '@/features/drum-night/session'
import { coachDrumSession } from '@/features/drum-night/session'
import type { DrumProject } from './drum-project'
import { drumProjectContentFingerprint } from './drum-project'
import type { DrumTakeEvidencePolicy, DrumTakeInputSource, DrumTakeSummary, } from './drum-take-summary'
import { DRUM_TAKE_SUMMARY_SCHEMA_VERSION, normalizeDrumTakeSummary, } from './drum-take-summary'

export const DRUM_TAKE_EVIDENCE_POLICY = Object.freeze({
  version: 1 as const,
  matchWindowMs: 120,
  centredWindowMs: 30,
  minimumConfidence: 0.55,
  minimumMatchedHits: 2,
}) satisfies DrumTakeEvidencePolicy

export interface BuildDrumTakeSummaryInput {
  readonly id: string
  readonly completedAt: string
  readonly project: DrumProject
  readonly document: DrumSessionDocument
  readonly capturedHits: readonly DrumCapturedHit[]
  readonly omittedCaptureHitCount: number
  /** Authored tempo before recovery or user speed scaling. */
  readonly tempoBpm: number
  readonly speedScale: number
  readonly scoreIndex?: DrumScoreIndex
}

function directHitsOnly(
  hits: readonly DrumCapturedHit[],
): readonly DrumCapturedDirectHit[] {
  if (hits.some((hit) => hit.source === 'room-mic')) {
    throw new Error('Room-microphone evidence cannot be saved in take history.')
  }
  return hits as readonly DrumCapturedDirectHit[]
}

function inputSources(
  hits: readonly DrumCapturedDirectHit[],
): readonly DrumTakeInputSource[] {
  return [...new Set(hits.map((hit) => hit.source))].sort()
}

/** Build one validated scalar-only row without mutating or clearing the take. */
export function buildDrumTakeSummary(
  input: BuildDrumTakeSummaryInput,
): DrumTakeSummary {
  if (input.document.sourceFormat !== 'prepared') {
    throw new Error('Only prepared First Pocket takes can be saved.')
  }
  if (
    !Number.isSafeInteger(input.omittedCaptureHitCount) ||
    input.omittedCaptureHitCount < 0
  ) {
    throw new Error('The omitted take count is invalid.')
  }

  const directHits = directHitsOnly(input.capturedHits)
  const startBeat = input.project.loopRange?.startBeat ?? 0
  const endBeat =
    input.project.loopRange?.endBeat ?? input.document.durationBeats
  const coachingOptions: DrumCoachingOptions = {
    startBeat,
    endBeat,
    matchWindowMs: DRUM_TAKE_EVIDENCE_POLICY.matchWindowMs,
    centredWindowMs: DRUM_TAKE_EVIDENCE_POLICY.centredWindowMs,
    minimumConfidence: DRUM_TAKE_EVIDENCE_POLICY.minimumConfidence,
    minimumMatchedHits: DRUM_TAKE_EVIDENCE_POLICY.minimumMatchedHits,
  }
  const coaching = coachDrumSession(
    input.document,
    directHits,
    coachingOptions,
    input.scoreIndex,
  )
  const omittedCaptureHitCount =
    input.omittedCaptureHitCount + coaching.unprocessedCaptureHitCount
  if (coaching.capturedHitCount + omittedCaptureHitCount < 1) {
    throw new Error('No captured take evidence exists in the practiced range.')
  }

  return normalizeDrumTakeSummary({
    schemaVersion: DRUM_TAKE_SUMMARY_SCHEMA_VERSION,
    id: input.id,
    projectId: input.project.id,
    projectRevision: input.project.revision,
    projectFingerprint: drumProjectContentFingerprint(input.project),
    completedAt: input.completedAt,
    variationId: input.project.selectedVariantId,
    startBeat,
    endBeat,
    tempoBpm: input.tempoBpm,
    speedScale: input.speedScale,
    inputSources: inputSources(directHits),
    evidencePolicy: DRUM_TAKE_EVIDENCE_POLICY,
    status: coaching.status,
    evidenceScope: coaching.evidenceScope,
    confidence: coaching.confidence,
    targetHitCount: coaching.targetHitCount,
    capturedHitCount: coaching.capturedHitCount,
    omittedCaptureHitCount,
    matchedHitCount: coaching.matchedHitCount,
    unmatchedTargetCount: coaching.unmatchedTargetCount,
    unmatchedCaptureCount: coaching.unmatchedCaptureCount,
    uncertainTimingCount: coaching.uncertainTimingCount,
    earlyCount: coaching.earlyCount,
    centredCount: coaching.centredCount,
    lateCount: coaching.lateCount,
    meanTimingOffsetMs: coaching.meanTimingOffsetMs,
    meanAbsoluteTimingOffsetMs: coaching.meanAbsoluteTimingOffsetMs,
    meanVelocityOffset: coaching.meanVelocityOffset,
    meanAbsoluteVelocityOffset: coaching.meanAbsoluteVelocityOffset,
    recovery:
      coaching.recovery === null
        ? null
        : {
            focus: coaching.recovery.focus,
            barNumber: coaching.recovery.barNumber,
          },
  })
}
