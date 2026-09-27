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

import { createEffect, onCleanup } from 'solid-js'
import { railVisible } from './run-shell-store'

/** Mirror the rail onto `data-shell-rail`, for as long as the caller lives. */
export function mirrorShellChrome(
  root: HTMLElement = document.documentElement,
): void {
  createEffect(() => {
    if (railVisible()) root.setAttribute('data-shell-rail', 'on')
    else root.removeAttribute('data-shell-rail')
  })
  onCleanup(() => {
    root.removeAttribute('data-shell-rail')
  })
}
