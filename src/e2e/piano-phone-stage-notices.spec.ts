// ============================================================
// The Piano tab's phone stage: the notices stand on its transport
// ============================================================
//
// The phone stage's transport spans the window's foot, on the tab bar, in
// its one column upright and on its side alike (narrower than 768 px; wider,
// the tab keeps its desk). The notices stood on the tab bar, so one lay over
// the transport's buttons: at 390x844 a notice at 722 to 780 over a bar from
// 706, and at 740x360 one at 242 to 288 over a bar from 222. The bar now
// publishes its room as the page's dock (TransportBar, lib/foot-space.ts),
// and the notices stand on it.
//
// Geometry, so only a browser can tell: a phone's user agent and touch.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

test.use({
  hasTouch: true,
  isMobile: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
})

const BAR = '[data-testid="mobile-transport-bar"]'

/** The Piano tab, this server only, its tour already offered. */
async function openPiano(
  page: Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport)
  await page.route(
    (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
    (route) => route.abort(),
  )
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_page_tour_offered_piano', 'true')
  })
  await page.goto('/#/piano')
  await dismissOverlays(page)
  await page.reload()
  await expect(page.locator(BAR)).toBeVisible({ timeout: 20_000 })
}

/** A notice as the app raises one, at rest: its box, and the bar's. */
async function noticeAndBar(
  page: Page,
): Promise<{ notice: number[]; bar: number[] }> {
  await page.evaluate(() => {
    const pp = (
      window as unknown as {
        __pp: {
          appStore: {
            showNotification: (
              message: string,
              type: string,
              options: { durationMs: number },
            ) => void
          }
        }
      }
    ).__pp
    pp.appStore.showNotification(
      'Your mic is off. Turn it on to be heard and scored.',
      'info',
      { durationMs: 60_000 },
    )
  })
  const notice = page
    .getByRole('region', { name: 'Notifications' })
    .locator('> div')
    .first()
  await expect(notice).toBeVisible()
  await notice.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  const box = async (sel: string): Promise<number[]> =>
    page.evaluate((s) => {
      const r = document.querySelector(s)!.getBoundingClientRect()
      return [r.left, r.top, r.right, r.bottom].map(Math.round)
    }, sel)
  return {
    notice: await notice.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return [r.left, r.top, r.right, r.bottom].map(Math.round)
    }),
    bar: await box(BAR),
  }
}

for (const size of [
  { width: 390, height: 844 },
  { width: 740, height: 360 },
]) {
  test(`at ${size.width}x${size.height}, a notice stands on the transport, clear of its buttons`, async ({
    page,
  }) => {
    await openPiano(page, size)

    const { notice, bar } = await noticeAndBar(page)

    // Its foot on the bar's top, within the stack's own gap of it.
    expect(
      {
        onTheBar: notice[3] <= bar[1] && notice[3] >= bar[1] - 24,
        inTheWindow: notice[1] >= 0,
      },
      `notice ${notice.join(', ')}, bar ${bar.join(', ')}`,
    ).toEqual({ onTheBar: true, inTheWindow: true })
  })
}
