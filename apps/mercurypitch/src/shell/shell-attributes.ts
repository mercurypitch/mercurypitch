// ============================================================
// What the shell says on <html> about the chrome it is drawing
// ============================================================
//
// The rail is the shell's and is portalled to <body>, so a room cannot
// measure it. A room whose own bottom bar rests ON the rail while it is
// there, and drops to the bottom edge while it has stepped aside for a song
// (the Karaoke room's zen bar, S8 D2 A), reads this attribute instead —
// the same way the kit's stylesheet reads `data-room-header` and
// `data-shell-chip`.
//
// And the session pill, which rides above the rail in the dock while a run is
// parked. It lies over the bottom of whatever scrolls under it, and a
// scroller can lift its last control out from under the pill only if it
// knows the pill is there (`data-shell-pill`, mobile-kit.css and shell.css):
// on TestFlight 0.7.1 Storage's Start fresh sat under it, out of reach.
//
// And a room drawn in Android's picture-in-picture window (the Karaoke
// room's lyrics). The window is a few centimetres across and the room's
// compact view is all it should hold, so while a room says it is in there
// (`roomInPictureInPicture`, native-shell-store.ts) the shell's stylesheet
// takes every piece of its chrome off the screen (`data-picture-in-picture`).

import { createEffect, onCleanup } from 'solid-js'
import { roomInPictureInPicture } from '@/stores/native-shell-store'
import { parked, railVisible } from './run-shell-store'

/**
 * Mirror the rail onto `data-shell-rail`, the pill onto `data-shell-pill` and
 * the small window onto `data-picture-in-picture`, for as long as the caller
 * lives.
 */
export function mirrorShellChrome(
  root: HTMLElement = document.documentElement,
): void {
  createEffect(() => {
    if (railVisible()) root.setAttribute('data-shell-rail', 'on')
    else root.removeAttribute('data-shell-rail')
  })
  createEffect(() => {
    if (parked()) root.setAttribute('data-shell-pill', 'on')
    else root.removeAttribute('data-shell-pill')
  })
  createEffect(() => {
    if (roomInPictureInPicture()) {
      root.setAttribute('data-picture-in-picture', 'on')
    } else root.removeAttribute('data-picture-in-picture')
  })
  onCleanup(() => {
    root.removeAttribute('data-shell-rail')
    root.removeAttribute('data-shell-pill')
    root.removeAttribute('data-picture-in-picture')
  })
}
