// ============================================================
// The harbour's layout — where the beam, the lighthouse and Merc go
// ============================================================
//
// One measurement of the room places everything: the beam (home's line)
// across the sea at a fixed share of the height, the lighthouse's lamp on
// its right end, Merc on the pier at the lower left, and the voice's trail
// running from left of centre to the lamp's side, its reach the height a
// half octave takes either side of the beam.
//
// Pure, in px, so a test can hold the places to the room's size: the
// trail's head must stay left of the lamp, and the reach must leave the
// head (the chip) and the dock (the mic) clear on a short phone.

import type { TrailGeometry } from './voice-trail'
import { TRAIL_REACH_CENTS } from './voice-trail'

/** Merc's canvas, square, as a share of the room's width. */
export const MERC_SIZE_W = 0.4
/** Where his feet stand: a share of the width, a share of the height. */
const MERC_FEET_AT = { x: 0.2, y: 0.735 }
/** The beam's height in the room. */
const BEAM_Y = 0.44
/** The lamp's centre, a share of the width. */
const LAMP_X = 0.84
/** The trail's head, a share of the width, and its length. */
const HEAD_X = 0.66
const TRAIL_W = 0.56
/** The trail's reach either side of the beam: a share of the height, capped. */
const REACH_H = 0.19
const REACH_MAX = 170
/** Where the sea begins, a share of the height. */
const SEA_Y = 0.6

export interface HarbourLayout {
  readonly width: number
  readonly height: number
  readonly beamY: number
  readonly lampX: number
  readonly seaY: number
  /** Merc's canvas: left, top and size, px. His feet are MERC_FEET down it. */
  readonly merc: {
    readonly left: number
    readonly top: number
    readonly size: number
  }
  readonly trail: TrailGeometry
}

/** The harbour for a room `width` x `height` px; `mercFeet` is MercView's. */
export function layoutHarbour(
  width: number,
  height: number,
  mercFeet: number,
): HarbourLayout {
  const beamY = height * BEAM_Y
  const size = width * MERC_SIZE_W
  const feetX = width * MERC_FEET_AT.x
  const feetY = height * MERC_FEET_AT.y
  return {
    width,
    height,
    beamY,
    lampX: width * LAMP_X,
    seaY: height * SEA_Y,
    merc: { left: feetX - size / 2, top: feetY - size * mercFeet, size },
    trail: {
      headX: width * HEAD_X,
      lineY: beamY,
      width: width * TRAIL_W,
      reach: Math.min(REACH_MAX, height * REACH_H),
    },
  }
}

/** The tolerance band's half-height around the beam, px. */
export function bandHalfHeight(
  tolCents: number,
  layout: HarbourLayout,
): number {
  return (tolCents / TRAIL_REACH_CENTS) * layout.trail.reach
}
