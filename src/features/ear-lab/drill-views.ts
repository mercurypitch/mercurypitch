// ============================================================
// Which view opens a drill — one map for every door.
//
// The catalogue in `lib/ear/drills.ts` is larger than what has a view:
// Pulse and Echo are designed but not built. The sprint, the Ascent's
// chips and the bench's Today panel all open drills by id, and they
// all read this map, so a drill without a view cannot be offered
// anywhere by accident — `drill-views.test.ts` holds the sprint list to
// it.
// ============================================================

import type { EarLabView } from './EarLabDashboard'

export const VIEW_FOR_DRILL: Readonly<Record<string, EarLabView>> = {
  hairline: 'hairline',
  home: 'home',
  'the-grid': 'grid',
  leap: 'leap',
  stack: 'stack',
  contour: 'contour',
  pulse: 'pulse',
  echo: 'echo',
  span: 'span',
  'beat-hunt': 'beat-hunt',
  drift: 'drift',
  gravity: 'gravity',
  'the-pull': 'the-pull',
}

export function viewForDrill(drillId: string): EarLabView | undefined {
  return VIEW_FOR_DRILL[drillId]
}
