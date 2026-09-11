// The Top Shelf's rooms, as data.
// ============================================================
//
// `sim/locomotion3d` knows how Merc moves. This knows the staircases he
// climbs, and it is checked-in data rather than code for the reason the
// Line's rooms are (docs/games/top-shelf.md §4).
//
// Each room is built backwards from ONE sentence it teaches:
//
//   1  a note, then a fifth above it
//   2  thirds and fifths, each from where you are
//   3  an octave is two leaps
//
// THE INTERVAL IS THE HEIGHT. A leap is `(stop - reference) *
// RISE_PER_SEMI` high, and a shelf's rise is written in semitones, so a
// room is stated in the units the voice sings and the ruler reads
// (§3.2, §6).
//
// THE SHELVES ARE A STAIRCASE (T1). Each starts where the last one ends,
// so nothing overhangs anything: the underside of a shelf is never
// reachable, and no head test is needed anywhere (T3, §2).
//
// THE CATCH IS GEOMETRY. A riser is a wall while his feet are more than
// `CATCH` below its lip, and a floor once they are within it: his mitts
// reach 5 cm, which at 0.1 m a semitone is half a semitone flat (§3.4).
// The wall and the floor ask the one question, `withinCatch`, so the
// wall cannot lift a step before the shelf will hold him, or after.
//
// HE IS CAUGHT BY HIS MITTS, NOT BY HIS MIDDLE. The wall stops his mitt
// at the riser, and the floor under him is read across his whole span,
// so the shelf whose riser he is against holds him the moment his feet
// are in reach. Read at his centre, the catch cannot work: pinned at the
// riser he still has half his width, 0.265 m, to cover before that
// shelf is under his middle, and from a standstill that takes 0.3 s
// against the quarter second an exact leap spends within the catch. An
// exact fifth would hop, and half a semitone flat, whose apex is the
// catch itself, could never land.
//
// A LEAP IS AIMED. Carried at walking pace, a leap reached its riser
// only from 0.43 m for a minor third to 0.62 m for a fifth, and a
// landing leaves him further than that from the next one (§11). So
// within `LEAP_REACH` of the next riser he is carried at the speed that
// brings his front to it at the apex (`leapCarry`), and the catch
// judges the height alone, wherever he stood. Further out it is a hop.

import type { GroundSampler } from '../sim/locomotion3d'

/** Metres of height per semitone sung (T1): a fifth is 0.7 m, and the
 * ruler's ticks are this far apart (§6). */
export const RISE_PER_SEMI = 0.1

/** The highest leap, in metres: nine semitones, his spring (D2). Above
 * every ask in rooms 1 and 2, and below the octave room 3 is built on. */
export const MAX_LEAP = 0.9

/** How far below a lip his mitts still catch it, in metres (D3): half a
 * semitone flat at this scale. */
export const CATCH = 0.05

/**
 * Merc at rest, mitt to mitt, in metres. The whole actor, MEASURED at
 * 0.5282 wide when he stands 0.55 tall (see `REST_WIDTH` in
 * sim/tension3d, which is his torso alone). The torso is what fits a
 * slot; the mitts are what catch a lip and what would show through a
 * riser, so here the walls and the floor are read across all of him.
 */
export const MITT_SPAN = 0.53

/** How far ahead of his front the next riser may be for a leap to be
 * aimed at it, in metres (§3.2): room 2's shelves are this deep, so a
 * leap sung anywhere on one of them is aimed. */
export const LEAP_REACH = 1.0

/** The fastest an aimed leap carries him, in metres a second: three
 * times walking pace. */
export const LEAP_CARRY_MAX = 3.5

/** A riser exactly at his mitt is a riser he has reached. The wall puts
 * him there by subtraction, and `from - w + w` can come back an ulp
 * short of `from`. */
const TOUCH = 1e-9

/**
 * The catch is inclusive: a leap that tops out exactly at it lands, as
 * §3.4 says half a semitone flat does. A tenth of a millimetre covers the
 * stepped arc, whose apex can fall g*dt^2/8 under the one
 * `leapVelocity` aims at (0.05 mm at 120 Hz), and the floating point in
 * a top built from tenths. It is a thousandth of a semitone.
 */
const REACH_SLACK = 1e-4

/** Can his mitts reach a lip at `lip` from feet at `feetY`? A lip at or
 * below his feet is simply under him. */
