// On a phone, a toast stands above the Studio's transport dock, not on it.
//
// The dock sits on the tab bar, and toasts were anchored just above the tab
// bar, so the first-visit "New to Studio? Take a quick tour." offer covered
// the play button and the clock (review round 2, 27 Oct 2026). The dock now
// publishes its height as --page-dock-space (lib/foot-space.ts) and the toast
// floor adds it.
import { expect, test } from '@playwright/test'
import { studioRegion } from './helpers/dedicatedstudio-fixture'
import { dismissOverlays, waitForNav } from './helpers/ui'

test.use({ viewport: { width: 390, height: 844 } })

test('the Studio tour offer stands clear of the phone transport dock @smoke', async ({
  page,
}) => {
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
  await studio
    .getByRole('button', { name: 'Close Add takes', exact: true })
    .click()
  const dock = studio.getByRole('group', { name: 'Song playback' })
  await expect(dock).toBeVisible()

  // A returning visit with the offer still unspent raises it over the open song.
  await page.evaluate(() =>
    localStorage.removeItem('pitchperfect_page_tour_offered_studio'),
  )
  await page.reload()
  await waitForNav(page, 30_000)
  // A reload lands on the library; open the song again.
  await studio.getByRole('button', { name: /^Untitled song/ }).click()
  await expect(dock).toBeVisible()
  const offer = page
    .getByRole('region', { name: 'Notifications' })
    .getByRole('status')
    .filter({ hasText: 'New to Studio? Take a quick tour.' })
  await expect(offer).toBeVisible()

  const dockTop = async (): Promise<number> =>
    Math.round((await dock.boundingBox())!.y)
  // Polled: the toast slides up as it enters.
  await expect
    .poll(async () => {
      const box = await offer.boundingBox()
      return box === null ? null : Math.round(box.y + box.height)
    })
    .toBeLessThanOrEqual(await dockTop())
})
