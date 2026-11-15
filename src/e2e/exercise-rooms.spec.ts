// ============================================================
// The exercise rooms on the web: the tab lists them, a card opens one
// ============================================================
//
// The rooms are the native app's (Long note, Echo and the rest, with Merc),
// and the web opens the same ones from its Exercises tab. Each room has its
// own unit tests; only a browser reaches what the web adds round them: the
// cards, the frame over the whole window with its bar, the slot the room
// draws its level pill into, and the ways out. A room's code, its art and
// Merc's renderer all load when a card is pressed, so opening each one here
// is also the check that the web build carries what the room needs.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

/** Each room, and the test id of the page it draws. */
const ROOMS = [
  ['long-note-lantern', 'Long note', 'long-note-room'],
  ['echo-stars', 'Echo', 'echo-room'],
  ['lip-roll-bay', 'Lip roll', 'lip-roll-room'],
  ['ng-slides-bridge', 'Ng slides', 'ng-slides-room'],
  ['home-note-lighthouse', 'Home note', 'home-note-room'],
  ['leap-cliffs', 'Leap', 'leap-room'],
  ['harmony-lake', 'Harmony', 'harmony-room'],
] as const

async function openExercises(page: Page): Promise<void> {
  await page.goto('/')
  await dismissOverlays(page)
  await waitForNav(page)
  await openNavTab(page, 'tab-exercises')
  await expect(page.getByTestId('exercise-rooms')).toBeVisible()
}

const card = (page: Page, id: string) =>
  page.locator(`[data-testid="exercise-room-card"][data-room="${id}"]`)

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the Exercises tab lists the seven rooms above the drills', async ({
    page,
  }) => {
    await openExercises(page)

    const cards = page.getByTestId('exercise-room-card')
    await expect(cards).toHaveCount(ROOMS.length)
    await expect(cards.locator('img').first()).toBeVisible()
    // Above the drills' filter, two cards across, none wider than the page.
    const [strip, filter] = await Promise.all([
      page.getByTestId('exercise-rooms').boundingBox(),
      page.locator('.exercise-filter').boundingBox(),
    ])
    expect(strip!.y).toBeLessThan(filter!.y)
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })

  for (const [id, name, roomTestId] of ROOMS) {
    test(`${name} opens over the whole window, with its world and its mic`, async ({
      page,
    }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await openExercises(page)

      await card(page, id).click()

      const host = page.getByTestId('web-room')
      await expect(host).toHaveAttribute('data-room', id)
      await expect(host.getByRole('heading', { name })).toBeVisible()
      await expect(host.getByTestId(roomTestId)).toBeVisible()
      await expect(host.getByRole('button', { name: /^Start/ })).toBeVisible()
      // The whole window, over the app's own bars.
      const box = await host.boundingBox()
      expect(box).toEqual({ x: 0, y: 0, width: 390, height: 844 })
      expect(errors).toEqual([])
    })
  }

  test('Back leaves the room for the list, on the card it was opened by', async ({
    page,
  }) => {
    await openExercises(page)
    await card(page, 'echo-stars').click()
    await expect(page.getByTestId('echo-room')).toBeVisible()

    await page.getByTestId('web-room-back').click()

    await expect(page.getByTestId('web-room')).toHaveCount(0)
    await expect(card(page, 'echo-stars')).toBeFocused()
  })
})

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("a room's level sits in the bar once its demo is skipped, and Escape leaves", async ({
    page,
  }) => {
    await page.goto('/#/exercises')
    await dismissOverlays(page)
    await expect(page.getByTestId('exercise-rooms')).toBeVisible()
    await card(page, 'harmony-lake').click()
    const host = page.getByTestId('web-room')
    await expect(host.getByTestId('harmony-room')).toBeVisible()

    // A first visit plays "How it works"; the room's own controls wait.
    await host.getByRole('button', { name: 'Skip' }).click()

    // Drawn by the room kit into the slot the host registers.
    await expect(
      host.getByTestId('web-room-end').getByRole('button', { name: /^Level:/ }),
    ).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByTestId('web-room')).toHaveCount(0)
    await expect(page.getByTestId('exercise-rooms')).toBeVisible()
  })

  test("/exercises/harmony-line opens the Harmony room from a lesson's link", async ({
    page,
  }) => {
    // Production's Worker answers /exercises/<slug> with the app's shell
    // (src/worker.ts). The e2e server has no such rule, so do what it does.
    await page.route(/\/exercises\/harmony-line\?/, async (route) => {
      const shell = await route.fetch({
        url: new URL('/', route.request().url()).href,
      })
      await route.fulfill({ response: shell })
    })

    await page.goto('/exercises/harmony-line?lesson=26')

    const host = page.getByTestId('web-room')
    await expect(host).toHaveAttribute('data-room', 'harmony-lake')
    await expect(host.getByTestId('harmony-room')).toBeVisible()
  })
})
