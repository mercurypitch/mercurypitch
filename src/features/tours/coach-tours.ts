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

import { IS_NATIVE_BUILD } from '@/lib/native-build'
import type { TourKey } from '@/lib/tour-ids'
import type { ActiveTab } from '@/types'
import type { CoachTour } from './coach/types'

export interface CoachTourEntry {
  key: TourKey
  load: () => Promise<CoachTour>
}

const WEB_TOURS: Partial<Record<ActiveTab, CoachTourEntry>> = {}

export const COACH_TOURS: Partial<Record<ActiveTab, CoachTourEntry>> =
  IS_NATIVE_BUILD ? {} : WEB_TOURS
