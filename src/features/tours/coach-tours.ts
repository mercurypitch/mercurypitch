// ============================================================
// Coach tours — which tab has a Merc tour, loaded when it starts
// ============================================================
//
// The main app's registry of Merc tours by tab. A tab listed here offers its
// Merc tour where it would offer its legacy spotlight tour (TourChipHost).
// Each entry carries the tour's key, so the offer can be reported before the
// tour's own module has loaded, and a loader, so no tour's steps reach a
// page's first paint. Tours are web only, as the legacy ones are
// (TOURS_AVAILABLE): the native build lists none.

import type { CoachTour } from '@/lib/coach-types'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import type { TourKey } from '@/lib/tour-ids'
import type { ActiveTab } from '@/types'

export interface CoachTourEntry {
  key: TourKey
  /** The tour as a question before it names it: "Merc's Singing tour". */
  name: string
  load: () => Promise<CoachTour>
}

const WEB_TOURS: Partial<Record<ActiveTab, CoachTourEntry>> = {
  singing: {
    key: 'sing',
    name: "Merc's Singing tour",
    load: async () =>
      import('@/features/practice/sing-tour').then((m) => m.SING_TOUR),
  },
}

export const COACH_TOURS: Partial<Record<ActiveTab, CoachTourEntry>> =
  IS_NATIVE_BUILD ? {} : WEB_TOURS
