// ============================================================
// Drum hit dynamics — velocity curves, brightness bridge, micro-variation
// ============================================================
//
// Pure math shared by the sampled kit player. Velocity maps to gain through
// per-family dB-domain curves (metals respond shallower than drums), soft
// hits are darkened by a lowpass instead of crossfading unmatched velocity
// layers, and every hit draws small seeded variations that decorrelate
// repeated samples. Onset measurement runs on the decoded buffer so codec
// leading padding can never shift hit timing.

import type { DrumVoiceId } from '@/lib/drum-voices'
import type { DrumVelocityCurve } from './drum-kit-manifest'

/** Articulations struck on metal — shallower velocity curve, wider detune. */
const METAL_ARTICULATIONS: ReadonlySet<DrumVoiceId> = new Set([
  'hh-closed',
  'hh-pedal',
  'hh-open',
  'crash',
  'ride',
])

const GAIN_FLOOR = 0.02
const DRUM_EXPONENT = 2
const METAL_EXPONENT = 1.6
const MAXIMUM_POWER_CORRECTION_DB = 3
const MINIMUM_POWER_CORRECTION = 10 ** (-MAXIMUM_POWER_CORRECTION_DB / 20)
const MAXIMUM_POWER_CORRECTION = 10 ** (MAXIMUM_POWER_CORRECTION_DB / 20)

const BRIGHTNESS_BASE_HZ = 1200
const BRIGHTNESS_OCTAVES = 4
const BRIGHTNESS_BYPASS_HZ = 16_000

const DRUM_DETUNE_CENTS = 10
const WIDE_DETUNE_CENTS = 25
const VARIATION_GAIN_DB = 0.75
const CUTOFF_SCALE_SPREAD = 0.06
const START_OFFSET_MAX_SECONDS = 0.0004

const ONSET_THRESHOLD = 0.001
const ONSET_WINDOW_SECONDS = 0.06
const ONSET_PREROLL_SECONDS = 0.001

export interface DrumHitVariation {
  readonly rateRatio: number
  readonly gainScale: number
  readonly cutoffScale: number
  readonly startOffsetSec: number
}

export function velocityUnit(velocity: number): number {
  const bounded = Number.isFinite(velocity)
    ? Math.min(127, Math.max(1, velocity))
    : 1
  return (bounded - 1) / 126
}

/** Piecewise-linear velocity response, or the shipped family curve by default. */
export function velocityCurveTarget(
  articulation: DrumVoiceId,
  velocity: number,
  curve?: DrumVelocityCurve,
): number {
  if (curve === undefined) {
    const exponent = METAL_ARTICULATIONS.has(articulation)
      ? METAL_EXPONENT
      : DRUM_EXPONENT
    const shaped = Math.pow(velocityUnit(velocity), exponent)
    return GAIN_FLOOR + (1 - GAIN_FLOOR) * shaped
  }

  const boundedVelocity = Number.isFinite(velocity)
    ? Math.min(127, Math.max(1, velocity))
    : 1
  for (let index = 1; index < curve.length; index += 1) {
    const right = curve[index]
    if (boundedVelocity > right[0]) continue
    const left = curve[index - 1]
    const span = right[0] - left[0]
    if (span <= 0) return left[1]
    const mix = (boundedVelocity - left[0]) / span
    return left[1] + (right[1] - left[1]) * mix
  }
  return curve.at(-1)?.[1] ?? GAIN_FLOOR
}

/**
 * Velocity gain, or bounded compensation for measured sample power.
 *
 * `samplePower` is the sample's perceptual energy after `playbackGain`; the
 * effective output is therefore `samplePower * returnedGain`, not this scalar
 * alone. The ±3 dB cap preserves the performed layer instead of flattening it.
 */
export function velocityGain(
  articulation: DrumVoiceId,
  velocity: number,
  curve?: DrumVelocityCurve,
  samplePower?: number,
): number {
  const target = velocityCurveTarget(articulation, velocity, curve)
  if (samplePower === undefined) return target
  if (!Number.isFinite(samplePower) || samplePower <= 0) return target
  if (target <= 0) return 0
  return Math.min(
    MAXIMUM_POWER_CORRECTION,
    Math.max(MINIMUM_POWER_CORRECTION, target / samplePower),
  )
}

/** Lowpass cutoff bridging velocity layers; null bypasses the filter. */
export function brightnessCutoffHz(velocity: number): number | null {
  const cutoff =
    BRIGHTNESS_BASE_HZ *
    Math.pow(
      2,
      BRIGHTNESS_OCTAVES * (Math.min(127, Math.max(1, velocity)) / 127),
    )
  return cutoff >= BRIGHTNESS_BYPASS_HZ ? null : cutoff
}

/** Per-hit seeded variation; four draws from `random` per call. */
export function microVariation(
  random: () => number,
  articulation: DrumVoiceId,
): DrumHitVariation {
  const wide = METAL_ARTICULATIONS.has(articulation) || articulation === 'clap'
  const centsRange = wide ? WIDE_DETUNE_CENTS : DRUM_DETUNE_CENTS
  const cents = (random() * 2 - 1) * centsRange
  const gainDb = (random() * 2 - 1) * VARIATION_GAIN_DB
  const cutoffScale = 1 + (random() * 2 - 1) * CUTOFF_SCALE_SPREAD
  const startOffsetSec = random() * START_OFFSET_MAX_SECONDS
  return {
    rateRatio: Math.pow(2, cents / 1200),
    gainScale: Math.pow(10, gainDb / 20),
    cutoffScale,
    startOffsetSec,
  }
}

/**
 * First audible sample in the decoded buffer, minus a 1 ms preroll.
 * Defensive: any unreadable channel data means "start at zero".
 */
export function measureOnsetSeconds(buffer: AudioBuffer): number {
  let samples: Float32Array
  try {
    if (typeof buffer.getChannelData !== 'function') return 0
    samples = buffer.getChannelData(0)
  } catch {
    return 0
  }
  const sampleRate = buffer.sampleRate
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return 0
  const limit = Math.min(
    samples.length,
    Math.floor(ONSET_WINDOW_SECONDS * sampleRate),
  )
  for (let index = 0; index < limit; index += 1) {
    if (Math.abs(samples[index]) > ONSET_THRESHOLD) {
      return Math.max(0, index / sampleRate - ONSET_PREROLL_SECONDS)
    }
  }
  return 0
}
