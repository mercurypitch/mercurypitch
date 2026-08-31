// ============================================================
// Vibrato detection — the voice's WAVE as a game verb.
//
// Research flag (game-mechanics-research.md): vibrato is detected by
// trainer apps but has never shipped as a game verb anywhere. Here it
// pumps the Resonance Ring pane. Fed the RAW pitch stream (smoothing
// would erase the very modulation we are listening for), it watches a
// short window for periodic oscillation in the singer's vibrato band
// (~4-7 Hz) with a musical depth (roughly a quarter- to full semitone
// peak-to-peak). Pure module, unit-tested with synthetic sines.
// ============================================================

export interface VibratoConfig {
  /** Sliding window the wave is measured over, seconds. */
  windowSec: number
  /** Oscillation rate band that counts as vibrato, Hz. */
  minHz: number
  maxHz: number
  /** Amplitude band (half peak-to-peak), cents. Too small is just jitter,
   * too large is a trill or scooping. */
  minDepthCents: number
  maxDepthCents: number
  /** Samples needed before judging (rules out sparse/stale windows). */
  minSamples: number
  /** A silence gap longer than this resets the window, ms. */
  resetGapMs: number
}

export interface VibratoState {
  active: boolean
  rateHz: number
  depthCents: number
  /** 0..1 pump strength once active (deeper wave pumps harder). */
  strength: number
}

const IDLE: VibratoState = {
  active: false,
  rateHz: 0,
  depthCents: 0,
  strength: 0,
}

export interface VibratoDetector {
  /** Feed one raw pitch sample; returns the current judgment. */
  feed: (tMs: number, midi: number) => VibratoState
  reset: () => void
}

export const createVibratoDetector = (cfg: VibratoConfig): VibratoDetector => {
  let ts: number[] = []
  let ms: number[] = []

  const reset = (): void => {
    ts = []
    ms = []
  }

  const feed = (tMs: number, midi: number): VibratoState => {
    const last = ts.length > 0 ? ts[ts.length - 1] : null
    if (last !== null && tMs - last > cfg.resetGapMs) reset()
    ts.push(tMs)
    ms.push(midi)
    const cutoff = tMs - cfg.windowSec * 1000
    let drop = 0
    while (drop < ts.length && ts[drop] < cutoff) drop++
    if (drop > 0) {
      ts = ts.slice(drop)
      ms = ms.slice(drop)
    }
    const n = ts.length
    if (n < cfg.minSamples) return IDLE
    const spanSec = (ts[n - 1] - ts[0]) / 1000
    if (spanSec < cfg.windowSec * 0.55) return IDLE

    let mean = 0
    for (const m of ms) mean += m
    mean /= n
    let lo = Infinity
    let hi = -Infinity
    for (const m of ms) {
      if (m < lo) lo = m
      if (m > hi) hi = m
    }
    // amplitude as half the peak-to-peak swing, in cents
    const depthCents = ((hi - lo) * 100) / 2

    // count mean-crossings with a small hysteresis so pitch jitter does
    // not read as oscillation
    const gate = 0.04 // semitones — deviations inside this are ignored
    let sign = 0
    let crossings = 0
    for (const m of ms) {
      const dev = m - mean
      if (Math.abs(dev) < gate) continue
      const s = dev > 0 ? 1 : -1
      if (sign !== 0 && s !== sign) crossings++
      sign = s
    }
    const rateHz = crossings / 2 / spanSec

    const active =
      rateHz >= cfg.minHz &&
      rateHz <= cfg.maxHz &&
      depthCents >= cfg.minDepthCents &&
      depthCents <= cfg.maxDepthCents
    const strength = active ? Math.min(1, Math.max(0.25, depthCents / 60)) : 0
    return { active, rateHz, depthCents, strength }
  }

  return { feed, reset }
}