const withinCatch = (lip: number, feetY: number): boolean =>
  lip <= feetY + CATCH + REACH_SLACK

/** One step of the staircase. Shelf 0 is the floor, which rises 0. */
export interface Shelf {
  /** Where it starts along the room, in metres: its riser. */
  readonly from: number
  /** Where it ends, which is where the next one's riser stands. */
  readonly to: number
  /** Semitones above the shelf before it. */
  readonly rise: number
}

export interface ShelfLevel {
  readonly id: string
  /** What the room card calls it (§7): "The Octave -- 18¢ past the
   * shelf". Named for what is sung in it, like the sentence below. */
  readonly name: string
  /** The one sentence this room exists to teach (§4). */
  readonly teaches: string
  /** Two sentences on how, on the gate card, in the Line's pattern. */
  readonly hint: string
  /** Metres. */
  readonly length: number
  /** Where he comes in, in metres. */
  readonly startX: number
  /** Reaching this, grounded on the top shelf, finishes the room. */
  readonly exitX: number
  /** The floor first, then each shelf in order along the room. */
  readonly shelves: readonly Shelf[]
}

/**
 * Room 1. A fifth, once, and nothing else in the room: 2 m of floor,
 * then the one shelf 0.7 m up, 2.4 m deep with the exit on it. He comes
 * in with his front 0.9 m from the riser, inside `LEAP_REACH`, so the
 * first fifth sung at the start line lands.
 */
export const SHELF_1: ShelfLevel = {
  id: 'shelf-1',
  name: 'The Fifth',
  teaches: 'Sing a note, then a fifth above it.',
  hint: 'Hold any note, then sing a higher one: the gap between them is how high he leaps. A fifth gets him onto the shelf.',
  length: 4.4,
  startX: 0.835,
  exitX: 4.0,
  shelves: [
    { from: 0, to: 2.0, rise: 0 },
    { from: 2.0, to: 4.4, rise: 7 },
  ],
}

/**
 * Room 2. A third, a fifth, a minor third, a fifth: four leaps whose
 * stack is 21 semitones, which no voice has to climb because each one
 * is sung from wherever the last note was held (D1).
 */
export const SHELF_2: ShelfLevel = {
  id: 'shelf-2',
  name: 'Thirds and Fifths',
  teaches: 'Thirds and fifths, each from where you are.',
  hint: 'Each leap is measured from the note you last held. Come back down to a comfortable note before the next one; going down never moves him.',
  length: 6.2,
  startX: 0.4,
  exitX: 5.8,
  shelves: [
    { from: 0, to: 1.6, rise: 0 },
    { from: 1.6, to: 2.6, rise: 4 },
    { from: 2.6, to: 3.6, rise: 7 },
    { from: 3.6, to: 4.6, rise: 3 },
    { from: 4.6, to: 6.2, rise: 7 },
  ],
}

/**
 * Room 3. The second shelf is an octave above the floor and the fourth
 * an octave above that; `MAX_LEAP` is nine semitones, so each octave is
 * sung as a fifth to the 0.7 m ledge below it and a fourth on up. The
 * room teaches it; no sentence has to.
 */
export const SHELF_3: ShelfLevel = {
  id: 'shelf-3',
  name: 'The Octave',
  teaches: 'An octave is two leaps.',
  hint: 'The top shelf is an octave up, and no leap is that big. Stop on the ledge a fifth up, then leap the rest.',
  length: 5.6,
  startX: 0.4,
  exitX: 5.2,
  shelves: [
    { from: 0, to: 1.6, rise: 0 },
    { from: 1.6, to: 2.3, rise: 7 },
    { from: 2.3, to: 3.3, rise: 5 },
    { from: 3.3, to: 4.0, rise: 7 },
    { from: 4.0, to: 5.6, rise: 5 },
  ],
}

export const SHELVES: readonly ShelfLevel[] = [SHELF_1, SHELF_2, SHELF_3]

/** Each shelf's top, in metres: the sum of the rises up to it. Summed in
 * semitones and scaled once, the same way the wall and the floor do it,
 * so a top is the same number wherever it is asked for. */
export const topsOf = (room: ShelfLevel): number[] => {
  let semis = 0
  return room.shelves.map((shelf) => {
    semis += shelf.rise
    return semis * RISE_PER_SEMI
  })
}

