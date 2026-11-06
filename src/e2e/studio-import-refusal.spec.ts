// Studio import refusals — a file Studio cannot take is refused in a notice of its own that names the limit in words, apart from the save-failure banner and its ways out, and the notice can be dismissed.
import { expect, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { steadyWav } from './helpers/studio-output'

test.use({ viewport: { width: 1440, height: 900 } })

test('refuses a file over five minutes in a notice of its own that names the limit, and dismisses it @smoke', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openArrangement(page)
  const studio = studioRegion(page)

  // Five and a half minutes of mono 48 kHz: under 64 MB, over the length limit.
  await studio.getByLabel('Upload audio', { exact: true }).setInputFiles({
    name: 'Long.wav',
    mimeType: 'audio/wav',
    buffer: steadyWav(330, [220], 0.2),
  })

  const refusal = studio.locator('[data-studio-import-refusal]')
  await expect(refusal).toContainText(
    'This audio is over the 5-minute Studio import limit. Choose a shorter file.',
    { timeout: 30_000 },
  )
  await expect(refusal).toHaveAttribute('role', 'alert')
  // Nothing failed to save: the save banner and its ways out stay away.
  for (const action of [
    'Make a copy',
    'Save project backup',
    'Discard changes and reload',
  ])
    await expect(
      studio.getByRole('button', { name: action, exact: true }),
    ).toHaveCount(0)
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible()

  await refusal.getByRole('button', { name: 'Dismiss', exact: true }).click()
  await expect(refusal).toHaveCount(0)
})
