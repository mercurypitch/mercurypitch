// ============================================================
// First note's stage — where the note's line, the trail and Merc go
// ============================================================
//
// One measurement of the room places everything over the theatre: the
// note's line across the curtain at the round's own height (its
// lineShare, so the line's place says nothing about the note), the voice's
// trail running from left of centre towards it, its reach the height a
// half octave takes either side of the line, and Merc on the boards at the
// lower right, clear of the painted microphone at the left.
//
// Pure, in px, so a test can hold the places to the room's size: the reach
// must leave the head (the chip and the song) and the dock (the mic) clear
// on a short phone.

import type { TrailGeometry } from '@/components/room-kit/voice-trail'
import { TRAIL_REACH_CENTS } from '@/components/room-kit/voice-trail'

/** Merc's canvas, square, as a share of the room's width. */
export const MERC_SIZE_W = 0.34
/** Where his feet stand: a share of the width, a share of the height. */
const MERC_FEET_AT = { x: 0.78, y: 0.8 }
/** The line's height between rounds: the middle of its range. */
export const RESTING_LINE_SHARE = 0.43
/** The trail's head, a share of the width, and its length. */
const HEAD_X = 0.62
const TRAIL_W = 0.56
/** The trail's reach either side of the line: a share of the height, capped. */
const REACH_H = 0.16
const REACH_MAX = 140

export interface StageLayout {
  readonly width: number
  readonly height: number
  /** The note's line. */
  readonly lineY: number
  /** Merc's canvas: left, top and size, px. His feet are MERC_FEET down it. */
  readonly merc: {
    readonly left: number
    readonly top: number
    readonly size: number
  }
  readonly trail: TrailGeometry
}

/**
 * The stage for a room `width` x `height` px, its line at `lineShare` of
 * the height; `mercFeet` is MercView's.
 */
export function layoutStage(
  width: number,
  height: number,
  lineShare: number,
  mercFeet: number,
): StageLayout {
  const lineY = height * lineShare
  const size = width * MERC_SIZE_W
  const feetX = width * MERC_FEET_AT.x
  const feetY = height * MERC_FEET_AT.y
  return {
    width,
    height,
    lineY,
    merc: { left: feetX - size / 2, top: feetY - size * mercFeet, size },
    trail: {
      headX: width * HEAD_X,
      lineY,
      width: width * TRAIL_W,
      reach: Math.min(REACH_MAX, height * REACH_H),
    },
  }
}

/** The tolerance band's half-height around the line, px. */
export function bandHalfHeight(tolCents: number, layout: StageLayout): number {
  return (tolCents / TRAIL_REACH_CENTS) * layout.trail.reach
}
