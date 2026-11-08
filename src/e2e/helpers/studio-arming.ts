// Studio arming for browser tests — the transport's Record button, a lane's arm button, arming a lane until its microphone is open, recording a take, and a lane's input chosen in its Track details.
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
 * Record about two seconds on the armed lanes with R, doing `during` once
 * the take is two seconds in; resolves once each lane's take is kept as
 * `title`, `lanes` of them.
 */
export async function recordTake(
  page: Page,
  title: string,
  during: () => Promise<void> = async () => undefined,
  lanes = 1,
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
  ).toHaveCount(lanes)
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible({ timeout: 30_000 })
}

/** Choose `option` in the lane's Track details, then close them. */
export async function setLaneInput(
  page: Page,
  lane: string,
  field: 'Input' | 'Channel',
  option: string,
): Promise<void> {
  const studio = studioRegion(page)
  await studio
    .getByRole('button', { name: `${lane} details`, exact: true })
    .click()
  await studio
    .getByRole('combobox', { name: field, exact: true })
    .selectOption({ label: option })
  await studio
    .getByRole('button', { name: 'Close Track details', exact: true })
    .click()
}
