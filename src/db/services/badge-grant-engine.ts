// ============================================================
// Badge / Achievement Grant Engine
// ============================================================
//
// Badges and achievements are defined + seeded but were never granted at
// runtime. This engine evaluates the user's real stats against the seeded
// definitions and creates the missing UserBadge / UserAchievement records
// (idempotently), notifying the user on each new unlock.
//
// userBadges / userAchievements are cloud entities, so grants only persist
// when signed in; every DB call is wrapped so a signed-out user (or any
// failure) silently no-ops — this must never throw into a completion path.

import { getDb } from '@/db'
import type { Achievement, BadgeDefinition, UserAchievement, UserBadge, } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { loadAchievementDefinitions, loadBadgeDefinitions, loadChallengeDefinitions, loadChallengeProgress, loadUserAchievements, loadUserBadges, } from '@/db/services/challenges-service'
import { getFollowing } from '@/db/services/follow-service'
import { loadSessionRecords } from '@/db/services/session-service'
import { loadSharedMelodies, loadSharedSessions, } from '@/db/services/share-service'
import { getCurrentStreak } from '@/db/services/streak-service'
import type { ActivityCounts } from '@/db/services/user-activity-service'
import { loadActivityCounts } from '@/db/services/user-activity-service'
import { listVoiceprints } from '@/db/services/voiceprint-service'
import { localDayKey } from '@/features/practice-intelligence/practice-activity'
import { showNotification } from '@/stores/notifications-store'

interface GrantStats {
  totalSessions: number
  bestScore: number
  hasPerfectSession: boolean
  currentStreak: number
  challengesCompleted: number
  /** Categories of the challenges the user has completed. */
  completedCategories: Set<string>
  /** Longest streak ever reached, for goals a broken streak should keep. */
  longestStreak: number
  /** Distinct LOCAL days with at least one record — showing up, not volume. */
  distinctDays: number
  /** Which of the four practice surfaces have been used. */
  sourcesUsed: Set<string>
  /** Notes landed on target across every record. */
  notesHit: number
  /** Runs scoring 80 or better. */
  strongRuns: number
  /** Runs scoring 95 or better — the "nearly flawless" band. */
  immaculateRuns: number
  /** Runs scoring 70 or better — the first "that worked" moment. */
  decentRuns: number
  /** Distinct melody/drill names practised. */
  distinctMelodies: number
  /** How many runs came from each surface (practice/exercise/challenge/weekly). */
  bySource: Record<string, number>
  /** Distinct local days whose first practice started before 08:00. */
  earlyDays: number
  /** Distinct local days with practice at or after 22:00. */
  lateDays: number
  /** Distinct Saturday/Sunday practice days. */
  weekendDays: number
  /** Most runs finished within one local day. */
  busiestDay: number
  /** Acts that leave no session behind — karaoke, stems, melodies, Ascent. */
  activity: ActivityCounts
  /** Voiceprints taken. */
  voiceprints: number
  /** Singers followed. */
  friends: number
  /** Badges already earned — the "collector" goals count these. */
  badgesEarned: number
  /** Melodies or runs published to the Community board. */
  sharesPosted: number
}

/** A brand-new singer: every measure at zero. Only used to enumerate names. */
function emptyStats(): GrantStats {
  return {
    totalSessions: 0,
    bestScore: 0,
    hasPerfectSession: false,
    currentStreak: 0,
    challengesCompleted: 0,
    completedCategories: new Set(),
    longestStreak: 0,
    distinctDays: 0,
    sourcesUsed: new Set(),
    notesHit: 0,
    strongRuns: 0,
    immaculateRuns: 0,
    decentRuns: 0,
    distinctMelodies: 0,
    bySource: {},
    earlyDays: 0,
    lateDays: 0,
    weekendDays: 0,
    busiestDay: 0,
    activity: {},
    voiceprints: 0,
    friends: 0,
    badgesEarned: 0,
    sharesPosted: 0,
  }
}

/**
 * Everything the goals are measured against, gathered once.
 *
 * All of it is either already-loaded data or a single cheap list call, and
 * every field below backs at least one seeded achievement — a metric with
 * nothing reading it is dead weight, and a goal with no metric behind it
 * is decoration (see the four that sat permanently ungrantable before).
 */
