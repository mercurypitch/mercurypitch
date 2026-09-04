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

import type { Gate } from '../sim/tension3d'
import { LETTERBOX } from '../sim/tension3d'

/** A plate across the corridor with a slot in it. */
export interface SlotPlate {
  readonly kind: 'slot'
  /** Metres along the room. */
  readonly x: number
  /** What the slot admits. A flat gate is a horizontal slot along the
   * floor; a tall gate is a vertical slot up the middle. */
  readonly gate: Gate
}

export type LineGate = SlotPlate

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
  /** Whether the jump button is offered. A room with no vertical
   * geometry hides it: a button that does nothing is a button the
   * player believes they are failing to use. */
  readonly jump: boolean
}

/**
 * Room 1, "The Letterbox". Five metres, no hazard, cannot be lost.
 *
 * A plate at 1.5 with a horizontal slot along the bottom; the slot's
 * height comes from the letterbox band for THIS player's range. Beside
 * it a ghost of him, drawn at the band's centre, which is the whole
 * instruction. The band is enormous -- at least four semitones for
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

export const LINES: readonly LineLevel[] = [LINE_1]

/** How far short of a plate he stops while it is shut, in metres. */
export const PLATE_STANDOFF = 0.24
