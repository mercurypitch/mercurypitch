// ============================================================
// Song runner source — strict JSON authoring types and validation primitives.
// ============================================================

import type { CompiledRunnerMovementProfile, CompiledRunnerVoiceProfile, RunnerLane, } from './contracts'
import type { RunnerTempoPoint } from './tempo'

export interface RunnerPhraseNoteSource {
  readonly offsetSemitones: number
  readonly durationBeats: number
  readonly connection?: 'separate' | 'glide'
}

export interface RunnerPhraseSource {
  readonly id: string
  readonly notes: readonly RunnerPhraseNoteSource[]
  readonly breathAfterBeats: number
}

export interface RunnerTargetSource {
  readonly id: string
  readonly atBeat: number
  readonly phraseId: string
  readonly displayLane: RunnerLane
  readonly glassProfileId: string
  readonly requiredForGrade: boolean
  /** Omitted targets keep the exact scheduled-phrase contract from schema v1. */
  readonly completion?: RunnerChargeCompletionSource
}

export interface RunnerChargeCompletionSource {
  readonly kind: 'charge'
  /** One threshold per authored note. Charge notes advance in source order. */
  readonly minimumReliableSecondsPerNote: readonly number[]
  /** Audible example length, independent from the authored response window. */
  readonly previewDurationSeconds: number
  /** Physical contact after response close, independent from tempo. */
  readonly contactAfterResponseSeconds: number
}

export interface RunnerObstacleSource {
  readonly id: string
  readonly atBeat: number
  readonly laneMask: readonly RunnerLane[]
  readonly profileId: string
}

export interface RunnerCheckpointSource {
  readonly id: string
  readonly atBeat: number
  readonly respawnLane: RunnerLane
  readonly countInBeats: number
}

export interface RunnerPickupSource {
  readonly id: string
  readonly atBeat: number
  readonly lane: RunnerLane
}

export interface SongRunnerCourseSource {
  readonly id: string
  readonly title: string
  readonly revision: number
  readonly seed: number
  readonly meter: { readonly beatsPerBar: 4; readonly beatUnit: 4 }
  readonly tempoMap: readonly RunnerTempoPoint[]
  readonly track: {
    readonly lengthBeats: number
    readonly metersPerBeat: number
    readonly groundFeetY: number
    readonly fallBelowFeetY: number
    readonly laneCenters: readonly [number, number, number]
    readonly spawnRunwayBeats: number
    readonly vocalLookaheadBeats: number
    readonly vocalEmphasisBeats: number
    readonly chunkBeats: number
  }
  readonly movementProfileId: string
  readonly voice: {
    readonly profileId: string
    readonly phrases: readonly RunnerPhraseSource[]
    readonly targets: readonly RunnerTargetSource[]
  }
  readonly obstacles: readonly RunnerObstacleSource[]
  readonly checkpoints: readonly RunnerCheckpointSource[]
  readonly rewards: {
    readonly revision: number
    readonly pickupProfileId: string
    readonly pickups: readonly RunnerPickupSource[]
    readonly singingStarTargetIds: readonly string[]
    readonly finishRewardIds: readonly string[]
  }
  readonly presentation: {
    readonly environmentProfileId: string
    readonly musicProfileId: string
    readonly notationProfileId: string
  }
}

export interface SongRunnerSourceDocument {
  readonly schema: 'mercurypitch.song-runner-course'
  readonly version: 1
  readonly courses: readonly SongRunnerCourseSource[]
}

export interface RunnerVoiceCatalogProfile {
  readonly voice: CompiledRunnerVoiceProfile
  readonly judgeLeadBeats: number
  readonly protectedLeadBeats: number
  readonly protectedTailBeats: number
}

export interface RunnerBlockerCatalogProfile {
  readonly kind: 'blocker'
  readonly id: string
  readonly longitudinalHalfLengthMeters: number
  readonly laneHalfWidthMeters: number
  readonly minYOffsetMeters: number
  readonly maxYOffsetMeters: number
  readonly visibleLongitudinalHalfLengthMeters: number
  readonly visibleLaneHalfWidthMeters: number
  readonly visibleMinYOffsetMeters: number
  readonly visibleMaxYOffsetMeters: number
  readonly telegraphLeadBeats: number
  readonly assetProfileIds: readonly string[]
}

