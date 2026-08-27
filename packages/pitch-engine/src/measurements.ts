// ============================================================
// F0 measurements — neutral pitch-frame preprocessing and cents math
// ============================================================
//
// Voice Mirror originally owned these primitives even though Glass,
// onboarding, and future protocol-controlled assessments all consume them.
// Keeping confidence filtering and gap-aware median smoothing here gives each
// product one shared measurement seam without sharing product conclusions.

import { freqToMidiFloat } from './log-pitch'
import { median as pitchPipelineMedian } from './running-median'

/** One pitch frame from a detector stream. */
export interface F0Frame {
  /** Time in seconds since task start. */
  t: number
  /** Fundamental frequency in Hz; 0 when unvoiced. */
  f0: number
  /** Detector confidence or clarity, from 0 to 1. */
  conf: number
}

/** A voiced, median-filtered frame in MIDI-cents. */
export interface VoicedFrame {
  t: number
  /** MIDI-cents: 1200 log2(f0 / 440) + 6900. */
  cents: number
}

// The app's YIN/MPM detector reports `clarity` that healthy voiced frames
// clear at roughly 0.5 or above. Protocols may provide a different validated
// floor; no consumer should silently invent one from a visual input meter.
export const CONF_MIN = 0.5
export const MEDIAN_WINDOW = 5
export const DEFAULT_HOP_SEC = 0.016
export const DEFAULT_VOICED_RUN_GAP_SEC = 0.12

export interface F0PreprocessOptions {
  confidenceFloor?: number
  medianWindow?: number
  maxVoicedGapSeconds?: number
  /** Exact odd windows are the neutral default; legacy consumers may opt in. */
  medianEdgePolicy?: 'shift-window' | 'truncate-window'
}

/** Convert frequency in Hz to MIDI-cents, where A4 is 6900. */
export function hzToCents(f0: number): number {
  return freqToMidiFloat(f0) * 100
}

/** Return the nearest integer MIDI note for a MIDI-cents value. */
export function centsToMidi(cents: number): number {
  return Math.round(cents / 100)
}

/** Fold a cents difference into the octave-invariant range [-600, 600). */
export function foldCents(delta: number): number {
  return (((delta % 1200) + 1800) % 1200) - 600
}

/** Median of a non-empty numeric series. */
export function median(values: readonly number[]): number {
  return pitchPipelineMedian([...values])
}

/** Centered median filter with an exact odd window shifted at the edges. */
export function medianFilter(
  values: readonly number[],
  window: number,
  edgePolicy: 'shift-window' | 'truncate-window' = 'shift-window',
): number[] {
  if (!Number.isSafeInteger(window) || window < 1 || window % 2 === 0) {
    throw new Error('F0 median window must be a positive odd integer')
  }
  if (values.length === 0) return []
  const availableWindow = Math.min(window, values.length)
  const effectiveWindow =
    availableWindow % 2 === 1 ? availableWindow : availableWindow - 1
  const half = Math.floor(effectiveWindow / 2)
  return values.map((_, index) => {
    if (edgePolicy === 'truncate-window') {
      return median(
        values.slice(
          Math.max(0, index - Math.floor(window / 2)),
          index + Math.floor(window / 2) + 1,
        ),
      )
    }
    const start = Math.min(
      Math.max(0, index - half),
      values.length - effectiveWindow,
    )
    return median(values.slice(start, start + effectiveWindow))
  })
}

/** Median positive inter-frame gap, or the detector fallback hop. */
export function estimateFrameHop(frames: readonly { t: number }[]): number {
  const gaps: number[] = []
  for (let index = 1; index < frames.length; index += 1) {
    const gap = frames[index].t - frames[index - 1].t
    if (gap > 0) gaps.push(gap)
  }
  return gaps.length > 0 ? median(gaps) : DEFAULT_HOP_SEC
}

/**
 * Drop unvoiced and low-confidence frames, median-filter each continuous
 * voiced run, and convert frequency to MIDI-cents. Smoothing never crosses a
 * breath, consonant, or detector gap because that would invent a transition.
 */
export function preprocessF0Frames(
  frames: readonly F0Frame[],
  options: number | F0PreprocessOptions = CONF_MIN,
): VoicedFrame[] {
  const resolved =
    typeof options === 'number' ? { confidenceFloor: options } : options
  const confidenceFloor = resolved.confidenceFloor ?? CONF_MIN
  const medianWindow = resolved.medianWindow ?? MEDIAN_WINDOW
  const maxVoicedGapSeconds =
    resolved.maxVoicedGapSeconds ?? DEFAULT_VOICED_RUN_GAP_SEC
  const medianEdgePolicy = resolved.medianEdgePolicy ?? 'shift-window'
  if (
    !Number.isFinite(confidenceFloor) ||
    confidenceFloor < 0 ||
    confidenceFloor > 1
  ) {
    throw new Error('F0 confidence floor must be within [0, 1]')
  }
  if (
    !Number.isSafeInteger(medianWindow) ||
    medianWindow < 1 ||
    medianWindow % 2 === 0
  ) {
    throw new Error('F0 median window must be a positive odd integer')
  }
  if (!Number.isFinite(maxVoicedGapSeconds) || maxVoicedGapSeconds <= 0) {
    throw new Error('F0 maximum voiced gap must be positive')
  }
  const voiced = frames.filter(
    (frame) => frame.f0 > 0 && frame.conf >= confidenceFloor,
  )
  const result: VoicedFrame[] = []
  let runStart = 0

  for (let index = 1; index <= voiced.length; index += 1) {
    const gap =
      index < voiced.length ? voiced[index].t - voiced[index - 1].t : Infinity
    if (gap <= maxVoicedGapSeconds) continue

    const run = voiced.slice(runStart, index)
    const filtered = medianFilter(
      run.map((frame) => frame.f0),
      medianWindow,
      medianEdgePolicy,
    )
    for (let frameIndex = 0; frameIndex < run.length; frameIndex += 1) {
      result.push({
        t: run[frameIndex].t,
        cents: hzToCents(filtered[frameIndex]),
      })
    }
    runStart = index
  }

  return result
}
