// ============================================================
// The Jam tab's two tours
// ============================================================
//
// Owner report, 2026-09-20: "in the sidebar the 'tour' button is there, but
// it doesn't showcase the in room tour guide ... it actually shows the tour
// guide for the welcome screen where you can create the room and join one."
//
// One tab, two screens, and Tour played the lobby's steps on both: inside a
// room that is four tooltips pointing at a name field and a Create button
// that are not there. The room has its own tour now. Whether a step's
// spotlight really lands on something VISIBLE is a browser's question, so it
// is asked here -- on a desk, on the owner's tablet and on a phone, because
// two of the steps live in a sidebar that is a drawer on one of them.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

const ROOM_TOUR = [
  'Your room',
  'Bring people in',
  'Your side of the room',
  'Who is here',
  'Choose what to sing',
  'Play it for the room',
  'The stage',
  'Talk to the room',
]

const title = (page: Page) => page.locator('[class*="walkthroughStepTitle"]')
const spotlight = (page: Page) =>
  page.locator('[class*="walkthroughHighlight"]')

async function openLobby(page: Page): Promise<void> {
  await page.goto('/#/jam')
  await dismissOverlays(page)
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible()
}

async function openRoom(page: Page): Promise<void> {
  await openLobby(page)
  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(page.getByTestId('jam-room-header')).toBeVisible()
}

/** Press the sidebar's Tour, opening the drawer first where it is one. */
async function pressTour(page: Page, drawer: boolean): Promise<void> {
  if (drawer) await page.locator('.sidebar-toggle-btn').click()
  await page.getByTitle('Take a guided tour of this page').click()
  await expect(title(page)).toBeVisible()
}

/** Walk to the end, returning each step's title and its spotlight's size. */
async function walk(page: Page) {
  const steps: { title: string; width: number; height: number }[] = []
  for (let guard = 0; guard < 20; guard += 1) {
    // A step can switch tabs, slide a drawer in and unfold a section before
    // it measures; the engine gives its target about a second.
    await page.waitForTimeout(1500)
    const name = ((await title(page).textContent()) ?? '').trim()
    const box = (await spotlight(page).isVisible())
      ? await spotlight(page).boundingBox()
      : null
    steps.push({
      title: name,
      width: box?.width ?? 0,
      height: box?.height ?? 0,
    })
    const finish = page.getByRole('button', { name: 'Finish', exact: true })
    if (await finish.isVisible()) {
      await finish.click()
      break
    }
    await page.getByRole('button', { name: 'Next', exact: true }).click()
  }
  return steps
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    try {
      // The first-visit offer is a toast over the corner this walks through.
      localStorage.setItem('pitchperfect_page_tour_offered_jam', 'true')
    } catch {
      /* storage blocked: the toast is dismissible and out of the way */
    }
  })
})

test.describe('the Jam tab’s tour on a desk', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('is the lobby’s before there is a room @smoke', async ({ page }) => {
    await openLobby(page)
    await pressTour(page, false)
    await expect(title(page)).toHaveText('Pick a name')
    await expect(spotlight(page)).toBeVisible()
  })

  test('is the room’s inside one, and every step lands on something @smoke', async ({
    page,
  }) => {
    await openRoom(page)
    await pressTour(page, false)
    const steps = await walk(page)

    expect(steps.map((step) => step.title)).toEqual(ROOM_TOUR)
    for (const step of steps) {
      expect(step.width, `${step.title} has no spotlight`).toBeGreaterThan(14)
      expect(step.height, `${step.title} has no spotlight`).toBeGreaterThan(14)
    }
    // The tour is over and the room is still the room.
    await expect(title(page)).toHaveCount(0)
    await expect(page.getByTestId('jam-room-header')).toBeVisible()
  })

  test('goes back to the lobby’s once the room is left', async ({ page }) => {
    await openRoom(page)
    await page.getByTitle('Leave room').click()
    await expect(
      page.getByRole('button', { name: 'Create Room' }),
    ).toBeVisible()
    await pressTour(page, false)
    await expect(title(page)).toHaveText('Pick a name')
  })
})

test.describe('the room’s tour on a tablet', () => {
  test.use({
    viewport: { width: 1180, height: 820 },
    hasTouch: true,
    isMobile: true,
  })

  test('lands every step', async ({ page }) => {
    await openRoom(page)
    await pressTour(page, false)
    const steps = await walk(page)

    expect(steps.map((step) => step.title)).toEqual(ROOM_TOUR)
    for (const step of steps) {
      expect(step.width, `${step.title} has no spotlight`).toBeGreaterThan(14)
      expect(step.height, `${step.title} has no spotlight`).toBeGreaterThan(14)
    }
  })
})

test.describe('the room’s tour on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('lands every step, the two in the drawer included', async ({ page }) => {
    await openRoom(page)
    await pressTour(page, true)
    const steps = await walk(page)

    expect(steps.map((step) => step.title)).toEqual(ROOM_TOUR)
    for (const step of steps) {
      expect(step.width, `${step.title} has no spotlight`).toBeGreaterThan(14)
      expect(step.height, `${step.title} has no spotlight`).toBeGreaterThan(14)
    }
  })
})
