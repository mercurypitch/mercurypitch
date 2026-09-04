// ============================================================
// Progress data loader — independently settles local and account-backed inputs
// into one snapshot without allowing an optional source to erase real history.
// ============================================================

import type { SessionRecord } from '@/db/entities'
import type { ProgressGrantContext } from '@/db/services/grant-context'
import { loadProgressGrantContext } from '@/db/services/grant-context'
import { flushGrants } from '@/db/services/grant-flush'
import type { LeagueMe } from '@/db/services/league-service'
import { fetchLeagueMe } from '@/db/services/league-service'
import type { ProgressSessionRecords } from '@/db/services/session-service'
import { loadProgressSessionRecords } from '@/db/services/session-service'
import type { ProgressActivityRecords } from '@/db/services/user-activity-service'
import { loadProgressActivityRecords } from '@/db/services/user-activity-service'
import type { ProgressVoiceprintRecords } from '@/db/services/voiceprint-service'
import { loadProgressVoiceprints } from '@/db/services/voiceprint-service'
import type { StoredChallengeTrace } from '@/features/challenges/challenge-trace'
import { loadChallengeTrace } from '@/features/challenges/challenge-trace'
import type { BuildProgressModelOptions, ProgressDataAvailability, ProgressModel, } from './model'
import { buildProgressModel, challengeIdForRecord, PROGRESS_SESSION_LIMIT, } from './model'

export interface ProgressDataDependencies {
  loadProgressGrantContext: () => Promise<ProgressGrantContext>
  loadProgressSessionRecords: (options: {
    pageSize: number
    maxRecords: number
  }) => Promise<ProgressSessionRecords>
  loadProgressVoiceprints: (options: {
    pageSize: number
    maxRecords: number
  }) => Promise<ProgressVoiceprintRecords>
  loadProgressActivityRecords: (options: {
    pageSize: number
    maxRecords: number
  }) => Promise<ProgressActivityRecords>
  fetchLeagueMe: () => Promise<LeagueMe | null>
  loadChallengeTrace: (challengeId: string) => StoredChallengeTrace | null
  /**
   * Push pending badge and achievement writes before reading them back.
   * Optional so a test can wire the readers alone.
   */
  flushPendingGrants?: () => Promise<unknown>
}

export interface LoadProgressModelOptions extends BuildProgressModelOptions {
  dependencies?: ProgressDataDependencies
}

export const defaultProgressDataDependencies: ProgressDataDependencies = {
  loadProgressGrantContext,
  loadProgressSessionRecords,
  loadProgressVoiceprints,
  loadProgressActivityRecords,
  fetchLeagueMe,
  loadChallengeTrace,
  flushPendingGrants: () => flushGrants(),
}

function valueOr<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback
}

function mergeRecords(
  primary: readonly SessionRecord[],
  fallback: readonly SessionRecord[],
): SessionRecord[] {
  const seen = new Set<string>()
  const merged: SessionRecord[] = []
  for (const record of [...primary, ...fallback]) {
    if (seen.has(record.id)) continue
    seen.add(record.id)
    merged.push(record)
  }
  return merged.sort((a, b) => {
    const ended = b.endedAt.localeCompare(a.endedAt)
    return ended !== 0 ? ended : b.id.localeCompare(a.id)
  })
}

/**
 * Load one coherent snapshot for Progress.
 *
 * The grant context keeps account metadata to one request. Session history is
 * loaded separately in bounded pages; completeness and the safety ceiling are
 * surfaced explicitly by the coverage labels. Each source settles on its own
 * so an unavailable league or voiceprint endpoint cannot erase local practice
 * history.
 */
