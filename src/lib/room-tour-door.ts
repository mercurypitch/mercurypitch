// ============================================================
// room-tour-door: a tab's tour, started from outside the tours
// ============================================================
//
// First Light's Map and the plan's Start here, after the showcase, open a tab
// with its tour, and the tours decide which kind it gets: Merc's where the tab
// has one, else its spotlight tour (startRoomTour, in
// src/features/tours/room-tour.ts). They start it through this door instead
// of importing the tours. App hands the door its starter as it draws
// (provideRoomTourDoor), as it hands the tours the plan's handoff, so neither
// feature imports the other.
//
// Until a starter is handed in, a tour asked for here starts nothing: only a
// test that draws no App, or a page without one, gets that far.

import type { ActiveTab } from '@/types'

/** What starts a tab's tour. */
export type RoomTourStarter = (tab: ActiveTab) => void

let starter: RoomTourStarter | null = null

/** Hands in what starts a tab's tour. App does, as it draws. */
export function provideRoomTourDoor(start: RoomTourStarter): void {
  starter = start
}

/** Starts `tab`'s tour, whichever kind it has, through what App handed in. */
export function startTabTour(tab: ActiveTab): void {
  starter?.(tab)
}
