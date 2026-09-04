// The Sorting Line's rooms, as data.
// ============================================================
//
// `sim/tension3d` knows what a voice does to Merc's body. This knows
// which rooms are worth walking him through, and it is checked-in data
// rather than code for the same reason the chambers are
// (docs/games/sorting-line.md §4, §5).
//
// Each room is built backwards from ONE sentence it teaches:
//
//   1  any sound changes him, and a flat one gets under things
//   2  the shape that carries you is not the shape that fits
//
// THE ROOM IS INERT. Every plate, gap and slot would sit there
// unchanged if the microphone never opened. The voice touches Merc and
// nothing else, which is the exact inversion of a chamber. And the
// furniture is DERIVED: a gate states its ask in `t` and in semitones,
// and the slot it becomes is drawn per player by the same function
// that decides whether he fits (§6, from The Top Shelf: tolerance is
// geometry, never a constant).
//
// Positions are in METRES, not fractions of the room: the plan states
// them that way, and a room whose plate is "at 1.5" is easier to argue
// with on a phone than one whose plate is "at 0.3".

import type { Band, Gate, Silhouette } from '../sim/tension3d'
import { fitsSlotHeight, fitsSlotWidth, gapWidthFor, LETTERBOX, SCREEN_MESH, SCREEN_SLOT, slotHeightFor, slotWidthFor, supportedBy, } from '../sim/tension3d'

/** A plate across the corridor with a slot in it. */
export interface SlotPlate {
  readonly kind: 'slot'
  /** Metres along the room. */
  readonly x: number
  /** What the slot admits. A flat gate is a horizontal slot along the
   * floor; a tall gate is a vertical slot up the middle. */
  readonly gate: Gate
}

/** A stretch of floor that is a grate over a chute: it holds a body
 * wide enough to span its gaps, and a narrower one pours through. */
export interface MeshFloor {
  readonly kind: 'mesh'
  /** Where the grate starts and ends, in metres. */
  readonly from: number
  readonly to: number
  /** The support band. Always a flat gate: wide is what holds. */
  readonly gate: Gate
}

export type LineGate = SlotPlate | MeshFloor

/**
 * The one number a piece of furniture is, for THIS player's band:
 * a horizontal slot's height, a vertical slot's width, a grate's gap.
 * Drawn from it and judged by it, so the two cannot disagree (§6).
 */
export const sizeFor = (gate: LineGate, band: Band): number => {
  if (gate.kind === 'mesh') return gapWidthFor(band)
  return gate.gate.end === 'flat' ? slotHeightFor(band) : slotWidthFor(band)
}

/** Does this body get past this furniture right now? For a grate that
 * means being held by it. */
export const admits = (
  gate: LineGate,
  body: Silhouette,
  size: number,
): boolean => {
  if (gate.kind === 'mesh') return supportedBy(body, size)
  return gate.gate.end === 'flat'
    ? fitsSlotHeight(body, size)
    : fitsSlotWidth(body, size)
}

/** Is he through? A plate is passed a hand's width beyond it; a grate
 * when its far lip is behind him. Passed stays passed (§5). */
export const crossed = (gate: LineGate, x: number): boolean =>
  gate.kind === 'mesh' ? x >= gate.to : x >= gate.x + 0.05

/** How wide a grate's bar is, in metres. */
export const SLAT = 0.05

/**
 * How a grate is cut. The gaps are EXACTLY the judged size, every one,
 * and the two lips at its ends absorb whatever length is left over --
 * so what is drawn is what is judged, and a lip is solid floor.
 */
export const meshLayout = (
  grate: { readonly from: number; readonly to: number },
  size: number,
): { gaps: number; lip: number } => {
  const span = grate.to - grate.from
  const gaps = Math.max(1, Math.floor((span - SLAT) / (size + SLAT)))
  const lip = (span - gaps * size - (gaps - 1) * SLAT) / 2
  return { gaps, lip }
}

/** Is his centre over the gaps of this grate, rather than on a lip? */
export const overGaps = (
  grate: { readonly from: number; readonly to: number },
  x: number,
  size: number,
): boolean => {
  const { lip } = meshLayout(grate, size)
  return x > grate.from + lip && x < grate.to - lip
}

/** What the renderer needs to stand a piece of furniture up: where it
 * is and which way its opening runs. Its size arrives per frame. */
export type LineFurniture =
  | { readonly kind: 'slot'; readonly axis: 'h' | 'v'; readonly x: number }
  | { readonly kind: 'mesh'; readonly from: number; readonly to: number }

export const furnitureOf = (gate: LineGate): LineFurniture =>
  gate.kind === 'mesh'
    ? { kind: 'mesh', from: gate.from, to: gate.to }
    : { kind: 'slot', axis: gate.gate.end === 'flat' ? 'h' : 'v', x: gate.x }

export interface LineLevel {
  readonly id: string
  /** The one sentence this room exists to teach. Shown at the gate and
   * hidden for the acceptance test (§4). */
  readonly teaches: string
  /** Metres. */
  readonly length: number
  /** Where he comes in, in metres. */
  readonly startX: number
  /** Reaching this, grounded, with every gate passed, finishes the room. */
  readonly exitX: number
  readonly gates: readonly LineGate[]
  /** Where a drop puts him back, in metres. A room with nothing to
   * drop through has none. */
  readonly returnX?: number
  /** Whether the jump button is offered. A room with no vertical
   * geometry hides it: a button that does nothing is a button the
   * player believes they are failing to use. */
  readonly jump: boolean
}

/**
 * Room 1, "The Letterbox". Five metres, no hazard, cannot be lost.
 *
 * A plate at 1.5 with a horizontal slot along the bottom; the slot's
 * height comes from the letterbox band for THIS player's range. The
 * band is enormous -- at least four semitones for
 * every voice, the bottom of the range -- so a player who hums one low
 * note, once, is through.
 */
export const LINE_1: LineLevel = {
  id: 'line-1',
  teaches: 'Any sound. He changes with it.',
  length: 5,
  startX: 0.2,
  exitX: 4.7,
  gates: [{ kind: 'slot', x: 1.5, gate: LETTERBOX }],
  jump: false,
}

/**
 * Room 2, "The Screen". Seven metres, the first way to lose, and the
 * room the world exists for (§5): the shape that carries you is not
 * the shape that fits.
 *
 * Solid floor to 1.6, then two metres of grate over a chute -- a wide
 * body spans the gaps and is held, a narrow one pours through. A solid
 * island from 3.6, the only place to swap. A vertical slot at 4.9 that
 * only a narrow body fits. The two asks oppose each other, and the
 * relax is the clock: from the flat end silence crosses the grate in
 * one breath with slack, from the island it reaches the slot the same
 * way. A drop returns him to the lip of the grate, and gates already
 * passed stay passed.
 */
export const LINE_2: LineLevel = {
  id: 'line-2',
  teaches: 'The shape that carries you is not the shape that fits.',
  length: 7,
  startX: 0.2,
  exitX: 6.6,
  returnX: 1.4,
  gates: [
    { kind: 'mesh', from: 1.6, to: 3.6, gate: SCREEN_MESH },
    { kind: 'slot', x: 4.9, gate: SCREEN_SLOT },
  ],
  jump: false,
}

export const LINES: readonly LineLevel[] = [LINE_1, LINE_2]

/** How far short of a plate he stops while it is shut, in metres. */
export const PLATE_STANDOFF = 0.24
