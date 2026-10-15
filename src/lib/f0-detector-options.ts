// ============================================================
// The F0 stream's detector settings (pitch-f0-stream.ts)
// ============================================================
//
// Shared with the detector's warm-up (pitch-detector-warmup.ts), so the
// warm-up runs the YIN pass under the settings the stream's own detector
// has.

import type { PitchDetectorOptions } from '@/lib/pitch-detector'

/** Everything but the sample rate and the buffer's size. */
export const F0_DETECTOR_OPTIONS = {
  algorithm: 'yin',
  // Human singing range with headroom; keeps YIN off subharmonics.
  minFrequency: 60,
  maxFrequency: 1600,
  // The mirror captures with AGC off (required for honest pitch), so raw
  // mobile input is quiet — the detector's 0.02 default RMS gate would
  // reject normal singing at arm's length on a phone.
  minAmplitude: 0.005,
} as const satisfies PitchDetectorOptions
