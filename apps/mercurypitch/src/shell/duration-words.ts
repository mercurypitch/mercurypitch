// ============================================================
// Duration words — how long until something, said as a person says it
// ============================================================
//
// "3 days", "a day", "5 hours", "an hour", "less than an hour": rounded to
// the nearest unit, so the time left is never read as half what it is
// (47 hours is "2 days", not "a day"). The Leagues screen's next cut and the
// Legend's close read the same way. Never "3d 4h", never a percentage.

/** The time left in words, rounded to the nearest day or hour. */
export function durationInWords(ms: number): string {
  const hours = Math.round(ms / 3_600_000)
  if (hours >= 36) return `${Math.round(hours / 24)} days`
  if (hours >= 24) return 'a day'
  if (hours >= 2) return `${hours} hours`
  if (hours === 1) return 'an hour'
  return 'less than an hour'
}
