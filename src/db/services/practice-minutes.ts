// ============================================================
// Practice minutes — the daily-goal accumulator behind the streak
// ============================================================
//
// A day counts toward the streak once ~5 scored minutes are practiced
// (Melodics-style tiny daily goal). Every scored run (a melody session or an
// exercise run) reports its duration here; the day's total lives in
// localStorage keyed by local date. When the total first crosses the goal we
// bump the practice streak (idempotent per day). Device-local by design — the
// streak itself is the cloud value.

import { getCurrentStreak, todayDateString, updatePracticeStreak, } from '@/db/services/streak-service'
import { recordPathPracticeDay } from '@/features/path/path-progress'

export const DAILY_GOAL_MS = 5 * 60 * 1000 // 5 minutes
/** Credit for a completed scored run when no real duration is available. */
export const NOMINAL_RUN_MS = 90 * 1000
const MS_KEY_PREFIX = 'mp_practice_ms_'
const COUNTED_KEY_PREFIX = 'mp_streak_counted_'

function msKey(date: string): string {
  return `${MS_KEY_PREFIX}${date}`
}

function countedKey(date: string): string {
  return `${COUNTED_KEY_PREFIX}${date}`
}

function readNumber(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    const n = raw !== null ? Number(raw) : 0
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

/** Milliseconds of scored practice accumulated today. */
export function getTodayScoredMs(): number {
  return readNumber(msKey(todayDateString()))
}

/** Whole scored minutes practiced today (for the Home daily-goal ring). */
export function getTodayScoredMinutes(): number {
  return Math.floor(getTodayScoredMs() / 60_000)
}

/** True once today's daily goal is met. */
export function isDailyGoalMet(): boolean {
  return getTodayScoredMs() >= DAILY_GOAL_MS
}

/** Drop counters for days other than today so localStorage doesn't grow. */
function pruneOldDays(today: string): void {
  try {
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key === null) continue
      if (
        (key.startsWith(MS_KEY_PREFIX) && key !== msKey(today)) ||
        (key.startsWith(COUNTED_KEY_PREFIX) && key !== countedKey(today))
      ) {
        stale.push(key)
      }
    }
    for (const key of stale) localStorage.removeItem(key)
  } catch {
    // best-effort cleanup only
  }
}

/**
 * Record `ms` of scored practice for today. When the day first reaches the
 * daily goal, bump the practice streak. Returns the (possibly updated) streak
 * value; on any failure returns the value from a plain streak update so callers
 * still get a sensible number to store on a SessionRecord.
 */
export async function addScoredMs(ms: number): Promise<number> {
  const today = todayDateString()
  const safeMs =
    Number.isFinite(ms) && ms > 0 ? Math.min(ms, DAILY_GOAL_MS * 12) : 0

  let total = getTodayScoredMs()
  const wasMet = total >= DAILY_GOAL_MS
  total += safeMs
  try {
    localStorage.setItem(msKey(today), String(total))
    pruneOldDays(today)
  } catch {
    // localStorage unavailable — fall through; the streak can still update.
  }

  const alreadyCounted = readNumber(countedKey(today)) === 1
  const justMet = total >= DAILY_GOAL_MS

  // A goal-met day also lights a segment on the guided path's active orb
  // (idempotent per date — safe to call on every scored run).
  if (justMet) recordPathPracticeDay(today)

  // Bump on the crossing, or self-heal if a previous crossing failed to record.
  if (justMet && (!wasMet || !alreadyCounted)) {
    const streak = await updatePracticeStreak()
    if (streak > 0) {
      try {
        localStorage.setItem(countedKey(today), '1')
      } catch {
        // ignore — worst case we retry the (idempotent) bump next run
      }
    }
    return streak
  }

  // Goal not yet met (or already counted today): report the current streak so
  // callers can snapshot it, without advancing it here.
  return await getCurrentStreak()
}
