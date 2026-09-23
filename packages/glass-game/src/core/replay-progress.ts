// Replay progress — isolated lesson attempts with durable discoveries and honest tier evidence.

import type { LevelDefinition, SavedProgress, SavedRewardProgress, } from '../contracts'
import { readProgress } from './progress'
import type { LevelStarTier, ReplayIdentity, ResolvedReplay, } from './replay-profile'
import { replayIdentityKey, sameReplayIdentity } from './replay-profile'
import { emptyRewardProgress, mergeRewardProgress } from './rewards'

export interface ReplayAttempt {
  identity: ReplayIdentity
  progress: SavedProgress
}

export interface ReplayClear {
  identity: ReplayIdentity
  tier: LevelStarTier
  completedAt: number
  requiredEncounterIds: string[]
}

export interface ReplayProgress {
  version: 1
  levelId: string
  collection: SavedRewardProgress
  attempts: ReplayAttempt[]
  clears: ReplayClear[]
  historicalClears: ReplayClear[]
  /** Historical completion is retained but never presented as a harder clear. */
  legacyCompleted: boolean
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function identityMatches(value: unknown, identity: ReplayIdentity): boolean {
  const data = record(value)
  return (
    data !== undefined &&
    data.levelId === identity.levelId &&
    data.contentRevision === identity.contentRevision &&
    data.profileId === identity.profileId &&
    data.profileRevision === identity.profileRevision &&
    data.challengeSignature === identity.challengeSignature
  )
}

function historicalClear(value: unknown): ReplayClear | undefined {
  const data = record(value)
  const identity = record(data?.identity)
  if (
    !data ||
    !identity ||
    typeof identity.levelId !== 'string' ||
    typeof identity.profileId !== 'string' ||
    typeof identity.challengeSignature !== 'string' ||
    identity.challengeSignature.length === 0 ||
    typeof identity.contentRevision !== 'number' ||
    !Number.isSafeInteger(identity.contentRevision) ||
    identity.contentRevision < 1 ||
    typeof identity.profileRevision !== 'number' ||
    !Number.isSafeInteger(identity.profileRevision) ||
    identity.profileRevision < 1 ||
    ![1, 2, 3].includes(data.tier as number) ||
    typeof data.completedAt !== 'number' ||
    !Number.isFinite(data.completedAt) ||
    data.completedAt < 0 ||
    !Array.isArray(data.requiredEncounterIds) ||
    data.requiredEncounterIds.length === 0 ||
    !data.requiredEncounterIds.every((id) => typeof id === 'string') ||
    new Set(data.requiredEncounterIds).size !== data.requiredEncounterIds.length
  )
    return undefined
  return {
    identity: {
      levelId: identity.levelId,
      profileId: identity.profileId,
      challengeSignature: identity.challengeSignature,
      contentRevision: identity.contentRevision,
      profileRevision: identity.profileRevision,
    },
    tier: data.tier as LevelStarTier,
    completedAt: data.completedAt,
    requiredEncounterIds: data.requiredEncounterIds as string[],
  }
}

export function replayIsComplete(
  level: LevelDefinition,
  progress: SavedProgress,
): boolean {
  return (
    progress.finished === true &&
    level.breakables.every(
      (item) =>
        item.optional === true ||
        progress.completedBreakableIds.includes(item.id),
    )
  )
}

export function readReplayProgress(
  level: LevelDefinition,
  profiles: readonly ResolvedReplay[],
  raw: unknown,
  legacyRaw?: unknown,
): ReplayProgress {
  const legacy = readProgress(level, legacyRaw)
  const data = record(raw)
  const valid = data?.version === 1 && data.levelId === level.id
  const collection = mergeRewardProgress(
    level,
    legacy.rewards,
    valid ? (data.collection as SavedRewardProgress) : undefined,
  )
  const attempts: ReplayAttempt[] = []
  const clears: ReplayClear[] = []
  const historical = valid
    ? [
        ...(Array.isArray(data.clears) ? data.clears : []),
        ...(Array.isArray(data.historicalClears) ? data.historicalClears : []),
      ]
        .map(historicalClear)
        .filter(
          (item): item is ReplayClear =>
            item !== undefined &&
            item.identity.levelId === level.id &&
            !profiles.some((profile) =>
              sameReplayIdentity(profile.identity, item.identity),
            ),
        )
    : []
  const historicalClears = [
    ...new Map(
      historical.map((item) => [JSON.stringify(item.identity), item]),
    ).values(),
  ]
  for (const profile of profiles) {
    const attempt =
      valid && Array.isArray(data.attempts)
        ? data.attempts
            .map(record)
            .find(
              (item) =>
                item !== undefined &&
                identityMatches(item.identity, profile.identity),
            )
        : undefined
    if (attempt)
      attempts.push({
        identity: profile.identity,
        progress: readProgress(profile.level, attempt.progress),
      })
    if (!valid || !Array.isArray(data.clears)) continue
    const required = profile.level.breakables
      .filter((item) => !item.optional)
      .map((item) => item.id)
    const candidates = data.clears
      .map(record)
      .filter(
        (item) =>
          item !== undefined &&
          identityMatches(item.identity, profile.identity) &&
          item.tier === profile.profile.tier &&
          typeof item.completedAt === 'number' &&
          Number.isFinite(item.completedAt) &&
          item.completedAt >= 0 &&
          Array.isArray(item.requiredEncounterIds) &&
          item.requiredEncounterIds.length === required.length &&
          required.every((id) =>
            (item.requiredEncounterIds as unknown[]).includes(id),
          ),
      )
    const clear = candidates.sort(
      (a, b) => (a!.completedAt as number) - (b!.completedAt as number),
    )[0]
    if (clear)
      clears.push({
        identity: profile.identity,
        tier: profile.profile.tier,
        completedAt: clear.completedAt as number,
        requiredEncounterIds: required,
      })
  }
  return {
    version: 1,
    levelId: level.id,
    collection,
    attempts,
    clears,
    historicalClears,
    legacyCompleted:
      legacy.finished === true || (valid && data.legacyCompleted === true),
  }
}

/** Saved accuracy stars remain in collection; they are not difficulty evidence. */
export function highestReplayTier(progress: ReplayProgress): LevelStarTier | 0 {
  return progress.clears.reduce<LevelStarTier | 0>(
    (best, item) => (item.tier > best ? item.tier : best),
    0,
  )
}

export function canEnterReplay(
  progress: ReplayProgress,
  profile: ResolvedReplay,
): boolean {
  return (
    profile.profile.tier === 1 ||
    progress.legacyCompleted ||
    progress.clears.length > 0
  )
}

export function beginReplayAttempt(
  progress: ReplayProgress,
  profile: ResolvedReplay,
  fresh: boolean,
): ReplayProgress {
  if (!canEnterReplay(progress, profile))
    throw new Error(
      'Complete the first visit before starting a harder challenge.',
    )
  const previous = progress.attempts.find((item) =>
    sameReplayIdentity(item.identity, profile.identity),
  )
  const starting =
    fresh || !previous
      ? readProgress(profile.level, undefined)
      : previous.progress
  const attempt: ReplayAttempt = {
    identity: profile.identity,
    progress: {
      ...starting,
      rewards: mergeRewardProgress(
        profile.level,
        starting.rewards,
        progress.collection,
      ),
    },
  }
  return {
    ...progress,
    attempts: [
      ...progress.attempts.filter(
        (item) =>
          replayIdentityKey(item.identity) !==
          replayIdentityKey(profile.identity),
      ),
      attempt,
    ],
  }
}

export function saveReplayAttempt(
  progress: ReplayProgress,
  profile: ResolvedReplay,
  candidate: SavedProgress,
  now: number,
): ReplayProgress {
  if (
    candidate.levelId !== progress.levelId ||
    !Number.isFinite(now) ||
    now < 0
  )
    throw new Error(
      'Replay save must belong to its level and carry a valid completion clock.',
    )
  if (
    !progress.attempts.some((item) =>
      sameReplayIdentity(item.identity, profile.identity),
    )
  )
    throw new Error('Start a compatible replay before saving its progress.')
  const saved = readProgress(profile.level, candidate)
  const collection = mergeRewardProgress(
    profile.level,
    progress.collection,
    saved.rewards ?? emptyRewardProgress(),
  )
  const existing = progress.clears.some((item) =>
    sameReplayIdentity(item.identity, profile.identity),
  )
  const earned: ReplayClear[] =
    !existing && replayIsComplete(profile.level, saved)
      ? [
          {
            identity: profile.identity,
            tier: profile.profile.tier,
            completedAt: now,
            requiredEncounterIds: profile.level.breakables
              .filter((item) => !item.optional)
              .map((item) => item.id),
          },
        ]
      : []
  return {
    ...progress,
    collection,
    attempts: progress.attempts.map((item) =>
      sameReplayIdentity(item.identity, profile.identity)
        ? {
            identity: profile.identity,
            progress: { ...saved, rewards: collection },
          }
        : item,
    ),
    clears: [...progress.clears, ...earned],
  }
}
