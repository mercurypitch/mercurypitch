// ============================================================
// Glass — honest per-rep metrics + the shatter epicness (spec
// §4, §17.3). Pure post-processing over a rep's pitch frames;
// no composite "voice score" ever (house rule).
// ============================================================

import { CONF_MIN, hzToCents } from '@/lib/mirror/metrics'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { GlassConfig } from './config'
import { GLASS_CONFIG } from './config'

export interface RepMetrics {
  /** 1-based rep number. */
  rep: number
  /** Mean |cents off target| over voiced frames (null: nothing voiced). */
  meanAbsCents: number | null
  /** Longest continuous in-band run, seconds. */
  bestLockSec: number
  /** Fraction of voiced time spent in band (0..1). */
  inBandPct: number
  /** Highest resonance reached during the rep. */
  peakResonance: number
}

const MAX_FRAME_GAP_SEC = 0.1

interface VoicedSample {
  t: number
  absOff: number
}

function voicedOffsets(
  frames: readonly PitchFrame[],
  targetMidi: number,
): VoicedSample[] {
  const targetCents = targetMidi * 100
  return frames
    .filter((f) => f.f0 > 0 && f.conf >= CONF_MIN)
    .map((f) => ({ t: f.t, absOff: Math.abs(hzToCents(f.f0) - targetCents) }))
}

export function computeRepMetrics(
  frames: readonly PitchFrame[],
  targetMidi: number,
  rep: number,
  peakResonance: number,
  config: GlassConfig = GLASS_CONFIG,
): RepMetrics {
  const tol = config.target.tolCents
  const voiced = voicedOffsets(frames, targetMidi)
  if (voiced.length === 0) {
    return {
      rep,
      meanAbsCents: null,
      bestLockSec: 0,
      inBandPct: 0,
      peakResonance,
    }
  }

  const meanAbsCents =
    voiced.reduce((sum, s) => sum + s.absOff, 0) / voiced.length
  const inBand = voiced.filter((s) => s.absOff <= tol)

  let bestLockSec = 0
  let run = 0
  let previousT: number | null = null
  for (const sample of voiced) {
    if (sample.absOff <= tol) {
      const dt =
        previousT === null
          ? 0
          : Math.min(MAX_FRAME_GAP_SEC, Math.max(0, sample.t - previousT))
      run += dt
      bestLockSec = Math.max(bestLockSec, run)
    } else {
      run = 0
    }
    previousT = sample.t
  }

  return {
    rep,
    meanAbsCents,
    bestLockSec,
    inBandPct: inBand.length / voiced.length,
    peakResonance,
  }
}

/** Mean |cents| over the FINAL contiguous in-band run — the winning lock. */
export function lockWindowMeanAbs(
  frames: readonly PitchFrame[],
  targetMidi: number,
  config: GlassConfig = GLASS_CONFIG,
): number | null {
  const tol = config.target.tolCents
  const voiced = voicedOffsets(frames, targetMidi)
  const lock: number[] = []
  for (let i = voiced.length - 1; i >= 0; i--) {
    if (voiced[i].absOff > tol) break
    lock.push(voiced[i].absOff)
  }
  if (lock.length === 0) return null
  return lock.reduce((sum, off) => sum + off, 0) / lock.length
}

/**
 * How earned the shatter was, 0..1 (spec §17.3): a clean first-try lock is
 * the most cinematic; a rep-5 fatigue-grind collapses quick and raw. Derives
 * only from recorded numbers, so replays reproduce the exact same burst.
 */
export function computeEpicness(
  input: {
    shatterRep: number
    fatigue: number
    /** Mean |cents| over the winning lock window (null → treat as edge-of-band). */
    lockMeanAbsCents: number | null
  },
  config: GlassConfig = GLASS_CONFIG,
): number {
  const { base, cleanW, repW, fatigueW } = config.shatter.epicness
  const tol = config.target.tolCents
  const lockMean = input.lockMeanAbsCents ?? tol
  const cleanliness = Math.max(0, Math.min(1, 1 - lockMean / tol))
  const raw =
    base +
    cleanW * cleanliness -
    repW * (input.shatterRep - 1) -
    fatigueW * input.fatigue
  return Math.max(0, Math.min(1, raw))
}
