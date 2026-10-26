// ============================================================
// Lesson 9's Wrap: its practice links, and free play in a browser
// ============================================================
//
// WEB-SPEC, End to end 9: every link on the page to a practice room, the
// practice card's, the season map's card for this lesson and the footer's,
// opens `/pitch-training?lesson=09` in a tab of its own, and that address,
// opened in a fresh profile, shows the Exercises tab and no intro, as
// lesson-marker.spec.ts checks Lesson 4's link. Then free play at a
// phone's size and a desktop's: a first tap names its rung, a tap after it
// names the leap, and the voice switch renames the rungs for the visit
// while `fyp-voice` stays unset. The next card's words and its tease figure
// are learn-next-card.spec.ts's (End to end 10); free play's sounds,
// timings and voice rules are wrap.test.ts's.

import type { Page } from '@playwright/test'
import { test as freshProfile } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

/** Every link on the page into the app, other than the lesson pages and the home and plan links. */
const appLinks = (page: Page): Promise<(string | null)[][]> =>
  page
    .locator('a[href^="/"]')
    .evaluateAll((links) =>
      links
        .map((a) => [
          a.getAttribute('href'),
          a.getAttribute('target'),
          a.getAttribute('rel'),
        ])
        .filter(
          ([href]) =>
            href !== null &&
            href !== '/' &&
            !href.startsWith('/learn/') &&
            !href.startsWith('/#'),
        ),
    )

test("every practice link, the card's, the map card's and the footer's, carries lesson=09 and opens a tab of its own", async ({
  page,
}) => {
  // Act: the map's card for this lesson drawn, with its practise link
  await page.goto('/learn/09')
  await expect(page.locator('#exCardHost h3')).toHaveText('Landing a leap')

  // Assert
  expect(await appLinks(page)).toEqual([
    ['/pitch-training?lesson=09', '_blank', 'noopener'],
    ['/pitch-training?lesson=09', '_blank', 'noopener'],
    ['/pitch-training?lesson=09', '_blank', 'noopener'],
  ])
  await expect(page.locator('#practiseCard')).toHaveAttribute(
    'href',
    '/pitch-training?lesson=09',
  )
  await expect(
    page.locator('footer a[href="/pitch-training?lesson=09"]'),
  ).toHaveText('mercurypitch.com/pitch-training')
})

// a fresh profile, as lesson-marker.spec.ts's are: nothing seeded, not even
// the lesson pages' tour record
freshProfile(
  '/pitch-training?lesson=09 in a fresh profile opens the Exercises tab, with no intro',
  async ({ page }) => {
    // Act
    await page.goto('/pitch-training?lesson=09')

    // Assert
    await expect(page.locator('#exercises-panel')).toBeVisible()
    await expect(page).toHaveURL(/\/pitch-training\?lesson=09#\/exercises$/)
    // the boot finishes fetching first: First Light is a lazy chunk opened
    // from an effect, so an intro that was going to open has done so by now
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('dialog', { name: 'Welcome to MercuryPitch' }),
    ).toHaveCount(0)
  },
)

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`free play at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test("names a first tap's rung and the leap after it, and its voice switch renames the rungs, storing nothing", async ({
      page,
    }) => {
      // Arrange
      await page.goto('/learn/09')
      const free = page.locator('#freePlay')
      const said = free.locator('[data-free-status]')
      const rung = (name: string) =>
        free.getByRole('button', { name, exact: true })

      // Act
      await rung('so, A3').click()
      await expect(said).toHaveText('So, A3')
      await rung('top do, D4').click()
      await expect(said).toHaveText(
        'So to top do: a perfect fourth, 5 semitones, up',
      )
      await free.getByRole('button', { name: 'Higher voice' }).click()

      // Assert
      await expect(
        free.getByRole('button', { name: 'Higher voice' }),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(rung('so, A4')).toBeVisible()
      await expect(said).toHaveText('')
      expect(
        await page.evaluate(() => localStorage.getItem('fyp-voice')),
      ).toBeNull()
    })
  })
}
