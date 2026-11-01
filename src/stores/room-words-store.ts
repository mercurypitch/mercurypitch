// ============================================================
// A room's words, kept off a screen something else is about to take
// ============================================================
//
// The native onboarding opens over the Sing room on a new install's first
// Sing door (apps/mercurypitch onboarding-layer.ts). The room mounts as the
// door's clone covers the screen, and its resting words ("Hum. The line is
// you.", Sing a note, Mic off) showed in full for the frames before the
// onboarding was drawn over them. So from the tap that picks that door the
// shell holds the room's words, and a room hides everything it draws over
// its own picture while `roomWordsHeld()`: the picture is all that shows
// until the onboarding goes. Counted, and released once, as arrival holds
// are; nothing holds them on the web.

import { createSignal } from 'solid-js'

const [wordsHolds, setWordsHolds] = createSignal(0)

/** True while the shell keeps the room's words off the screen. */
export function roomWordsHeld(): boolean {
  return wordsHolds() > 0
}

/** Hold every room's words until the returned release is called. */
export function holdRoomWords(): () => void {
  setWordsHolds((count) => count + 1)
  let released = false
  return () => {
    if (released) return
    released = true
    setWordsHolds((count) => Math.max(0, count - 1))
  }
}

/** Tests only: drop every hold on a room's words. */
export function resetRoomWordsHolds(): void {
  setWordsHolds(0)
}
