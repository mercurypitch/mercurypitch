// How late the room hears you, and how it found out.
// ============================================================
//
// Between striking a string and the app seeing that sample there is the mic
// preamp, the OS capture buffer, the browser's own buffering — and between the
// app scheduling a click and the player hearing it there is the output buffer
// and the speaker. A player who is dead on the beat therefore produces an
// attack that arrives *after* the beat by the sum of the two, every time.
//
// The sum is the only part that can be measured. A loopback calibration plays a
// click and listens for it, and what comes back is output-plus-capture with no
// way to tell which half is which. So this module keeps one number, applies all
// of it on the input side, and never pretends to know the split. Anything that
// claims to separate them is guessing.
//
// The number has an origin, and the origin is shown to the player, because
// "measured on this device" and "what the browser claims" deserve different
// amounts of trust.

import { median, nearestClickDelta } from '@/lib/tap-calibration'

export type InputLatencyOrigin = 'measured' | 'reported' | 'assumed'

export interface InputLatencyProfile {
  /** The capture device this was measured on. Latency is a property of it. */
  deviceId: string
  /** Output plus capture, in milliseconds. */
  roundTripMs: number
  origin: InputLatencyOrigin
  /** Spread of the calibration sample. Null unless measured. */
  spreadMs: number | null
  /** ISO timestamp — a year-old measurement on new hardware is worth re-doing. */
  updatedAt: string
}

/**
 * What to assume with nothing better. A middling figure for a laptop's own
 * microphone and speakers; deliberately not zero, because zero is a claim that
 * the route is instant and it never is.
 */
export const ASSUMED_ROUND_TRIP_MS = 45
/** Past this, the measurement is picking up a room reflection, not the click. */
export const MAX_ROUND_TRIP_MS = 400
/** Below this many heard clicks the median is not worth trusting. */
export const MIN_CALIBRATION_CLICKS = 4
/** A click heard later than this is an echo or something else entirely. */
export const MAX_CLICK_DISTANCE_SEC = 0.25

export const INPUT_LATENCY_STORAGE_KEY = 'pitchperfect_guitar_input_latency'

interface LatencyReportingContext {
  baseLatency?: number
  outputLatency?: number
}

/**
 * The browser's own account of its output buffering, in milliseconds. Only the
 * output half is knowable this way — no browser reports capture latency — so
 * this is a floor on the real round trip, not the round trip.
 */
export function reportedOutputLatencyMs(
  context: LatencyReportingContext,
): number | null {
  const base = Number.isFinite(context.baseLatency)
    ? (context.baseLatency ?? 0)
    : 0
  const output = Number.isFinite(context.outputLatency)
    ? (context.outputLatency ?? 0)
    : 0
  const total = (base + output) * 1000
  if (!(total > 0)) return null
  return Math.min(MAX_ROUND_TRIP_MS, Math.round(total))
}

/** The starting profile for a device nobody has calibrated yet. */
export function assumeLatencyProfile(
  deviceId: string,
  context: LatencyReportingContext,
  now: string,
): InputLatencyProfile {
  const reported = reportedOutputLatencyMs(context)
  return reported === null
    ? {
        deviceId,
        roundTripMs: ASSUMED_ROUND_TRIP_MS,
        origin: 'assumed',
        spreadMs: null,
        updatedAt: now,
      }
    : {
        deviceId,
        // The reported figure covers output only, so the capture half is still
        // missing. Assume it is about the same size rather than reporting a
        // round trip that is knowably half a round trip.
        roundTripMs: Math.min(MAX_ROUND_TRIP_MS, reported * 2),
        origin: 'reported',
        spreadMs: null,
        updatedAt: now,
      }
}

export interface CalibrationResult {
  roundTripMs: number
  spreadMs: number | null
  clicksHeard: number
}

/**
 * Round trip from a loopback run: the clicks that were scheduled, and the
 * attack times the microphone reported back. Returns null when too few clicks
 * came back — which is the normal outcome on headphones, and must read as
 * "could not measure" rather than as a measurement of zero.
 */
export function measureRoundTrip(
  clickTimes: readonly number[],
  heardTimes: readonly number[],
  minClicks: number = MIN_CALIBRATION_CLICKS,
): CalibrationResult | null {
  const schedule = [...clickTimes]
  const deltas: number[] = []
  for (const heard of heardTimes) {
    const delta = nearestClickDelta(schedule, heard, MAX_CLICK_DISTANCE_SEC)
    // A click cannot be heard before it is played; a negative delta is some
    // other sound landing near the schedule, not the click coming back.
    if (delta === null || delta < 0) continue
    deltas.push(delta)
  }
  if (deltas.length < minClicks) return null

  const centre = median(deltas)
  if (centre === null) return null
  const sorted = [...deltas].sort((left, right) => left - right)
  const lower = median(sorted.slice(0, Math.floor(sorted.length / 2)))
  const upper = median(sorted.slice(Math.ceil(sorted.length / 2)))
  return {
    roundTripMs: Math.max(
      0,
      Math.min(MAX_ROUND_TRIP_MS, Math.round(centre * 1000)),
    ),
    spreadMs:
      lower === null || upper === null
        ? null
        : Math.round((upper - lower) * 1000),
    clicksHeard: deltas.length,
  }
}

/** When the player actually struck the string, given when we heard it. */
export function playedAt(
  capturedAt: number,
  profile: InputLatencyProfile | null,
): number {
  if (profile === null) return capturedAt
  return capturedAt - profile.roundTripMs / 1000
}

/**
 * How far off the beat a strike was, in milliseconds. Positive is late, which
 * is the direction players expect to read.
 */
export function timingErrorMs(playedAtSeconds: number, beatAt: number): number {
  return (playedAtSeconds - beatAt) * 1000
}

/** One line the player can act on, or decide to ignore. */
export function describeLatencyProfile(profile: InputLatencyProfile): string {
  const rounded = Math.round(profile.roundTripMs)
  switch (profile.origin) {
    case 'measured':
      return profile.spreadMs === null || profile.spreadMs <= 8
        ? `Measured on this input: ${rounded} ms.`
        : `Measured on this input: ${rounded} ms, and varying by about ${profile.spreadMs} ms.`
    case 'reported':
      return `Estimated from this browser: about ${rounded} ms. Calibrate for a real number.`
    case 'assumed':
      return `Assumed ${rounded} ms — nothing has measured this input yet.`
  }
}

interface StoredProfiles {
  [deviceId: string]: InputLatencyProfile
}

function readStore(): StoredProfiles {
  try {
    const raw = localStorage.getItem(INPUT_LATENCY_STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as StoredProfiles
  } catch {
    return {}
  }
}

/** The saved profile for one capture device, or null if it has never run. */
export function loadInputLatencyProfile(
  deviceId: string,
): InputLatencyProfile | null {
  const stored = readStore()[deviceId]
  if (stored === undefined) return null
  if (typeof stored.roundTripMs !== 'number') return null
  return stored
}

export function saveInputLatencyProfile(profile: InputLatencyProfile): void {
  try {
    const store = readStore()
    store[profile.deviceId] = profile
    localStorage.setItem(INPUT_LATENCY_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // A full or blocked store costs the player a re-calibration, nothing more.
  }
}
