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
// is also the check that the web build carries what the room needs. The
// Warm-up's path opens its stops' rooms over itself, in the same frame.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

/** Each room, and the test id of the page it draws. */
const ROOMS = [
  ['long-note-lantern', 'Long note', 'long-note-room'],
  ['echo-stars', 'Echo', 'echo-room'],
  ['warm-up-path', 'Warm-up', 'warm-up-path'],
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

  test('the Exercises tab lists the eight rooms above the drills', async ({
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
    test(`${name} opens over the whole window, with its world and its Start`, async ({
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

  test("the Warm-up opens a stop over its path, and the stop's Skip, Back and Escape come back to it", async ({
    page,
  }) => {
    // Six screens one after another, each loading its own code, its art and
    // Merc's renderer, with the path's card and the ring's pulse between
    // them: 36 s on a four-core machine, measured, against the default 30.
    test.setTimeout(90_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openExercises(page)
    await card(page, 'warm-up-path').click()
    const host = page.getByTestId('web-room')
    await expect(host.getByTestId('warm-up-path')).toBeVisible()
    // The path carries the level, in the bar's slot.
    await expect(
      host.getByTestId('web-room-end').getByRole('button', { name: /^Level:/ }),
    ).toBeVisible()

    // Start: the first stop's room over the path, in the same frame.
    await host.getByTestId('warm-up-start').click()
    await expect(host).toHaveAttribute('data-room', 'lip-roll-bay')
    await expect(host.getByTestId('lip-roll-room')).toBeVisible()
    await expect(host.getByText('Warm-up 1 of 4')).toBeVisible()
    await expect(host.getByRole('heading', { name: 'Lip roll' })).toBeFocused()

    // Skip stop: back on the path, the stop skipped.
    await host.getByRole('button', { name: 'Skip stop' }).click()
    await expect(host).toHaveAttribute('data-room', 'warm-up-path')
    await expect(host.getByTestId('warm-up-stop-0')).toContainText('Skipped')
    await expect(host.getByRole('heading', { name: 'Warm-up' })).toBeFocused()

    // Next opens the next stop, as its countdown would five seconds on;
    // Back leaves that stop unfinished.
    await host.getByTestId('warm-up-next').click()
    await expect(host).toHaveAttribute('data-room', 'ng-slides-bridge')
    await expect(host.getByText('Warm-up 2 of 4')).toBeVisible()
    await page.getByTestId('web-room-back').click()
    await expect(host).toHaveAttribute('data-room', 'warm-up-path')
    await expect(host.getByTestId('warm-up-next')).toContainText('Ng slides')

    // Escape does what Back does: the stop, then the path.
    await host.getByTestId('warm-up-next').click()
    await expect(host).toHaveAttribute('data-room', 'ng-slides-bridge')
    await page.keyboard.press('Escape')
    await expect(host).toHaveAttribute('data-room', 'warm-up-path')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('web-room')).toHaveCount(0)
    await expect(card(page, 'warm-up-path')).toBeFocused()

    // The card again: the run is where it was left, and Back leaves too.
    await card(page, 'warm-up-path').click()
    await expect(host.getByTestId('warm-up-stop-0')).toContainText('Skipped')
    await expect(host.getByTestId('warm-up-next')).toContainText('Ng slides')
    await page.getByTestId('web-room-back').click()
    await expect(page.getByTestId('web-room')).toHaveCount(0)
    await expect(card(page, 'warm-up-path')).toBeFocused()
    expect(errors).toEqual([])
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

  test("Sing a song, at the Warm-up's end, leaves for Karaoke Night", async ({
    page,
  }) => {
    // Today's run with its four stops sung, as this device would keep it:
    // no take finishes in this suite, which has no microphone.
    await page.addInitScript(() => {
      const now = new Date()
      const two = (n: number): string => String(n).padStart(2, '0')
      const rooms = [
        'lip-roll-bay',
        'ng-slides-bridge',
        'long-note-lantern',
        'echo-stars',
      ]
      localStorage.setItem(
        'mp_warm_up_today',
        JSON.stringify({
          date: `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`,
          plan: {
            id: 'four-rooms-and-a-song',
            stops: [
              ...rooms.map((id) => ({ kind: 'room', id })),
              { kind: 'song', opens: 'song-list' },
            ],
          },
          marks: [
            ...rooms.map(() => ({ state: 'done', line: '86% lit' })),
            { state: 'waiting' },
          ],
          settledNote: 57,
          warmedUp: true,
          lastActiveAt: now.getTime(),
        }),
      )
    })
    await page.goto('/#/exercises')
    await dismissOverlays(page)
    await expect(page.getByTestId('exercise-rooms')).toBeVisible()
    await card(page, 'warm-up-path').click()
    const host = page.getByTestId('web-room')
    await expect(host.getByTestId('warm-up-path')).toHaveAttribute(
      'data-state',
      'done',
    )

    await host.getByTestId('warm-up-sing').click()

    // Karaoke Night is a page of its own: the app is left for it.
    await expect(page).toHaveURL(/\/karaoke-night$/)
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
