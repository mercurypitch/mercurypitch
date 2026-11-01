// ============================================================
// Premium rooms on the shell's stack: full-bleed, and held in portrait
// ============================================================
//
// A premium exercise is painted as a whole screen: the storyboards run the
// art under the status bar and the header, and show no tab rail. The owner
// decided on 13 Oct 2026:
//
//   D1  every premium room is drawn full-bleed: the pushed screen's bar
//       floats over the art with its back button and title kept legible,
//       and the rail is hidden for the whole room (run-shell-store.ts,
//       railVisible). Long note included. One switch per room, below, so
//       a room can go back under the opaque bar and keep the rail.
//   D2  a phone holds a premium room in portrait (portrait-lock.ts); an
//       iPad keeps turning, and the web does nothing. So a room keeps to
//       any screen: never taller than it, and Ng slides' bridge in a
//       column on a wide one (src/tests/premium-rooms-screen-fit.test.ts).
//
// The screen ids are the stack's own (PushedScreen); a room joins by
// adding its line here.

import type { PushedScreen } from './pushed-screen-ids'

export interface PremiumRoomScreen {
  /**
   * D1's switch for this room: true draws it under a see-through bar with
   * no rail, false puts it back under the opaque bar with the rail.
   */
  readonly fullBleed: boolean
}

export const PREMIUM_ROOM_SCREENS: Readonly<
  Partial<Record<PushedScreen, PremiumRoomScreen>>
> = {
  'long-note': { fullBleed: true },
  echo: { fullBleed: true },
  'lip-roll': { fullBleed: true },
  'ng-slides': { fullBleed: true },
  'warm-up': { fullBleed: true },
  'home-note': { fullBleed: true },
  'first-note': { fullBleed: true },
  leap: { fullBleed: true },
  // The Legend (NATIVE_LEAGUES): a line on a dark stage, its own scroller.
  legend: { fullBleed: true },
}

/** Is this screen a premium room (a phone holds it in portrait)? */
export function isPremiumRoom(screen: PushedScreen | null): boolean {
  return screen !== null && PREMIUM_ROOM_SCREENS[screen] !== undefined
}

/** Is this screen drawn full-bleed, with no rail? */
export function isFullBleed(screen: PushedScreen | null): boolean {
  return screen !== null && PREMIUM_ROOM_SCREENS[screen]?.fullBleed === true
}
