// ============================================================
// Daily-goal readout — live, not read-once
// ============================================================
//
// Home used to read the scored minutes once per mount and lean on the tab
// switch to remount it. Finish a run while Home stays open — a routine
// auto-continuing in another tab of the mind, a drill launched from the
// ribbon — and "N of 5 min" sat frozen until the next navigation. The
// readout now tracks the session-record version the services bump on
// every persisted run, the same signal Progress already subscribes to.

import type { Accessor } from 'solid-js'
import { createMemo } from 'solid-js'
import { DAILY_GOAL_MS, getTodayScoredMinutes, } from '@/db/services/practice-minutes'
import { sessionRecordVersion } from '@/db/services/session-service'

export const DAILY_GOAL_MIN = Math.round(DAILY_GOAL_MS / 60_000)

export interface DailyGoalProgress {
  minutes: number
  met: boolean
  pct: number
}

/**
 * Reactive daily-goal progress: recomputes when a session record lands
 * (sessionRecordVersion), so the bar moves while Home stays mounted.
 */
export function createDailyGoalProgress(): Accessor<DailyGoalProgress> {
  const progress = createMemo(() => {
    sessionRecordVersion()
    const minutes = getTodayScoredMinutes()
    return {
      minutes,
      met: minutes >= DAILY_GOAL_MIN,
      pct: Math.min(100, Math.round((minutes / DAILY_GOAL_MIN) * 100)),
    }
  })
  return progress
}
