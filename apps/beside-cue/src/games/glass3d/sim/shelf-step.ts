// The Top Shelf, a step at a time.
// ============================================================
//
// What one fixed step of the loop does to him while he climbs
// (docs/games/top-shelf.md §3): the voice, the leap a stop fires, the
// carry toward the next shelf, the walls and the catch, the flash at the
// apex, and the grade of a leap that comes down. Out of
// `render/ShelfStage` so a room can be stepped without a canvas: the
// stage hands it the note heard and the thumb, draws what it reports,
// and keeps the rest -- the phases, the mic, the HUD, the camera.
//
// A CLIMB IS ONE ROOM, FROM ITS DOOR. A new room is a new climb, so
// nothing crosses a handover: not the reference, so a note held across
// it settles as the first stop and only readies him; not a crouch; not
// a jump banked in the buffer, which only decays inside
// `stepLocomotion` and so would outlast the beat between rooms.

import type { ShelfLevel } from '../levels/shelf'
import { groundFor, leapCarry, MITT_SPAN, riserWallAt, topsOf, } from '../levels/shelf'
import type { GroundSampler, LocomotionConfig, LocomotionState, } from './locomotion3d'
import { createLocomotion, leapVelocity, stepLocomotion } from './locomotion3d'
import type { ShelfGrade, ShelfStats } from './shelf-grade'
import { NO_LEAPS, statsOf, withLeap } from './shelf-grade'
import type { ShelfVoice } from './shelf-voice'
import { emptyVoice, intervalLabel, voiceStep } from './shelf-voice'

/** Half of him, mitt to mitt: what the walls and the floor read (6a). */
const HALF = MITT_SPAN / 2
/** How close to the exit counts as reaching it, in metres. */
const ARRIVED = 0.02
/** How fast he crouches into readiness and out of it, per second. */
const CROUCH_RATE = 12
/** A silence this long lets the crouch go. Shorter than a breath would
 * flicker him on every consonant; longer reads as not listening. */
const CROUCH_BREATH = 0.25

/** A leap in the air: what was sung, at which riser, and whether his
 * mitt has reached that riser on the way up -- which is what aims it
 * there, for the grade (§7) -- and whether its apex has flashed (§6). */
export interface Flight {
  interval: number
  riser: number
  reached: boolean
  flashed: boolean
  /** How fast it carries him while he rises, when it was fired in reach
   * of that riser (`leapCarry`, §3.2); null for a hop at walking pace. */
  carry: number | null
}

/** One room's climb: where he is, what the voice last held, and what
 * each riser's leaps came to. `stepShelf` steps it, in place. */
export interface ShelfClimb {
  readonly room: ShelfLevel
  /** Each shelf's top (`topsOf`). */
  readonly tops: readonly number[]
  readonly ground: GroundSampler
  /** His own locomotion: what the carry's pace comes back to. */
  readonly locomotion: LocomotionConfig
  /** What he is stepped with: `locomotion` walled in by the room's ends
   * and the riser ahead (`closeWalls`), at the carry's pace. */
  readonly walls: LocomotionConfig
  readonly loco: LocomotionState
  readonly voice: ShelfVoice
  /** The shelf he last stood on: 0 is the floor. */
  standingOn: number
  /** Airborne from a leap, and carried toward the next shelf (§3.2):
   * at the leap's own speed while an aimed one rises, else at walking
   * pace. A step off a low edge is not carried. */
  carrying: boolean
  /** Where the carry goes on to after a leap lands him on a higher
   * shelf: all of him past its lip. The catch takes him by the mitts
   * with most of him still over the drop, and left there he reads as
   * perched on the edge; "he is on" (§3.4) is a step onto it. */
  boardTo: number | null
  /** The last stop only moved the reference, on the ground: he is
   * crouched, readying, while the note that did it is held. */
  readying: boolean
  /** How far into that crouch he is, 0 to 1 (`easeCrouch`). */
  crouch: number
  /** Seconds of silence, for letting the crouch go. */
  silentFor: number
  /** Leaps launched this room, and the highest the last one got him,
   * for the dev hook: what a test checks a stop did. */
  leaps: number
  apex: number
  /** The leap in the air, or null on the ground. */
  flight: Flight | null
  /** What each riser's leaps came to: riser k's at k - 1 (§7). */
  readonly grades: ShelfGrade[]
}

