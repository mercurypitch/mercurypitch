// ============================================================
// Glass — calibration glide → the glass's note (spec §3.2).
//
// Pure functions over pitch frames: find the singer's ceiling
// (highest semitone sustained long enough), derive the target the
// glass rings at, and judge whether the glide was usable. The
// component decides retries; this module only measures.
// ============================================================

import { CONF_MIN, hzToCents } from '@/lib/mirror/metrics'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { GlassConfig } from './config'
import { GLASS_CONFIG } from './config'

/** Frame-to-frame gaps above this are breaths/dropouts, not dwell. */
const MAX_FRAME_GAP_SEC = 0.1

export interface CalibrationResult {
  /** The glide was long and wide enough to trust. */
  ok: boolean
  /** Highest semitone sustained ≥ ceilingSustainMs (null: none qualified). */
  ceilingMidi: number | null
  /** ceiling + target.offsetSemitones (null while no ceiling). */
  targetMidi: number | null
  /** Dwell-weighted median semitone (null: no voiced audio at all). */
  medianMidi: number | null
  /** median + fallbackOffsetFromMedian — the last-resort target. */
  fallbackTargetMidi: number | null
  voicedSeconds: number
  spanSemitones: number
}

/**
 * Analyse a calibration glide. Voiced dwell is accumulated per semitone
 * (gaps capped so breaths don't count), the ceiling is the highest semitone
 * with enough sustained dwell, and the target sits `offsetSemitones` below
 * it (the offset is negative — see GLASS_CONFIG.target for the tuning
 * rationale).
 */
export function computeTarget(
  frames: readonly PitchFrame[],
  config: GlassConfig = GLASS_CONFIG,
): CalibrationResult {
  const dwellMsByMidi = new Map<number, number>()
  let voicedSeconds = 0
  let previousT: number | null = null

  for (const frame of frames) {
    const voiced = frame.f0 > 0 && frame.conf >= CONF_MIN
    if (!voiced) {
      previousT = frame.t
      continue
    }
    const dt =
      previousT === null
        ? 0
        : Math.min(MAX_FRAME_GAP_SEC, Math.max(0, frame.t - previousT))
    previousT = frame.t
    voicedSeconds += dt
    const midi = Math.round(hzToCents(frame.f0) / 100)
    dwellMsByMidi.set(midi, (dwellMsByMidi.get(midi) ?? 0) + dt * 1000)
  }

  const midis = [...dwellMsByMidi.keys()]
  const spanSemitones =
    midis.length > 0 ? Math.max(...midis) - Math.min(...midis) : 0

  let ceilingMidi: number | null = null
  for (const [midi, dwellMs] of dwellMsByMidi) {
    if (dwellMs >= config.calibration.ceilingSustainMs) {
      ceilingMidi = ceilingMidi === null ? midi : Math.max(ceilingMidi, midi)
    }
  }

  const medianMidi = dwellWeightedMedian(dwellMsByMidi)

  const ok =
    ceilingMidi !== null &&
    voicedSeconds >= config.calibration.minVoicedSeconds &&
    spanSemitones >= config.calibration.minSpanSemitones

  return {
    ok,
    ceilingMidi,
    targetMidi:
      ceilingMidi === null ? null : ceilingMidi + config.target.offsetSemitones,
    medianMidi,
    fallbackTargetMidi:
      medianMidi === null
        ? null
        : medianMidi + config.calibration.fallbackOffsetFromMedian,
    voicedSeconds,
    spanSemitones,
  }
}

/** The semitone at which half the total dwell lies below (ties round down). */
function dwellWeightedMedian(
  dwellMsByMidi: Map<number, number>,
): number | null {
  if (dwellMsByMidi.size === 0) return null
  const entries = [...dwellMsByMidi.entries()].sort((a, b) => a[0] - b[0])
  const total = entries.reduce((sum, [, ms]) => sum + ms, 0)
  let cumulative = 0
  for (const [midi, ms] of entries) {
    cumulative += ms
    if (cumulative >= total / 2) return midi
  }
  return entries[entries.length - 1][0]
}
