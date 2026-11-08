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

/**
 * Record about two seconds on the armed lane with R, doing `during` once
 * the take is two seconds in; resolves once the take is kept as `title`.
 */
export async function recordTake(
  page: Page,
  title: string,
  during: () => Promise<void> = async () => undefined,
): Promise<void> {
  const studio = studioRegion(page)
  await studio.locator('[data-tour="studio.workspace"]').focus()
  await page.keyboard.press('r')
  await expect(recordButton(page)).toHaveAccessibleName('Stop recording', {
    timeout: 10_000,
  })
  await expect(studio.getByRole('timer')).toHaveText(/^0:0[2-9]/, {
    timeout: 10_000,
  })
  await during()
  await page.keyboard.press('r')
  await expect(recordButton(page)).toHaveAccessibleName('Record', {
    timeout: 30_000,
  })
  await expect(
    studio.getByRole('button', { name: new RegExp(`, ${title}\\.wav, `) }),
  ).toHaveCount(1)
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible({ timeout: 30_000 })
}
