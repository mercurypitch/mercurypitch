// ============================================================
// The tap tuner's brain — pure and unit-tested.
//
// The tuner plays a metronome on the audio clock and stamps each tap
// with AudioContext.currentTime (the conductor rule: never frame time).
// Here we turn those stamps into one number: the device's input
// latency — the median signed offset between taps and their nearest
// tick. Positive = taps register late (the usual WebView case); the
// rhythm judge subtracts that much travel so honest taps land centered.
// ============================================================

/** Where the measured offset persists (whole ms; positive = late).
 * The tap tuner writes it; the rhythm judge reads it back. */
export const TAP_LATENCY_KEY = 'beside-cue:games:tap-latency'

export const readStoredTapLatency = (clampMs: number): number | null => {
  try {
    const raw = window.localStorage.getItem(TAP_LATENCY_KEY)
    if (raw === null) return null
    const v = Number(raw)
    return Number.isInteger(v) && Math.abs(v) <= clampMs ? v : null
  } catch {
    return null
  }
}

/** Signed offset of each tap from its NEAREST tick, seconds in → ms
 * out. Taps further off than maxOffFrac of a beat are wild (a stray
 * knock, a missed beat) and dropped rather than averaged in. */
export const tapOffsets = (
  tapTimes: readonly number[],
  firstBeatAt: number,
  beatS: number,
  maxOffFrac: number,
): number[] => {
  const out: number[] = []
  for (const t of tapTimes) {
    const beats = (t - firstBeatAt) / beatS
    const off = (beats - Math.round(beats)) * beatS * 1000
    if (Math.abs(off) <= maxOffFrac * beatS * 1000) out.push(off)
  }
  return out
}

export interface TapLatency {
  /** Median signed offset, whole ms. Positive = taps land late. */
  offsetMs: number
  /** On-grid taps the measurement stands on. */
  taps: number
}

/** Median over the on-grid offsets; null when too few taps survived to
 * trust the number. The clamp keeps a wild session from saving an
 * offset the judge could never mean. */
export const computeTapLatency = (
  tapTimes: readonly number[],
  firstBeatAt: number,
  beatS: number,
  opts: { minTaps: number; maxOffFrac: number; clampMs: number },
): TapLatency | null => {
  const offs = tapOffsets(tapTimes, firstBeatAt, beatS, opts.maxOffFrac)
  if (offs.length < opts.minTaps) return null
  const sorted = [...offs].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const offsetMs = Math.max(
    -opts.clampMs,
    Math.min(opts.clampMs, Math.round(median)),
  )
  return { offsetMs, taps: offs.length }
}
