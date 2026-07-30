// ============================================================
// Ear Lab — round-trip latency analysis (the timing wizard's
// maths, kept pure so it can be tested with synthetic buffers).
//
// The wizard plays short clicks at known AudioContext times and
// records the microphone on the same clock. The gap between when
// a click was scheduled and when its onset shows up in the mic
// capture is the full round trip: output buffering + speaker +
// air + mic + input buffering. Millisecond drills (The Grid,
// tap-timing) subtract this number; without it, "you resolve
// 14 ms" would include the hardware and be a lie — which is why
// the wizard gates every ms-unit drill (plan §7).
// ============================================================

export interface ClickDetection {
  /** Scheduled click time, seconds on the capture clock. */
  scheduledAt: number
  /** Detected onset in the capture, or null if never found. */
  detectedAt: number | null
  /** Round trip in milliseconds (null when undetected). */
  offsetMs: number | null
}

export interface LatencyReading {
  /** Robust round-trip estimate, milliseconds. */
  medianMs: number
  /** Median absolute deviation of the per-click offsets, ms. A big
   *  spread means echoes or noise — the wizard asks for a re-run. */
  spreadMs: number
  detected: number
  total: number
}

/** How long after the scheduled time an onset may arrive and still
 *  count. Bluetooth output alone can push 300 ms; beyond 600 ms the
 *  "detection" is more likely the next click or a noise burst. */
export const MAX_ROUND_TRIP_MS = 600

/** Detections needed before a reading is trusted at all. */
export const MIN_DETECTIONS = 3

/** Spread beyond which the wizard should ask for a quieter re-run. */
export const MAX_TRUSTED_SPREAD_MS = 25

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Find one click's onset: the first sample in the search window whose
 * short-window energy clears an adaptive threshold.
 *
 * The threshold adapts to the window's own noise floor (so a laptop
 * fan does not fake an onset) with an absolute floor (so a silent
 * capture — muted speakers, wrong output device — detects nothing
 * rather than latching onto quantisation noise).
 */
export function detectOnset(
  capture: Float32Array,
  sampleRate: number,
  captureStartAt: number,
  searchFrom: number,
  searchWindowSec: number = MAX_ROUND_TRIP_MS / 1000,
): number | null {
  const startSample = Math.max(
    0,
    Math.floor((searchFrom - captureStartAt) * sampleRate),
  )
  const endSample = Math.min(
    capture.length,
    startSample + Math.ceil(searchWindowSec * sampleRate),
  )
  if (endSample - startSample < sampleRate * 0.01) return null

  // Noise floor: mean |x| over the window's first 30 ms — the stretch
  // before the click can physically have arrived.
  const floorEnd = Math.min(
    endSample,
    startSample + Math.floor(sampleRate * 0.03),
  )
  let floorSum = 0
  for (let i = startSample; i < floorEnd; i++) floorSum += Math.abs(capture[i])
  const noiseFloor = floorSum / Math.max(1, floorEnd - startSample)

  const threshold = Math.max(0.02, noiseFloor * 8)

  // Short-window mean |x| (~1.5 ms) so a single crackle sample cannot
  // trigger; the click burst sustains the level, a pop does not.
  const win = Math.max(4, Math.floor(sampleRate * 0.0015))
  let running = 0
  for (let i = startSample; i < endSample; i++) {
    running += Math.abs(capture[i])
    if (i - startSample >= win) running -= Math.abs(capture[i - win])
    if (i - startSample >= win && running / win >= threshold) {
      return captureStartAt + (i - win + 1) / sampleRate
    }
  }
  return null
}

/** Detect every scheduled click's onset in one capture. */
export function detectClicks(
  capture: Float32Array,
  sampleRate: number,
  captureStartAt: number,
  scheduledAts: readonly number[],
): ClickDetection[] {
  return scheduledAts.map((scheduledAt) => {
    const detectedAt = detectOnset(
      capture,
      sampleRate,
      captureStartAt,
      scheduledAt,
    )
    return {
      scheduledAt,
      detectedAt,
      offsetMs: detectedAt === null ? null : (detectedAt - scheduledAt) * 1000,
    }
  })
}

/**
 * Pool per-click offsets into one reading. Median + MAD rather than
 * mean + SD: one click swallowed by a cough must not move the number
 * the drills will subtract.
 */
export function aggregateLatency(
  detections: readonly ClickDetection[],
): LatencyReading | null {
  const offsets = detections
    .map((d) => d.offsetMs)
    .filter((v): v is number => v !== null && v >= 0)
  if (offsets.length < MIN_DETECTIONS) return null

  const med = median(offsets)
  const spread = median(offsets.map((v) => Math.abs(v - med)))

  return {
    medianMs: Math.round(med * 10) / 10,
    spreadMs: Math.round(spread * 10) / 10,
    detected: offsets.length,
    total: detections.length,
  }
}