async function computeStats(userBadgeCount: number): Promise<GrantStats> {
  const [
    records,
    streak,
    progress,
    challengeDefs,
    activity,
    voiceprints,
    friends,
    sharedMelodies,
    sharedSessions,
  ] = await Promise.all([
    loadSessionRecords(200),
    getCurrentStreak(),
    loadChallengeProgress(),
    loadChallengeDefinitions(),
    // Each of these resolves empty rather than throwing when signed out,
    // which is the same contract the grant pass itself keeps.
    loadActivityCounts(),
    listVoiceprints().catch(() => []),
    getFollowing().catch(() => []),
    loadSharedMelodies().catch(() => []),
    loadSharedSessions().catch(() => []),
  ])

  const scores = records.map((r) => r.score ?? 0)
  const defById = new Map(challengeDefs.map((d) => [d.id, d]))
  const completed = progress.filter(
    (p) => p.completed || p.status === 'completed',
  )
  const completedCategories = new Set<string>()
  for (const p of completed) {
    const def = defById.get(p.challengeId)
    if (def) completedCategories.add(def.category)
  }

  // All of the following come out of the records already loaded — no new
  // capture and no new table. An achievement nobody can measure is
  // decoration, so the metric comes first and the goal second.
  const days = new Set<string>()
  const sourcesUsed = new Set<string>()
  const melodies = new Set<string>()
  const earlyDays = new Set<string>()
  const lateDays = new Set<string>()
  const weekendDays = new Set<string>()
  const runsPerDay = new Map<string, number>()
  const bySource: Record<string, number> = {}
  let notesHit = 0
  let strongRuns = 0
  let immaculateRuns = 0
  let decentRuns = 0
  for (const r of records) {
    const when = r.endedAt ?? r.startedAt
    if (typeof when === 'string' && when !== '') {
      const day = localDayKey(when)
      days.add(day)
      runsPerDay.set(day, (runsPerDay.get(day) ?? 0) + 1)
      // Local hour and local weekday, for the same reason localDayKey works
      // in local time: a 23:30 run is a late one wherever the singer is.
      const at = new Date(when)
      if (!Number.isNaN(at.getTime())) {
        if (at.getHours() < 8) earlyDays.add(day)
        if (at.getHours() >= 22) lateDays.add(day)
        const dow = at.getDay()
        if (dow === 0 || dow === 6) weekendDays.add(day)
      }
    }
    const source = r.source ?? 'practice'
    sourcesUsed.add(source)
    bySource[source] = (bySource[source] ?? 0) + 1
    if (typeof r.melodyName === 'string' && r.melodyName !== '') {
      melodies.add(r.melodyName)
    }
    notesHit += r.notesHit ?? 0
    const score = r.score ?? 0
    if (score >= 70) decentRuns += 1
    if (score >= 80) strongRuns += 1
    if (score >= 95) immaculateRuns += 1
  }
  days.delete('')
  earlyDays.delete('')
  lateDays.delete('')
  weekendDays.delete('')

  return {
    totalSessions: records.length,
    bestScore: scores.length > 0 ? Math.max(...scores) : 0,
    hasPerfectSession: scores.some((s) => s >= 100),
    currentStreak: streak,
    challengesCompleted: completed.length,
    completedCategories,
    longestStreak: Math.max(streak, ...records.map((r) => r.streak ?? 0), 0),
    distinctDays: days.size,
    sourcesUsed,
    notesHit,
    strongRuns,
    immaculateRuns,
    decentRuns,
    distinctMelodies: melodies.size,
    bySource,
    earlyDays: earlyDays.size,
    lateDays: lateDays.size,
    weekendDays: weekendDays.size,
    busiestDay: Math.max(0, ...runsPerDay.values()),
    activity,
    voiceprints: voiceprints.length,
    friends: friends.length,
    badgesEarned: userBadgeCount,
    sharesPosted: sharedMelodies.length + sharedSessions.length,
  }
}

/** Whether a badge's unlock condition is met, given current stats. */
function isBadgeEarned(
  badge: BadgeDefinition,
  stats: GrantStats,
  earnedBadgeIds: Set<string>,
  allBadges: BadgeDefinition[],
): boolean {
  switch (badge.category) {
    case 'challenges':
      return stats.challengesCompleted >= 1
    case 'streak':
      // Bronze "On Fire" = 7-day, gold "Streak Master" = 14-day.
      return stats.currentStreak >= (badge.tier === 'gold' ? 14 : 7)
    case 'meta': {
      // "All Star" — every bronze badge earned.
      const bronze = allBadges.filter((b) => b.tier === 'bronze')
      return bronze.length > 0 && bronze.every((b) => earnedBadgeIds.has(b.id))
    }
    default:
      // Category badges map 1:1 to a completed challenge of that category
      // (high-notes, low-notes, speed, perfect, scales, intervals, harmony,
      // agility, range, dynamic, call-response, ...). Matching on the
      // category string keeps new challenge categories self-serving: seed a
      // badge with the same category and it grants on first completion.
      return stats.completedCategories.has(badge.category)
  }
}

