// ============================================================
// Headroom for the master bus: a music level you can raise, and a
// soft clipper so raising it cannot make the mix crack
// ============================================================
//
// Reported about singing along on a phone: the backing track drops the moment
// the mic goes live, and there is no way to bring it back up. The app itself
// does no ducking — the audit found no compressor, no sidechain, no gain move
// tied to `micActive`. What moves the level is the platform: iOS switches the
// session to `playAndRecord` when a page opens a mic, and jam rooms ask for
// echo cancellation, which is an attenuator by construction.
//
// Neither is ours to switch off, so the fix is to give the singer the gain
// back. The master sat at a hardcoded 0.7 with no control; it is now a stored
// level that goes to 2.0 (+9.1 dB over the old fixed value).
//
// That much boost will run a two-stem mix past full scale, so the master ends
// in a soft clipper rather than the raw destination. It is a WaveShaper, not a
// DynamicsCompressorNode, for one specific reason: Chromium's compressor
// carries an internal lookahead, and the mixer times mic pitch against
// reference pitch frame by frame. A shaper is a per-sample function — zero
// added latency, so nothing on the scoring path moves.

import { createClampedPreference } from '@/lib/clamped-preference'

/**
 * Where the curve stops being the identity. Below this the shaper is
 * bit-exact — today's mix at today's level goes through untouched.
 */
export const SOFT_CLIP_THRESHOLD = 0.8

/** Samples in the generated curve. 4096 puts the step under 0.0005. */
export const SOFT_CLIP_CURVE_SIZE = 4096

/**
 * Identity below the threshold, `tanh`-shaped above it, asymptotic to 1.
 *
 * The bend is scaled so the curve is continuous in value AND in slope at the
 * threshold (d/dx of `tanh(u)` is 1 at u=0), which is what keeps it from
 * sounding like a corner.
 */
export function softClipSample(x: number): number {
  const magnitude = Math.abs(x)
  if (magnitude <= SOFT_CLIP_THRESHOLD) return x
  const range = 1 - SOFT_CLIP_THRESHOLD
  const over = (magnitude - SOFT_CLIP_THRESHOLD) / range
  const shaped = SOFT_CLIP_THRESHOLD + range * Math.tanh(over)
  return x < 0 ? -shaped : shaped
}

/** The curve as a `WaveShaperNode` wants it: `size` samples spanning -1..1. */
export function buildSoftClipCurve(
  size: number = SOFT_CLIP_CURVE_SIZE,
): Float32Array<ArrayBuffer> {
  // Explicitly over an `ArrayBuffer`: `WaveShaperNode.curve` will not take the
  // `ArrayBufferLike` a bare `Float32Array` widens to.
  const curve = new Float32Array(new ArrayBuffer(size * 4))
  for (let index = 0; index < size; index += 1) {
    curve[index] = softClipSample((index / (size - 1)) * 2 - 1)
  }
  return curve
}

/**
 * How loud the mix runs into the soft clipper.
 *
 * The default is 0.7 exactly — the constant the master was pinned at before
 * this control existed — so nobody's mix changes until they move the slider.
 * The ceiling of 2.0 is +9.1 dB, chosen to cover the worst attenuation an
 * iOS `playAndRecord` switch has been observed to apply; the floor of 0.35 is
 * there because the other half of singing along is wanting the backing
 * quieter, which was equally impossible.
 */
export const MUSIC_LEVEL = createClampedPreference({
  storageKey: 'pitchperfect_mixer_music_level',
  defaultValue: 0.7,
  min: 0.35,
  max: 2,
  step: 0.05,
})

export const loadMusicLevel = (): number => MUSIC_LEVEL.load()
export const persistMusicLevel = (value: number): number =>
  MUSIC_LEVEL.persist(value)
