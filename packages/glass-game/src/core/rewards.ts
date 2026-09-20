// Adventure rewards — grade reliable pitch time and merge finite level collectibles.

import type { ChallengeDefinition, LevelDefinition, PitchAccuracyGradingPolicy, PitchObservation, PitchStepDefinition, SavedRewardProgress, SingingQualityGrade, SingingQualityResult, } from '../contracts'
import type { ChallengeProgress } from './challenge'

interface ReliablePoint {
  captureSeconds: number
  errorCents: number
  stepIndex: number
  targetMidi: number
}

export interface SingingQualityAttempt {
  observe(
    frame: PitchObservation,
    nowMs: number,
    progress: ChallengeProgress,
  ): void
  reset(): void
  finish(): SingingQualityResult
}

const EMPTY_REWARDS: SavedRewardProgress = {
  version: 1,
  discoveredEncounterIds: [],
  collectedCoinIds: [],
  qualityResults: [],
  collectedPortraitIds: [],
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function round(value: number, places: number): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

/** Only challenges with an explicit, stable target are supported by v1 grading. */
function gradingStep(
  definition: ChallengeDefinition,
  stepIndex: number,
): PitchStepDefinition | undefined {
  switch (definition.kind) {
    case 'hold':
      return stepIndex === 0 ? definition.step : undefined
    case 'ordered-pair':
      return definition.steps[stepIndex]
    default:
      return undefined
  }
}

function contentRevision(level: LevelDefinition): number {
  return level.authored?.contentRevision ?? 1
}

export function ungradedQualityResult(
  level: LevelDefinition,
  policy: PitchAccuracyGradingPolicy,
): SingingQualityResult {
  return {
    encounterId: policy.encounterId,
    grade: 'not-graded',
    challengeRevision: policy.challengeRevision,
    policyRevision: policy.policyRevision,
    contentRevision: contentRevision(level),
    evidenceVersion: 'pitch-accuracy-v1',
    reliableSeconds: 0,
  }
}

/**
 * Grade capture-clock duration, never callback count or wall-clock latency.
 * Rejected frames break a segment, so silence, weak confidence and stale input
 * cannot bridge into invented evidence. Fresh voiced misses still count as error.
 */
export function createSingingQualityAttempt(
  level: LevelDefinition,
  definition: ChallengeDefinition,
  policy: PitchAccuracyGradingPolicy,
): SingingQualityAttempt | undefined {
  if (gradingStep(definition, 0) === undefined) return undefined

  let latestSequence = -Infinity
  let latestCaptureSeconds = -Infinity
  let previous: ReliablePoint | null = null
  let reliableSeconds = 0
  let weightedAbsoluteCents = 0

  const reset = (): void => {
    latestSequence = -Infinity
    latestCaptureSeconds = -Infinity
    previous = null
    reliableSeconds = 0
    weightedAbsoluteCents = 0
  }

  return {
    observe(frame, nowMs, progress) {
      if (
        !finiteNumber(frame.sequence) ||
        !finiteNumber(frame.captureSeconds) ||
        frame.sequence <= latestSequence ||
        frame.captureSeconds <= latestCaptureSeconds
      )
        return

      latestSequence = frame.sequence
      latestCaptureSeconds = frame.captureSeconds
      const step = gradingStep(definition, progress.stepIndex)
      const ageMs = nowMs - frame.capturedAtMs
      const fresh =
        finiteNumber(nowMs) &&
        finiteNumber(frame.capturedAtMs) &&
        finiteNumber(ageMs) &&
        ageMs >= -5 &&
        step !== undefined &&
        ageMs <= step.hold.maximumSampleAgeMs
      const midi = frame.midi
      if (
        !fresh ||
        step === undefined ||
        midi === null ||
        !finiteNumber(midi) ||
        midi < 0 ||
        midi > 127 ||
        !finiteNumber(frame.confidence) ||
        frame.confidence < step.hold.confidenceFloor
      ) {
        previous = null
        return
      }

      const current: ReliablePoint = {
        captureSeconds: frame.captureSeconds,
        errorCents: Math.min(
          Math.abs(midi - progress.targetMidi) * 100,
          policy.maximumErrorCents,
        ),
        stepIndex: progress.stepIndex,
        targetMidi: progress.targetMidi,
      }
      if (
        previous !== null &&
        previous.stepIndex === current.stepIndex &&
        previous.targetMidi === current.targetMidi
      ) {
        const duration = current.captureSeconds - previous.captureSeconds
        if (duration <= step.hold.maximumSampleGapSeconds) {
          reliableSeconds += duration
          weightedAbsoluteCents +=
            duration * (previous.errorCents + current.errorCents) * 0.5
        }
      }
      previous = current
    },
    reset,
    finish() {
      const result = ungradedQualityResult(level, policy)
      result.reliableSeconds = round(reliableSeconds, 3)
      if (reliableSeconds <= 0) return result
      const meanAbsoluteCents = weightedAbsoluteCents / reliableSeconds
      result.meanAbsoluteCents = round(meanAbsoluteCents, 1)
      if (reliableSeconds < policy.minimumReliableSeconds) return result
      result.grade = gradeForMean(meanAbsoluteCents, policy)
      return result
    },
  }
}

function gradeForMean(
  meanAbsoluteCents: number,
  policy: PitchAccuracyGradingPolicy,
): SingingQualityGrade {
  if (meanAbsoluteCents <= policy.threeStarMaxMeanCents) return 3
  if (meanAbsoluteCents <= policy.twoStarMaxMeanCents) return 2
  return 1
}

/** Whether a saved result was measured by the currently authored thresholds. */
export function qualityResultMatchesPolicy(
  result: SingingQualityResult,
  policy: PitchAccuracyGradingPolicy,
): boolean {
  return (
    result.encounterId === policy.encounterId &&
    result.policyRevision === policy.policyRevision &&
    result.challengeRevision === policy.challengeRevision
  )
}

export function emptyRewardProgress(): SavedRewardProgress {
  return {
    ...EMPTY_REWARDS,
    discoveredEncounterIds: [],
    collectedCoinIds: [],
    qualityResults: [],
    collectedPortraitIds: [],
  }
}

function gradeRank(grade: SingingQualityGrade): number {
  return grade === 'not-graded' ? 0 : grade
}

function betterQualityResult(
  current: SingingQualityResult | undefined,
  candidate: SingingQualityResult,
): SingingQualityResult {
  if (current === undefined) return candidate
  const rankDifference = gradeRank(candidate.grade) - gradeRank(current.grade)
  if (rankDifference > 0) return candidate
  if (rankDifference < 0) return current
  if (candidate.grade === 'not-graded')
    return candidate.reliableSeconds > current.reliableSeconds
      ? candidate
      : current
  const currentMean = current.meanAbsoluteCents ?? Infinity
  const candidateMean = candidate.meanAbsoluteCents ?? Infinity
  if (candidateMean < currentMean) return candidate
  if (candidateMean > currentMean) return current
  return candidate.reliableSeconds > current.reliableSeconds
    ? candidate
    : current
}

function validQualityResult(
  value: unknown,
  encounterIds: ReadonlySet<string>,
): value is SingingQualityResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Partial<SingingQualityResult>
  return (
    typeof result.encounterId === 'string' &&
    encounterIds.has(result.encounterId) &&
    (result.grade === 'not-graded' ||
      result.grade === 1 ||
      result.grade === 2 ||
      result.grade === 3) &&
    Number.isInteger(result.challengeRevision) &&
    finiteNumber(result.challengeRevision) &&
    result.challengeRevision > 0 &&
    Number.isInteger(result.policyRevision) &&
    finiteNumber(result.policyRevision) &&
    result.policyRevision > 0 &&
    Number.isInteger(result.contentRevision) &&
    finiteNumber(result.contentRevision) &&
    result.contentRevision > 0 &&
    result.evidenceVersion === 'pitch-accuracy-v1' &&
    finiteNumber(result.reliableSeconds) &&
    result.reliableSeconds >= 0 &&
    (result.meanAbsoluteCents === undefined ||
      (finiteNumber(result.meanAbsoluteCents) && result.meanAbsoluteCents >= 0))
  )
}

