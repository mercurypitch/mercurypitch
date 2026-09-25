// ============================================================
// The App Mode guard: where a hidden tab is sent
// ============================================================
//
// On the web, a tab the practice scope or the UI mode hides is bounced to the
// scope's home tab (with a toast once the app has settled): the bar does not
// offer it, so a deep link or a stale hash must not land on it either.
//
// NEVER UNDER THE NATIVE BUILD. The native shell owns reachability: its rail
// is fixed (it never consults `isTabVisible`) and the alley's doors reach
// their rooms whatever "I practice" says. Under a Guitar scope the guard
// bounced the Sing door's room back to the alley under the door's clone, with
// the "hidden by your App Mode settings" toast.

import type { ActiveTab, PracticeScope, UiMode } from './constants'
import { isTabVisible, scopeHomeTab } from './constants'

/** The tab to send `tab` to, or null to leave it where it is. */
export function appModeBounce(
  tab: ActiveTab,
  scope: PracticeScope,
  mode: UiMode,
  native: boolean,
): ActiveTab | null {
  if (native) return null
  return isTabVisible(tab, scope, mode) ? null : scopeHomeTab(scope)
}
