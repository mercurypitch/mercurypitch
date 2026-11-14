// ============================================================
// Studio velocity lane — where a note's lollipop stands in the note editor's velocity lane: one geometry for the lane that draws it and the press that takes it
// ============================================================
//
// A lollipop stands 4 px right of its note's start, on the roll's time
// axis: a stick from the lane's foot, 10 px over its bottom, up to the
// note's velocity, and a head 4 px across on top; velocity 1 reaches 8 px
// under the lane's top, as C's roll first drew it. note-roll-frame.ts draws
// from these numbers and edit-velocity.ts picks from them, so the head a
// finger aims at is the head it takes. y counts down from the lane's top,
// x across the roll's grid.
import type { RollViewport } from '@/lib/roll-geometry'
import { timeToX } from '@/lib/roll-geometry'

/** The room under a stick, and over a full one. */
export const VELOCITY_FOOT = 10
export const VELOCITY_HEAD = 8
/** A lollipop's head, and how far right of its note's start it stands. */
export const VELOCITY_CAP_RADIUS = 4
export const VELOCITY_INSET = 4

/** How many pixels velocity 0 to 1 spans in a lane `height` tall. */
export function velocityReach(height: number): number {
  return Math.max(1, height - VELOCITY_FOOT - VELOCITY_HEAD)
}

/** Where a head for `velocity` stands, down from the lane's top. */
export function velocityLaneY(velocity: number, height: number): number {
  return height - VELOCITY_FOOT - velocity * velocityReach(height)
}

/** Where the lollipop of a note starting on `tick` stands across the grid. */
export function velocityLaneX(tick: number, viewport: RollViewport): number {
  return timeToX(tick, viewport) + VELOCITY_INSET
}

/** How many of 127 steps a drag `dy` pixels up a lane `height` tall moves a velocity. */
export function velocitySteps(dy: number, height: number): number {
  return Math.round((dy / velocityReach(height)) * 127)
}
