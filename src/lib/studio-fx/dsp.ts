// ============================================================
// Studio FX DSP math — gain laws, shaper curves and tail estimates
// ============================================================
//
// Pure functions shared by the effect graphs and by the tests that pin them.
// Nothing here touches an AudioContext.
//
// WaveShaperNode only reads its curve over [-1, 1] and clamps beyond it, so
// every shaper in the Studio runs in a scaled domain: a gain of 1/H before the
// shaper and H after it. That keeps material above 0 dBFS from slamming into
// the curve's end, and lets drive change by gain alone, without rebuilding a
// curve while audio plays.

/** What WaveShaperNode.curve accepts: a curve over its own ArrayBuffer. */
export type ShaperCurve = Float32Array<ArrayBuffer>

export interface MixGains {
  readonly dry: number
  readonly wet: number
}

/** Fully processed, nothing unprocessed: EQ, de-esser and limiter. */
export const WET_ONLY: MixGains = { dry: 0, wet: 1 }

/** Bypassed: the latency-matched unprocessed path only. */
export const DRY_ONLY: MixGains = { dry: 1, wet: 0 }

/**
 * Web Audio reads Q in decibels for lowpass and highpass filters, so a
 * Butterworth response (Q = 1/sqrt 2) is 20 log10(1/sqrt 2) = -3.01 dB, not
 * 0.707. Two of these in series make one Linkwitz-Riley crossover side.
 */
export const BUTTERWORTH_Q_DB = 20 * Math.log10(Math.SQRT1_2)

/**
 * A fourth-order Butterworth (24 dB/octave, -3 dB at its frequency) is two
 * biquads with these Qs — 0.5412 and 1.3066 — written in decibels for the
 * same reason as above. The vocal low cut uses it, as fx-lab's front end does.
 */
export const BUTTERWORTH4_Q_DB: readonly [number, number] = [
  20 * Math.log10(0.5411961001461969),
  20 * Math.log10(1.3065629648763766),
]

/** Saturation shaper domain: the curve covers 12 dB above the driven signal. */
export const SATURATION_DOMAIN = 4

/** Soft-clip domain: the curve covers 12 dB above the limiter ceiling. */
export const SOFT_CLIP_DOMAIN = 4

/** Identity shaper domain: +18 dBFS before the unprocessed twin would clip. */
export const IDENTITY_DOMAIN = 8

/** Hard clamp domain: the clamp corner sits at half the curve's input range. */
export const HARD_CLAMP_DOMAIN = 2

/** Envelope domain: the follower reads levels up to +12 dBFS. */
export const ENVELOPE_DOMAIN = 4

/** Ducking starts when the smoothed level passes -40 dBFS ... */
export const DUCK_ONSET_LEVEL = 0.01

/**
 * ... and is complete at -27 dBFS: a voice at -18 LUFS ducks fully, and stays
 * ducked through the short gaps between its syllables.
 */
export const DUCK_FULL_LEVEL = 0.045

/**
 * Log-envelope curves map a level to decibels / LOG_SPAN_DB, so a difference
 * of two of them is a level ratio — the same for a ghost note and a rimshot.
 */
export const LOG_SPAN_DB = 100

/** Below this the log envelope stops falling: silence has no transients. */
export const LOG_FLOOR_DB = -70

/** Odd, so that silence lands exactly on the curve's centre sample. */
const CURVE_LENGTH = 4097

/**
 * A log curve sampled uniformly needs fine steps near zero: at this length a
 * step is 1.2e-4 of full scale (-78 dBFS), below the log floor.
 */
const LOG_CURVE_LENGTH = 65537

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20)
}

export function gainToDb(gain: number): number {
  return gain > 0 ? 20 * Math.log10(gain) : Number.NEGATIVE_INFINITY
}

/**
 * Equal-gain law for correlated paths (parallel compression, saturation): the
 * two paths are the same signal, so their amplitudes, not powers, must sum to
 * one or the blend bulges in the middle.
 */
export function linearMix(amount: number): MixGains {
  const wet = clamp(amount, 0, 1)
  return { dry: 1 - wet, wet }
}

/**
 * Equal-power law for decorrelated paths (reverb, delay), so loudness holds
 * steady across the mix control.
 */
export function equalPowerMix(amount: number): MixGains {
  const angle = (clamp(amount, 0, 1) * Math.PI) / 2
  return { dry: Math.cos(angle), wet: Math.sin(angle) }
}

function buildCurve(
  transfer: (x: number) => number,
  length: number = CURVE_LENGTH,
): ShaperCurve {
  const curve = new Float32Array(length)
  const half = (length - 1) / 2
  for (let i = 0; i < length; i++) {
    curve[i] = transfer((i - half) / half)
  }
  return curve
}

/**
 * tanh saturation with unity slope at zero, in the `SATURATION_DOMAIN`.
 * Driving it with g/H and restoring with H/g gives y = tanh(g x) / g: quiet
 * material passes at unity and only the peaks are rounded, so engaging the
 * effect does not simply make things louder.
 */
export function createSaturationCurve(): ShaperCurve {
  const domain = SATURATION_DOMAIN
  return buildCurve((u) => Math.tanh(u * domain) / domain)
}

