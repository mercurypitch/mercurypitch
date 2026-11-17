// ============================================================
// The tab a singer sings a song in
// ============================================================
//
// "Sing a song" closes the web's Warm-up (src/pages/ExercisesPage.tsx). The
// web's songs are the Karaoke tab's: the songs a singer split into stems,
// to sing over the band, as the native Sing room's song list holds the
// native Karaoke's. The Singing tab sings a melody's notes with no band, so
// it is the second choice, for a singer whose app does not show Karaoke:
// the simple UI keeps the practice tabs alone (constants.ts), and the app
// sends a visit to a hidden tab home with a notice (app-mode-guard.ts).

import type { ActiveTab, PracticeScope, UiMode } from './constants'
import { isTabVisible, TAB_KARAOKE, TAB_SINGING } from './constants'

/** Karaoke, or the Singing tab where the singer's app shows no Karaoke. */
export function songTab(scope: PracticeScope, mode: UiMode): ActiveTab {
  return isTabVisible(TAB_KARAOKE, scope, mode) ? TAB_KARAOKE : TAB_SINGING
}
