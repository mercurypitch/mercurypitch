// Studio desk Auto-balance — the Sound panel's balance runs from the desk's master heading as one undoable edit and says briefly that it is done.
import { expect, test } from '@playwright/test'
import { importStudioAudio, openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'

test('Auto-balance in the desk balances the lanes as one undoable edit, leaving volume and pan as they were @smoke', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  await importStudioAudio(page, 'Harmony', 2)
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Mix', exact: true }).click()
  const master = studio
    .getByRole('region', { name: 'Mix', exact: true })
    .getByRole('group', { name: 'Master', exact: true })
  const before = await readStudioProject(page)

  await master
    .getByRole('button', { name: 'Auto-balance', exact: true })
    .click()

  await expect(master.getByRole('status')).toHaveText('Balanced', {
    timeout: 30_000,
  })
  const after = await readStudioProject(page)
  expect(after.revision).toBe(before.revision + 1)
  expect(after.tracks.map((track) => [track.gainDb, track.pan])).toEqual(
    before.tracks.map((track) => [track.gainDb, track.pan]),
  )
  // One undo step takes the balance back.
  const balance = async () =>
    (await readStudioProject(page)).tracks.map((track) => track.balanceGainDb)
  expect(await balance()).not.toEqual(
    before.tracks.map((track) => track.balanceGainDb),
  )
  await page.keyboard.press('Control+z')
  await expect
    .poll(balance)
    .toEqual(before.tracks.map((track) => track.balanceGainDb))
})