/**
 * Linear up to `kneeStart` of the ceiling, then a tanh shoulder that meets the
 * line with matching slope and flattens onto the ceiling. Domain-scaled by
 * `SOFT_CLIP_DOMAIN`. Run oversampled, its output can still ring past the
 * ceiling by up to a decibel on a lone click (the downsampler's ripple), which
 * is what `createHardClampCurve` is for.
 */
export function createSoftClipCurve(kneeStart = 0.9): ShaperCurve {
  const domain = SOFT_CLIP_DOMAIN
  const knee = clamp(kneeStart, 0.5, 0.99)
  const shoulder = 1 - knee
  return buildCurve((u) => {
    const v = u * domain
    const magnitude = Math.abs(v)
    if (magnitude <= knee) return v / domain
    const shaped = knee + shoulder * Math.tanh((magnitude - knee) / shoulder)
    return (Math.sign(v) * shaped) / domain
  })
}

/**
 * A straight line clipped flat at half the domain, i.e. at the ceiling when
 * run with gains 1/(ceiling * HARD_CLAMP_DOMAIN) and ceiling * HARD_CLAMP_DOMAIN.
 * The corner falls exactly on a curve point, so below the ceiling it is an
 * exact identity. Run without oversampling it adds no latency and no filter,
 * so its output samples can never exceed the ceiling.
 */
export function createHardClampCurve(): ShaperCurve {
  const limit = 1 / HARD_CLAMP_DOMAIN
  return buildCurve((u) => clamp(u, -limit, limit))
}

/**
 * tanh(g x)^2 / g in the `SATURATION_DOMAIN`: an even curve, so it makes only
 * even harmonics (the second an octave up) and DC, which a highpass removes.
 * It has no linear part to cancel, and it is bounded, so a loud "s" cannot
 * drive it past a fixed level.
 */
export function createEvenHarmonicCurve(): ShaperCurve {
  const domain = SATURATION_DOMAIN
  return buildCurve((u) => Math.tanh(u * domain) ** 2 / domain)
}

/** Full-wave rectifier, in the `ENVELOPE_DOMAIN`: the first half of a follower. */
export function createRectifierCurve(): ShaperCurve {
  return buildCurve((u) => Math.abs(u))
}

/**
 * Maps a smoothed level (rectified, in the `ENVELOPE_DOMAIN`) to how far a
 * duck should go, 0 to 1, with a smoothstep between `DUCK_ONSET_LEVEL` and
 * `DUCK_FULL_LEVEL`. Negative input (filter ringing below zero) means silence.
 */
export function createDuckCurve(): ShaperCurve {
  return buildCurve((u) => {
    const level = u * ENVELOPE_DOMAIN
    const t = clamp(
      (level - DUCK_ONSET_LEVEL) / (DUCK_FULL_LEVEL - DUCK_ONSET_LEVEL),
      0,
      1,
    )
    return t * t * (3 - 2 * t)
  })
}

/**
 * A level (in the `ENVELOPE_DOMAIN`) as decibels / LOG_SPAN_DB, floored at
 * LOG_FLOOR_DB; zero and below (a follower's undershoot) is the floor.
 */
export function createLogEnvelopeCurve(): ShaperCurve {
  return buildCurve((u) => {
    const level = u * ENVELOPE_DOMAIN
    const decibels = level > 0 ? 20 * Math.log10(level) : LOG_FLOOR_DB
    return Math.max(decibels, LOG_FLOOR_DB) / LOG_SPAN_DB
  }, LOG_CURVE_LENGTH)
}

/**
 * A difference of two log envelopes (decibels / LOG_SPAN_DB) to 0..1: zero
 * at or below 0 dB, a smoothstep up to `fullDb`, one beyond.
 */
export function createLeadCurve(fullDb: number): ShaperCurve {
  return buildCurve((u) => {
    const t = clamp((u * LOG_SPAN_DB) / fullDb, 0, 1)
    return t * t * (3 - 2 * t)
  })
}

/**
 * Coefficients of two chains of second-order allpass sections whose outputs
 * stay 90 degrees apart (within 0.7 degrees from 30 Hz to 20 kHz at 48 kHz),
 * after Olli Niemitalo's Hilbert transformer. Each section is
 * (a^2 - z^-2) / (1 - a^2 z^-2); the first chain carries one sample more.
 * Rectifying a signal and its 90-degree twin together cancels the ripple a
 * plain rectifier leaves at twice the note's pitch.
 */
export const QUADRATURE_ALLPASS: readonly [
  readonly number[],
  readonly number[],
] = [
  [0.6923878, 0.9360654322959, 0.988229522686, 0.9987488452737],
  [0.4021921162426, 0.856171088242, 0.9722909545651, 0.9952884791278],
]

/** Two points are an exact straight line under the shaper's interpolation. */
export function createIdentityCurve(): ShaperCurve {
  return Float32Array.of(-1, 1)
}

/** Seconds until a feedback delay's repeats fall below -60 dB. */
export function delayTailSeconds(
  timeSeconds: number,
  feedback: number,
): number {
  const time = Math.max(0, timeSeconds)
  const gain = clamp(feedback, 0, 0.99)
  if (gain < 0.001) return time
  const repeats = Math.log(0.001) / Math.log(gain)
  return time * (1 + repeats)
}
