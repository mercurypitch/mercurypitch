// ============================================================
// The app's notices on a drill's stage: one, in Merc's bubble, no toast
// ============================================================
//
// While a drill's stage is on screen, the app's notices are said one at a
// time in Merc's bubble (src/features/exercises/stage/StageNotice.tsx), not
// as toasts over the drill: on a phone two "Achievement unlocked" toasts
// used to lie over the sheet's foot. The owner judges it by eye on a phone,
// so these finish a real first run with a fake microphone, which earns the
// first two achievements, and check what a look would. The take is asked
// first: the singer's own recording goes before a badge (0.9.31's review
// found the question six seconds behind the unlock, and a Try Again
// pressed meanwhile lost the take unasked). Once the question is answered,
// one notice in the bubble names both achievements, no toast is on the
// page, the sheet under it has not moved, it covers no control, and it
// goes at an upward swipe of a mouse or of a finger. The order of what the
// bubble says, and the store's queue, are unit-tested.
//
// Each check of the achievements' notice waits for the take's to be gone
// first. The two used to race on a slow runner: a take asked before the
// grants came was still leaving as the unlock popped, and its Keep and
// Discard take lay under the unlock's box (main, 19 Nov 2026).

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
const TAKE = 'exercise-take-notice'

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
 * Every notice that pops out of Merc's bubble, in order, as `testid:tone`:
 * which came first is what a look would judge, however soon it went.
 */
function recordNotices(): void {
  const seen: string[] = []
  ;(window as unknown as { __noticesSeen: string[] }).__noticesSeen = seen
  const ids = ['exercise-stage-notice', 'exercise-take-notice']
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue
        for (const el of [node, ...node.querySelectorAll('[data-testid]')]) {
          const id = (el as HTMLElement).dataset.testid ?? ''
          if (ids.includes(id))
            seen.push(`${id}:${(el as HTMLElement).dataset.tone ?? ''}`)
        }
      }
    }
  }).observe(document, { childList: true, subtree: true })
}

async function noticesSeen(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __noticesSeen: string[] }).__noticesSeen,
  )
}

/**
 * Open Pitch Hold on a phone, run it to its timer's end and come back to
 * the result: a first run, which earns the first two achievements. Returns
 * where the sheet's top edge stood before any notice came.
 */
async function finishFirstRun(page: Page): Promise<number> {
  await page.addInitScript(recordNotices)
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

/**
 * The take's question, asked first, with nothing of the achievements on
 * show before it or with it: not in the bubble, and not as a toast.
 */
async function expectTakeAskedFirst(page: Page): Promise<void> {
  const coach = page.getByTestId('exercise-stage-coach')
  await expect(coach.getByTestId(TAKE)).toContainText('Keep this take?', {
    timeout: 15000,
  })
  await expect(page.locator(NOTICE)).toHaveCount(0)
  await expect(page.getByText(/Achievement unlocked/)).toHaveCount(0)
  const seen = await noticesSeen(page)
  expect(seen[0]).toBe(`${TAKE}:ask`)
  expect(seen.filter((notice) => notice.endsWith(':unlock'))).toEqual([])
}

/** "Discard take": the question is answered, and its notice is gone. */
async function putTakeAway(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Discard take' }).click()
  await expect(page.getByTestId(TAKE)).toHaveCount(0)
}

test("a first run asks about its take first; its two achievements follow as one notice in Merc's bubble, and no toast", async ({
  page,
}) => {
  test.slow()
  const before = await finishFirstRun(page)
  await expectTakeAskedFirst(page)
  await putTakeAway(page)

  const coach = page.getByTestId('exercise-stage-coach')
  const notice = coach.locator(NOTICE)
  await expect(notice).toHaveCount(1)
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

  // It goes by itself, and the brief has the bubble again.
  await expect(notice).toHaveCount(0, { timeout: 10000 })
  await expect(coach.getByTestId(TAKE)).toHaveCount(0)
  expect(await sheetTop(page)).toBe(before)
})

test('Keep, then Try Again, keeps the take, and the achievements come after it', async ({
  page,
}) => {
  test.slow()
  await finishFirstRun(page)
  await expectTakeAskedFirst(page)
  const coach = page.getByTestId('exercise-stage-coach')
  const take = coach.getByTestId(TAKE)
  const notice = coach.locator(NOTICE)

  await page.getByRole('button', { name: 'Keep', exact: true }).click()
  await expect(take).toContainText('Take kept', { timeout: 15000 })
  await expect(notice).toHaveCount(0)

  // Try Again while "Take kept" still shows: a second run, stopped after a
  // second, which asks about its own take. The achievements wait again.
  await page.getByRole('button', { name: 'Try Again' }).click()
  const stop = page.locator('.exercise-btn-stop')
  await expect(stop).toBeVisible({ timeout: 15000 })
  const startedAt = Date.now()
  await expect.poll(() => Date.now() - startedAt).toBeGreaterThan(1200)
  await stop.click()
  await expectTakeAskedFirst(page)
  await putTakeAway(page)

  // Answered: the first run's achievements, not lost on the way.
  await expect(notice).toHaveCount(1)
  await expect(notice).toContainText('2 new achievements')
  await expect(notice).toContainText('First Note, Drill Sergeant')

  // The kept take is in Hear Yourself.
  await openNavTab(page, 'tab-voice-history')
  const history = page.getByTestId('voice-history-page')
  await expect(history).toBeVisible()
  await expect(history.getByText(/Pitch Hold/).first()).toBeVisible({
    timeout: 10000,
  })
})

test('the notice follows an upward swipe of a mouse and goes, a short drag springs back @smoke', async ({
  page,
}) => {
  test.slow()
  await finishFirstRun(page)
  await expectTakeAskedFirst(page)
  await putTakeAway(page)
  const notice = page.getByTestId('exercise-stage-coach').locator(NOTICE)
  await expect(notice).toHaveCount(1)
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
  await expect(page.getByTestId(TAKE)).toHaveCount(0)
})

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true })

  test('a finger swiping the notice up throws it away', async ({ page }) => {
    test.slow()
    await finishFirstRun(page)
    await expectTakeAskedFirst(page)
    await putTakeAway(page)
    const notice = page.getByTestId('exercise-stage-coach').locator(NOTICE)
    await expect(notice).toHaveCount(1)
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
