// ============================================================
// Merc in a glide room: what he does at each moment, and his feet
// ============================================================
//
// He rides the voice at the playhead (DESIGN-ng-slides.md 1,
// DESIGN-lip-roll.md 1): the room hands his feet the sung pitch every
// frame, smoothed here (`rideStep`), and the room's own geometry says where
// that pitch stands (its rideTarget). The moments are the core's
// (useGlideRoom.ts): `voiced` and `quiet` are an arch's sung part with the
// voice sounding or not, `lit` an arch just lit (his happy face), `cheer` a
// result he cheers (the room says which). Which state each moment shows is
// the room's choreography, in its RIDE_STATES (bay-ride.ts, bridge-ride.ts).

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

/** His feet's smoothing toward the voice, s (a time constant). */
export const RIDE_TAU_SEC = 0.08

/** One step of his feet toward `target`, `dt` seconds on. */
export function rideStep(current: number, target: number, dt: number): number {
  if (!(dt > 0)) return current
  const k = 1 - Math.exp(-dt / RIDE_TAU_SEC)
  return current + (target - current) * k
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
