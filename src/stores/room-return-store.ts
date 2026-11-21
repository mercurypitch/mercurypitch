// ============================================================
// Room return store — a room the Exercises tab comes back to
// ============================================================
//
// The Exercises tab keeps its place, as a tab bar does: an exercise left
// open by a switch to another tab is open again when the tab comes back,
// since the selected exercise is the app's (App.tsx). The tab's page is
// made anew on that return, and so is the room on it, and a room's first
// visit used to play Merc's demo again by itself (useExerciseDemo's
// auto-play) for a singer who had watched it, or walked away from it, a
// moment before. 0.9.31's review found it in all eight rooms.
//
// So the tab says what it held as it went (`exercisesTabLeft`), and as it
// comes back whether it shows that same exercise (`exercisesTabShown`).
// While that room is up, `isRoomReturn` is true and the demo kit does not
// start a demo by itself; "How it works" still plays it on demand. Every
// fresh way in, the room's card, a link, a share or a drill's launch,
// calls `exerciseEntered`, and its demo plays as it always has.
//
// Module state rather than a signal: the demo kit asks once, as a room
// mounts, and nothing redraws on it.

/** What the Exercises tab held when the singer went to another tab. */
let leftOpen: string | null = null
/** The exercise on the tab now is the one it held when it went. */
let returning = false

/** The Exercises tab goes, with `open` on it; null is the tab's list. */
export function exercisesTabLeft(open: string | null): void {
  leftOpen = open
  returning = false
}

/**
 * The Exercises tab is shown, with `open` on it. True, and a return for
 * as long as that exercise stays, when it is the one the tab held as it
 * went.
 */
export function exercisesTabShown(open: string | null): boolean {
  returning = open !== null && open === leftOpen
  leftOpen = null
  return returning
}

/**
 * An exercise is opened afresh, by its card, a link, a share or a launch:
 * not a return, whatever the tab held before.
 */
export function exerciseEntered(): void {
  leftOpen = null
  returning = false
}

/** The room on screen is one the Exercises tab came back to. */
export function isRoomReturn(): boolean {
  return returning
}
