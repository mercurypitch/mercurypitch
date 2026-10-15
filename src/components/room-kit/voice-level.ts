// ============================================================
// The singer's loudness for Merc: an RMS level as 0..1
// ============================================================
//
// Merc's renderer reads how loud the voice is as 0..1 (MercVoice.level):
// his mouth and his glow follow it. Long note was the first room to feed
// him; every premium room feeds him the same reading. The mic's ring on the
// singer's turn (mic-state.ts) reads it too, from the newest frame.

/** RMS to Merc's 0..1 loudness: -50 dBFS is silent, -10 dBFS is full. */
export function levelFromRms(rms: number): number {
  if (!(rms > 0)) return 0
  const db = 20 * Math.log10(rms)
  return Math.min(1, Math.max(0, (db + 50) / 40))
}

/** The newest frame's loudness as 0..1 (levelFromRms); 0 before any frame. */
export function newestLevel(
  frames: readonly { readonly rms: number }[],
): number {
  return frames.length === 0 ? 0 : levelFromRms(frames[frames.length - 1].rms)
}
