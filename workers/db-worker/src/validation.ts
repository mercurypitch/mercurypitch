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
export function validateWrite(
  entity: string,
  body: Row,
): string | null {
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
  }
  return null
}
