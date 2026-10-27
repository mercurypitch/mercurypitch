// ============================================================
// loadPlanSettings — Settings' "Your plan", one lazy step further out
// ============================================================
//
// Settings' page (src/pages/SettingsPage.tsx) loads the plan's section lazily,
// and Vite writes, beside every import(), the chunks the imported module
// needs, so the browser can fetch them together. PlanSettings needs the app's
// main chunks (the store's settings, Settings' own sheet), about 130 chunk
// numbers, which cost index.html's first paint 478 B (measured: the section
// added 1,276 B with the list, 798 B without it), for a section only the
// General tab draws. The page imports this file instead, as App imports
// load-plan-handoff.ts: its one import is a type, which the build drops, so
// the page's import() of it carries an empty list, and the long one is
// written here, in this file's own chunk, fetched when Settings draws.

import type { PlanSettings } from './PlanSettings'

/** The plan's section of Settings, once it has loaded. */
export const loadPlanSettings = async (): Promise<typeof PlanSettings> =>
  import('./PlanSettings').then((m) => m.PlanSettings)
