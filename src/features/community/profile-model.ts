// ============================================================
// Profile model — the numbers behind "your voice, so far"
// ============================================================
//
// Pure data-in/data-out. Lifted out of CommunityShare so the profile can
// be rebuilt without touching the 1100-line component it grew inside, and
// so the arithmetic is testable without mounting anything.
//
// Every figure here is derived from sessions the singer actually
// completed. Nothing is invented for the sake of filling a card: an empty
// history returns nulls, and the view says so plainly rather than showing
// a confident zero.

/** The shape the profile needs from one completed session. */
export interface ProfileSession {
  score?: number
  avgCents?: number
  completedAt: number
}

export interface ProfileStats {
  sessions: number
  /** Highest single score, rounded. */
  best: number
  /** Mean score across every session. */
  average: number
  /** Mean across the last five — "where you are now" vs "where you've been". */
  recentAverage: number
  /** Milliseconds of the earliest session, for "since". */
  firstAt: number
}

/**
 * Headline stats, or null when there is no history yet.
 *
 * Null rather than zeros: "best score 0%" reads as a bad result, while
 * "sing something and this fills in" reads as an invitation. The
 * difference matters most for the person who just arrived.
 */
export function profileStats(
  sessions: readonly ProfileSession[],
): ProfileStats | null {
  if (sessions.length === 0) return null
  const scores = sessions.map((s) => s.score ?? 0)
  const recent = sessions.slice(-5)
  return {
    sessions: sessions.length,
    best: Math.round(Math.max(...scores)),
    average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    recentAverage: Math.round(
      recent.reduce((a, s) => a + (s.score ?? 0), 0) / recent.length,
    ),
    firstAt: Math.min(...sessions.map((s) => s.completedAt)),
  }
}

/**
 * The last N scores, oldest first — the shape of a practice run rather
 * than a single number. Short series are returned as-is; the view decides
 * whether two points are worth drawing.
 */
export function scoreSeries(
  sessions: readonly ProfileSession[],
  count = 12,
): number[] {
  return sessions.slice(-count).map((s) => Math.round(s.score ?? 0))
}

/**
 * Accuracy per session, oldest first.
 *
 * `avgCents` is how far off pitch they were, so it inverts into a
 * percentage; sessions recorded before that was measured fall back to
 * their score, which is the closest honest stand-in.
 */
export function accuracySeries(
  sessions: readonly ProfileSession[],
  count = 12,
): number[] {
  return sessions
    .slice(-count)
    .map((s) =>
      s.avgCents === undefined
        ? Math.round(s.score ?? 0)
        : Math.max(0, Math.min(100, Math.round(100 - Math.abs(s.avgCents)))),
    )
}

/**
 * Movement between the first half of a series and the second, in points.
 *
 * The number people actually want is "am I getting better", and a single
 * best-ever cannot answer it. Needs at least four points to mean
 * anything, so fewer returns null rather than a dramatic swing between
 * two sessions.
 */
export function trend(series: readonly number[]): number | null {
  if (series.length < 4) return null
  const mid = Math.floor(series.length / 2)
  const mean = (xs: readonly number[]): number =>
    xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.round(mean(series.slice(mid)) - mean(series.slice(0, mid)))
}

/** An SVG polyline path for a sparkline in a `width` x `height` box. */
export function sparklinePoints(
  series: readonly number[],
  width: number,
  height: number,
): string {
  if (series.length === 0) return ''
  if (series.length === 1) {
    return `0,${height / 2} ${width},${height / 2}`
  }
  // Scale to the series' own range, floored at 10 points so a steady
  // singer does not get a chart of dramatic-looking noise.
  const lo = Math.min(...series)
  const hi = Math.max(...series)
  const span = Math.max(10, hi - lo)
  const mid = (lo + hi) / 2
  const top = mid + span / 2
  const step = width / (series.length - 1)
  return series
    .map((value, i) => {
      const y = height - ((value - (top - span)) / span) * height
      return `${(i * step).toFixed(1)},${Math.max(0, Math.min(height, y)).toFixed(1)}`
    })
    .join(' ')
}
