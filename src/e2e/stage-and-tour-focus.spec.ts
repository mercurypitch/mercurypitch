// ============================================================
// The Zen stage and the spotlight tour hold the keyboard focus
// ============================================================
//
// docs/accessibility-audit-2026-10.md, items 2, 3 and 5, each re-run before
// it was fixed:
//
//  - The Zen stage portals itself over the app, but the app stayed live
//    behind it: the first Tab went to the hidden voice pill, and after the
//    stage's last control focus walked into the header and tabs under it.
//  - After a run with the mic on, the score card opened invisibly behind the
//    stage and took the focus anyway; Escape was the only way out.
//  - The tour never took focus, so Enter, its "next" key, landed on the
//    mixer's Tour button behind the overlay and restarted the tour.
//
// The phone stage is the same StageShell, but it comes and goes with the
// window's width rather than a button, so it gets a spec of its own here.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { blockMic, openSeededSong } from './helpers/mixer-song'

test.use({ permissions: ['microphone'] })

const DESK = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }
const stage = (page: Page) => page.getByTestId('karaoke-mobile-stage')
const zenButton = (page: Page) =>
  page.getByRole('button', { name: 'Zen', exact: true })

/** Where focus is: inside the stage, inside the covered app, or neither. */
const focusIsIn = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement
    if (active === null || active === document.body) return 'nowhere'
    if (
      document
        .querySelector('[data-testid="karaoke-mobile-stage"]')
        ?.contains(active) === true
    )
      return 'stage'
    return document.getElementById('app')?.contains(active) === true
      ? 'app'
      : 'elsewhere'
  })

/** Whether the page under the stage is inert: its main layout, its header. */
const coveredIsInert = (page: Page) =>
  page.evaluate(() => [
    document.getElementById('main-layout')?.inert ?? null,
    document.querySelector<HTMLElement>('#app > header')?.inert ?? null,
  ])

async function openZenByKeyboard(page: Page): Promise<void> {
  await zenButton(page).focus()
  await page.keyboard.press('Enter')
  await expect(stage(page)).toBeVisible()
}

test.describe('the Zen stage', () => {
  test('takes the focus, keeps it off the covered page, and gives it back', async ({
    page,
  }) => {
    await openSeededSong(page, DESK)
    await openZenByKeyboard(page)

    await expect(
      page.getByRole('dialog', { name: 'Karaoke: Rail Layout Song' }),
    ).toBeVisible()
    await expect.poll(() => focusIsIn(page)).toBe('stage')
    expect(await coveredIsInert(page)).toEqual([true, true])

    for (let press = 0; press < 30; press += 1) {
      await page.keyboard.press('Tab')
      expect(await focusIsIn(page), `Tab ${press + 1}`).not.toBe('app')
    }

    await page.getByRole('button', { name: 'Back' }).first().click()
    await expect(stage(page)).toHaveCount(0)
    await expect(zenButton(page)).toBeFocused()
    expect(await coveredIsInert(page)).toEqual([false, false])
  })

  test('on a phone, holds the page while the window is narrow and frees it after', async ({
    page,
  }) => {
    await openSeededSong(page, DESK)
    await page.setViewportSize(PHONE)

    await expect(stage(page)).toBeVisible()
    await expect.poll(() => focusIsIn(page)).toBe('stage')
    expect(await coveredIsInert(page)).toEqual([true, true])

    // Widened again, the stage unmounts on its own, with no Back pressed.
    await page.setViewportSize(DESK)
    await expect(stage(page)).toHaveCount(0)
    await expect(zenButton(page)).toBeVisible()
    expect(await coveredIsInert(page)).toEqual([false, false])
  })

  test('leaves the toasts drawn above it live', async ({ page }) => {
    await openSeededSong(page, DESK)
    await openZenByKeyboard(page)
    await blockMic(page)
    await stage(page)
      .getByRole('button', { name: 'Toggle your microphone' })
      .click()

    const toast = page
      .locator('[class*="notificationContainer"] [role]')
      .first()
    await expect(toast).toBeVisible()
    expect(await toast.evaluate((node) => node.closest('[inert]'))).toBeNull()
  })

  test('shows the score card above itself after a mic run', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await openSeededSong(page, DESK)
    await openZenByKeyboard(page)
    await stage(page)
      .getByRole('button', { name: 'Toggle your microphone' })
      .click()
    // Sing the last six seconds of the thirty-second song.
    await stage(page).getByRole('slider', { name: 'Playback position' }).focus()
    for (let second = 0; second < 24; second += 1) {
      await page.keyboard.press('ArrowRight')
    }
    await stage(page).getByRole('button', { name: 'Play', exact: true }).click()

    const card = page.getByRole('dialog', { name: 'Karaoke score' })
    await expect(card).toBeVisible({ timeout: 20_000 })
    expect(
      await card.evaluate((dialog) => {
        const box = dialog.getBoundingClientRect()
        const top = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        )
        return dialog.contains(top)
      }),
    ).toBe(true)
    await expect(
      page.getByRole('button', { name: 'Close score' }),
    ).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(card).toHaveCount(0)
  })
})

test.describe('the mixer tour', () => {
  test('is a dialog that takes the focus, and Enter moves it on', async ({
    page,
  }) => {
    await openSeededSong(page, DESK)
    await page.getByRole('button', { name: 'Tour', exact: true }).click()

    const title = page.locator('[class*="walkthroughStepTitle"]')
    await expect(title).toHaveText('Mix the stems')
    await expect(
      page.getByRole('dialog', { name: 'Mix the stems' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeFocused()

    await page.keyboard.press('ArrowRight')
    await expect(title).toHaveText('Transport & seek')
    await page.keyboard.press('Enter')
    await expect(title).toHaveText('A–B loop')

    await page.keyboard.press('Escape')
    await expect(title).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Tour', exact: true }),
    ).toBeFocused()
  })
})
