// ============================================================
// The app's notices in a room on the web: one pill under its bar, no toast
// ============================================================
//
// Over a room the toasts stood where the room's controls are: at a phone's
// foot, over its microphone, and in a wide window's top right corner, over
// its "?". A room on the web now holds the notices in the native app's pill
// while it is up (src/components/notice-pill/NoticePill.tsx, the store's
// `presentNoticesInPill`): one at a time, under the room's bar, on no
// control. These raise notices the way the app raises them and check what a
// look would, in a room of the Exercises tab at a phone's size and a
// desktop's, and in Merc's room in the Ear Lab:
//
//   - one pill, under the bar, inside the window, on no control a tap
//     could reach, and no toast;
//   - an error is an alert, and its action keeps a 44 px press;
//   - a room of the Exercises tab claims its unlocks for the chip under
//     its result (room-kit/room-unlocks.ts), so they are not said over it;
//     Merc's room has no chip, and two unlocks of one moment are one pill;
//   - left, the room hands what it still holds back to the toasts.
//
// The store's claims and their order are unit-tested
// (src/stores/notifications-pill.test.ts).

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

const PILL = '[data-testid="notice-pill"]'

declare global {
  interface Window {
    mpNotices?: {
      show: (
        message: string,
        type: 'info' | 'success' | 'warning' | 'error',
        opts?: Record<string, unknown>,
      ) => void
      showAction: (
        message: string,
        type: 'info' | 'success' | 'warning' | 'error',
        action: { label: string; onClick: () => void },
        opts?: Record<string, unknown>,
      ) => void
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
})

/** Two badges earned in one take, as the grant engine announces them. */
async function raiseTwoUnlocks(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const [name, icon] of [
      ['Steady Hold', 'leaf'],
      ['Echo Ace', 'star'],
    ] as const) {
      window.mpNotices!.show(`Badge unlocked: ${name}`, 'success', {
        unlock: { kind: 'badge', name, icon },
        durationMs: 60_000,
      })
    }
  })
}

/** A failed save, with its way to try again. */
async function raiseError(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.mpNotices!.showAction(
      'Could not save your take. Check your connection.',
      'error',
      { label: 'Retry', onClick: () => undefined },
      { durationMs: 60_000 },
    )
  })
}

/** The pill at rest: placed, and its drop-in over. */
async function restingPill(page: Page) {
  const pill = page.locator(PILL)
  await expect(pill).toHaveCount(1)
  await expect(pill).toHaveClass(/\bis-placed\b/)
  await pill.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)),
  )
  return pill
}

/**
 * Where the pill is against the window and the bar it sits under, and every
 * control a tap could reach that lies under it: a control counts only if a
 * tap on its centre lands on it, as the pill's own rule counts them.
 */
async function pillAgainst(page: Page, bar: string) {
  return page.locator(PILL).evaluate((pill, barSelector) => {
    const r = pill.getBoundingClientRect()
    const under: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="switch"], [role="slider"], [tabindex]:not([tabindex="-1"])',
    )) {
      if (pill.contains(el)) continue
      const b = el.getBoundingClientRect()
      if (b.width < 1 || b.height < 1) continue
      if (b.bottom <= 0 || b.top >= innerHeight) continue
      const x = Math.min(Math.max(b.left + b.width / 2, 0), innerWidth - 1)
      const y = Math.min(Math.max(b.top + b.height / 2, 0), innerHeight - 1)
      const hit = document
        .elementsFromPoint(x, y)
        .find((u) => !pill.contains(u))
      if (hit === undefined || !el.contains(hit)) continue
      if (
        b.right > r.left &&
        b.left < r.right &&
        b.bottom > r.top &&
        b.top < r.bottom
      ) {
        under.push(el.getAttribute('aria-label') ?? el.textContent ?? '')
      }
    }
    return {
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      barBottom: document.querySelector(barSelector)!.getBoundingClientRect()
        .bottom,
      under,
    }
  }, bar)
}

const toasts = (page: Page) =>
  page.getByRole('region', { name: 'Notifications' }).locator('> *')

/** The web room's bar: Back, the room's name, its end. */
const ROOM_BAR = '[data-testid="web-room-bar"]'

