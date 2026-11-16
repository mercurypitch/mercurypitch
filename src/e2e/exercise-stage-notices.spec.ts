// ============================================================
// The app's notices on a drill's stage: one, in Merc's bubble, no toast
// ============================================================
//
// While a drill's stage is on screen, the app's notices are said one at a
// time in Merc's bubble (src/features/exercises/stage/StageNotice.tsx), not
// as toasts over the drill: on a phone two "Achievement unlocked" toasts
// used to lie over the sheet's foot. The owner judges it by eye on a phone,
// so these finish a real first run with a fake microphone, which earns the
// first two achievements, and check what a look would: one notice in the
// bubble names both, no toast is on the page, the sheet under it has not
// moved, it covers no control, and it goes at an upward swipe of a mouse
// or of a finger, leaving the bubble to the take's question. The order of
// what the bubble says, and the store's queue, are unit-tested.

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
  viewport: { width: 390, height: 844 },
})

const NOTICE = '[data-testid="exercise-stage-notice"]'

/** The sheet's top edge: what would move if the notice pushed. */
async function sheetTop(page: Page): Promise<number> {
  return page
    .locator('.exercise-canvas-area')
    .evaluate((sheet) => sheet.getBoundingClientRect().top)
}

/** Every control a tap could reach whose box the notice's box overlaps. */
async function controlsUnderNotice(page: Page): Promise<string[]> {
  return page.locator(NOTICE).evaluate((notice) => {
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

/**
 * Open Pitch Hold on a phone, run it to its timer's end and come back to
 * the result: a first run, which earns the first two achievements. Returns
 * where the sheet's top edge stood before any notice came.
 */
async function finishFirstRun(page: Page): Promise<number> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_advanced_features', 'true')
  })
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
  await expect(page.locator(NOTICE)).toHaveCount(0)
  const before = await sheetTop(page)

  await start.click()
  await expect(page.locator('.exercise-btn-stop')).toBeVisible({
    timeout: 15000,
  })
  // The run ends by itself when its timer runs out, which makes it a whole
  // run: one stopped early is not a result, and earns nothing.
  await expect(page.locator('.exercise-result-card')).toBeVisible({
    timeout: 40000,
  })
  return before
}

test("a first run's two achievements are one notice in Merc's bubble, and no toast", async ({
  page,
}) => {
  test.slow()
  const before = await finishFirstRun(page)

  const coach = page.getByTestId('exercise-stage-coach')
  const notice = coach.locator(NOTICE)
  await expect(notice).toHaveCount(1, { timeout: 15000 })
  await expect(notice).toContainText('2 new achievements')
  await expect(notice).toContainText('First Note, Drill Sergeant')
  await expect(notice).toHaveAttribute('data-tone', 'unlock')
  // Nothing anywhere else says it: the toast host draws nothing.
  await expect(
    page.getByRole('region', { name: 'Notifications' }).locator('> *'),
  ).toHaveCount(0)
  await expect(page.getByText(/Achievement unlocked/)).toHaveCount(0)
  // It pops; it does not push, and it lies over no control.
  expect(await sheetTop(page)).toBe(before)
  expect(await controlsUnderNotice(page)).toEqual([])

  // It goes by itself, and the take's question has the bubble.
  await expect(notice).toHaveCount(0, { timeout: 10000 })
  await expect(coach.getByTestId('exercise-take-notice')).toContainText(
    'Keep this take?',
  )
  expect(await sheetTop(page)).toBe(before)
})

test('the notice follows an upward swipe of a mouse and goes, a short drag springs back @smoke', async ({
  page,
}) => {
  test.slow()
  await finishFirstRun(page)
  const notice = page.getByTestId('exercise-stage-coach').locator(NOTICE)
  await expect(notice).toHaveCount(1, { timeout: 15000 })
  const words = notice.locator('p')
  const box = (await words.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  // A drag shorter than the throw springs back, and is not a tap.
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - 12, { steps: 4 })
  await page.mouse.up()
  await expect(notice).toHaveCount(1)
  await expect(notice).toContainText('2 new achievements')

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - 48, { steps: 8 })
  await page.mouse.up()
  await expect(notice).toHaveCount(0)
  await expect(
    page
      .getByTestId('exercise-stage-coach')
      .getByTestId('exercise-take-notice'),
  ).toContainText('Keep this take?')
})

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true })

  test('a finger swiping the notice up throws it away', async ({ page }) => {
    test.slow()
    await finishFirstRun(page)
    const notice = page.getByTestId('exercise-stage-coach').locator(NOTICE)
    await expect(notice).toHaveCount(1, { timeout: 15000 })
    const box = (await notice.locator('p').boundingBox())!
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }

    // Starts on the words themselves, which take the vertical swipe.
    const client = await page.context().newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point],
    })
    for (let step = 1; step <= 8; step++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...point, y: point.y - step * 6 }],
      })
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })

    await expect(notice).toHaveCount(0)
  })
})