export interface RunnerGapCatalogProfile {
  readonly kind: 'gap'
  readonly id: string
  readonly lengthMeters: number
  readonly laneHalfWidthMeters: number
  readonly visibleLengthMeters: number
  readonly visibleLaneHalfWidthMeters: number
  readonly landingRunwayMeters: number
  readonly telegraphLeadBeats: number
  readonly assetProfileIds: readonly string[]
}

export type RunnerObstacleCatalogProfile =
  | RunnerBlockerCatalogProfile
  | RunnerGapCatalogProfile

export interface RunnerPickupCatalogProfile {
  readonly id: string
  readonly radiusMeters: number
  readonly assetProfileIds: readonly string[]
}

export interface SongRunnerCourseCatalog {
  readonly movementProfiles: Readonly<
    Record<string, CompiledRunnerMovementProfile>
  >
  readonly voiceProfiles: Readonly<Record<string, RunnerVoiceCatalogProfile>>
  readonly obstacleProfiles: Readonly<
    Record<string, RunnerObstacleCatalogProfile>
  >
  readonly pickupProfiles: Readonly<Record<string, RunnerPickupCatalogProfile>>
  readonly glassProfiles: Readonly<
    Record<string, { readonly assetProfileIds: readonly string[] }>
  >
  readonly environmentProfiles: Readonly<
    Record<string, { readonly assetProfileIds: readonly string[] }>
  >
  readonly musicProfileIds: readonly string[]
  readonly notationProfileIds: readonly string[]
}

export type RunnerJsonRecord = Record<string, unknown>

export function runnerSourceFail(path: string, message: string): never {
  throw new Error(`${path} ${message}`)
}

export function runnerSourceRecord(
  value: unknown,
  path: string,
): RunnerJsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return runnerSourceFail(path, 'must be an object.')
  return value as RunnerJsonRecord
}

export function runnerSourceExactKeys(
  value: RunnerJsonRecord,
  path: string,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(value).find((key) => !allowed.has(key))
  if (unknown !== undefined)
    runnerSourceFail(`${path}.${unknown}`, 'is not supported.')
  const missing = required.find((key) => !(key in value))
  if (missing !== undefined)
    runnerSourceFail(`${path}.${missing}`, 'is required.')
}

export function runnerSourceArray(
  value: unknown,
  path: string,
  maximum = 256,
): readonly unknown[] {
  if (!Array.isArray(value)) return runnerSourceFail(path, 'must be an array.')
  if (value.length > maximum)
    return runnerSourceFail(path, `must contain at most ${maximum} entries.`)
  return value
}

export function runnerSourceString(value: unknown, path: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 96 ||
    !/^[a-z0-9][a-z0-9-]*$/i.test(value)
  )
    return runnerSourceFail(path, 'must be a bounded identifier.')
  return value
}

export function runnerSourceTitle(value: unknown, path: string): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > 120
  )
    return runnerSourceFail(path, 'must be a non-empty bounded title.')
  return value
}

export function runnerSourceFinite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return runnerSourceFail(path, 'must be finite.')
  return value
}

export function runnerSourcePositive(value: unknown, path: string): number {
  const result = runnerSourceFinite(value, path)
  if (result <= 0) return runnerSourceFail(path, 'must be positive.')
  return result
}

export function runnerSourceInteger(value: unknown, path: string): number {
  const result = runnerSourceFinite(value, path)
  if (!Number.isSafeInteger(result))
    return runnerSourceFail(path, 'must be a safe integer.')
  return result
}

export function runnerSourceBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean')
    return runnerSourceFail(path, 'must be boolean.')
  return value
}

export function runnerSourceLane(value: unknown, path: string): RunnerLane {
  if (value !== 0 && value !== 1 && value !== 2)
    return runnerSourceFail(path, 'must be lane 0, 1, or 2.')
  return value
}

export function runnerSourceUniqueIds(
  values: readonly string[],
  path: string,
): Set<string> {
  const result = new Set<string>()
  for (const [index, value] of values.entries()) {
    if (result.has(value))
      runnerSourceFail(`${path}[${index}]`, `duplicates id "${value}".`)
    result.add(value)
  }
  return result
}