function bestQualityResults(
  values: readonly SingingQualityResult[],
): SingingQualityResult[] {
  const best = new Map<string, SingingQualityResult>()
  for (const value of values)
    best.set(
      value.encounterId,
      betterQualityResult(best.get(value.encounterId), value),
    )
  return [...best.values()]
}

export function readRewardProgress(
  level: LevelDefinition,
  raw: unknown,
  completed: ReadonlySet<string>,
  migrateLegacyCompletion = false,
): SavedRewardProgress {
  const rewards = level.rewards
  if (rewards === undefined) return emptyRewardProgress()

  const discoveries = new Map(
    rewards.discoveries.map((item) => [item.encounterId, item] as const),
  )
  const coinIds = new Set(rewards.discoveries.flatMap((item) => item.coinIds))
  const gradingIds = new Set(rewards.grading.map((item) => item.encounterId))
  const data =
    typeof raw === 'object' && raw !== null
      ? (raw as Partial<SavedRewardProgress>)
      : undefined
  const discoveredEncounterIds = new Set<string>()
  if (data?.version === 1 && Array.isArray(data.discoveredEncounterIds))
    for (const id of data.discoveredEncounterIds)
      if (typeof id === 'string' && discoveries.has(id))
        discoveredEncounterIds.add(id)

  const collectedCoinIds = new Set<string>()
  if (data?.version === 1 && Array.isArray(data.collectedCoinIds))
    for (const id of data.collectedCoinIds)
      if (typeof id === 'string' && coinIds.has(id)) collectedCoinIds.add(id)

  for (const [encounterId, discovery] of discoveries) {
    if (!discoveredEncounterIds.has(encounterId)) continue
    for (const coinId of discovery.coinIds) collectedCoinIds.add(coinId)
  }

  const qualityResults =
    data?.version === 1 && Array.isArray(data.qualityResults)
      ? bestQualityResults(
          data.qualityResults.filter((value) =>
            validQualityResult(value, gradingIds),
          ),
        )
      : []

  const collectedPortraitIds = new Set<string>()
  const portrait = rewards.portrait
  if (
    portrait !== undefined &&
    data?.version === 1 &&
    Array.isArray(data.collectedPortraitIds) &&
    data.collectedPortraitIds.includes(portrait.portraitId)
  )
    collectedPortraitIds.add(portrait.portraitId)
  if (
    migrateLegacyCompletion &&
    portrait !== undefined &&
    completed.has(portrait.awardAfterEncounterId)
  )
    collectedPortraitIds.add(portrait.portraitId)

  return {
    version: 1,
    discoveredEncounterIds: [...discoveredEncounterIds],
    collectedCoinIds: [...collectedCoinIds],
    qualityResults,
    collectedPortraitIds: [...collectedPortraitIds],
  }
}

