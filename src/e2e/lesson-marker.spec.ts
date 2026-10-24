// ============================================================
// The lesson marker: a lesson's practise link opens its room, not the intro
// ============================================================
//
// Find Your Pitch lesson pages link the app with `?lesson=NN`. A first visit
// that arrives that way goes straight to the room the link names; First
// Light, the intro every other first visit meets, steps aside for good
// (stepAsideForLesson in src/stores/onboarding-store.ts).
//
// Every test here is a fresh browser profile: Playwright gives each its own
// context, so storage starts empty, as it does for a lesson's first-time
// visitor. Nothing is seeded to skip the intro.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { skipTheIntro } from './helpers/ui'

/** First Light, by the name its dialog announces. */
const intro = (page: Page) =>
  page.getByRole('dialog', { name: 'Welcome to MercuryPitch' })

/**
 * Let the boot finish fetching. First Light is a lazy chunk opened from an
 * effect, so an intro that was going to open has done so by now, and its
 * absence means something.
 */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
}

test.describe('a lesson link on a first visit', () => {
  test('/ear-lab?lesson=02 opens the Ear Lab, and Leap opens from it @smoke', async ({
    page,
  }) => {
    await page.goto('/ear-lab?lesson=02')

    const bench = page.locator('#ear-lab-panel')
    await expect(bench).toBeVisible()
    // The address is left alone: the marker stays, and so does the bench's
    // own hash route (render-entry-page.ts adds it only when there is none).
    await expect(page).toHaveURL(/\/ear-lab\?lesson=02#\/ear-lab$/)
    await settle(page)
    await expect(intro(page)).toHaveCount(0)

    // "Then tap Leap", as the lesson says. A modal intro would take this
    // click; here nothing covers the bench.
    await page
      .locator('[data-tour="ear.drills"] button', { hasText: 'Leap' })
      .click()
    await expect(page.getByTestId('ear-stage')).toBeVisible()
    await expect(intro(page)).toHaveCount(0)
  })

  test('the intro does not come back on a later visit without the marker', async ({
    page,
  }) => {
    await page.goto('/ear-lab?lesson=02')
    await expect(page.locator('#ear-lab-panel')).toBeVisible()

    await page.goto('/ear-lab')

    await expect(page.locator('#ear-lab-panel')).toBeVisible()
    await settle(page)
    await expect(intro(page)).toHaveCount(0)
  })

  test('/pitch-training?lesson=04 opens the Exercises tab', async ({
    page,
  }) => {
    await page.goto('/pitch-training?lesson=04')

    await expect(page.locator('#exercises-panel')).toBeVisible()
    await expect(page).toHaveURL(/\/pitch-training\?lesson=04#\/exercises$/)
    await settle(page)
    await expect(intro(page)).toHaveCount(0)
  })

  test('/?lesson=09#/path opens the Ascent on its tab hash', async ({
    page,
  }) => {
    await page.goto('/?lesson=09#/path')

    await expect(
      page.getByRole('heading', { level: 1, name: 'The Ascent' }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/\?lesson=09#\/path$/)
    await settle(page)
    await expect(intro(page)).toHaveCount(0)
  })

  test('/exercises/<slug>?lesson=04 opens the drill, and a reload keeps the intro away', async ({
    page,
  }) => {
    // Production's Worker answers /exercises/<slug> with the app's shell
    // (src/worker.ts). The e2e server has no such rule, so do what it does.
    await page.route(/\/exercises\/speed-scales\?/, async (route) => {
      const shell = await route.fetch({
        url: new URL('/', route.request().url()).href,
      })
      await route.fulfill({ response: shell })
    })

    await page.goto('/exercises/speed-scales?lesson=04')

    await expect(page.locator('h2.exercise-title')).toHaveText('Scale Runner')
    await settle(page)
    await expect(intro(page)).toHaveCount(0)
    // The slug cleans its own address, as it always has, and the marker goes
    // with it. The next load has no marker, and still no intro.
    await expect(page).toHaveURL(/\/#\/exercises$/)
    await page.reload()
    await expect(page.locator('#exercises-panel')).toBeVisible()
    await settle(page)
    await expect(intro(page)).toHaveCount(0)
  })
})

test.describe('a lesson link to a document of its own', () => {
  // Voice Mirror and the Vocal Range Test are not the main app, so they have
  // no intro to step aside, and Lessons 1, 3 and 7 never needed a line for it.
  for (const path of ['/mirror?lesson=03', '/vocal-range-test?lesson=07']) {
    test(`${path} boots its own page, with no intro`, async ({ page }) => {
      await page.goto(path)

      await expect(page.locator('#root')).not.toBeEmpty()
      await settle(page)
      await expect(intro(page)).toHaveCount(0)
      await expect(page.locator('#app-tabs')).toHaveCount(0)
    })
  }
})

test.describe('a first visit without a lesson marker', () => {
  test('/ear-lab opens on the intro, whose x leaves the Ear Lab on screen @smoke', async ({
    page,
  }) => {
    await page.goto('/ear-lab')

    await expect(intro(page)).toBeVisible()
    const skip = page.getByRole('button', { name: 'Skip the intro' })
    await expect(skip).toBeVisible()

    await skipTheIntro(page)

    await expect(intro(page)).toHaveCount(0)
    await expect(page.locator('#ear-lab-panel')).toBeVisible()
  })

  for (const search of ['?lesson=15', '?lesson=2', '?lesson=']) {
    test(`/ear-lab${search} is not a lesson's link, and opens on the intro`, async ({
      page,
    }) => {
      await page.goto(`/ear-lab${search}`)

      await expect(intro(page)).toBeVisible()
    })
  }
})
