// ── Display time ──────────────────────────────────────────────────────
// Seconds to "m:ss" (or "h:mm:ss"), for anything a person reads off a
// transport.
//
// Not formatTimeLrc, which emits the LRC file format (mm:ss.xx) -- that
// is a serialisation for a lyrics file, not a label for a human.
//
// A running clock truncates (formatClock): it must not show a second the
// music has not reached. A length, or a time someone asked to jump to,
// rounds to the nearest second (roundedMinutesSeconds). Both settle the
// whole seconds before splitting off the minutes. Rounding afterwards is
// how 179.5 seconds came to read "2:60".

/** e.g. 65 -> "1:05". Negative and non-finite inputs read as "0:00". */
export function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const whole = Math.floor(totalSeconds)
  const s = whole % 60
  const m = Math.floor(whole / 60) % 60
  const h = Math.floor(whole / 3600)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return h > 0
    ? `${h}:${mm}:${String(s).padStart(2, '0')}`
    : `${mm}:${String(s).padStart(2, '0')}`
}

/**
 * e.g. 179.5 -> { minutes: 3, seconds: 0 }. Minutes keep counting past
 * the hour. Callers keep their own guards for missing or empty lengths.
 */
export function roundedMinutesSeconds(totalSeconds: number): {
  minutes: number
  seconds: number
} {
  const whole = Math.round(totalSeconds)
  return { minutes: Math.floor(whole / 60), seconds: whole % 60 }
}

/**
 * The time a voice reply says it jumped to: "2:00" from the first minute
 * on, "59s" inside it. One label for every transport that answers "go to",
 * the Singing tab and the stem mixer alike.
 */
export function formatSeekTarget(totalSeconds: number): string {
  const { minutes, seconds } = roundedMinutesSeconds(totalSeconds)
  return minutes > 0
    ? `${String(minutes)}:${String(seconds).padStart(2, '0')}`
    : `${String(seconds)}s`
}

/**
 * A rest between session items, from milliseconds: "0.5s" under a second,
 * then "45s", "2m 5s", or "2m" on the minute. When ms is omitted or undefined,
 * defaults to 2000ms (2s). Nonsense reads "0s".
 */
export function formatRestDuration(ms?: number): string {
  const actual = ms ?? 2000
  if (!Number.isFinite(actual) || actual <= 0) return '0s'
  const tenths = Math.round(actual / 100) / 10
  if (tenths < 1) return `${String(tenths)}s`
  const { minutes, seconds } = roundedMinutesSeconds(actual / 1000)
  if (minutes === 0) return `${String(seconds)}s`
  return seconds > 0
    ? `${String(minutes)}m ${String(seconds)}s`
    : `${String(minutes)}m`
}
