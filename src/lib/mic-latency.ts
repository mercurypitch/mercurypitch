// ============================================================
// mic-latency — measuring the round trip from speaker to microphone
// ============================================================
//
// Play a click, hear it come back through the mic, and the gap between the
// two is everything the device puts in the way: output buffering, the speaker,
// the air, the capture buffer. That total is the correction needed to place a
// sung note on a reference timeline, which is why this measures the WHOLE
// round trip rather than any one leg of it.
//
// The contrast with @/lib/tap-calibration matters, because the two sit beside
// each other and differ in exactly one subtle way. That one measures a human
// reaction, so it *adds* `outputLatency` to the reference and excludes the
// device's own delay from the answer. This one wants the device's delay — it
// IS the answer — so the reference is the scheduled time, untouched.
//
// Everything here is pure. The capture and playback live in the wizard
// (@/features/mic-feedback/MicLatencyWizard.tsx); tests feed synthetic buffers.
//
// Tests: src/lib/mic-latency.test.ts.

import { median, nearestEventDelta, spreadMs } from './calibration-stats'

/** Clicks played in one measurement run. */
export const LATENCY_CLICK_COUNT = 8
/** Seconds between clicks — comfortably longer than any plausible round trip. */
export const LATENCY_CLICK_INTERVAL_SEC = 0.75
/** Silence before the first click: lets the mic settle and the AGC give up. */
export const LATENCY_LEAD_IN_SEC = 1
/**
 * A returning click further than this from its own is a false onset — a cough,
 * a keystroke — not the click. Half the interval, so no click can steal the
 * next one's echo.
 */
export const MAX_ONSET_DISTANCE_SEC = LATENCY_CLICK_INTERVAL_SEC / 2
/** Below this many matched clicks the median is not worth trusting. */
export const MIN_LATENCY_HITS = 4
/**
 * Nothing above this is believed. A real round trip is 20-300 ms; half a
 * second means the run measured a reflection or a false onset, and a wrong
 * offset is worse than none.
 */
export const MAX_LATENCY_MS = 500

/** Why a run produced no number. Each maps to its own thing to tell the user. */
export type LatencyFailure =
  /** The clicks never came back — headphones on, mic muted, volume down. */
  | 'not-heard'
  /** Onsets found, but too few lined up with a click to trust the median. */
  | 'too-few-hits'
  /** A median outside the believable range. */
  | 'out-of-range'

export interface LatencyResult {
  /** Round-trip latency in whole ms, or null when the run failed. */
  latencyMs: number | null
  /** Interquartile spread in ms — a confidence hint, null below two hits. */
  spreadMs: number | null
  /** How many clicks were matched. */
  hits: number
  /** Set when `latencyMs` is null. */
  failure: LatencyFailure | null
}

export interface OnsetOptions {
  /** Envelope window in samples. 64 gives ~1.3 ms resolution at 48 kHz. */
  hopSamples?: number
  /** An onset must reach this fraction of the loudest thing in the recording. */
  peakFraction?: number
  /** ...and this multiple of the noise floor, so a quiet room is not all onsets. */
  noiseFactor?: number
  /** Below this peak-to-floor ratio, nothing was heard at all. */
  minPeakRatio?: number
  /** Ignore further onsets for this long after one fires. */
  refractorySec?: number
}

const DEFAULT_ONSET_OPTIONS: Required<OnsetOptions> = {
  hopSamples: 64,
  peakFraction: 0.25,
  noiseFactor: 4,
  minPeakRatio: 3,
  refractorySec: 0.2,
}

/** Root-mean-square amplitude of one window. */
function windowRms(
  samples: Float32Array,
  start: number,
  length: number,
): number {
  let sum = 0
  const end = Math.min(start + length, samples.length)
  for (let i = start; i < end; i++) sum += samples[i] * samples[i]
  const count = end - start
  return count > 0 ? Math.sqrt(sum / count) : 0
}

/**
 * Times (seconds from the start of the buffer) at which something sharp
 * started. Returns an empty array when the recording holds nothing that
 * stands out from its own noise floor — that is the 'not-heard' case, and it
 * is a normal outcome rather than an error.
 *
 * Thresholds are relative to the recording, not absolute: how loud a click
 * comes back depends on the speaker volume and the distance to the mic, so an
 * absolute level would only ever be right for one room.
 */
export function detectOnsets(
  samples: Float32Array,
  sampleRate: number,
  options: OnsetOptions = {},
): number[] {
  const opts = { ...DEFAULT_ONSET_OPTIONS, ...options }
  if (samples.length === 0 || sampleRate <= 0) return []

  const envelope: number[] = []
  for (let i = 0; i < samples.length; i += opts.hopSamples) {
    envelope.push(windowRms(samples, i, opts.hopSamples))
  }
  if (envelope.length === 0) return []

  const peak = Math.max(...envelope)
  // The recording is mostly silence between clicks, so its median IS the floor.
  const floor = median(envelope) ?? 0
  if (peak <= 0) return []
  if (floor > 0 && peak < floor * opts.minPeakRatio) return []

  const threshold = Math.max(peak * opts.peakFraction, floor * opts.noiseFactor)
  const refractoryWindows = Math.max(
    1,
    Math.round((opts.refractorySec * sampleRate) / opts.hopSamples),
  )

  const onsets: number[] = []
  let blockedUntil = -1
  for (let w = 0; w < envelope.length; w++) {
    if (w <= blockedUntil) continue
    if (envelope[w] < threshold) continue
    onsets.push((w * opts.hopSamples) / sampleRate)
    blockedUntil = w + refractoryWindows
  }
  return onsets
}

/**
 * Signed gap between each scheduled click and the onset that answered it, in
 * seconds. Onsets that match no click are dropped; so are negative gaps, which
 * cannot be a click returning before it was played and are always a false
 * onset just before the real one.
 */
export function matchOnsetDeltas(
  scheduledSec: number[],
  onsetSec: number[],
  maxDistance: number = MAX_ONSET_DISTANCE_SEC,
): number[] {
  const deltas: number[] = []
  for (const onset of onsetSec) {
    const delta = nearestEventDelta(scheduledSec, onset, maxDistance)
    if (delta === null || delta < 0) continue
    deltas.push(delta)
  }
  return deltas
}

/**
 * Turn one run's matched gaps into the offset to store, or say why not.
 * Rounds to whole ms — the measurement is not good to a fraction of one, and
 * pretending otherwise in the UI would be a lie about its precision.
 */
export function summariseLatency(
  deltasSec: number[],
  onsetsFound: number,
  minHits: number = MIN_LATENCY_HITS,
): LatencyResult {
  const spread = spreadMs(deltasSec)

  if (onsetsFound === 0) {
    return { latencyMs: null, spreadMs: null, hits: 0, failure: 'not-heard' }
  }
  if (deltasSec.length < minHits) {
    return {
      latencyMs: null,
      spreadMs: spread,
      hits: deltasSec.length,
      failure: 'too-few-hits',
    }
  }

  const mid = median(deltasSec)
  const ms = mid === null ? null : Math.round(mid * 1000)
  if (ms === null || ms <= 0 || ms > MAX_LATENCY_MS) {
    return {
      latencyMs: null,
      spreadMs: spread,
      hits: deltasSec.length,
      failure: 'out-of-range',
    }
  }

  return {
    latencyMs: ms,
    spreadMs: spread,
    hits: deltasSec.length,
    failure: null,
  }
}
