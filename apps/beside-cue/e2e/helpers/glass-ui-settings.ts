// Shared game settings navigation — exercise the actual modal and live camera preview paths.
import type { Page } from '@playwright/test'

export async function openGameSettings(
  page: Page,
  section?: 'Sound' | 'Play' | 'Display' | 'Advanced',
): Promise<void> {
  await page.getByRole('button', { name: 'Open settings', exact: true }).click()
  if (section !== undefined)
    await page.getByRole('tab', { name: section, exact: true }).click()
}

export async function openCameraPreview(page: Page): Promise<void> {
  await openGameSettings(page, 'Advanced')
  await page
    .getByRole('button', { name: 'Preview camera', exact: true })
    .click()
}
