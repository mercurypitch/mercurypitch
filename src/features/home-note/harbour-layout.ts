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
// Merc stands on the painted pier. The painting covers the room, pinned at
// its lantern (HarbourScene.tsx), so each screen's shape scales and crops
// it its own way, and a share of the room lands on the planks on one
// screen and over the water on the next: on its side, the room's width
// made him fill the screen above the pier. So he is placed on the plate
// the room shows, through the same cover and pin as the picture: his feet
// on a spot of its planks, his size a share of the plate as shown, which
// is the pier's own scale. Which plate shows is the picture's own choice,
// the screen's orientation (LANDSCAPE_PLATE_MEDIA), not the room's shape:
// the two part whenever the room is not the screen's shape.
//
// Pure, in px, so a test can hold the places to the room's size: the
// trail's head must stay left of the lamp, the reach must leave the head
// (the chip) and the dock (the mic) clear on a short phone, and Merc's feet
// must land on the planks.

import type { TrailGeometry } from '@/components/room-kit/voice-trail'
import { TRAIL_REACH_CENTS } from '@/components/room-kit/voice-trail'

/** When the picture shows its landscape plate: its `<source>`'s media. */
export const LANDSCAPE_PLATE_MEDIA = '(orientation: landscape)'

/** A plate of the painting, and where Merc stands on its pier. */
interface HarbourPlate {
  /** The plate's own size, px. */
  readonly width: number
  readonly height: number
  /** His feet on the planks: shares of the plate's width and height. */
  readonly feet: { readonly x: number; readonly y: number }
  /** His canvas, square, as a share of the plate's height. */
  readonly size: number
}

/**
 * The two plates in ./art/. Upright, his feet and size are the ones a
 * 390 x 844 phone gave him, where the pier was painted out to meet him
 * (docs/plans/ear-rooms.md). On its side, his feet where the walkway leaves
 * the wide deck, since an iPad's crop takes the plate's left fifth off the
 * screen, and his size set by eye against the same planks.
 */
const PLATES = {
  portrait: {
    width: 1440,
    height: 2560,
    feet: { x: 0.314, y: 0.735 },
    size: 0.185,
  },
  landscape: {
    width: 2048,
    height: 1152,
    feet: { x: 0.27, y: 0.795 },
    size: 0.26,
  },
} as const satisfies Record<string, HarbourPlate>

/** The beam's height in the room: the lantern's on the plates too. */
const BEAM_Y = 0.44
/** The lamp's centre, a share of the width: the lantern's on the plates too. */
const LAMP_X = 0.84
/** The trail's head, a share of the width, and its length. */
const HEAD_X = 0.66
const TRAIL_W = 0.56
/** The trail's reach either side of the beam: a share of the height, capped. */
const REACH_H = 0.19
const REACH_MAX = 170
/** Where the sea begins, a share of the height. */
const SEA_Y = 0.6
/** His body's half-width, a share of his canvas: what stays on screen. */
const MERC_BODY_HALF = 0.25

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
  /** The deck under his feet and the pier's end past them, px: the drawing's. */
  readonly pier: { readonly deckY: number; readonly end: number }
  readonly trail: TrailGeometry
}

/**
 * The harbour for a room `width` x `height` px; `mercFeet` is MercView's,
 * and `landscape` whether the picture shows its landscape plate (the
 * screen matches LANDSCAPE_PLATE_MEDIA).
 */
export function layoutHarbour(
  width: number,
  height: number,
  mercFeet: number,
  landscape: boolean,
): HarbourLayout {
  const beamY = height * BEAM_Y
  const plate: HarbourPlate = landscape ? PLATES.landscape : PLATES.portrait
  // Shown as `object-fit: cover` at `object-position: 84% 44%` shows it.
  const scale = Math.max(width / plate.width, height / plate.height)
  const left = (width - plate.width * scale) * LAMP_X
  const top = (height - plate.height * scale) * BEAM_Y
  const size = plate.size * plate.height * scale
  // A window narrower than any phone (an iPad's split view) crops the spot
  // off the side: he keeps to the screen, as near it as he can.
  const keep = size * MERC_BODY_HALF
  const feetX = Math.min(
    width - keep,
    Math.max(keep, left + plate.feet.x * plate.width * scale),
  )
  const feetY = top + plate.feet.y * plate.height * scale
  return {
    width,
    height,
    beamY,
    lampX: width * LAMP_X,
    seaY: height * SEA_Y,
    merc: { left: feetX - size / 2, top: feetY - size * mercFeet, size },
    pier: { deckY: feetY, end: Math.max(width * 0.34, feetX + size * 0.4) },
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