/**
 * What each achievement counts, keyed by its seeded name.
 *
 * One number per goal, compared against the definition's own `required` —
 * so retuning a target is a seed edit rather than a code change, and a new
 * achievement only needs code when it needs a new measurement.
 *
 * A name missing from here returns undefined and is left ungranted rather
 * than falsely awarded, which is what keeps a half-built goal honest.
 */
function buildMeasures(stats: GrantStats): Record<string, number> {
  const act = stats.activity
  return {
    // ── beginnings ────────────────────────────────────────────────
    'First Note': stats.totalSessions,
    'Warmed Up': stats.totalSessions,
    'Two Days Running': stats.distinctDays,
    'Drill Sergeant': stats.bySource.exercise ?? 0,
    Challenger: stats.challengesCompleted,
    'Legend Attempt': stats.bySource.weekly ?? 0,
    'Voice Print': stats.voiceprints,
    Composer: act.melody_created ?? 0,
    'Set List': act.playlist_created ?? 0,
    'Stage Debut': act.song_completed ?? 0,
    'Sound Engineer': act.stems_separated ?? 0,
    'On the Path': act.ascent_week_completed ?? 0,
    'Sharing Voice': stats.sharesPosted,
    'First Friend': stats.friends,
    'Hundred Notes': stats.notesHit,
    'Solid Start': stats.decentRuns,

    // ── building ──────────────────────────────────────────────────
    'Ten Days In': stats.distinctDays,
    Regular: stats.distinctDays,
    // Longest, not current: a streak that broke last week was still
    // earned, and taking the achievement back would be mean.
    'Week Runner': stats.longestStreak,
    Fortnight: stats.longestStreak,
    '10 Notes': stats.totalSessions,
    '50 Sessions': stats.totalSessions,
    Dependable: stats.strongRuns,
    'Thousand Notes': stats.notesHit,
    'Wide Repertoire': stats.distinctMelodies,
    // The four practice surfaces: session mode, drills, challenges and the
    // weekly Legend. Rewards trying the app, not grinding one part of it.
    'Well Rounded': stats.sourcesUsed.size,
    'Perfect Run': stats.hasPerfectSession ? 1 : 0,
    'Drill Habit': stats.bySource.exercise ?? 0,
    'Challenge Streak': stats.challengesCompleted,
    'Legend Regular': stats.bySource.weekly ?? 0,
    'Two Weeks Up': act.ascent_week_completed ?? 0,
    'Playlist Night': act.playlist_completed ?? 0,
    'Ten Songs Sung': act.song_completed ?? 0,
    'Backing Band': act.stems_separated ?? 0,
    Songwriter: act.melody_created ?? 0,
    'Early Bird': stats.earlyDays,
    'Night Owl': stats.lateDays,
    'Weekend Voice': stats.weekendDays,
    'Double Session': stats.busiestDay,
    'Voice Diary': stats.voiceprints,
    'Small Circle': stats.friends,

    // ── mastery ───────────────────────────────────────────────────
    Century: stats.totalSessions,
    'Fifty Days': stats.distinctDays,
    'Hundred Days': stats.distinctDays,
    'Month Unbroken': stats.longestStreak,
    'Season Unbroken': stats.longestStreak,
    'Ten Thousand Notes': stats.notesHit,
    Consistent: stats.strongRuns,
    Immaculate: stats.immaculateRuns,
    'Deep Repertoire': stats.distinctMelodies,
    'Drill Master': stats.bySource.exercise ?? 0,
    'Challenge Master': stats.challengesCompleted,
    'Legend Keeper': stats.bySource.weekly ?? 0,
    Summit: act.ascent_week_completed ?? 0,
    Headliner: act.song_completed ?? 0,
    'Full Production': act.stems_separated ?? 0,
    Prolific: act.melody_created ?? 0,
    Collector: stats.badgesEarned,
    'Full Set': stats.badgesEarned,
  }
}

/**
 * Every achievement name this engine knows how to measure. A seeded
 * achievement missing from here can never be granted, so the seed test
 * checks the two lists against each other.
 */
