// Studio arming for browser tests — the transport's Record button, a lane's arm button, and arming a lane until its microphone is open.
import { expect, type Locator, type Page } from '@playwright/test'
import { studioRegion } from './dedicatedstudio-fixture'

/** The transport's Record button, the one shown in this layout. */
export function recordButton(page: Page): Locator {
  return studioRegion(page).locator('[data-studio-record]:visible')
}

export function armButton(page: Page, lane: string): Locator {
  return studioRegion(page).getByRole('button', {
    name: `Arm ${lane} for recording`,
    exact: true,
  })
}

/** Arm `lane` from its header's arm button; resolves once its microphone is open. */
export async function armLane(page: Page, lane: string): Promise<void> {
  await armButton(page, lane).click()
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
    timeout: 15_000,
  })
  await expect(armButton(page, lane)).toHaveAttribute('aria-pressed', 'true')
}
