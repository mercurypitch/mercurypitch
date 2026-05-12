// ============================================================
// pitch-history-window — oscilloscope-style sliding window math
// Maps beat positions to canvas X for pitch history trail.
// ============================================================

export const HISTORY_WINDOW_BEATS = 16
export const HISTORY_FILL_RATIO = 0.65

export function beatToHistoryX(
  beat: number,
  w: number,
  currentBeat: number,
  totalBeats: number,
): number {
  if (!Number.isFinite(beat) || !Number.isFinite(w)) return 0
  const clampedTotal = Math.max(1, totalBeats)
  const windowBeats =
    clampedTotal <= HISTORY_WINDOW_BEATS ? clampedTotal : HISTORY_WINDOW_BEATS
  let windowStart: number
  if (clampedTotal <= HISTORY_WINDOW_BEATS) {
    windowStart = 0
  } else {
    windowStart = currentBeat - windowBeats * HISTORY_FILL_RATIO
    windowStart = Math.max(0, Math.min(windowStart, clampedTotal - windowBeats))
  }
  const x = ((beat - windowStart) / windowBeats) * w
  return Number.isFinite(x) ? x : 0
}
