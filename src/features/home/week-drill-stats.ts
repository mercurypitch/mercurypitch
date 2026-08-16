// ============================================================
// Home week strip — one source of truth for "drills this week"
// (CLAUDE-JOURNEY-009)
// ============================================================
//
// The strip used to count the device-local exercise history alone, so a
// second device signed into the same account reported zero drills while
// the Progress page (which reads the synced session records) showed the
// full story. The synced records are the account's truth; the local
// mirror only steps in when the record read lags or fails and this
// device has seen more than the account read returned.

/** The slice of a session record this module needs. */
export interface WeekRecord {
  source?: string
  endedAt: string
  score: number
}

/** The slice of a local exercise-history entry this module needs. */
export interface WeekLocalEntry {
  completedAt: number
  score: number
}

export interface WeekDrillStats {
  runs: number
  avgScore: number | null
}

const WEEK_MS = 7 * 86_400_000

function summarize(scores: number[]): WeekDrillStats {
  return {
    runs: scores.length,
    avgScore:
      scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        : null,
  }
}

/**
 * Drills in the trailing seven days. `synced` are the account's session
 * records ('exercise'-source records ARE the drills — challenge and weekly
 * records reference a challengeId and may not be drills at all); `local` is
 * this device's history mirror. The larger window count wins: synced when
 * the account has at least as much as the device (the second-device case,
 * and the everyday case, since every local run is also a record), local
 * when the record read failed, lags, or is still loading (undefined).
 */
export function weekDrillStats(
  nowMs: number,
  local: readonly WeekLocalEntry[],
  synced: readonly WeekRecord[] | undefined,
): WeekDrillStats {
  const weekAgo = nowMs - WEEK_MS
  const localScores = local
    .filter((entry) => entry.completedAt >= weekAgo)
    .map((entry) => entry.score)
  const syncedScores = (synced ?? [])
    .filter(
      (record) =>
        record.source === 'exercise' && Date.parse(record.endedAt) >= weekAgo,
    )
    .map((record) => record.score)
  return summarize(
    syncedScores.length >= localScores.length ? syncedScores : localScores,
  )
}
