// ============================================================
// Local calendar day — the single source of "what day is it"
// ============================================================
//
// Streaks, the daily goal, the daily routine and Ascent days all answer "is
// this the same day as the stored one?", and they must answer it in the
// singer's own calendar. `new Date().toISOString().slice(0, 10)` answers it in
// UTC, which is wrong east and west of Greenwich:
//
//   at UTC+2, a session at 01:00 local banks to the PREVIOUS UTC day, so a
//   singer who practised Monday evening and Tuesday after midnight has both
//   sessions land on Monday and their streak breaks.
//
// The heatmap already got this right (see practice-activity.ts:localDayKey);
// the streak, goal, routine and Ascent code did not. This is the one helper
// they should all use.

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * `date` as a local-calendar `YYYY-MM-DD`.
 *
 * Reads the LOCAL components, so the string names the day the singer is living
 * in, not the day it is in UTC. Callers compare these strings for equality and
 * feed them to calendar-string date math (daysBetween/addDays), both of which
 * are correct as long as every anchor is produced the same way — which is the
 * point of routing them all through here.
 */
export function localDayString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 0-based day-of-year in the LOCAL calendar.
 *
 * Used as the deterministic seed for "today's" generated routine, so it must
 * roll over at local midnight rather than UTC midnight or the routine changes
 * hours early or late.
 *
 * The subtraction is done on `Date.UTC` timestamps built from the LOCAL
 * components on purpose: it keeps the calendar arithmetic (local) while making
 * the millisecond maths immune to DST, where a real local day is 23 or 25
 * hours and a naive `getTime()` difference would be off by one across a
 * spring-forward.
 */
export function localDayOfYear(date: Date = new Date()): number {
  const startOfYear = Date.UTC(date.getFullYear(), 0, 0)
  const midnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((midnight - startOfYear) / 86_400_000)
}