/**
 * The floor under him, for `stepLocomotion`: the top of the shelf he
 * is over, read across his span, if his mitts can reach it from where
 * his feet are -- the catch -- else the next surface below. `halfWidth`
 * must be the one `riserWallAt` is given: the wall stops his mitt at a
 * riser, and this is what lets that shelf hold him once he is in reach.
 *
 * The next surface below is the shelf he left: a riser he is against
 * but cannot catch is not a floor, which is the ledge-overhead rule
 * `GroundSampler` exists for (a surface above his feet is never offered,
 * beyond the catch).
 */
export const groundFor = (
  room: ShelfLevel,
  halfWidth = MITT_SPAN / 2,
): GroundSampler => {
  const tops = topsOf(room)
  const { shelves } = room
  return (x, fromY) => {
    // The shelf his leading mitt is over: the last riser it has reached.
    let i = shelves.length - 1
    while (i > 0 && shelves[i]!.from > x + halfWidth + TOUCH) i--
    // Tops only fall towards the floor, so the first one in reach is
    // the highest surface he can be standing on.
    for (; i >= 0; i--) {
      if (withinCatch(tops[i]!, fromY)) return tops[i]!
    }
    return null
  }
}

/** The next riser up: the first whose lip is more than `CATCH` above
 * his feet. None on the top shelf. */
const riserAbove = (room: ShelfLevel, feetY: number): Shelf | undefined => {
  const { shelves } = room
  let semis = 0
  for (let i = 1; i < shelves.length; i++) {
    const shelf = shelves[i]!
    semis += shelf.rise
    if (!withinCatch(semis * RISE_PER_SEMI, feetY)) return shelf
  }
  return undefined
}

/**
 * The `x` he may not pass: the next riser whose lip is more than `CATCH`
 * above his feet, less his half width, so his mitt stops against it.
 * Infinity when there is none, on the top shelf.
 *
 * NEVER BEHIND HIM, the Line's `wallAt` pattern: a body that is somehow
 * past the riser with his feet below its catch is pinned where he is,
 * not thrown back. Walking cannot climb one either way (D7): every rise
 * is at least three semitones, 0.3 m, six times the catch.
 */
export const riserWallAt = (
  room: ShelfLevel,
  x: number,
  feetY: number,
  halfWidth: number,
): number => {
  const riser = riserAbove(room, feetY)
  return riser === undefined ? Infinity : Math.max(x, riser.from - halfWidth)
}

/**
 * How fast a leap of `height` carries him while he rises, in metres a
 * second, launched with his centre at `x` and his feet at `feetY`: the
 * speed that brings his front to the next riser up, the one the carry
 * faces him toward, at the apex, and never more than `LEAP_CARRY_MAX`
 * (§3.2). Null when that riser is more than `LEAP_REACH` ahead of his
 * front, or there is none: the leap is a hop, carried at walking pace.
 *
 * Aimed at the apex `gravity` gives a launch that reaches `height`. The
 * stepped arc tops out half a step later or more (`leapVelocity`), so
 * his front is at the riser a moment before the catch can take him,
 * never after, and the wall holds him there if he is early. A leap too
 * low for the catch meets the riser at its top and hops back (§3.5).
 */
export const leapCarry = (
  room: ShelfLevel,
  x: number,
  feetY: number,
  height: number,
  gravity: number,
  halfWidth = MITT_SPAN / 2,
): number | null => {
  const riser = riserAbove(room, feetY)
  if (riser === undefined || !(height > 0)) return null
  // Never behind him: a front somehow past the riser leaps straight up.
  const ahead = Math.max(0, riser.from - (x + halfWidth))
  if (ahead > LEAP_REACH + TOUCH) return null
  return Math.min(LEAP_CARRY_MAX, ahead / Math.sqrt((2 * height) / gravity))
}

/**
 * How high a stop leaps him, in metres, measured from the reference --
 * the last note held (§3.1) -- and capped at his spring. Null when it is
 * not a leap: a stop on the reference or below it only moves the
 * reference, which is what lets every leap be sung from a comfortable
 * note (§3.3, D1).
 */
export const leapHeight = (reference: number, stop: number): number | null =>
  stop > reference
    ? Math.min(MAX_LEAP, (stop - reference) * RISE_PER_SEMI)
    : null
