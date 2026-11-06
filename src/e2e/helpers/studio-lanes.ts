// Studio lane height for browser tests — tall lanes hold each header's Lines toggle, fader and pan knob.
import type { Page } from '@playwright/test'

/** Tall lanes from the first load: the device's choice, set before the Studio reads it. */
export async function tallStudioLanes(page: Page): Promise<void> {
  await page.addInitScript(() =>
    localStorage.setItem('mercurypitch.studio.lane-height', 'tall'),
  )
}
