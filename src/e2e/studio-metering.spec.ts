// Studio live-meter proof — native worklet windows, visible hold reset and revision-bound master readiness.
import { expect, test } from '@playwright/test'
import { importStudioAudio, openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

test('Studio measures audible output and clears measured-master status after an edit @smoke', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openArrangement(page)
  await importStudioAudio(page, 'Long phrase', 8)
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect(
    studio.getByText(
      'Preview levels. Export or Compare measures the whole song.',
      { exact: true },
    ),
  ).toBeVisible()
  const windows = studio.getByLabel('Live loudness').last().locator('dd')
  await expect(windows.nth(0)).toHaveText('—')
  await expect(windows.nth(1)).toHaveText('—')
  await studio.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect(windows.nth(0)).toHaveText(/^-?\d+\.\d$/, { timeout: 10_000 })
  await expect(windows.nth(1)).toHaveText(/^-?\d+\.\d$/, { timeout: 10_000 })
  const holds = studio
    .getByRole('meter', { name: 'Output sample peak' })
    .last()
    .locator('b')
  const before = await holds
    .first()
    .evaluate((element) => parseFloat((element as HTMLElement).style.left))
  expect(before).toBeGreaterThan(0)
  await studio
    .getByRole('button', { name: 'Reset peak hold', exact: true })
    .click()
  await expect
    .poll(() =>
      holds
        .first()
        .evaluate((element) => parseFloat((element as HTMLElement).style.left)),
    )
    .toBeLessThan(before - 0.1)
  await expect(
    studio.getByRole('button', { name: 'Pause song', exact: true }),
  ).toBeVisible()
  await studio.getByRole('button', { name: 'Pause song', exact: true }).click()
  await studio.getByRole('button', { name: 'Close Sound', exact: true }).click()
  await studio.getByRole('button', { name: 'Export', exact: true }).click()
  await studio.getByRole('button', { name: 'Export WAV', exact: true }).click()
  await expect(
    studio.getByRole('button', { name: 'Download WAV', exact: true }),
  ).toBeVisible({ timeout: 90_000 })
  await studio
    .getByRole('button', { name: 'Close Export', exact: true })
    .click()
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect(
    studio.getByText('Playback uses measured master settings.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    studio.getByRole('button', { name: 'Play song', exact: true }),
  ).toBeVisible()
  await studio.getByRole('button', { name: 'Close Sound', exact: true }).click()
  await studio
    .getByRole('button', { name: 'Song options', exact: true })
    .click()
  const title = studio.getByRole('textbox', {
    name: 'Project name',
    exact: true,
  })
  await title.fill('New arrangement revision')
  await title.press('Tab')
  await studio.getByRole('button', { name: 'Close Song', exact: true }).click()
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect(
    studio.getByText(
      'Preview levels. Export or Compare measures the whole song.',
      { exact: true },
    ),
  ).toBeVisible()
})
