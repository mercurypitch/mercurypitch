// ============================================================
// Merc in a glide room: what he does at each moment, and his feet
// ============================================================
//
// He rides the voice at the playhead (DESIGN-ng-slides.md 1,
// DESIGN-lip-roll.md 1): the room hands his feet the sung pitch every
// frame, its distance from the path smoothed here (`rideFeet`), and the
// room's own geometry says where a pitch stands (its rideTarget). The
// moments are the core's (useGlideRoom.ts): `voiced` and `quiet` are an
// arch's sung part with the voice sounding or not, `lit` an arch just lit
// (his happy face), `cheer` a result he cheers (the room says which). Which
// state each moment shows is the room's choreography, in its RIDE_STATES
// (bay-ride.ts, bridge-ride.ts).

import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'

/** What the run is doing, as Merc's choreography sees it. */
export type GlideMoment =
  | 'intro'
  | 'countIn'
  | 'voiced'
  | 'quiet'
  | 'breath'
  | 'lit'
  | 'result'
  | 'cheer'

/** His state for each moment: the room's choreography. */
export type GlideRideStates = Readonly<Record<GlideMoment, MercState>>

/**
 * His feet's smoothing, s (a time constant): of the voice's distance from
 * the path, not of the voice itself (rideFeet).
 */
export const RIDE_TAU_SEC = 0.08

/**
 * The same on a lip roll. A lip trill's pitch flutters with the lips
 * several times a second, which an Ng hum's does not; at 80 ms he bobbed on
 * every flutter. At a fifth of a second the flutter barely moves him, and
 * because only the voice's distance from the path is eased, he still glides
 * with the wave rather than behind it.
 */
export const BUZZ_RIDE_TAU_SEC = 0.2

/** One step of an eased value toward `target`, `dt` seconds on. */
export function rideStep(
  current: number,
  target: number,
  dt: number,
  tauSec: number = RIDE_TAU_SEC,
): number {
  if (!(dt > 0)) return current
  const k = 1 - Math.exp(-dt / tauSec)
  return current + (target - current) * k
}

/** His feet one frame on: the voice's eased distance from the path, and y. */
export interface RideFeet {
  /** The voice's distance from the path as his feet show it, world y. */
  readonly offset: number
  /** His feet, world y: the path's height plus that distance. */
  readonly y: number
}

/**
 * His feet one frame on. The path's height is taken as it is and only the
 * voice's distance from it (`voiceY - pathY`) is eased (`rideStep`): on a
 * voice that follows the path he stands right on it however fast it
 * glides, while a flutter around it, a slip off it, or a voice that comes
 * and goes moves him only as fast as `tauSec` allows. Easing the voice
 * itself would leave him a time constant behind every glide, which the bay
 * reads as flat going up and sharp coming down.
 */
export function rideFeet(
  offset: number,
  voiceY: number,
  pathY: number,
  dt: number,
  tauSec: number = RIDE_TAU_SEC,
): RideFeet {
  const next = rideStep(offset, voiceY - pathY, dt, tauSec)
  return { offset: next, y: pathY + next }
}

/** How strongly he sings on his own at the intro, 0..1. */
export const INTRO_HUM_LEVEL = 0.45

/**
 * His own hum (Ng slides) or buzz (Lip roll) at the intro, on the first
 * arch's root: a picture of what to do. Nothing sounds.
 */
export function introHum(root: number): MercVoice {
  return {
    voiced: true,
    cents: 0,
    level: INTRO_HUM_LEVEL,
    steady: 1,
    midi: root,
  }
}
