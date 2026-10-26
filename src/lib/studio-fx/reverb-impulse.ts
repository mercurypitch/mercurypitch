// ============================================================
// Reverb impulse — deterministic synthetic room responses
// ============================================================
//
// Decorrelated stereo noise under an exponential envelope that reaches -60 dB
// at the decay time, darkened over its length by a one-pole lowpass whose
// cutoff falls as the tail ages (air absorbs highs first; `damping` sets how
// far it falls). Seeded, so the same settings always give the same buffer and
// an offline bounce matches what was heard live.
//
// The envelope is advanced by multiplication and the filter coefficient is
// refreshed every 32 samples, so an 8 s stereo tail costs a few milliseconds
// rather than a call to Math.pow per sample.

import { clamp } from './dsp'

export interface ReverbImpulseOptions {
  readonly sampleRate: number
  readonly decaySeconds: number
  /** 0..1 — how far the brightness falls by the end of the tail. */
  readonly damping: number
  readonly seed?: number
}

const LN_1000 = Math.log(1000)
const ONSET_SECONDS = 0.004
const COEFFICIENT_BLOCK = 32
const BRIGHT_HZ = 16000
const DARK_HZ = 1200
const DEFAULT_SEED = 0x5eed_f00d

/** mulberry32: small, fast, and identical on every engine. */
function seededNoise(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (((t ^ (t >>> 14)) >>> 0) / 4_294_967_296) * 2 - 1
  }
}

export function reverbImpulseLength(
  sampleRate: number,
  decaySeconds: number,
): number {
  return Math.max(1, Math.round(sampleRate * Math.max(0.05, decaySeconds)))
}

function fillChannel(
  data: Float32Array,
  options: ReverbImpulseOptions,
  seed: number,
): void {
  const { sampleRate } = options
  const length = data.length
  const noise = seededNoise(seed)
  const step = Math.exp(-LN_1000 / length)
  const onset = Math.max(1, Math.round(ONSET_SECONDS * sampleRate))
  const startHz = Math.min(BRIGHT_HZ, sampleRate * 0.45)
  const endHz =
    startHz * Math.pow(DARK_HZ / startHz, clamp(options.damping, 0, 1))
  let envelope = 1
  let smoothed = 0
  let alpha = 1
  for (let i = 0; i < length; i++) {
    if (i % COEFFICIENT_BLOCK === 0) {
      const cutoff = startHz * Math.pow(endHz / startHz, i / length)
      alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate)
    }
    smoothed += alpha * (noise() - smoothed)
    const fadeIn = i < onset ? i / onset : 1
    data[i] = smoothed * envelope * fadeIn
    envelope *= step
  }
}

/** Two channels of a synthetic impulse response, left and right. */
export function generateReverbImpulse(
  options: ReverbImpulseOptions,
): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const length = reverbImpulseLength(options.sampleRate, options.decaySeconds)
  const seed = options.seed ?? DEFAULT_SEED
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  fillChannel(left, options, seed)
  fillChannel(right, options, (seed ^ 0x9e3779b9) >>> 0)
  return [left, right]
}
