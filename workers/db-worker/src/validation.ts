// ── Write validation ─────────────────────────────────────────────────
// Pure per-entity value checks, extracted (like league-points/league-cut)
// so the main project's tests can import them without pulling the whole
// worker — and its Cloudflare ambient types — into their compilation.

type Row = Record<string, unknown>

/**
 * Per-entity value validation for writes. Keeps the (server-derived)
 * leaderboard honest — a forged sessionRecords row can't carry impossible
 * numbers. Returns an error message, or null when the body is acceptable.
 */
export function validateWrite(entity: string, body: Row): string | null {
  if (entity === 'sessionRecords') {
    const inRange = (v: unknown, lo: number, hi: number): boolean =>
      v === undefined || (typeof v === 'number' && v >= lo && v <= hi)
    if (!inRange(body.score, 0, 100)) return 'score must be between 0 and 100'
    if (!inRange(body.accuracy, 0, 100)) {
      return 'accuracy must be between 0 and 100'
    }
    const nh = body.notesHit
    const nt = body.notesTotal
    if (
      typeof nh === 'number' &&
      typeof nt === 'number' &&
      (nh < 0 || nt < 0 || nh > nt)
    ) {
      return 'notesHit must be between 0 and notesTotal'
    }
    // source is the eligibility key for the leaderboard and league awards.
    // Unknown strings earn nothing today, but letting them into the column
    // turns every future eligibility query into a guessing game.
    if (
      body.source !== undefined &&
      (typeof body.source !== 'string' ||
        !['practice', 'challenge', 'weekly', 'exercise'].includes(body.source))
    ) {
      return 'source must be one of practice, challenge, weekly, exercise'
    }
    if (
      body.instrument !== undefined &&
      (typeof body.instrument !== 'string' ||
        !['voice', 'piano', 'guitar'].includes(body.instrument))
    ) {
      return 'instrument must be one of voice, piano, guitar'
    }
    if (
      body.durationMs !== undefined &&
      (typeof body.durationMs !== 'number' ||
        !Number.isFinite(body.durationMs) ||
        body.durationMs <= 0 ||
        body.durationMs > 86_400_000)
    ) {
      return 'durationMs must be measured milliseconds from 1 to 86400000'
    }
    if (
      body.sourceVersion !== undefined &&
      (typeof body.sourceVersion !== 'number' ||
        !Number.isInteger(body.sourceVersion) ||
        body.sourceVersion < 0)
    ) {
      return 'sourceVersion must be a non-negative integer'
    }
    const validEvidenceString = (value: unknown, maxLength: number): boolean =>
      value === undefined ||
      (typeof value === 'string' &&
        value.trim().length > 0 &&
        value.length <= maxLength)
    if (!validEvidenceString(body.sourceRef, 200)) {
      return 'sourceRef must be a non-empty string of at most 200 characters'
    }
    if (!validEvidenceString(body.comparabilityKey, 300)) {
      return 'comparabilityKey must be a non-empty string of at most 300 characters'
    }
    if (
      body.comparabilityKey !== undefined &&
      (body.sourceRef === undefined || body.sourceVersion === undefined)
    ) {
      return 'comparabilityKey requires sourceRef and sourceVersion'
    }
  }
  if (entity === 'userProfiles') {
    // The streak columns are not `serverCols` — the client owns the streak
    // rules (freezes, repairs, local midnights) and writes the result — so
    // until now nothing checked what it wrote, while the leaderboard ranked
    // and gated on the values. Bound them here so `clampStreakHighWater`
    // has numbers to compare: `Math.max(NaN, n)` is NaN, and a NaN bound to
    // an INTEGER column is how an invariant gets enforced into nonsense.
    for (const col of STREAK_COUNTERS) {
      const value = body[col]
      if (value === undefined) continue
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > MAX_STREAK_DAYS
      ) {
        return `${col} must be a whole number of days from 0 to ${MAX_STREAK_DAYS}`
      }
    }
  }
  return null
}

/**
 * A century of unbroken daily practice. Not a product rule — nobody is
 * getting near it — just a ceiling that keeps a typo or a scripted client
 * out of the column the leaderboard sorts on.
 */
export const MAX_STREAK_DAYS = 36_500

/** Profile columns counted in days, all of which must stay whole and >= 0. */
export const STREAK_COUNTERS = [
  'currentStreak',
  'longestStreak',
  'previousStreak',
  'streakFreezes',
] as const
