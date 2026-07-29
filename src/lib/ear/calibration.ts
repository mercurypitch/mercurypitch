// ============================================================
// Ear Lab — pooling tracks into a calibration reading.
//
// A single 8-reversal staircase is essentially unbiased but only
// precise to about ±28% (simulated, see calibration.test.ts). That
// is fine for a practice estimate and nowhere near good enough to
// mark the Mercury Column, because a user whose ear did not change
// would still watch the number swing by a third.
//
// Lengthening one track barely helps — 20 reversals costs twice the
// trials and still reads ±19%. Independent tracks pool as 1/√k
// instead, so Calibration Day runs several short interleaved tracks
// and pools them. Interleaving also breaks the expectation effects
// a single predictable track invites: the listener cannot tell
// which way the next trial is about to move.
// ============================================================

import type { StaircaseConfig, StaircaseState, ThresholdEstimate, } from './staircase'
import { createStaircase, recordTrial, thresholdOf } from './staircase'

/** Tracks run per calibration reading. Three is the knee of the
 *  curve: ±16% for ~90 trials, roughly a minute of drilling. */
export const CALIBRATION_TRACKS = 3

export interface PooledThreshold {
  /** The reading, pooled across tracks, in the drill's unit. */
  value: number
  /** Standard error of that reading — the half-width the
   *  certificate prints as "± x". Shrinks as tracks are added. */
  standardError: number
  /** How many tracks actually produced an estimate. */
  tracks: number
  /** True unless every track ran to full length. A short run still
   *  reads, but it must not mark the column. */
  provisional: boolean
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function standardError(values: readonly number[]): number {
  if (values.length < 2) return 0
  const centre = mean(values)
  const variance =
    values.reduce((a, v) => a + (v - centre) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance / values.length)
}

/** Pool independent track estimates into one reading.
 *
 *  Ratio-scaled drills (cents, ms) pool in log space, so a single
 *  high track cannot drag the reading up out of proportion — the
 *  same reason `thresholdOf` averages its reversals geometrically. */
export function poolThresholds(
  estimates: readonly (ThresholdEstimate | null)[],
  mode: StaircaseConfig['stepMode'],
): PooledThreshold | null {
  const usable = estimates.filter((e): e is ThresholdEstimate => e !== null)
  if (usable.length === 0) return null

  const provisional = usable.some((e) => e.provisional)
  const values = usable.map((e) => e.value)

  if (mode === 'linear') {
    return {
      value: mean(values),
      standardError: standardError(values),
      tracks: usable.length,
      provisional,
    }
  }

  const logs = values.map(Math.log)
  const value = Math.exp(mean(logs))
  // Convert the log-space standard error back into the drill's unit
  // so the UI can print a plain "± 1.4 cents".
  const logSe = standardError(logs)
  const half = (value * Math.exp(logSe) - value / Math.exp(logSe)) / 2

  return {
    value,
    standardError: half,
    tracks: usable.length,
    provisional,
  }
}

/** One track's worth of staircase state, plus the drill it belongs
 *  to, so a calibration session can interleave several at once. */
export interface CalibrationTrack {
  drillId: string
  state: StaircaseState
}

export function createCalibrationTracks(
  drillId: string,
  config: StaircaseConfig,
  tracks: number = CALIBRATION_TRACKS,
): CalibrationTrack[] {
  return Array.from({ length: tracks }, () => ({
    drillId,
    state: createStaircase(config),
  }))
}

/** Pick which track the next trial should come from.
 *
 *  Choosing at random among the unfinished tracks is what makes the
 *  interleave worth doing — a round-robin is just as predictable as
 *  a single track once the listener notices the pattern. Returns
 *  null when every track has finished. */
export function nextTrackIndex(
  tracks: readonly CalibrationTrack[],
  random: () => number = Math.random,
): number | null {
  const live = tracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => !track.state.done)
  if (live.length === 0) return null
  return live[Math.floor(random() * live.length)].index
}

export function recordCalibrationTrial(
  tracks: readonly CalibrationTrack[],
  index: number,
  correct: boolean,
): CalibrationTrack[] {
  return tracks.map((track, i) =>
    i === index
      ? { ...track, state: recordTrial(track.state, correct) }
      : track,
  )
}

export function isCalibrationComplete(
  tracks: readonly CalibrationTrack[],
): boolean {
  return tracks.every((track) => track.state.done)
}

/** The pooled reading for a finished (or abandoned) set of tracks. */
export function calibrationReading(
  tracks: readonly CalibrationTrack[],
  mode: StaircaseConfig['stepMode'],
): PooledThreshold | null {
  return poolThresholds(
    tracks.map((track) => thresholdOf(track.state)),
    mode,
  )
}
