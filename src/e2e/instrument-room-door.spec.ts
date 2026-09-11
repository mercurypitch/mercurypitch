// ============================================================
// The instrument room door — the part only a real browser can answer
// ============================================================
//
// The component and the stored preference are covered in
// src/tests/instrument-room-door.test.tsx. What that cannot check is the
// wiring: that pressing the tab opens the door instead of the tab, that a
// remembered answer sends the next press straight through, and that a phone
// never sees the question at all.

import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { dismissOverlays, openNavTab } from './helpers/ui'

const seed = async (
  page: import('@playwright/test').Page,
  rooms: Record<string, string> = {},
) => {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
  ) as { version: string }
  await page.addInitScript(
    ({ version, rooms }) => {
      ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_welcome_version', version)
      localStorage.setItem('pitchperfect_active_tab', 'singing')
      localStorage.setItem('pitchperfect_focus_mode', 'false')
      for (const [key, value] of Object.entries(rooms))
        localStorage.setItem(key, value)
    },
    { version: pkg.version, rooms },
  )
  await page.goto('/')
  // #app-tabs is the DESKTOP nav and never renders on a phone, where the
  // bottom bar takes its place. Waiting for whichever one this viewport has.
  await page.waitForSelector('#app-tabs, [data-tour="mobile-tabbar"]', {
    timeout: 15000,
  })
  await dismissOverlays(page)
}

const guitarPanel = '#guitar-practice-panel'

/** Reload and get back to a state where the nav can be pressed again. */
const restart = async (page: import('@playwright/test').Page) => {
  await page.reload()
  await page.waitForSelector('#app-tabs, [data-tour="mobile-tabbar"]', {
    timeout: 15000,
  })
  await dismissOverlays(page)
}

const door = (page: import('@playwright/test').Page) =>
  page.getByTestId('instrument-room-door')

test.describe('the instrument room door', () => {
  test('asks which room the first time the tab is pressed @smoke', async ({
    page,
  }) => {
    await seed(page)

    await openNavTab(page, 'tab-guitar')

    await expect(door(page)).toBeVisible()
    await expect(door(page)).toHaveAttribute('data-instrument', 'guitar')
    // The tab itself has NOT changed: the question IS the navigation. Asserted
    // on the destination rather than on #tab-guitar's class, because the nav
    // button can live in an overflow menu that closes when the door opens —
    // then the locator matches nothing and even a negated class assertion
    // errors on the missing element.
    await expect(page.locator(guitarPanel)).not.toBeVisible()
  })

  test('a remembered answer sends the next press straight through', async ({
    page,
  }) => {
    await seed(page)
    await openNavTab(page, 'tab-guitar')
    await expect(door(page)).toBeVisible()

    // Remember is ticked by default, so this is the one-press path.
    await page.getByTestId('room-door-workspace').click()
    await expect(door(page)).toHaveCount(0)
    await expect(page.locator(guitarPanel)).toBeVisible()

    await restart(page)
    await openNavTab(page, 'tab-guitar')

    await expect(page.locator(guitarPanel)).toBeVisible()
    await expect(door(page)).toHaveCount(0)
  })

  test('an unticked answer asks again next time', async ({ page }) => {
    await seed(page)
    await openNavTab(page, 'tab-guitar')

    await page.locator('label').filter({ hasText: 'Remember this' }).click()
    await page.getByTestId('room-door-workspace').click()
    await expect(page.locator(guitarPanel)).toBeVisible()

    await restart(page)
    await openNavTab(page, 'tab-guitar')

    await expect(door(page)).toBeVisible()
  })

  test('a remembered Night answer leaves the app for the room', async ({
    page,
  }) => {
    await seed(page, { pitchperfect_room_guitar: 'night' })

    await openNavTab(page, 'tab-guitar')

    await page.waitForURL(/\/guitar-night/, { timeout: 15000 })
    await expect(door(page)).toHaveCount(0)
  })

  test('a phone is never asked — both instruments open Night', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await seed(page)

    // Piano and Guitar read as doors in the sheet, the way Drum Night does,
    // because on this viewport they leave the app.
    const more = page.getByRole('button', { name: /more/i }).first()
    await more.click()
    const pianoDoor = page.getByTestId('nav-piano-night')
    await expect(pianoDoor).toBeVisible()
    await expect(pianoDoor).toHaveAttribute('href', '/piano-night')
    await expect(page.getByTestId('nav-guitar-night')).toHaveAttribute(
      'href',
      '/guitar-night',
    )
  })
})
