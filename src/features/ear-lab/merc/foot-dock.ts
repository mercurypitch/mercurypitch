// ============================================================
// The drill room and the app's notices, on the web: the pill under its
// header, and its console as a dock at the window's foot.
//
// On the web a notice from the app was a toast over the room: on a wide
// window over its "?" for as long as it showed, and on a phone at the
// window's foot, just above the console, over the pads and the "End the
// run?" question. While the room is up it is said in the pill under the
// room's header instead, one at a time and on no control, as the web's
// exercise rooms say theirs under their bar (`noticesUnder`, the store's
// `presentNoticesInPill`), and the toasts draw nothing.
//
// The room still says how much of the foot its console takes, as a page's
// docked transport does, so a toast that ever stands there stands on it
// (src/lib/foot-space.ts, src/styles/Notifications.module.css). What is
// measured is what lies under the stage: the console is one of two (the
// answer's and the plate's), the stage one element, and the cookie bar's
// room under the console is counted with it.
//
// The native app says a notice in its own pill, at the top, and its shell
// already holds the pill there: it publishes nothing and holds nothing.
// ============================================================

import { onCleanup } from 'solid-js'
import { publishFootSpace } from '@/lib/foot-space'
import { IS_NATIVE_BUILD, WEB_ROOMS } from '@/lib/native-build'
import { presentNoticesInPill } from '@/stores/notifications-store'

/** What the toasts on a phone stand on, beside the app's own bars. */
export const PAGE_DOCK_SPACE = '--page-dock-space'

/** The room's stage, as a `ref`: publishes what stands under it for as
 *  long as the room is up. */
export function dock(stage: HTMLElement): void {
  if (!IS_NATIVE_BUILD) publishFootSpace(stage, PAGE_DOCK_SPACE, 'below')
}

/**
 * Say the app's notices in the pill under the header the returned ref is
 * given, for as long as the calling owner lives: on the web alone.
 */
export function noticesUnder(): (header: HTMLElement) => void {
  let under: HTMLElement | undefined
  if (WEB_ROOMS) onCleanup(presentNoticesInPill(() => under))
  return (header) => {
    under = header
  }
}
