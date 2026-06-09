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
 * @param history   - Full pitch history from `base.pitchHistory()`
 * @param targetMidi - The expected MIDI note number
 * @param windowMs   - How many milliseconds of recent history to consider
 * @param sampleRateMs - Approximate interval between samples (default 50ms)
 * @returns A score 0-100 (100 = perfect match)
 */
export function scoreNoteAccuracy(
  history: PitchSample[],
  targetMidi: number,
  windowMs: number,
  sampleRateMs = 50,
): number {
  const sampleCount = Math.max(1, Math.floor(windowMs / sampleRateMs))
  const recentSamples = history.slice(-sampleCount)

  const deviations = recentSamples
    .filter((p) => p.freq > 0)
    .map((p) => {
      const midi = freqToExactMidi(p.freq)
      return Math.abs((midi - targetMidi) * 100) // cents
    })

  if (deviations.length === 0) return 0

  const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length
  return Math.round(Math.max(0, 100 - avgDeviation * 1.5))
}