export async function loadProgressModel(
  options: LoadProgressModelOptions = {},
): Promise<ProgressModel> {
  const dependencies = options.dependencies ?? defaultProgressDataDependencies
  const sessionLimit = options.sessionLimit ?? PROGRESS_SESSION_LIMIT
  // Achievement progress is written on a delay, and the page that displays
  // it is the moment worth paying the write for — otherwise a singer who
  // finishes a run and comes straight here reads the numbers from before it.
  // A failed flush is not fatal: the read below shows what last landed.
  try {
    await dependencies.flushPendingGrants?.()
  } catch {
    // Reported by the flush itself; nothing to add here.
  }
  const [
    contextResult,
    sessionsResult,
    voiceprintsResult,
    activityResult,
    leagueResult,
  ] = await Promise.allSettled([
    dependencies.loadProgressGrantContext(),
    dependencies.loadProgressSessionRecords({
      pageSize: Math.min(500, sessionLimit),
      maxRecords: sessionLimit,
    }),
    dependencies.loadProgressVoiceprints({
      pageSize: Math.min(500, sessionLimit),
      maxRecords: sessionLimit,
    }),
    dependencies.loadProgressActivityRecords({
      pageSize: Math.min(500, sessionLimit),
      maxRecords: sessionLimit,
    }),
    dependencies.fetchLeagueMe(),
  ])

  const contextEnvelope = valueOr<ProgressGrantContext>(contextResult, {
    context: null,
    available: false,
  })
  const context = contextEnvelope.context
  const sessionHistory = valueOr<ProgressSessionRecords | null>(
    sessionsResult,
    null,
  )
  const records = mergeRecords(
    sessionHistory?.records ?? [],
    context?.records ?? [],
  ).slice(0, sessionLimit)
  const sessionTotalIsCredible =
    sessionHistory?.available === true &&
    sessionHistory.totalAvailable !== null &&
    sessionHistory.totalAvailable >= records.length
  const sessionHistoryComplete =
    sessionTotalIsCredible && sessionHistory.complete
  const totalAvailable = sessionTotalIsCredible
    ? sessionHistory.totalAvailable
    : null
  const voiceprintHistory = valueOr<ProgressVoiceprintRecords>(
    voiceprintsResult,
    {
      records: [],
      available: false,
      complete: false,
      totalAvailable: null,
      comparable: false,
    },
  )
  const activityHistory = valueOr<ProgressActivityRecords>(activityResult, {
    records: [],
    available: false,
    complete: false,
    totalAvailable: null,
  })
  const voiceprints = voiceprintHistory.records
  const recentActivity = activityHistory.records.slice(0, 20)
  const league = valueOr<LeagueMe | null>(leagueResult, null)
  const challengeDefinitions = context?.challengeDefs ?? []
  const challengeIds = new Set<string>()
  for (const record of records) {
    const challengeId = challengeIdForRecord(record, challengeDefinitions)
    if (challengeId !== null) challengeIds.add(challengeId)
  }
  const challengeTraces: Record<string, StoredChallengeTrace> = {}
  for (const challengeId of challengeIds) {
    try {
      const trace = dependencies.loadChallengeTrace(challengeId)
      if (trace !== null) challengeTraces[challengeId] = trace
    } catch {
      // A malformed or blocked localStorage entry is optional evidence. The
      // scored session remains the authority for the attempt itself.
    }
  }

  const availability: ProgressDataAvailability = {
    sessions:
      sessionHistory?.available === true || (context?.records.length ?? 0) > 0,
    account: contextEnvelope.available,
    voiceprints: voiceprintHistory.available,
    activity: activityHistory.available,
    league: leagueResult.status === 'fulfilled',
  }

  return buildProgressModel(
    {
      records,
      sessionHistory: {
        complete: sessionHistoryComplete,
        totalAvailable,
      },
      voiceprintHistory: {
        complete: voiceprintHistory.complete,
        totalAvailable: voiceprintHistory.totalAvailable,
        comparable: voiceprintHistory.comparable,
      },
      activityHistory: {
        complete: activityHistory.complete,
        totalAvailable: activityHistory.totalAvailable,
      },
      currentStreak: context?.currentStreak ?? null,
      voiceprints,
      badgeDefinitions: context?.badges ?? [],
      userBadges: context?.userBadges ?? [],
      achievementDefinitions: context?.achievements ?? [],
      userAchievements: context?.userAchievements ?? [],
      challengeDefinitions,
      activityRows: activityHistory.records,
      recentActivity,
      league,
      challengeTraces,
      availability,
    },
    {
      now: options.now,
      sessionLimit,
      recentHistoryLimit: options.recentHistoryLimit,
      scoreTrendLimit: options.scoreTrendLimit,
    },
  )
}
