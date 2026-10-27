// ============================================================
// room-tour-door: a tab's tour, started from outside the tours
// ============================================================
//
// First Light's Map and the plan's Start here, after the showcase, open a tab
// with its tour, and the tours decide which kind it gets: Merc's where the tab
// has one, else the room's tour of the Guide's kind, its spotlight tour or for
// Singing the Guide's Singing section (startRoomTour, in
// src/features/tours/room-tour.ts). They start it through this door instead
// of importing the tours, and the Map asks it whether a room has a tour
// before it draws the room's tour link (hasRoomTour, beside startRoomTour).
// App hands the door both as it draws (provideRoomTourDoor), as it hands the
// tours the plan's handoff, so neither feature imports the other.
//
// Until App hands them in, a tour asked for here starts nothing and no room
// has one: only a test that draws no App, or a page without one, gets that
// far.

import type { ActiveTab } from '@/types'

/** What starts a tab's tour. */
export type RoomTourStarter = (tab: ActiveTab) => void

/** Whether a tab has a tour to start. */
export type RoomTourCheck = (tab: ActiveTab) => boolean

let starter: RoomTourStarter | null = null
let check: RoomTourCheck | null = null

/** Hands in what starts a tab's tour and what says it has one. App does, as it draws. */
export function provideRoomTourDoor(
  start: RoomTourStarter,
  has: RoomTourCheck,
): void {
  starter = start
  check = has
}

/** Starts `tab`'s tour, whichever kind it has, through what App handed in. */
export function startTabTour(tab: ActiveTab): void {
  starter?.(tab)
}

/** Whether `tab` has a tour the door can start; false until App hands one in. */
export function hasTabTour(tab: ActiveTab): boolean {
  return check?.(tab) ?? false
}
