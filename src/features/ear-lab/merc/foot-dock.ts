// ============================================================
// The drill room's console as a dock at the window's foot, on the web.
//
// On the web a notice from the app is a toast, and a phone's toasts stand
// at the window's foot, where the room's console is. So the room says how
// much of the foot its console takes, as a page's docked transport does,
// and the toasts stand on it (src/lib/foot-space.ts,
// src/styles/Notifications.module.css). What is measured is what lies
// under the stage: the console is one of two (the answer's and the
// plate's), the stage one element, and the cookie bar's room under the
// console is counted with it. The native app says a notice in its own
// pill, at the top, and publishes nothing.
// ============================================================

import { publishFootSpace } from '@/lib/foot-space'
import { IS_NATIVE_BUILD } from '@/lib/native-build'

/** What the toasts on a phone stand on, beside the app's own bars. */
export const PAGE_DOCK_SPACE = '--page-dock-space'

/** The room's stage, as a `ref`: publishes what stands under it for as
 *  long as the room is up. */
export function dock(stage: HTMLElement): void {
  if (!IS_NATIVE_BUILD) publishFootSpace(stage, PAGE_DOCK_SPACE, 'below')
}
