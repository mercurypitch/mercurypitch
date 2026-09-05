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
//   3  keep going down as you go through
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

import type { Band, Gate, Range, Silhouette } from '../sim/tension3d'
import { bandFor, fitsSlotHeight, fitsSlotWidth, gapWidthFor, LETTERBOX, SCREEN_MESH, SCREEN_SLOT, slotHeightFor, slotWidthFor, supportedBy, tForTorso, torsoHeight, WEDGE_IN, WEDGE_OUT, } from '../sim/tension3d'

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

/**
 * A slot whose ceiling falls along its length: `gate` is what it admits
 * at its mouth, `out` what it admits at its far end, and between them
 * the ceiling is a straight line. He cannot stand in it at one shape
 * and walk: the voice has to keep going down while he goes forward,
 * at the rate the wedge sets (§16.2).
 */
export interface WedgeSlot {
  readonly kind: 'wedge'
  readonly from: number
  readonly to: number
  /** What the mouth admits. Always a flat gate. */
  readonly gate: Gate
  /** What the far end admits. Flat, and tighter than the mouth. */
  readonly out: Gate
}

export type LineGate = SlotPlate | MeshFloor | WedgeSlot

/**
 * A piece of furniture's bands for THIS player. `band` is the one the
 * gauge shows and the grade judges: where he has to be to get through.
 * `entry` is where he has to be to get IN, which for everything but a
 * wedge is the same band.
 */
export const bandsFor = (
  gate: LineGate,
  range: Range,
): { band: Band; entry: Band } => {
  if (gate.kind === 'wedge') {
    return { band: bandFor(gate.out, range), entry: bandFor(gate.gate, range) }
  }
  const band = bandFor(gate.gate, range)
  return { band, entry: band }
}

/**
 * The numbers a piece of furniture is, for THIS player: a horizontal
 * slot's height, a vertical slot's width, a grate's gap, and for a
 * wedge the ceiling at each end. Drawn from them and judged by them,
 * so the two cannot disagree (§6). `sizeOut` is 0 for anything that
 * is one number.
 */
export interface Fit {
  readonly size: number
  readonly sizeOut: number
}

export const fitFor = (
  gate: LineGate,
  bands: { band: Band; entry: Band },
): Fit => {
  if (gate.kind === 'mesh') return { size: gapWidthFor(bands.band), sizeOut: 0 }
  if (gate.kind === 'wedge') {
    return {
      size: slotHeightFor(bands.entry),
      sizeOut: slotHeightFor(bands.band),
    }
  }
  return {
    size:
      gate.gate.end === 'flat'
        ? slotHeightFor(bands.band)
        : slotWidthFor(bands.band),
    sizeOut: 0,
  }
}

/** The one number a piece of furniture is, where it is one number. */
export const sizeFor = (gate: LineGate, band: Band): number =>
  fitFor(gate, { band, entry: band }).size

/** A wedge's ceiling at `x`, in metres. Flat at its mouth's height
 * before the mouth, and at its far end's beyond it. */
export const wedgeCeiling = (gate: WedgeSlot, fit: Fit, x: number): number => {
  const along = Math.max(
    0,
    Math.min(1, (x - gate.from) / (gate.to - gate.from)),
  )
  return fit.size + (fit.sizeOut - fit.size) * along
}

/** Does this body get past this furniture right now, standing at `x`?
 * For a grate that means being held by it; for a wedge, fitting under
 * the ceiling at his FRONT edge, which is where a falling ceiling meets
 * him first -- so he has to be lower than where he stands, which is
 * the wedge's whole ask. */
export const admits = (
  gate: LineGate,
  body: Silhouette,
  fit: Fit,
  x: number,
): boolean => {
  if (gate.kind === 'mesh') return supportedBy(body, fit.size)
  if (gate.kind === 'wedge') {
    const front = x + body.width / 2
    return torsoHeight(body) <= wedgeCeiling(gate, fit, front) + 1e-9
  }
  return gate.gate.end === 'flat'
    ? fitsSlotHeight(body, fit.size)
    : fitsSlotWidth(body, fit.size)
}

/**
 * The band that applies where he stands. For everything but a wedge it
 * is the gate's band. For a wedge it is what the ceiling at his FRONT
 * admits: the entry band before the mouth, the exit band at the far
 * end, and between them a band that closes as he walks -- which is
 * what the gauge shows and what a stop is graded against, so the tube
 * says "keep going down" in the one place it is true, and a note held
 * before the mouth is not marked against the far end (maff's phone:
 * a low note at the door graded 0, the same note the next time 100).
 */
