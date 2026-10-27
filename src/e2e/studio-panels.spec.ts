// Studio panels — each top-bar button closes the panel it opened, X opens and closes Mix but stays a letter in a text field, and a take added from Mix returns to Mix.
import { expect, test } from '@playwright/test'
import { audioFixture, importStudioAudio, openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

test('Studio top-bar buttons close their own panels, X toggles Mix outside text fields, and a take added from Mix returns to Mix @smoke', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  const studio = studioRegion(page)

  for (const name of ['Add takes', 'Mix', 'Sound', 'Export']) {
    const button = studio.getByRole('button', { name, exact: true })
    await button.click()
    await expect(button, name).toHaveAttribute('aria-expanded', 'true')
    await button.click()
    await expect(button, name).toHaveAttribute('aria-expanded', 'false')
  }

  const mix = studio.getByRole('button', { name: 'Mix', exact: true })
  await expect(mix).toHaveAttribute('aria-keyshortcuts', 'X')
  await expect(mix).toHaveAttribute('title', 'Mix (X)')
  const desk = studio.getByRole('region', { name: 'Mix', exact: true })
  await mix.focus()
  await page.keyboard.press('x')
  await expect(desk).toBeVisible()
  await page.keyboard.press('x')
  await expect(desk).toHaveCount(0)

  // In a text field, X is a letter.
  await studio
    .getByRole('button', { name: 'Song options', exact: true })
    .click()
  const name = studio.getByRole('textbox', {
    name: 'Project name',
    exact: true,
  })
  await name.focus()
  await page.keyboard.press('End')
  await page.keyboard.press('x')
  await expect(name).toHaveValue(/x$/)
  await expect(mix).toHaveAttribute('aria-expanded', 'false')

  // Add takes from an open desk, and the desk comes back with the take in.
  await mix.click()
  await expect(desk).toBeVisible()
  await studio.getByRole('button', { name: 'Add takes', exact: true }).click()
  await expect(desk).toHaveCount(0)
  await studio.getByLabel('Upload audio', { exact: true }).setInputFiles({
    name: 'Harmony.wav',
    mimeType: 'audio/wav',
    buffer: audioFixture(2),
  })
  await expect(
    studio.getByRole('button', { name: 'Harmony details', exact: true }),
  ).toBeVisible()
  await expect(desk).toBeVisible()
  await expect(mix).toHaveAttribute('aria-expanded', 'true')
  // With the desk open, a take still lands and the desk stays.
  await importStudioAudio(page, 'Keys', 2)
  await expect(desk).toBeVisible()
})
