// ============================================================
// mic-level — the one live microphone level
// ============================================================
//
// Two jobs, one module so there is exactly one answer to "how loud is the
// input right now":
//
//   1. The RMS helpers every mic surface derives its level with, so
//      `useMicInsights` behaves identically whether a tab exposes a raw
//      buffer or an AnalyserNode.
//   2. A publish/read seam. Whichever capture loop is currently running
//      publishes the RMS it already computed for pitch detection; anything
//      that needs to show or judge that level reads it back without being
//      wired to that particular tab. Two readers today: the input meter
//      (@/components/MicLevelMeter) and the silence watchdog
//      (@/lib/input-health).
//
// Deliberately not a Solid signal and deliberately not reactive. Publishers
// run inside requestAnimationFrame at ~60 Hz, and pushing every frame through
// a signal would re-run subscriber effects sixty times a second to move a bar
// that only needs fifteen. Readers poll on their own schedule instead, and
// this module stays framework-free so the watchdog beneath it can be tested
// without a DOM.

/**
 * How long a published level stays meaningful.
 *
 * Capture loops publish every animation frame (~16 ms), so a reading older
 * than this means the loop has stopped — a backgrounded tab, a released mic,
 * a torn-down page. The honest answer then is silence, not the last number we
 * happened to see before everything went quiet.
 */
const STALE_MS = 400

let latestRms = 0
let latestAt = Number.NEGATIVE_INFINITY

/**
 * Publish one analysed frame's level, as linear RMS.
 *
 * Called from inside capture loops, so it must stay allocation-free and
 * branch-light. Non-finite and negative values are dropped rather than
 * clamped: they mean the caller's buffer was wrong, and a fabricated 0 would
 * read as a working-but-silent mic.
 */
export function publishMicLevel(rms: number, now = performance.now()): void {
  if (!Number.isFinite(rms) || rms < 0) return
  latestRms = rms
  latestAt = now
}

/**
 * Current input level as linear RMS (0-1), or 0 when no capture loop has
 * published recently — see {@link STALE_MS}.
 */
export function readMicLevel(now = performance.now()): number {
  if (now - latestAt > STALE_MS) return 0
  return latestRms
}

/** Forget the published level. Called on mic release, and between tests. */
export function resetMicLevel(): void {
  latestRms = 0
  latestAt = Number.NEGATIVE_INFINITY
}

/** RMS amplitude (0-1) of a time-domain sample buffer. */
export function rmsOfTimeData(data: Float32Array | null | undefined): number {
  if (!data || data.length === 0) return 0
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
  return Math.sqrt(sum / data.length)
}

// Reused scratch buffer so per-frame RMS sampling doesn't allocate ~60x/s.
let scratch: Float32Array | null = null

/** RMS amplitude (0-1) sampled from an AnalyserNode's time-domain data. */
export function rmsOfAnalyser(
  analyser: AnalyserNode | null | undefined,
): number {
  if (!analyser) return 0
  if (scratch === null || scratch.length !== analyser.fftSize) {
    scratch = new Float32Array(analyser.fftSize)
  }
  analyser.getFloatTimeDomainData(scratch as Float32Array<ArrayBuffer>)
  return rmsOfTimeData(scratch)
}

/**
 * Linear RMS to dBFS, floored at `floorDb` so a silent frame maps to the
 * bottom of a meter rather than to -Infinity.
 */
export function rmsToDb(rms: number, floorDb = -60): number {
  if (rms <= 0) return floorDb
  return Math.max(floorDb, 20 * Math.log10(rms))
}

/**
 * Meter position (0-1) for a level, on a dB scale.
 *
 * Linear RMS is useless to look at: normal singing sits in the bottom tenth
 * of the range and the bar barely leaves the floor. Mapping through dBFS
 * spends the width where the voice actually lives.
 */
export function micLevelFraction(rms: number, floorDb = -60): number {
  const db = rmsToDb(rms, floorDb)
  return Math.min(1, Math.max(0, (db - floorDb) / -floorDb))
}