export function measurableAchievements(): string[] {
  return Object.keys(buildMeasures(emptyStats()))
}

/**
 * Progress (0-100) + unlocked flag for an achievement, or null when the
 * achievement depends on a metric we don't track yet (left ungranted rather
 * than falsely awarded).
 */
function evalAchievement(
  ach: Achievement,
  measures: Record<string, number>,
): { unlocked: boolean; progress: number } | null {
  const measured = measures[ach.name]
  if (measured === undefined) return null
  // A definition with a zero or missing target would divide by zero and
  // hand out a NaN progress; treat it as unreachable instead.
  const target = ach.required
  if (!Number.isFinite(target) || target <= 0) return null
  return {
    unlocked: measured >= target,
    progress: Math.min(100, Math.round((measured / target) * 100)),
  }
}

/**
 * Grant one badge directly, referenced by id or by name (challenge
 * definitions carry `rewardBadgeId`; seed data links it by badge name since
 * ids are generated at seed time). Idempotent and silent on failure — same
 * contract as checkAndGrantBadges.
 */
export async function grantBadgeByRef(ref: string): Promise<void> {
  try {
    const [badges, userBadges] = await Promise.all([
      loadBadgeDefinitions(),
      loadUserBadges(),
    ])
    const badge = badges.find((b) => b.id === ref || b.name === ref)
    if (badge === undefined) return
    if (userBadges.some((ub) => ub.badgeId === badge.id)) return

    const db = await getDb()
    const repo = db.getRepository<UserBadge>('userBadges')
    await repo.create({
      userId: getUserId(),
      badgeId: badge.id,
      earnedAt: new Date().toISOString(),
    })
    showNotification(`Badge unlocked: ${badge.name}`, 'success')
  } catch {
    // Signed out or transient failure — ignore.
  }
}

/**
 * Evaluate all badges + achievements and grant any newly-earned ones.
 * Safe to call after any completion event; never throws.
 */
export async function checkAndGrantBadges(): Promise<void> {
  try {
    const [badges, userBadges, achievements, userAchievements] =
      await Promise.all([
        loadBadgeDefinitions(),
        loadUserBadges(),
        loadAchievementDefinitions(),
        loadUserAchievements(),
      ])

    if (badges.length === 0 && achievements.length === 0) return

    // The collector goals count badges, so the stats need the badge list —
    // which this pass has already loaded. Counting what was earned BEFORE
    // this round, deliberately: a badge granted below should show up on
    // the next completion, not race the loop that is granting it.
    const stats = await computeStats(userBadges.length)

    const db = await getDb()
    const badgeRepo = db.getRepository<UserBadge>('userBadges')
    const achRepo = db.getRepository<UserAchievement>('userAchievements')
    const userId = getUserId()
    const now = new Date().toISOString()
    const earnedBadgeIds = new Set(userBadges.map((b) => b.badgeId))

    // Two passes so the meta "All Star" badge can see badges granted this
    // round (e.g. the bronze badge that completes the set).
    for (let pass = 0; pass < 2; pass++) {
      for (const badge of badges) {
        if (earnedBadgeIds.has(badge.id)) continue
        if (!isBadgeEarned(badge, stats, earnedBadgeIds, badges)) continue
        try {
          await badgeRepo.create({ userId, badgeId: badge.id, earnedAt: now })
          earnedBadgeIds.add(badge.id)
          showNotification(`Badge unlocked: ${badge.name}`, 'success')
        } catch {
          // Already granted (race) or signed out — ignore.
        }
      }
    }

    const achByDef = new Map(userAchievements.map((a) => [a.achievementId, a]))
    const measures = buildMeasures(stats)
    for (const ach of achievements) {
      const result = evalAchievement(ach, measures)
      if (!result) continue
      const existing = achByDef.get(ach.id)
      if (existing?.unlocked === true) continue

      const fields = {
        progress: result.progress,
        unlocked: result.unlocked,
        ...(result.unlocked ? { unlockedAt: now } : {}),
      }
      try {
        if (existing) {
          await achRepo.update(existing.id, fields)
        } else {
          await achRepo.create({ userId, achievementId: ach.id, ...fields })
        }
        if (result.unlocked) {
          showNotification(`Achievement unlocked: ${ach.name}`, 'success')
        }
      } catch {
        // Signed out or transient failure — ignore.
      }
    }
  } catch {
    // Grant checks must never disrupt the completion flow.
  }
}
