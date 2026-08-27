// ============================================================
// Tap input — where a tap landed against the beat, in milliseconds.
//
// The seam the rhythm drills stand on. A tap arrives as a timestamp
// on the page clock (a pointer event's timeStamp, or performance.now)
// and is compared with the moment a beat was scheduled to sound. Two
// delays sit in between and neither is the ear: the click leaves the
// speaker after the output latency, and the tap reaches the page
// after the touch latency. The app's one latency number — the round
// trip Settings measures, speaker to microphone — stands in for both,
// and is subtracted here. It over-corrects by the microphone's own
// input latency less the touch latency: a few milliseconds on one
// device, and constant, so it cancels out of any change over time,
// which is what a reading is for.
//
// Pure, so it can be tested against fabricated clocks. Nothing here
// touches the DOM, the audio clock or a store.
// ============================================================

export interface TapLedger {
  /** Start a take: taps are measured from `originMs` on the page
   *  clock — the instant the first beat was scheduled to sound. */
  arm: (originMs: number) => void
  /** Record a tap at `atMs` on the page clock. Ignored while unarmed. */
  tap: (atMs: number) => void
  /** Offsets from the origin, in ms, with the latency subtracted. */
  taps: () => readonly number[]
  armed: () => boolean
  disarm: () => void
}

export function createTapLedger(options: {
  /** The round trip to subtract, read at each tap. 0 when unmeasured. */
  latencyMs: () => number
}): TapLedger {
  let origin: number | null = null
  const taps: number[] = []
  return {
    arm: (originMs) => {
      origin = originMs
      taps.length = 0
    },
    tap: (atMs) => {
      if (origin === null) return
      taps.push(atMs - origin - options.latencyMs())
    },
    taps: () => taps,
    armed: () => origin !== null,
    disarm: () => {
      origin = null
    },
  }
}

/** Deviation of one tap from the nearest beat of a grid: negative is
 *  early, positive late. `beatsMs` are the beats' offsets from the same
 *  origin the taps were measured from. Null when there is no beat. */
export function nearestBeatDeviation(
  tapMs: number,
  beatsMs: readonly number[],
): number | null {
  let best: number | null = null
  for (const beat of beatsMs) {
    const deviation = tapMs - beat
    if (best === null || Math.abs(deviation) < Math.abs(best)) {
      best = deviation
    }
  }
  return best
}

export interface TapSummary {
  /** Taps that found a beat within `windowMs`. */
  matched: number
  /** Mean signed deviation: negative is early. */
  meanMs: number
  /** Standard deviation of the matched deviations. */
  spreadMs: number
}

/** Summarise a take: each tap against its nearest beat, taps further
 *  than `windowMs` from any beat left out as misses rather than
 *  dragging the mean. Null with nothing matched. */
export function summariseTaps(
  tapsMs: readonly number[],
  beatsMs: readonly number[],
  windowMs: number,
): TapSummary | null {
  const deviations: number[] = []
  for (const tap of tapsMs) {
    const deviation = nearestBeatDeviation(tap, beatsMs)
    if (deviation !== null && Math.abs(deviation) <= windowMs) {
      deviations.push(deviation)
    }
  }
  if (deviations.length === 0) return null
  const meanMs = deviations.reduce((sum, d) => sum + d, 0) / deviations.length
  const variance =
    deviations.reduce((sum, d) => sum + (d - meanMs) ** 2, 0) /
    deviations.length
  return { matched: deviations.length, meanMs, spreadMs: Math.sqrt(variance) }
}