/** The nearest riser his mitts cannot catch is the wall, and the room's
 * far end past the last one. Never behind him (`riserWallAt`). */
export const closeWalls = (climb: ShelfClimb): void => {
  climb.walls.maxX = Math.min(
    climb.room.length - HALF,
    riserWallAt(climb.room, climb.loco.x, climb.loco.y, HALF),
  )
}

/** A climb of `room` from its door: him at the start line, no reference
 * yet, nothing graded, and the wall at the first riser. */
export const createClimb = (
  room: ShelfLevel,
  locomotion: LocomotionConfig,
): ShelfClimb => {
  const climb: ShelfClimb = {
    room,
    tops: topsOf(room),
    ground: groundFor(room, HALF),
    locomotion,
    walls: { ...locomotion, minX: HALF, maxX: room.length - HALF },
    loco: createLocomotion(room.startX),
    voice: emptyVoice(),
    standingOn: 0,
    carrying: false,
    boardTo: null,
    readying: false,
    crouch: 0,
    silentFor: 0,
    leaps: 0,
    apex: 0,
    flight: null,
    grades: room.shelves.slice(1).map(() => NO_LEAPS),
  }
  closeWalls(climb)
  return climb
}

/**
 * Fire a leap from where he stands: `height` metres, for a stop sung
 * `interval` semitones above the reference. Pass the loop's own step,
 * so the stepped apex is the height the interval asked for to a
 * twentieth of a millimetre (6a).
 */
export const launch = (
  climb: ShelfClimb,
  leap: { readonly height: number; readonly interval: number },
  stepSeconds: number,
): void => {
  const { loco } = climb
  loco.vy = leapVelocity(leap.height, climb.locomotion, stepSeconds)
  // Aimed, in reach of the riser ahead: carried at the speed that
  // brings his front to it at the apex, so where he stood never
  // decides whether it lands (§3.2). Further out, a hop.
  const carry = leapCarry(
    climb.room,
    loco.x,
    loco.y,
    leap.height,
    climb.locomotion.gravity,
    HALF,
  )
  if (carry !== null) loco.vx = carry
  loco.grounded = false
  climb.carrying = true
  climb.boardTo = null
  climb.readying = false
  climb.leaps += 1
  climb.apex = loco.y
  climb.flight = {
    interval: leap.interval,
    riser: climb.standingOn + 1,
    reached: false,
    flashed: false,
    carry,
  }
}

/** Which shelf a height is the top of. Exact: the floor under him is
 * always one of these very numbers (`groundFor`). */
const shelfAt = (climb: ShelfClimb, y: number): number => {
  const i = climb.tops.findIndex((t) => Math.abs(t - y) < 1e-6)
  return i < 0 ? climb.standingOn : i
}

/** A leap has come down, on shelf `on`. It was aimed at its riser if it
 * reached it on the way up or landed past it, and then it is graded
 * (§7); a hop in the open, short of any riser, is aimed at nothing. */
const grade = (climb: ShelfClimb, f: Flight, on: number): void => {
  const target = climb.room.shelves[f.riser]
  if (target === undefined) return
  const up = on >= f.riser
  if (!up && !f.reached) return
  const i = f.riser - 1
  climb.grades[i] = withLeap(climb.grades[i]!, f.interval, target.rise, up)
}

/** What a step did that the stage shows. */
export interface ShelfStep {
  /** A leap's apex, on the step it is reached: where its line flashes
   * over the ruler, and what it says (§6). */
  readonly flash: {
    readonly x: number
    readonly y: number
    readonly label: string
  } | null
  /** Grounded on the top shelf, at the exit: the room is climbed. */
  readonly arrived: boolean
}

/**
 * One fixed step of the climb: the note heard, or null when none is sure
 * enough to count; the thumb, -1 to 1, which the carry overrides; and
 * the loop's step, in seconds.
 */
