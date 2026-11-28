// Studio failure notices — Play on a song too short to repeat, with Repeat on, plays nothing, and Studio says why in the app's notice, in its own words for people, with no bar left in the Studio; the song plays again once Repeat is off. A muted song is no failure: it plays silently (studio-muted-play.spec.ts). Nothing reaches the live site.
import { expect, test } from '@playwright/test'
import { importStudioAudio, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { dismissOverlays, waitForNav } from './helpers/ui'

test.use({ viewport: { width: 1440, height: 900 } })

test('says why Play did nothing in the app’s notice, in words for people, and leaves no bar in the Studio', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/studio-night')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  const studio = studioRegion(page)
  await studio
    .getByRole('button', { name: 'Create project', exact: true })
    .click()
  // A fifth of a second: too short to repeat.
  await importStudioAudio(page, 'Blip', 0.2)
  await studio.getByRole('button', { name: 'Repeat song', exact: true }).click()

  await studio.getByRole('button', { name: 'Play song', exact: true }).click()

  const notice = page
    .getByRole('region', { name: 'Notifications' })
    .getByRole('alert')
  await expect(notice).toContainText(
    'A song needs at least a quarter second to repeat.',
  )
  await expect(studio.getByRole('alert')).toHaveCount(0)
  // Repeat off, the song plays to its end.
  await studio.getByRole('button', { name: 'Repeat song', exact: true }).click()
  await studio.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect
    .poll(async () =>
      Number(
        await studio
          .getByRole('spinbutton', { name: 'Playhead in seconds' })
          .getAttribute('aria-valuenow'),
      ),
    )
    .toBeGreaterThan(0.1)
  await expect(studio.getByRole('alert')).toHaveCount(0)
})
