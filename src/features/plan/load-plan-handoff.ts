// ============================================================
// loadPlanHandoff — the plan's hand-over, one lazy step further out
// ============================================================
//
// App hands the tours a loader for "Next on your plan" (plan-handoff.ts). Vite
// writes, beside every import(), the chunks the imported module needs, so the
// browser can fetch them together, and plan-handoff needs the app's main
// chunks (enter-stop starts tours; the menu lives in settings-store): about
// 130 chunk numbers, measured at 550 B of index.html's first paint, for a list
// only a finished tour reads. App imports this file instead. Its one import is
// a type, which the build drops, so App's import() of it carries an empty
// list, and the long one is written here, in this file's own chunk, fetched
// when a tour starts.

import type { tabHandoff } from './plan-handoff'

/** plan-handoff's offer for a tab's finished tour, once it has loaded. */
export const loadPlanHandoff = async (): Promise<typeof tabHandoff> =>
  import('./plan-handoff').then((m) => m.tabHandoff)
