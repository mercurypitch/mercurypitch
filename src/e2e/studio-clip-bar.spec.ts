// Studio's floating clip bar — its commands' names show while the whole bar fits beside zoom, at the other end of the timeline's foot; past that it folds to icons, so it never runs into zoom: a narrow window, a side panel open, or a long lane name.
import { expect, type Page, test } from '@playwright/test'
import { openArrangement, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'

const LONG_NAME = 'Lead vocal for the second verse, doubled'

/** The px between the bar's end and zoom's start, and whether the bar shows its commands' names. */
async function barBesideZoom(
  page: Page,
): Promise<{ gap: number; names: boolean }> {
  const studio = studioRegion(page)
  const bar = studio.getByRole('toolbar', { name: 'Selected clip' })
  const box = (await bar.boundingBox())!
  const zoom = (await studio
    .getByRole('group', { name: 'Timeline zoom' })
    .boundingBox())!
  const names = await bar
    .getByText('Duplicate', { exact: true })
    .evaluate((text) => text.getBoundingClientRect().width > 1)
  return { gap: Math.round(zoom.x - box.x - box.width), names }
}

async function expectBar(
  page: Page,
  names: boolean,
  because: string,
): Promise<void> {
  await expect
    .poll(() => barBesideZoom(page), { message: because })
    .toEqual({ gap: expect.any(Number), names })
  const { gap } = await barBesideZoom(page)
  expect(gap, because).toBeGreaterThanOrEqual(16)
}

test('Studio clip bar folds to icons rather than run into zoom, and takes its names back with room', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  const studio = studioRegion(page)
  await studioClip(page, 'Phrase').click()
  await expectBar(page, true, 'a wide window')

  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  await expectBar(page, true, 'a wide window with Sound open')
  await page.setViewportSize({ width: 1180, height: 820 })
  await expectBar(page, false, 'a laptop window with Sound open')
  await studio.getByRole('button', { name: 'Close Sound', exact: true }).click()
  await expectBar(page, true, 'the same window with Sound closed')
  await page.setViewportSize({ width: 1068, height: 800 })
  await expectBar(page, true, 'a 1068 px window')

  // A long lane name fills the bar's label: the bar folds sooner.
  await studio
    .getByRole('button', { name: 'Phrase details', exact: true })
    .click()
  const field = studio.getByRole('textbox', { name: 'Track name', exact: true })
  await field.fill(LONG_NAME)
  await field.press('Enter')
  await studio
    .getByRole('button', { name: 'Close Track details', exact: true })
    .click()
  // At 1068 px the lane's first name left the bar 68 px clear of zoom.
  await page.setViewportSize({ width: 1068, height: 800 })
  await studioClip(page, LONG_NAME).click()
  await expectBar(page, false, 'a long lane name in a 1068 px window')
  await page.setViewportSize({ width: 1440, height: 900 })
  await expectBar(page, true, 'a long lane name in a wide window')
})
