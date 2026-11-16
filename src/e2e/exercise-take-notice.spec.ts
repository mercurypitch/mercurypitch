// ============================================================
// The voice take's notice on a phone: it pops, it keeps, it leaves
// ============================================================
//
// After a run, the question of keeping its voice take is a notice over
// Merc's bubble (src/features/exercises/stage/StageNotice.tsx), no longer a
// block in the result card. The owner judges it by eye on a phone, so this
// runs a real drill on a phone's screen with a fake microphone and checks
// what a look would: the notice comes, the sheet under it does not move, it
// covers no control, Keep keeps, "Take kept" leaves by itself, and the take
// is in Hear Yourself afterwards. The unit suite pins every state's words.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

// Written at module load: Chromium needs the file before it launches, and
// without a microphone the drill never leaves its setup.
const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

const PHONE = { width: 390, height: 844 }

/** The sheet's top edge: what would move if the notice pushed. */
async function sheetTop(page: Page): Promise<number> {
  return page
    .locator('.exercise-canvas-area')
    .evaluate((sheet) => sheet.getBoundingClientRect().top)
}

/** Every control a tap could reach whose box the notice's box overlaps. */
async function controlsUnderNotice(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const notice = document.querySelector(
      '[data-testid="exercise-take-notice"]',
    )
    if (notice === null) return ['no notice']
    const n = notice.getBoundingClientRect()
    const under: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [role="button"]',
    )) {
      if (notice.contains(el)) continue
      const b = el.getBoundingClientRect()
      if (b.width < 1 || b.height < 1) continue
      if (
        b.right > n.left &&
        b.left < n.right &&
        b.bottom > n.top &&
        b.top < n.bottom
      ) {
        under.push(el.getAttribute('aria-label') ?? el.textContent ?? '')
      }
    }
    return under
  })
}

test('a finished drill asks over Merc, keeps the take and puts it in Hear Yourself', async ({
  page,
}) => {
  test.slow()
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_advanced_features', 'true')
  })
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await waitForNav(page)
  await dismissOverlays(page)
  await openNavTab(page, 'tab-exercises')
  await page
    .locator('.exercise-card', { hasText: 'Pitch Hold' })
    .first()
    .click()

  const start = page.locator('.exercise-idle-start')
  await expect(start).toBeVisible({ timeout: 10000 })
  const before = await sheetTop(page)

  await start.click()
  const stop = page.locator('.exercise-btn-stop')
  await expect(stop).toBeVisible({ timeout: 15000 })
  // A take needs something recorded in it: let the run reach a second.
  const startedAt = Date.now()
  await expect.poll(() => Date.now() - startedAt).toBeGreaterThan(1200)
  await stop.click()

  const notice = page.getByTestId('exercise-take-notice')
  await expect(notice).toContainText('Keep this take?', { timeout: 15000 })
  await expect(notice).toContainText('Not saved unless you keep it.')
  // It is Merc's, not the card's: in his row, beside him.
  await expect(
    page
      .getByTestId('exercise-stage-coach')
      .getByTestId('exercise-take-notice'),
  ).toBeVisible()
  await expect(
    page.locator('.exercise-result-card').getByRole('button'),
  ).toHaveCount(0)
  // It pops; it does not push, and it lies over no control.
  expect(await sheetTop(page)).toBe(before)
  expect(await controlsUnderNotice(page)).toEqual([])

  await page.getByRole('button', { name: 'Keep', exact: true }).click()
  await expect(notice).toContainText('Take kept', { timeout: 15000 })
  await expect(notice).toContainText(
    'Find it in Hear Yourself, on this device.',
  )
  expect(await sheetTop(page)).toBe(before)

  // It leaves by itself, and the brief is back where it was.
  await expect(notice).toHaveCount(0, { timeout: 8000 })
  expect(await sheetTop(page)).toBe(before)

  await openNavTab(page, 'tab-voice-history')
  const history = page.getByTestId('voice-history-page')
  await expect(history).toBeVisible()
  await expect(history.getByText(/Pitch Hold/).first()).toBeVisible({
    timeout: 10000,
  })
})