export function mergeRewardProgress(
  level: LevelDefinition,
  left: SavedRewardProgress | undefined,
  right: SavedRewardProgress | undefined,
): SavedRewardProgress {
  const completed = new Set<string>()
  const first = readRewardProgress(level, left, completed)
  const second = readRewardProgress(level, right, completed)
  return readRewardProgress(
    level,
    {
      version: 1,
      discoveredEncounterIds: [
        ...first.discoveredEncounterIds,
        ...second.discoveredEncounterIds,
      ],
      collectedCoinIds: [...first.collectedCoinIds, ...second.collectedCoinIds],
      qualityResults: bestQualityResults([
        ...first.qualityResults,
        ...second.qualityResults,
      ]),
      collectedPortraitIds: [
        ...first.collectedPortraitIds,
        ...second.collectedPortraitIds,
      ],
    },
    completed,
  )
}

export function applyEncounterRewards(
  level: LevelDefinition,
  progress: SavedRewardProgress,
  encounterId: string,
  qualityResult?: SingingQualityResult,
): SavedRewardProgress {
  const rewards = level.rewards
  if (rewards === undefined) return progress
  const discovery = rewards.discoveries.find(
    (item) => item.encounterId === encounterId,
  )
  const portrait = rewards.portrait
  return readRewardProgress(
    level,
    {
      version: 1,
      discoveredEncounterIds: [
        ...progress.discoveredEncounterIds,
        ...(discovery === undefined ? [] : [encounterId]),
      ],
      collectedCoinIds: [
        ...progress.collectedCoinIds,
        ...(discovery?.coinIds ?? []),
      ],
      qualityResults:
        qualityResult === undefined
          ? progress.qualityResults
          : [...progress.qualityResults, qualityResult],
      collectedPortraitIds: [
        ...progress.collectedPortraitIds,
        ...(portrait?.awardAfterEncounterId === encounterId
          ? [portrait.portraitId]
          : []),
      ],
    },
    new Set([encounterId]),
  )
}

export function summarizeRewards(
  level: LevelDefinition,
  progress: SavedRewardProgress,
) {
  const rewards = level.rewards
  if (rewards === undefined) return undefined
  return {
    levelId: level.id,
    discoveriesFound: progress.discoveredEncounterIds.length,
    discoveriesTotal: rewards.discoveries.length,
    coinsFound: progress.collectedCoinIds.length,
    coinsTotal: rewards.discoveries.reduce(
      (total, item) => total + item.coinIds.length,
      0,
    ),
    qualityResults: rewards.grading.flatMap((policy) => {
      const result = progress.qualityResults.find(
        (item) => item.encounterId === policy.encounterId,
      )
      return result === undefined ? [] : [result]
    }),
    ...(rewards.portrait === undefined
      ? {}
      : {
          portrait: {
            ...rewards.portrait,
            collected: progress.collectedPortraitIds.includes(
              rewards.portrait.portraitId,
            ),
          },
        }),
  }
}
