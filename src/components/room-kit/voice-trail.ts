// ============================================================
// The voice's trail — where the voice sits against the note it is after
// ============================================================
//
// A room's turn draws the voice as a short trail of light, its newest
// point at the head, older points drifting left. Up is higher. The note
// the voice is after is a line across the room (Home note's lighthouse
// beam, First note's spotlight), and the voice is read against its nearest
// octave, as the sequence engine hears it at the levels that fold: a voice
// an octave under the note sits on the line, because it is that note.
//
// The live picture is what the research says moves a voice: seeing the
// pitch while matching it (Blanco et al. 2021). So the trail is drawn
// every frame the voice is heard, and the tolerance band around the line
// is the level's own, so "in the light" on screen is "landing" in the
// engine.
//
// Pure: the room hands it the readings and its size, and draws the path.

import { offTarget } from '@/lib/hold/hold-reading'
import type { PitchFrame } from '@/lib/pitch-f0-stream'

/** The trail's length on screen, s. */
export const TRAIL_SECONDS = 2.6
/** The trail shows this far either side of the note, cents: half an octave. */
export const TRAIL_REACH_CENTS = 600

/** One reading on the trail: seconds on the frames' clock, cents off the note. */
export interface TrailPoint {
  readonly t: number
  /** Null where the voice was not heard: the trail breaks there. */
  readonly cents: number | null
}

/** Cents off the note `home`, folded to its nearest octave. */
export function foldedCents(midi: number, home: number): number {
  const off = (midi - home) * 100
  return off - 1200 * Math.round(off / 1200)
}

/** A frame's reading for the trail: folded cents, or null when unvoiced. */
export function trailPoint(frame: PitchFrame, home: number): TrailPoint {
  const off = offTarget(frame, home)
  return {
    t: frame.t,
    cents: off === null ? null : foldedCents(home + off / 100, home),
  }
}

/** Where the trail is drawn, px. */
export interface TrailGeometry {
  /** The newest point's x. */
  readonly headX: number
  /** The note's line. */
  readonly lineY: number
  /** Px for TRAIL_SECONDS of trail. */
  readonly width: number
  /** Px for TRAIL_REACH_CENTS either side of the line. */
  readonly reach: number
}

/** The y of a reading: up is higher, held inside the trail's reach. */
export function trailY(cents: number, geometry: TrailGeometry): number {
  const held = Math.max(-TRAIL_REACH_CENTS, Math.min(TRAIL_REACH_CENTS, cents))
  return geometry.lineY - (held / TRAIL_REACH_CENTS) * geometry.reach
}

/**
 * The trail's SVG path at `now` on the frames' clock: the readings of the
 * last TRAIL_SECONDS, one sub-path per voiced run, empty with none.
 */
export function trailPath(
  points: readonly TrailPoint[],
  now: number,
  geometry: TrailGeometry,
): string {
  const from = now - TRAIL_SECONDS
  const pxPerSecond = geometry.width / TRAIL_SECONDS
  let path = ''
  let open = false
  for (const point of points) {
    if (point.t < from || point.t > now + 1e-6) continue
    if (point.cents === null) {
      open = false
      continue
    }
    const x = geometry.headX - (now - point.t) * pxPerSecond
    const y = trailY(point.cents, geometry)
    path += `${open ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    open = true
  }
  return path
}

/** The newest voiced reading at or before `now`, if it is recent. */
export function headOf(
  points: readonly TrailPoint[],
  now: number,
  freshSeconds = 0.25,
): TrailPoint | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i]
    if (point.t > now + 1e-6) continue
    if (point.cents === null) return null
    return now - point.t <= freshSeconds ? point : null
  }
  return null
}
