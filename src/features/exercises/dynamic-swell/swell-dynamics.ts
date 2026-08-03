// ============================================================
// Dynamic Swell — the loudness the score already measures
// ============================================================
//
// 35% of the swell score is dynamic range in dB, computed from real RMS:
//
//   score = avgAccuracy * 0.45 + bestRound * 0.20 + dynamicScore * 0.35
//   dynamicScore = min(100, dynamicRangeDb * 3)
//
// And none of it was on screen. The only live indicator was the pitch
// dot — green within 25 cents, red beyond — borrowed from mirror-melody.
// So a singer deliberately going soft→loud watched a marker that was
// telling them about something else entirely, while the thing the
// exercise is named for went unmeasured to their eyes.
//
// The maths lives here, apart from the DOM, because "is the meter
// moving" is not a question a component test can answer honestly.

/** Frames quiet enough to be room noise rather than singing. */
const SILENCE_RMS = 0.0015

/** The window the meter spans. Below FLOOR reads empty, above CEIL full. */
export const DB_FLOOR = -50
export const DB_CEIL = -6

/** Linear RMS (0–1) to dBFS. Silence maps to the floor, not -Infinity. */
export function rmsToDb(rms: number): number {
  if (!Number.isFinite(rms) || rms <= SILENCE_RMS) return DB_FLOOR
  return Math.max(DB_FLOOR, 20 * Math.log10(rms))
}

/** Where a level sits on the meter, 0–1. */
export function levelFraction(db: number): number {
  if (!Number.isFinite(db)) return 0
  const span = DB_CEIL - DB_FLOOR
  return Math.min(1, Math.max(0, (db - DB_FLOOR) / span))
}

/**
 * How far the singer travelled between their softest and loudest, in dB.
 *
 * Silent frames are dropped rather than clamped to the floor: a pause
 * between phrases is not a pianissimo, and counting it as one would hand
 * out dynamic range for stopping singing.
 */
export function dynamicRangeDb(frames: readonly { rms?: number }[]): number {
  const dbs = frames
    .map((f) => f.rms ?? 0)
    .filter((r) => r > SILENCE_RMS)
    .map(rmsToDb)
  if (dbs.length < 2) return 0
  return Math.max(0, Math.max(...dbs) - Math.min(...dbs))
}

/**
 * What the swell asks for right now, as a fraction of the meter.
 *
 * The exercise is soft → loud → soft, so the target is a shape, not a
 * number. Phase 2 is the sung hold; anything else has nothing to ask
 * for yet.
 */
export function targetFraction(phase: number, elapsedFraction: number): number {
  if (phase !== 2) return 0
  const t = Math.min(1, Math.max(0, elapsedFraction))
  // A single arch: quiet at both ends, peak in the middle.
  return 0.15 + 0.75 * Math.sin(t * Math.PI)
}

/** Plain-language read on how much dynamic range that is. */
export function rangeVerdict(rangeDb: number): string {
  if (rangeDb < 3) return 'Flat — try starting softer'
  if (rangeDb < 8) return 'Some swell'
  if (rangeDb < 15) return 'Good swell'
  return 'Big swell'
}