async function openHarmony(page: Page): Promise<void> {
  await page.goto('/')
  await waitForNav(page)
  await dismissOverlays(page)
  await openNavTab(page, 'tab-exercises')
  await page
    .locator('[data-testid="exercise-room-card"][data-room="harmony-lake"]')
    .click()
  await expect(
    page.getByTestId('web-room').getByTestId('harmony-room'),
  ).toBeVisible()
}

/**
 * In a room of the Exercises tab: two unlocks go to the room, an error is
 * the one pill, under the bar and on no control; left, the toasts again.
 */
async function noticesInARoom(page: Page): Promise<void> {
  await openHarmony(page)
  // Nothing yet: the pill is drawn only while it has a notice.
  await expect(page.locator(PILL)).toHaveCount(0)

  await raiseTwoUnlocks(page)
  await raiseError(page)

  const pill = await restingPill(page)
  await expect(pill).toContainText('Could not save your take')
  await expect(pill).toHaveAttribute('role', 'alert')
  await expect(pill).toHaveAttribute('data-notice-type', 'error')
  const action = pill.getByTestId('notice-pill-action')
  await expect(action).toHaveText('Retry')
  expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await expect(toasts(page)).toHaveCount(0)

  const viewport = page.viewportSize()!
  const at = await pillAgainst(page, ROOM_BAR)
  expect(at.top).toBeGreaterThanOrEqual(at.barBottom)
  expect(at.left).toBeGreaterThanOrEqual(0)
  expect(at.right).toBeLessThanOrEqual(viewport.width)
  expect(at.under).toEqual([])

  // Left, the room gives back what it held: the error, still up, and the
  // two unlocks it had kept for its result, as one notice.
  await page.getByTestId('web-room-back').click()
  await expect(page.getByTestId('web-room')).toHaveCount(0)
  await expect(page.locator(PILL)).toHaveCount(0)
  await expect(toasts(page)).toHaveCount(2)
  await expect(toasts(page).first()).toContainText('Could not save your take')
  await expect(toasts(page).nth(1)).toContainText('2 new badges')
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('a room says the notices in one pill under its bar, and none as a toast @smoke', async ({
    page,
  }) => {
    await noticesInARoom(page)
  })

  test("Merc's room says two unlocks in one pill under its header, and over its exit question", async ({
    page,
  }) => {
    await page.goto('/')
    await dismissOverlays(page)
    await openNavTab(page, 'tab-ear-lab')
    await page
      .locator('[data-testid="merc-station"][data-faculty="resolution"]')
      .click()
    await page
      .getByTestId('merc-station-row')
      .filter({ hasText: 'Hairline' })
      .first()
      .click()
    await expect(page.getByTestId('ear-stage')).toBeVisible()
    const HEADER = '[data-merc-room] header'

    await raiseTwoUnlocks(page)
    const pill = await restingPill(page)
    await expect(pill).toHaveAttribute('data-unlock', 'on')
    await expect(pill).toContainText('2 new badges')
    await expect(pill.getByTestId('notice-pill-names')).toHaveText(
      'Steady Hold, Echo Ace',
    )
    await expect(toasts(page)).toHaveCount(0)
    let at = await pillAgainst(page, HEADER)
    expect(at.top).toBeGreaterThanOrEqual(at.barBottom)
    expect(at.under).toEqual([])

    // A tap sends it away; a notice that comes while the room asks
    // "End the run?" lies on none of the question's answers.
    await page.getByTestId('notice-pill-body').click()
    await expect(page.locator(PILL)).toHaveCount(0)
    await page.getByTestId('merc-close').click()
    await expect(page.getByTestId('merc-exit')).toBeVisible()
    await raiseError(page)
    await restingPill(page)
    at = await pillAgainst(page, HEADER)
    expect(at.under).toEqual([])
    await expect(toasts(page)).toHaveCount(0)

    await page
      .getByTestId('merc-exit')
      .getByRole('button', { name: 'End the run' })
      .click()
    await expect(page.getByTestId('ear-stage')).toHaveCount(0)
    await expect(page.locator(PILL)).toHaveCount(0)
    await expect(toasts(page)).toHaveCount(1)
    await expect(toasts(page).first()).toContainText('Could not save your take')
  })
})

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a room says the notices in one pill under its bar, and none as a toast', async ({
    page,
  }) => {
    await noticesInARoom(page)
  })
})