export const stepShelf = (
  climb: ShelfClimb,
  sure: number | null,
  thumb: number,
  dt: number,
): ShelfStep => {
  const { loco, room } = climb
  // The voice first: a stop this step launches him this step, from
  // where he stands.
  const heard = voiceStep(climb.voice, sure, dt, loco.grounded)
  if (heard?.kind === 'leap') launch(climb, heard, dt)
  else if (heard?.kind === 'ready') climb.readying = true
  climb.silentFor = sure === null ? climb.silentFor + dt : 0
  if (climb.voice.slide.moving || climb.silentFor > CROUCH_BREATH) {
    climb.readying = false
  }

  closeWalls(climb)
  // The carry: airborne from a leap he drifts toward the next shelf
  // whatever the thumb is doing (§3.2) -- at the leap's own speed while
  // an aimed one rises, at walking pace after its apex and for a hop --
  // and on across the lip of the one it lands him on.
  const aim = climb.flight?.carry ?? null
  climb.walls.walkSpeed =
    aim !== null && loco.vy > 0 ? aim : climb.locomotion.walkSpeed
  const move = climb.carrying || climb.boardTo !== null ? 1 : thumb
  stepLocomotion(loco, { move, jump: false }, climb.ground, dt, climb.walls)

  let flash: ShelfStep['flash'] = null
  const { flight } = climb
  if (flight !== null) {
    // The highest he got in the air: never the step the catch takes him
    // on, which lifts him onto the lip, a height he did not reach.
    if (!loco.grounded) climb.apex = Math.max(climb.apex, loco.y)
    // His mitt at the riser on the way up: the leap is aimed at that
    // shelf. A hop that only meets it falling, past its apex, is not.
    const target = room.shelves[flight.riser]
    if (
      !flight.flashed &&
      target !== undefined &&
      loco.x >= target.from - HALF - 1e-3
    ) {
      flight.reached = true
    }
    // The apex is the step his climb stopped on -- or the one the catch
    // took him on, which for a leap that lands is the same step (§11,
    // 6b). Its line goes at the height reached (§6).
    if (!flight.flashed && loco.vy <= 0) {
      flight.flashed = true
      // Past the apex the carry is walking pace (§3.2). The pace drops
      // there, but the aimed speed would only ease off at his
      // acceleration and carry on through the landing, over the thumb.
      const pace = climb.locomotion.walkSpeed
      loco.vx = Math.max(-pace, Math.min(pace, loco.vx))
      flash = {
        x: target === undefined ? loco.x + HALF : target.from,
        y: climb.apex,
        label: intervalLabel(flight.interval),
      }
    }
  }
  if (loco.grounded) {
    const on = shelfAt(climb, loco.y)
    if (flight !== null) grade(climb, flight, on)
    if (climb.carrying && on > climb.standingOn) {
      climb.boardTo = room.shelves[on]!.from + HALF
    }
    climb.carrying = false
    climb.flight = null
    climb.standingOn = on
    if (
      climb.boardTo !== null &&
      loco.x >= Math.min(climb.boardTo, climb.walls.maxX) - 1e-6
    ) {
      climb.boardTo = null
    }
  } else {
    climb.readying = false
  }

  return {
    flash,
    arrived:
      loco.grounded &&
      climb.standingOn === room.shelves.length - 1 &&
      loco.x >= room.exitX - ARRIVED,
  }
}

/** The room is climbed: what its leaps came to, in §7's units. He
 * stands up out of any crouch as it is: readying only changes inside a
 * step, the stage steps no more after this, and `easeCrouch` goes on. */
export const finishRoom = (climb: ShelfClimb): ShelfStats => {
  climb.readying = false
  return statsOf(climb.grades)
}

/** The crouch, eased toward readying over a frame of `seconds`. A frame,
 * not a step: the stage eases it between rooms and after the last, when
 * no step runs. */
export const easeCrouch = (climb: ShelfClimb, seconds: number): void => {
  climb.crouch +=
    ((climb.readying ? 1 : 0) - climb.crouch) *
    (1 - Math.exp(-CROUCH_RATE * seconds))
}
