// ============================================================
// Exercise Scoring Utilities
// ============================================================
//
// Shared helpers for pitch-matching exercises. Centralises the
// freq-to-midi conversion and note accuracy scoring that were
// previously inlined across 8+ exercise controllers.

const A4_FREQ = 440
const A4_MIDI = 69

/** Minimal pitch sample shape compatible with base exercise history */
interface PitchSample {
  freq: number
  time: number
  cents: number
  clarity?: number
}

/**
 * Return the trailing `windowMs` of samples selected by their `time` field.
 *
 * The pitch loop runs on requestAnimationFrame (~16ms) and only emits a sample
 * on confident frames, so history is non-uniformly spaced. Selecting a recent
 * window by slicing a guessed sample count (e.g. `windowMs / 50`) is wrong;
 * always filter by elapsed time instead.
 */
export function trailingSamplesByTime<T extends { time: number }>(
  history: readonly T[],
  windowMs: number,
): T[] {
  if (history.length === 0) return []
  const windowSec = windowMs / 1000
  const latest = history[history.length - 1]!.time
  return history.filter((p) => latest - p.time <= windowSec)
}

/**
 * Convert frequency (Hz) to an exact (non-rounded) MIDI number.
 *
 * Unlike `freqToMidi` in scale-data.ts (which rounds to the nearest
 * integer), this returns a continuous value so callers can compute
 * sub-semitone deviations in cents.
 */
export function freqToExactMidi(freq: number): number {
  if (freq <= 0) return 0
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI
}

/**
 * Score how accurately recent pitch samples match a target MIDI note.
 *
 * Samples carry a `time` field (seconds since the exercise started), so the
 * trailing window is selected by actual elapsed time rather than a guessed
 * sample count. This keeps scoring independent of the pitch loop's frame
 * rate (the loop runs on requestAnimationFrame, ~16ms, not a fixed 50ms).
 *
 * @param history   - Full pitch history from `base.pitchHistory()`
 * @param targetMidi - The expected MIDI note number
 * @param windowMs   - How many milliseconds of recent history to consider
 * @returns A score 0-100 (100 = perfect match)
 */
export function scoreNoteAccuracy(
  history: PitchSample[],
  targetMidi: number,
  windowMs: number,
): number {
  if (history.length === 0) return 0

  const recentSamples = trailingSamplesByTime(history, windowMs)
  return scoreSamples(recentSamples, targetMidi)
}

/**
 * Score an explicit time slice of the history against a target note —
 * `[startSec, endSec)` in exercise-elapsed seconds (the samples' `time`
 * epoch). This is the aligned variant used by phrase/echo scoring: each
 * expected note only sees the samples of ITS slot, so singing the right
 * notes in the wrong order does not score (unlike a window-wide best-match).
 */
export function scoreNoteInRange(
  history: PitchSample[],
  targetMidi: number,
  startSec: number,
  endSec: number,
): number {
  const slice = history.filter((p) => p.time >= startSec && p.time < endSec)
  return scoreSamples(slice, targetMidi)
}

/**
 * Standard deviation of a set of frequencies expressed in cents around their
 * OWN mean — i.e. how steadily a single sustained note was held (0 = rock
 * steady). Fewer than two voiced samples returns 0 (no basis to judge wobble).
 *
 * Use this per sustained note and average the results; taking it across a run
 * that deliberately moves between pitches (e.g. the drone-intonation intervals)
 * measures the movement, not the steadiness, and punishes singing correctly.
 */
export function pitchStabilityCents(freqs: readonly number[]): number {
  const midis = freqs.filter((f) => f > 0).map(freqToExactMidi)
  if (midis.length < 2) return 0
  const mean = midis.reduce((a, b) => a + b, 0) / midis.length
  const variance = midis.reduce((s, v) => s + (v - mean) ** 2, 0) / midis.length
  return Math.sqrt(variance) * 100
}

/**
 * How far, in cents, a slice of samples sat from its target on average.
 * `null` means nothing voiced landed in the slice — no basis to judge, which
 * is NOT the same as "sang it badly" and must not be flattened to a number.
 *
 * Exported because a drill's SCORE cannot answer "was this note hit?".
 * Drills map cents to a score with their own slope (scoreToleranceK,
 * scoreCentsK), and those slopes are divided by a difficulty factor — so one
 * score means a different deviation per drill and per difficulty. Only the
 * deviation itself is comparable, and the note tally is counted from it.
 */
export function averageDeviationCents(
  samples: readonly PitchSample[],
  targetMidi: number,
): number | null {
  const deviations = samples
    .filter((p) => p.freq > 0)
    .map((p) => {
      const midi = freqToExactMidi(p.freq)
      return Math.abs((midi - targetMidi) * 100) // cents
    })

  if (deviations.length === 0) return null
  return deviations.reduce((a, b) => a + b, 0) / deviations.length
}

/** The trailing window's average deviation in cents, or null if unvoiced. */
export function noteDeviationCents(
  history: PitchSample[],
  targetMidi: number,
  windowMs: number,
): number | null {
  if (history.length === 0) return null
  return averageDeviationCents(
    trailingSamplesByTime(history, windowMs),
    targetMidi,
  )
}

/** `[startSec, endSec)`'s average deviation in cents, or null if unvoiced. */
export function noteDeviationCentsInRange(
  history: PitchSample[],
  targetMidi: number,
  startSec: number,
  endSec: number,
): number | null {
  return averageDeviationCents(
    history.filter((p) => p.time >= startSec && p.time < endSec),
    targetMidi,
  )
}

/** Shared cents-deviation scoring: 100 − avgCents×1.5, floored at 0. */
function scoreSamples(samples: PitchSample[], targetMidi: number): number {
  const avgDeviation = averageDeviationCents(samples, targetMidi)
  if (avgDeviation === null) return 0
  return Math.round(Math.max(0, 100 - avgDeviation * 1.5))
}

/**
 * Seconds actually sung, from a voiced-only sample series: sums the gaps
 * between consecutive samples, skipping any gap wider than `maxGapSec` —
 * that is silence (settling before the first note, a breath, a dropout),
 * not singing. Pitch history records only voiced frames, so silence shows
 * up exactly as those wide gaps.
 */
export function voicedSeconds(
  history: ReadonlyArray<{ time: number }>,
  maxGapSec = 0.25,
): number {
  let sung = 0
  for (let i = 1; i < history.length; i++) {
    const dt = history[i]!.time - history[i - 1]!.time
    if (dt > 0 && dt <= maxGapSec) sung += dt
  }
  return sung
}
