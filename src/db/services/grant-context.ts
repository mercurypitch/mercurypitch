// ============================================================
// Grant context — everything one badge/achievement pass reads
// ============================================================
//
// A grant pass used to make twelve list calls, each one an HTTPS round trip
// of ~85 ms against a D1 query of 0.4-1.3 ms. The database was never the
// cost; asking twelve times was. `GET /api/me/grant-context` returns all of
// it from a single D1 batch, so the read half of a pass is one request.
//
// The server does not evaluate anything and does not derive anything — it
// hands back rows. The streak still comes from `computeStreakState`, the
// activity counts still from `countActivity`, both of them here on the
// client, both of them the same functions every other surface uses. That is
// the point: there is exactly one implementation of each rule, so the
// endpoint cannot drift away from what the app believes.
//
// The local (IndexedDB) path and the cloud-unreachable path fall back to the
// individual services, which is also what keeps this honest — the two paths
// have to produce the same shape, and the tests run both.

import { getDb } from '@/db'
import type { Achievement, BadgeDefinition, ChallengeDefinition, ChallengeProgress, SessionRecord, SharedMelody, SharedSession, UserAchievement, UserActivity, UserBadge, UserProfile, } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { hasValidToken } from '@/db/services/auth-service'
import { loadAchievementDefinitions, loadBadgeDefinitions, loadChallengeDefinitions, loadChallengeProgress, loadUserAchievements, loadUserBadges, } from '@/db/services/challenges-service'
import { getFollowing } from '@/db/services/follow-service'
import { loadSessionRecords } from '@/db/services/session-service'
import { computeStreakState, getCurrentStreak, streakFieldsOf, todayDateString, } from '@/db/services/streak-service'
import { getAuthHeaders } from '@/db/services/user-service'
import { listVoiceprints } from '@/db/services/voiceprint-service'
import { API_BASE_URL } from '@/lib/defaults'

/**
 * The inputs to a grant pass. Counts rather than lists wherever the engine
 * only ever asked for a length — a singer with 400 followers has no reason
 * to download 400 rows so we can call `.length` on them.
 */
export interface GrantContext {
  badges: BadgeDefinition[]
  userBadges: UserBadge[]
  achievements: Achievement[]
  userAchievements: UserAchievement[]
  records: SessionRecord[]
  challengeDefs: ChallengeDefinition[]
  challengeProgress: ChallengeProgress[]
  /** Raw rows; `countActivity` turns them into per-kind counts. */
  activityRows: Array<Pick<UserActivity, 'kind' | 'refId'>>
  currentStreak: number
  voiceprintCount: number
  followingCount: number
  /**
   * Melodies and runs THIS singer published.
   *
   * It used to be the size of the whole community board: the engine called
   * `loadSharedMelodies()`, which filters on `isPublic`, not on `userId`. So
   * every new account arrived with "Sharing Voice" already satisfied, because
   * somebody else had shared something. Counting per owner is the fix, and it
   * is why the server returns a count instead of the list.
   */
  sharesPosted: number
}

function cloudActive(): boolean {
  try {
    return API_BASE_URL != null && API_BASE_URL !== '' && hasValidToken()
  } catch {
    return false
  }
}

/** Shape of `GET /api/me/grant-context`. */
interface GrantContextResponse {
  badgeDefinitions: BadgeDefinition[]
  userBadges: UserBadge[]
  achievements: Achievement[]
  userAchievements: UserAchievement[]
  sessionRecords: SessionRecord[]
  challengeDefinitions: ChallengeDefinition[]
  challengeProgress: ChallengeProgress[]
  userActivity: Array<Pick<UserActivity, 'kind' | 'refId'>>
  profile: UserProfile | null
  voiceprintCount: number
  followingCount: number
  sharesPosted: number
}

async function fetchBulkContext(): Promise<GrantContext | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/me/grant-context`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) return null
    const body = (await res.json()) as GrantContextResponse

    // The streak is computed here, from the profile row, by the same function
    // the Home card uses — deliberately not returned by the endpoint. A
    // server-side streak would be a second implementation of a rule with
    // freezes, repairs and local midnights in it.
    const currentStreak = computeStreakState(
      streakFieldsOf(body.profile ?? undefined),
      todayDateString(),
    ).currentStreak

    return {
      badges: body.badgeDefinitions ?? [],
      userBadges: body.userBadges ?? [],
      achievements: body.achievements ?? [],
      userAchievements: body.userAchievements ?? [],
      records: body.sessionRecords ?? [],
      challengeDefs: body.challengeDefinitions ?? [],
      challengeProgress: body.challengeProgress ?? [],
      activityRows: body.userActivity ?? [],
      currentStreak,
      voiceprintCount: body.voiceprintCount ?? 0,
      followingCount: body.followingCount ?? 0,
      sharesPosted: body.sharesPosted ?? 0,
    }
  } catch {
    return null
  }
}

/** This singer's own published melodies + runs, for the fallback path. */
async function countOwnShares(): Promise<number> {
  try {
    const db = await getDb()
    const userId = getUserId()
    const [melodies, sessions] = await Promise.all([
      db
        .getRepository<SharedMelody>('sharedMelodies')
        .count({ where: { userId } }),
      db
        .getRepository<SharedSession>('sharedSessions')
        .count({ where: { userId } }),
    ])
    return melodies + sessions
  } catch {
    return 0
  }
}

/** The original twelve-call path: local mode, or the cloud being unreachable. */
async function loadContextPiecemeal(): Promise<GrantContext> {
  const [
    badges,
    userBadges,
    achievements,
    userAchievements,
    records,
    challengeDefs,
    challengeProgress,
    currentStreak,
    voiceprints,
    following,
    sharesPosted,
    activityRows,
  ] = await Promise.all([
    loadBadgeDefinitions(),
    loadUserBadges(),
    loadAchievementDefinitions(),
    loadUserAchievements(),
    loadSessionRecords(200),
    loadChallengeDefinitions(),
    loadChallengeProgress(),
    getCurrentStreak(),
    // Each resolves empty rather than throwing when signed out, which is the
    // contract the grant pass itself keeps.
    listVoiceprints().catch(() => []),
    getFollowing().catch(() => []),
    countOwnShares(),
    loadActivityRows(),
  ])

  return {
    badges,
    userBadges,
    achievements,
    userAchievements,
    records,
    challengeDefs,
    challengeProgress,
    activityRows,
    currentStreak,
    voiceprintCount: voiceprints.length,
    followingCount: following.length,
    sharesPosted,
  }
}

async function loadActivityRows(): Promise<
  Array<Pick<UserActivity, 'kind' | 'refId'>>
> {
  // Same guard loadActivityCounts uses: userActivity is only ever written in
  // cloud mode, so a local read is a round trip that can only return nothing.
  if (!cloudActive()) return []
  try {
    const db = await getDb()
    const repo = db.getRepository<UserActivity>('userActivity')
    return await repo.findAll({ where: { userId: getUserId() } })
  } catch {
    return []
  }
}

/**
 * One request when signed in to the cloud, twelve otherwise.
 *
 * Falls back rather than failing: a 500, a rollback to a worker without the
 * endpoint, or a flaky connection all land on the piecemeal path, which is
 * slower but produces the identical context.
 */
export async function loadGrantContext(): Promise<GrantContext> {
  if (cloudActive()) {
    const bulk = await fetchBulkContext()
    if (bulk) return bulk
  }
  return loadContextPiecemeal()
}
