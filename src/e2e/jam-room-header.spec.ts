// ============================================================
// The jam room's header and corner, on the owner's tablet
// ============================================================
//
// Owner report, 2026-09-20, after an evening in a room on a tablet:
//
//  - the room code and "Copy link" said one thing twice. The code is the
//    button now, and a press copies the link;
//  - "On my tablet, the camera when enabled, it's somehow missing." The
//    tray started hidden on every touch screen, and the switch that shows
//    it is only drawn on a phone.
//
// jsdom has no clipboard, no layout and no pointer type, so both are checked
// here, in a real browser.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

async function openRoom(page: Page): Promise<void> {
  await page.goto('/#/jam')
  await dismissOverlays(page)
  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(page.getByTestId('jam-room-header')).toBeVisible()
}

async function boxOf(target: Locator) {
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  return box ?? { x: 0, y: 0, width: 0, height: 0 }
}

const header = (page: Page) => page.getByTestId('jam-room-header')
const code = (page: Page) => page.getByTestId('jam-room-code')
const tray = (page: Page) => page.getByTestId('jam-camera-tray')
const chat = (page: Page) => page.locator('[data-jam-chat]')

test.describe('the room code', () => {
  test.use({
    viewport: { width: 1180, height: 820 },
    hasTouch: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  })

  test('is the one control for the code and the link', async ({ page }) => {
    await openRoom(page)

    await expect(code(page)).toBeVisible()
    await expect(
      header(page).getByRole('button', { name: /copy link/i }),
    ).toHaveCount(0)
    // Inside the header's one row, not on a line of its own.
    const head = await boxOf(header(page))
    const pill = await boxOf(code(page))
    expect(pill.y).toBeGreaterThanOrEqual(head.y)
    expect(pill.y + pill.height).toBeLessThanOrEqual(head.y + head.height + 1)
  })

  test('copies the link that opens this room', async ({ page }) => {
    await openRoom(page)
    const roomCode = (await code(page).innerText()).trim()
    expect(roomCode).not.toBe('')

    await code(page).click()

    await expect(code(page).getByRole('status')).toHaveText('Link copied')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toBe(`${new URL(page.url()).origin}/jam#/jam:${roomCode}`)
    // The code is still there to be read aloud while it says so.
    await expect(code(page)).toContainText(roomCode)
  })

  test('says so without moving the header', async ({ page }) => {
    await openRoom(page)
    const before = await boxOf(header(page))

    await code(page).click()
    await expect(code(page).getByRole('status')).toHaveText('Link copied')

    const after = await boxOf(header(page))
    expect(after.height).toBe(before.height)
    expect(after.width).toBe(before.width)
  })
})

test.describe('the camera tray on a tablet', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true })

  test.beforeEach(async ({ page }) => {
    // The owner's tablet, as the app sees it: a wide screen whose pointer
    // is a finger. Said outright rather than left to the browser's touch
    // emulation, which does not promise to change this media query -- and
    // this query is the whole bug.
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window)
      window.matchMedia = (query: string): MediaQueryList => {
        const list = real(query)
        if (!query.includes('pointer: coarse')) return list
        return new Proxy(list, {
          get: (target, key) => {
            if (key === 'matches') return true
            const value = Reflect.get(target, key) as unknown
            return typeof value === 'function'
              ? (value as (...args: unknown[]) => unknown).bind(target)
              : value
          },
        })
      }
    })
  })

  test('is on screen, beside the chat bubble', async ({ page }) => {
    await openRoom(page)

    await expect(tray(page)).toBeVisible()
    const cams = await boxOf(tray(page))
    const bubble = await boxOf(chat(page))

    // Left of the bubble with the chat's own 12px between them, and level
    // with it along the bottom: one row of controls in the corner.
    expect(bubble.x - (cams.x + cams.width)).toBeGreaterThanOrEqual(8)
    expect(bubble.x - (cams.x + cams.width)).toBeLessThanOrEqual(16)
    expect(
      Math.abs(cams.y + cams.height - (bubble.y + bubble.height)),
    ).toBeLessThanOrEqual(2)
  })

  test('steps aside for the open chat and comes back after', async ({
    page,
  }) => {
    await openRoom(page)
    const docked = await boxOf(tray(page))

    await chat(page)
      .getByRole('button', { name: /^Open the chat/ })
      .click()
    await expect
      .poll(async () => (await boxOf(tray(page))).x)
      .toBeLessThan(docked.x - 100)
    const aside = await boxOf(tray(page))
    const open = await boxOf(chat(page))
    expect(aside.x + aside.width).toBeLessThanOrEqual(open.x)
  })
})
