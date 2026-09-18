// ============================================================
// piano-night-count-in — the shape of a count-in, as pure numbers
// ============================================================
//
// A count-in has to do two things at once: sound its clicks on the audio
// clock, and show a number the player can read as each click lands. Both
// read this one plan, so the number can never drift from the beep, and a
// tempo too fast to read moves the count to half notes instead of racing
// the display — the same way a drummer counts a fast song in "1, 2, 1-2-3-4".

/** Below this many seconds per count nobody can read the number. */
export const COUNT_IN_MIN_INTERVAL_SECONDS = 0.4

/**
 * How far ahead of "now" the first click is scheduled. A click asked for at
 * exactly `currentTime` is already late by the time the audio thread sees
 * it, which put the first beep behind the first number.
 */
export const COUNT_IN_LEAD_SECONDS = 0.05

export interface CountInPlan {
  /** The tempo the song will actually play at, after practice speed. */
  tempoBpm: number
  beatSeconds: number
  /** 1 at a readable tempo; 2, 4 … when the beat is too short to read. */
  beatsPerCount: number
  /** Seconds from one count to the next: beatSeconds × beatsPerCount. */
  intervalSeconds: number
  counts: number
  totalSeconds: number
  /** When each count sounds, in seconds from the count-in's origin. */
  offsetsSeconds: readonly number[]
}

export function planCountIn(tempoBpm: number, counts: number): CountInPlan {
  const safeTempo = Number.isFinite(tempoBpm) && tempoBpm > 0 ? tempoBpm : 120
  const beatSeconds = 60 / safeTempo
  let beatsPerCount = 1
  while (
    beatSeconds * beatsPerCount < COUNT_IN_MIN_INTERVAL_SECONDS &&
    beatsPerCount < 8
  ) {
    beatsPerCount *= 2
  }
  const intervalSeconds = beatSeconds * beatsPerCount
  const safeCounts = Number.isFinite(counts)
    ? Math.max(0, Math.floor(counts))
    : 0
  const offsetsSeconds = Array.from(
    { length: safeCounts },
    (_, index) => index * intervalSeconds,
  )
  return {
    tempoBpm: safeTempo,
    beatSeconds,
    beatsPerCount,
    intervalSeconds,
    counts: safeCounts,
    totalSeconds: safeCounts * intervalSeconds,
    offsetsSeconds,
  }
}

/**
 * The number on screen at `elapsedSeconds` from the origin: the full count
 * until the first click, then one less as each click sounds, never below 1
 * while the count-in is still running.
 */
export function countInRemainingAt(
  plan: CountInPlan,
  elapsedSeconds: number,
): number {
  if (plan.counts === 0) return 0
  const sounded = plan.offsetsSeconds.filter(
    (offset) => offset <= elapsedSeconds + 1e-9,
  ).length
  return Math.min(plan.counts, Math.max(1, plan.counts - sounded + 1))
}
