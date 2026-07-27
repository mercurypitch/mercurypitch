// ── League points: pure, dependency-free calculator ──────────────────
// No D1 / auth / Env imports, so this is importable by the frontend test
// suite (src/tests/league-points.test.ts) as well as the worker. Only the
// *scoring decision* lives here; the DB writes (crediting a membership,
// appending a leaguePointEvents audit row) live in the worker request path
// and are out of scope for this foundation.
//
// League points are an "effort currency", separate from the leaderboard's
// skill score: earned per completed action, weighted so harder/longer actions
// pay more, but the floor still rewards mere participation. Accumulated over
// the ISO week, reset each Monday. The model is consistency-weighted — the
// daily-goal bonus (see goalMetBonus) dominates, so streaks, not raw skill,
// drive the ladder.
//
// ELIGIBILITY (enforced by the caller, not here): leagues are a
// REGISTERED-users-only surface (users.authProvider != 'anonymous'). This
// module is pure arithmetic and makes no eligibility decision.
//
// Anti-abuse: callers must feed a SERVER-side score (from sessionRecords or
// the streak service), never a client-reported number.

/**
 * Tunable point weights. Mirrors the single-row `leaguePointsConfig` table in
 * schema.sql (minus the id/createdAt/updatedAt bookkeeping columns), so admins
 * can retune the ladder without a deploy. The worker loads the row and falls
 * back to {@link DEFAULT_LEAGUE_POINTS_CONFIG} when it is missing.
 */
export interface LeaguePointsConfig {
  /** Flat points for completing an exercise. */
  exerciseBase: number
  /** Flat points for a challenge attempt. */
  challengeBase: number
  /** Flat points for a weekly "Sing the Legend" attempt. */
  weeklyBase: number
  /** Score is divided by this then rounded for the quality bonus (0..10 at divisor 10). */
  scoreDivisor: number
  /** Added the first time a given exercise is completed on a given day. */
  dailyVarietyBonus: number
  /** Added once per day when the daily practice goal is met (the streak day). */
  goalMetBonus: number
  /** Added when the streak hits a milestone (every `milestoneEvery` days). */
  streakMilestoneBonus: number
  /** Streak-day period between milestone bonuses. */
  milestoneEvery: number
}

/**
 * Default weights, matching the `leaguePointsConfig` seed row in schema.sql.
 * Consistency-weighted: goalMetBonus (+25/day) is the dominant lever, so a
 * daily practiser out-earns a one-session grinder.
 */
export const DEFAULT_LEAGUE_POINTS_CONFIG: LeaguePointsConfig = {
  exerciseBase: 10,
  challengeBase: 15,
  weeklyBase: 20,
  scoreDivisor: 10,
  dailyVarietyBonus: 5,
  goalMetBonus: 25,
  streakMilestoneBonus: 50,
  milestoneEvery: 7,
}

/**
 * The kind of completed action a points award is for.
 * - `practice` — free practice; NEVER ranked, always earns 0.
 * - `exercise` — a structured exercise completion (base + score + variety).
 * - `challenge` — a challenge attempt (base + score).
 * - `weekly` — a weekly "Sing the Legend" attempt (base + score).
 *
 * (Once this branch gains the `SessionSource` union in src/db/entities.ts,
 * these should be reconciled with it — it does not exist here yet.)
 */
export type LeaguePointsSource = 'practice' | 'challenge' | 'weekly' | 'exercise'

export interface LeaguePointsInput {
  source: LeaguePointsSource
  /** The action's score, 0..100. Clamped defensively; non-finite treated as 0. */
  score: number
  /**
   * True when this is the first completion of the given exercise today, which
   * grants the daily-variety bonus. Only meaningful for `source: 'exercise'`.
   */
  firstOfDayForExercise?: boolean
}

/** Clamp an arbitrary number into 0..100; non-finite becomes 0. */
function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  if (score < 0) return 0
  if (score > 100) return 100
  return score
}

/** The rounded quality bonus for a score (0..10 at the default divisor). */
function scoreBonus(score: number, config: LeaguePointsConfig): number {
  // A non-positive divisor would blow up / go infinite — treat as "no bonus".
  if (!(config.scoreDivisor > 0)) return 0
  return Math.round(clampScore(score) / config.scoreDivisor)
}

/**
 * League points granted for one completed action. Pure and deterministic.
 * `practice` always returns 0 (free practice is never ranked). Otherwise:
 *   base (per source) + round(clamp(score) / scoreDivisor)
 *   + dailyVarietyBonus  (exercise only, when firstOfDayForExercise)
 */
export function pointsForAction(
  input: LeaguePointsInput,
  config: LeaguePointsConfig = DEFAULT_LEAGUE_POINTS_CONFIG,
): number {
  // Free practice is never ranked — no base, no score, no bonus.
  if (input.source === 'practice') return 0

  const bonus = scoreBonus(input.score, config)

  switch (input.source) {
    case 'exercise': {
      const variety = input.firstOfDayForExercise ? config.dailyVarietyBonus : 0
      return config.exerciseBase + bonus + variety
    }
    case 'challenge':
      return config.challengeBase + bonus
    case 'weekly':
      return config.weeklyBase + bonus
    default:
      // Exhaustive over LeaguePointsSource; unknown sources earn nothing.
      return 0
  }
}

/**
 * Points for meeting the daily practice goal (the streak day). This is the
 * consistency lever that makes showing up daily out-earn one big session.
 */
export function goalMetBonus(
  config: LeaguePointsConfig = DEFAULT_LEAGUE_POINTS_CONFIG,
): number {
  return config.goalMetBonus
}

/**
 * Points for hitting a streak milestone. Awarded only when `streakDays` is a
 * positive whole multiple of `config.milestoneEvery` (every 7 days by
 * default); 0 otherwise. Non-positive `milestoneEvery` disables milestones.
 */
export function streakMilestoneBonus(
  streakDays: number,
  config: LeaguePointsConfig = DEFAULT_LEAGUE_POINTS_CONFIG,
): number {
  const days = Math.floor(streakDays)
  if (days <= 0) return 0
  if (!(config.milestoneEvery > 0)) return 0
  return days % config.milestoneEvery === 0 ? config.streakMilestoneBonus : 0
}
