// Studio failure notices — Play on a song whose only lane is muted plays nothing, and Studio says why in the app's notice, in its own words for people, with no bar left in the Studio; the song plays again once the lane is heard. Nothing reaches the live site.
import { expect, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

test.use({ viewport: { width: 1440, height: 900 } })

test('says why Play did nothing in the app’s notice, in words for people, and leaves no bar in the Studio', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openArrangement(page)
  const studio = studioRegion(page)
  const lane = studio.locator('[data-studio-track]')
  await lane.getByRole('button', { name: 'Mute Phrase', exact: true }).click()

  await studio.getByRole('button', { name: 'Play song', exact: true }).click()

  const notice = page
    .getByRole('region', { name: 'Notifications' })
    .getByRole('alert')
  await expect(notice).toContainText('Add an audible take before playing.')
  await expect(studio.getByRole('alert')).toHaveCount(0)
  // Heard again, the song plays.
  await lane.getByRole('button', { name: 'Unmute Phrase', exact: true }).click()
  await studio.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect(
    studio.getByRole('button', { name: 'Pause song', exact: true }),
  ).toBeVisible()
  await expect(studio.getByRole('alert')).toHaveCount(0)
})
