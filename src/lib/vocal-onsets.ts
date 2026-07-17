// ============================================================
// vocal-onsets — energy-flux onset detection on a clean vocal stem
// ============================================================
//
// Separation already removed drums/instruments, so a log-energy positive
// flux with an adaptive threshold finds sung-word attacks well — no FFT,
// no model download, runs in ~tens of ms for a full song. Used by the
// auto word-sync (docs/plans/lyrics-word-sync.md) to snap word timings
// to real vocal onsets.

const FRAME = 1024
const HOP = 512
/** Two onsets closer than this are one attack (seconds). */
const MIN_SEPARATION_SEC = 0.09
/** Adaptive threshold: local mean multiplier + absolute floor. */
const THRESHOLD_RATIO = 1.6
const THRESHOLD_FLOOR = 0.008
/** Averaging window for the adaptive threshold (seconds). */
const THRESHOLD_WINDOW_SEC = 0.35

/** Detect vocal onset times (seconds, ascending) in an AudioBuffer. */
export function detectVocalOnsets(buffer: AudioBuffer): number[] {
  const sr = buffer.sampleRate
  const mono = buffer.getChannelData(0)
  const nFrames = Math.floor((mono.length - FRAME) / HOP)
  if (nFrames <= 2) return []

  // Frame RMS energy
  const energy = new Float32Array(nFrames)
  for (let f = 0; f < nFrames; f++) {
    let sum = 0
    const off = f * HOP
    for (let i = 0; i < FRAME; i++) {
      const s = mono[off + i]
      sum += s * s
    }
    energy[f] = Math.sqrt(sum / FRAME)
  }

  // Log-compressed positive flux — rising energy only
  const flux = new Float32Array(nFrames)
  for (let f = 1; f < nFrames; f++) {
    const d = Math.log1p(energy[f] * 40) - Math.log1p(energy[f - 1] * 40)
    flux[f] = d > 0 ? d : 0
  }

  // Peak-pick against a moving-average threshold
  const win = Math.max(1, Math.round((THRESHOLD_WINDOW_SEC * sr) / HOP))
  const onsets: number[] = []
  let lastT = -Infinity
  for (let f = 2; f < nFrames - 1; f++) {
    let acc = 0
    let n = 0
    for (
      let j = Math.max(0, f - win);
      j <= Math.min(nFrames - 1, f + win);
      j++
    ) {
      acc += flux[j]
      n++
    }
    const threshold = (acc / n) * THRESHOLD_RATIO + THRESHOLD_FLOOR
    if (
      flux[f] > threshold &&
      flux[f] >= flux[f - 1] &&
      flux[f] > flux[f + 1]
    ) {
      const t = (f * HOP + FRAME / 2) / sr
      if (t - lastT >= MIN_SEPARATION_SEC) {
        onsets.push(Math.round(t * 1000) / 1000)
        lastT = t
      }
    }
  }
  return onsets
}
