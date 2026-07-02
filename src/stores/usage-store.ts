// ============================================================
// Usage store — lightweight cumulative "has really used the app" tracking
// ============================================================
//
// Persists two coarse signals across sessions:
//  - usageMs: foreground time in the app (counted in ticks while the tab is
//    visible), across all visits.
//  - activityCount: real practice actions (playback started, practice session
//    or exercise finished) — a proxy for "did more than open the app".
//
// Consumers (e.g. the onboarding survey) gate on these instead of firing the
// moment a first-time visitor closes the welcome screen.

import { createPersistedSignal } from '@/lib/storage'

/** Cumulative foreground time in the app across sessions (ms). */
export const [usageMs, setUsageMs] = createPersistedSignal<number>(
  'pitchperfect_usage_ms',
  0,
)

/** Count of real practice/playback activities across sessions. */
export const [activityCount, setActivityCount] = createPersistedSignal<number>(
  'pitchperfect_activity_count',
  0,
)

/** Record one real activity (a playback start, a finished session/exercise). */
export const recordActivity = (): void => {
  setActivityCount((c) => c + 1)
}

const TICK_MS = 15_000

let tracking = false

/** Start the foreground-time ticker (idempotent; call once at app mount). */
export function startUsageTracking(): void {
  if (tracking || typeof document === 'undefined') return
  tracking = true
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      setUsageMs((v) => v + TICK_MS)
    }
  }, TICK_MS)
}
