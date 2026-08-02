// ── Display time ──────────────────────────────────────────────────────
// Seconds to "m:ss" (or "h:mm:ss"), for anything a person reads off a
// transport.
//
// Not formatTimeLrc, which emits the LRC file format (mm:ss.xx) -- that
// is a serialisation for a lyrics file, not a label for a human.

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