export const bandAt = (
  gate: LineGate,
  bands: { band: Band; entry: Band },
  fit: Fit,
  body: Silhouette,
  x: number,
): Band => {
  if (gate.kind !== 'wedge') return bands.band
  const ceiling = wedgeCeiling(gate, fit, x + body.width / 2)
  return { lo: 0, hi: Math.min(bands.entry.hi, tForTorso(ceiling)) }
}

/**
 * Where a wedge stops a body of this height and half-width: the `x`
 * his front edge reaches before the ceiling meets his head. Infinity
 * when the far end admits him, so it is no wall at all; before the
 * mouth when the mouth does not.
 */
export const wedgeStop = (
  gate: WedgeSlot,
  fit: Fit,
  torso: number,
  halfWidth: number,
): number => {
  if (torso <= fit.sizeOut + 1e-9) return Infinity
  if (torso > fit.size) return gate.from - halfWidth
  const along = (fit.size - torso) / (fit.size - fit.sizeOut)
  return gate.from + (gate.to - gate.from) * along - halfWidth
}

/**
 * The `x` this piece of furniture will not let him pass right now, or
 * Infinity. A grate is never a wall: it is walked onto and holds or
 * does not. A wall is NEVER behind him: a wedge whose ceiling has come
 * down on him, or a plate that shut while he was in its doorway, pins
 * him where he stands until he is the shape again -- he stops with his
 * head against it, and can back out. (maff's phone: a note released in
 * the wedge let him walk on out, because the wall had moved behind him
 * and a wall behind him was ignored.)
 */
export const wallAt = (
  gate: LineGate,
  fit: Fit,
  body: Silhouette,
  x: number,
  open: boolean,
): number => {
  if (gate.kind === 'mesh') return Infinity
  if (gate.kind === 'wedge') {
    return Math.max(x, wedgeStop(gate, fit, torsoHeight(body), body.width / 2))
  }
  return open ? Infinity : Math.max(x, gate.x - PLATE_STANDOFF)
}

/** Is he through? A plate is passed a hand's width beyond it; a grate
 * when its far lip is behind him; a wedge a hand past its far end.
 * Passed stays passed (§5). */
export const crossed = (gate: LineGate, x: number): boolean => {
  if (gate.kind === 'mesh') return x >= gate.to
  if (gate.kind === 'wedge') return x >= gate.to + 0.05
  return x >= gate.x + 0.05
}

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
  | { readonly kind: 'wedge'; readonly from: number; readonly to: number }

export const furnitureOf = (gate: LineGate): LineFurniture => {
  if (gate.kind === 'mesh')
    return { kind: 'mesh', from: gate.from, to: gate.to }
  if (gate.kind === 'wedge') {
    return { kind: 'wedge', from: gate.from, to: gate.to }
  }
  return { kind: 'slot', axis: gate.gate.end === 'flat' ? 'h' : 'v', x: gate.x }
}

export interface LineLevel {
  readonly id: string
  /** The one sentence this room exists to teach. Shown at the gate and
   * hidden for the acceptance test (§4). */
  readonly teaches: string
  /** Two sentences, at most, on how: shown on the gate card in place
   * of the world's hint once the world's hint has been read. A room
   * whose furniture explains itself has none. maff's phone: the grate
   * did not explain itself, and the ghosts that were to do it are gone
   * (§15.4). */
  readonly hint?: string
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
  hint: 'Only a wide body is carried over the grate, and only a thin one fits the slot after it. Sing low to spread and cross, then sing high on the solid ground between.',
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

/**
 * Room 3, "The Wedge". Six and a half metres, and the gate §8 asked
 * for, as far as one degree of freedom allows (§16.2): a slot whose
 * ceiling falls along its length, from what a low note fits to what a
 * lower one does. He cannot stop in it and be right; the voice has to
 * keep going down at the pace he walks. A hummed glide with a target.
 *
 * Two metres long, not one: at one metre a note released at the mouth
 * still fitted the far end before the relax had brought him up, so
 * the glide never had to be sustained (maff's phone). At two, silence
 * from the mouth's shape reaches the far end's ceiling with half a
 * metre to go, and he has to keep singing down to get out.
 */
export const LINE_3: LineLevel = {
  id: 'line-3',
  teaches: 'Keep going down as you go through.',
  hint: 'The ceiling falls as he walks under it. Keep the note sliding lower, a step ahead of him, and he keeps going.',
  length: 6.5,
  startX: 0.2,
  exitX: 6.0,
  gates: [
    { kind: 'wedge', from: 1.8, to: 3.8, gate: WEDGE_IN, out: WEDGE_OUT },
  ],
  jump: false,
}

export const LINES: readonly LineLevel[] = [LINE_1, LINE_2, LINE_3]

/** How far short of a plate he stops while it is shut, in metres. */
export const PLATE_STANDOFF = 0.24
