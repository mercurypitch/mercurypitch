// ============================================================
// Lesson page fixture — the learn specs' `test`, with the welcome tour already closed
// ============================================================
//
// A first visit to a lesson page opens the welcome tour over it
// (kit/tour-gate.ts), and every spec's browser is a first visit. The tour is
// not what those specs measure, and its dimmed sheet would take every press
// they make, so this `test` writes the tour's record before each document
// loads, as the app's specs mark their own tour offers seen
// (helpers/mixer-song.ts). It is written on every load, so a spec that
// clears the storage and reloads still never meets the tour. The tour's own
// spec, learn-lesson-tour.spec.ts, imports Playwright's `test` and starts
// clean.

import { test as base } from '@playwright/test'
import { TOUR_KEY, TOUR_VERSION } from '../../features/lessons/kit/tour-gate'

export { expect } from '@playwright/test'

export const test = base.extend<{ tourClosed: undefined }>({
  tourClosed: [
    async ({ page }, use) => {
      await page.addInitScript(
        ([k, v]) => {
          try {
            localStorage.setItem(k, v)
          } catch {
            // a document with no storage (about:blank) has no tour either
          }
        },
        [TOUR_KEY, TOUR_VERSION] as const,
      )
      await use(undefined)
    },
    { auto: true },
  ],
})
