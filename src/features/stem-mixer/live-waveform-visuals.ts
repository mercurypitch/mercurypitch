// ============================================================
// Live waveform visuals — adaptive display gain for truthful movement
// ============================================================

const TARGET_DISPLAY_PEAK = 0.62
const MAX_DISPLAY_GAIN = 5.5

/** Peak distance from the Web Audio byte-domain centre, normalized to 0–1. */
export const liveWaveformPeak = (data: ArrayLike<number>): number => {
  let peak = 0
  for (let i = 0; i < data.length; i++) {
    peak = Math.max(peak, Math.abs(data[i] / 128 - 1))
  }
  return Math.min(1, peak)
}

/** Boost quiet real signals enough to read while leaving loud signals alone. */
export const liveWaveformDisplayGain = (peak: number): number => {
  if (!Number.isFinite(peak) || peak <= 0) return 1
  return Math.min(MAX_DISPLAY_GAIN, Math.max(1, TARGET_DISPLAY_PEAK / peak))
}

/** Convert one byte-domain analyser sample to a clipped display amplitude. */
export const liveWaveformSample = (sample: number, gain: number): number =>
  Math.min(1, Math.max(-1, (sample / 128 - 1) * gain))
