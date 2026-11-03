// ============================================================
// The cliffs' layout — where the ledges, Merc, the lantern and the trail go
// ============================================================
//
// One measurement of the room and the round place everything. Each note is
// a ledge, at its pitch's height: Merc's on the near cliff at the left, the
// target on the far cliff at the right, its lantern at the far end. The two
// heights are a semitone scale apart, centred in the room between the head
// (the chip and the leap's lamp) and the dock (the mic), so the widest leap
// (an octave) still fits on a short phone, and a fourth stands as a fourth
// does beside it. Up is higher, as everywhere a voice is drawn in the app.
//
// The voice's trail runs from Merc's ledge out over the gap to the far
// cliff. It is read against the leap's middle, unfolded (leap-rules.ts:
// never folded), so Merc's note and the target are each half the leap from
// its line, and the room kit's trail (voice-trail.ts) draws it as it draws
// Home note's, half an octave of reach either side.
//
// Pure, in px, so a test can hold the places to the room's size.

import type { TrailGeometry } from '@/components/room-kit/voice-trail'
import type { LeapRound } from './leap-round'

/** The ledges' band: from this share of the height, at least this far down, px. */
const TOP_SHARE = 0.25
const TOP_MIN = 196
/** ...to this share of the height from the bottom, at least this far up, px. */
const BOTTOM_SHARE = 0.27
const BOTTOM_MIN = 210
/** Semitones the band must hold: the octave, and half a step either side. */
const BAND_SEMITONES = 13
/** Px a semitone, at most and at least. */
const SEMITONE_MAX = 34
const SEMITONE_MIN = 12
/** The near cliff's edge and the far cliff's, shares of the width. */
const NEAR_EDGE = 0.36
const FAR_EDGE = 0.6
/** Merc's canvas: a share of the width, capped by a share of the height. */
const MERC_W = 0.24
const MERC_H = 0.115
const MERC_MIN = 64
const MERC_MAX = 112
/** At the result, Merc's ledge this share of the height up, at least this many px. */
const LOW_SHARE = 0.17
const LOW_MIN = 136
/** At the result, the far ledge a fourth over his. */
const RESULT_LEAP = 5
/** The trail's head and its length, shares of the width. */
const HEAD_X = 0.66
const TRAIL_W = 0.5

export interface CliffLayout {
  readonly width: number
  readonly height: number
  /** Merc's ledge and the target's, px down the room. */
  readonly fromY: number
  readonly toY: number
  /** Px a semitone. */
  readonly semitone: number
  /** The near cliff's edge and the far cliff's, px across. */
  readonly nearEdge: number
  readonly farEdge: number
  /** The lantern on the far ledge: its foot, px. */
  readonly lantern: { readonly x: number; readonly y: number }
  /** Merc's canvas: left, top and size, px. His feet are on his ledge. */
  readonly merc: {
    readonly left: number
    readonly top: number
    readonly size: number
  }
  /** The trail, read against the leap's middle. */
  readonly trail: TrailGeometry
}

/**
 * The cliffs for a room `width` x `height` px and the leap `round` (null
 * at rest: a fifth up, as the room opens on); `mercFeet` is MercView's.
 * `low` stands the ledges low, just over the dock, for the result: its
 * leaps' card needs the room above them.
 */
export function layoutCliffs(
  width: number,
  height: number,
  round: Pick<LeapRound, 'from' | 'to'> | null,
  mercFeet: number,
  low = false,
): CliffLayout {
  const top = Math.max(height * TOP_SHARE, TOP_MIN)
  const bottom = height - Math.max(height * BOTTOM_SHARE, BOTTOM_MIN)
  const span = Math.max(0, bottom - top)
  const semitone = Math.min(
    SEMITONE_MAX,
    Math.max(SEMITONE_MIN, span / BAND_SEMITONES),
  )
  const middle = (top + bottom) / 2
  const leap = round === null ? (low ? RESULT_LEAP : 7) : round.to - round.from
  const fromY = low
    ? height - Math.max(height * LOW_SHARE, LOW_MIN)
    : middle + (leap * semitone) / 2
  const toY = fromY - leap * semitone
  const nearEdge = width * NEAR_EDGE
  const size = Math.min(
    MERC_MAX,
    Math.max(MERC_MIN, Math.min(width * MERC_W, height * MERC_H)),
  )
  const feetX = Math.max(size * 0.6, nearEdge * 0.42)
  return {
    width,
    height,
    fromY,
    toY,
    semitone,
    nearEdge,
    farEdge: width * FAR_EDGE,
    lantern: { x: width - Math.max(30, width * 0.08), y: toY },
    merc: { left: feetX - size / 2, top: fromY - size * mercFeet, size },
    trail: {
      headX: width * HEAD_X,
      lineY: middle,
      width: width * TRAIL_W,
      reach: 6 * semitone,
    },
  }
}

/**
 * A painted column of the cliffs (./art/, docs/plans/ear-rooms.md): its own
 * size, px, and its flat top, px down it. The near column's ledge corner is
 * its top right; the far one's, its top left. Each runs on below its rock
 * into the dark, so it reaches the room's floor from the highest ledge.
 */
export interface ColumnPlate {
  readonly width: number
  readonly height: number
  readonly top: number
}

/** The two columns as painted. */
export const COLUMN_PLATES: {
  readonly near: ColumnPlate
  readonly far: ColumnPlate
} = {
  near: { width: 570, height: 2743, top: 1 },
  far: { width: 573, height: 2743, top: 1 },
}

/** A painted column's box in its cliff's group (its ledge at y 0), px. */
export interface ColumnBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Where each painted column stands, in the group its cliff moves in: the
 * near one from the room's left edge to the near cliff's edge, the far one
 * from the far cliff's edge to the room's right, each scaled to that width
 * with its flat top on the ledge.
 */
export function columnBoxes(layout: CliffLayout): {
  near: ColumnBox
  far: ColumnBox
} {
  const box = (plate: ColumnPlate, x: number, width: number): ColumnBox => {
    const scale = width / plate.width
    return { x, y: -plate.top * scale, width, height: plate.height * scale }
  }
  return {
    near: box(COLUMN_PLATES.near, 0, layout.nearEdge),
    far: box(COLUMN_PLATES.far, layout.farEdge, layout.width - layout.farEdge),
  }
}

/** The tolerance band's half-height around the target's line, px. */
export function bandHalfHeight(tolCents: number, layout: CliffLayout): number {
  return (tolCents / 100) * layout.semitone
}

/** The note the trail is read against: the leap's middle, MIDI. */
export function trailNote(round: Pick<LeapRound, 'from' | 'to'>): number {
  return (round.from + round.to) / 2
}
