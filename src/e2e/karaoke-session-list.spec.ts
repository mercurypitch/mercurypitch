// ============================================================
// The Karaoke session list scrolls once, and fits two cards
// ============================================================
//
// Reported about a phone: "the page scrolls and then when you hit bottom, the
// inside container also scrolls, but sometimes its hard to get that inner
// container scroll" — and the cards are "quite big on mobile, in height too,
// so I basically see like one and top of second when scrolling".
//
// Measured here before the fix, at 390x844:
//
//   .panel-content         674 visible / 1857 scrollable
//   .history-list-inline   643 visible / 3197 scrollable, max-height 644px
//   .uvr-session-result    386px tall
//
// The stylesheet half is pinned in
// `src/tests/karaoke-session-list-scroll.test.ts`; this is the half that
// needs a layout engine.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

interface ListE2EStore {
  initSessionStore: () => Promise<void>
  getUvrSession: (id: string) => unknown
  importUvrSessionDurable: (session: Record<string, unknown>) => Promise<void>
}

const PHONE = { width: 390, height: 844 }
// Enough to overflow the panel several times over, which is what makes a
// nested scroller reachable — and unreachable — in the first place.
const SEEDED = 6
const SILENT_WAV = 'data:audio/wav;base64,UklGRg=='

test.use({ viewport: PHONE })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await dismissOverlays(page)
  await page.waitForFunction(() => window.__pp?.appStore !== undefined)

  await page.evaluate(
    async ({ audioUrl, count }) => {
      const store = window.__pp?.appStore as unknown as ListE2EStore
      await store.initSessionStore()
      for (let index = 1; index <= count; index += 1) {
        const sessionId = `e2e-session-list-${index}`
        if (store.getUvrSession(sessionId) !== undefined) continue
        await store.importUvrSessionDurable({
          sessionId,
          status: 'completed',
          progress: 100,
          originalFile: {
            name: `Josh Woodward — Goodbye to Spring ${index}`,
            size: 0,
            mimeType: 'audio/mpeg',
          },
          outputs: { vocal: audioUrl, instrumental: audioUrl },
          processingMode: 'server',
          provider: 'examples',
          createdAt: Date.now() - index * 1000,
        })
      }
    },
    { audioUrl: SILENT_WAV, count: SEEDED },
  )

  await page.goto('/#/karaoke')
  await dismissOverlays(page)
  await expect(page.locator('.uvr-session-result').first()).toBeVisible({
    timeout: 15_000,
  })
})

test('scrolls in one place, not two @smoke', async ({ page }) => {
  const scrollers = await page.evaluate(() => {
    const panel = document.querySelector('.panel-content')
    if (panel === null) return null
    const found: string[] = []
    // Only inside the panel: the sidebar and any open overlay are their own
    // surfaces and are not what a finger on the list is fighting.
    for (const node of panel.querySelectorAll<HTMLElement>('*')) {
      const style = getComputedStyle(node)
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        found.push(node.className.toString())
      }
    }
    return {
      inside: found,
      panelScrolls: panel.scrollHeight > panel.clientHeight + 1,
    }
  })

  expect(scrollers).not.toBeNull()
  // The panel itself still scrolls — it has to; it is now the only one.
  expect(scrollers?.panelScrolls).toBe(true)
  expect(scrollers?.inside).toEqual([])
})

test('shows the list is scrollable by the page alone @smoke', async ({
  page,
}) => {
  // The behaviour behind the complaint: reaching the end of the page used to
  // hand the gesture to a second box. Now one scroll runs the whole list.
  const list = page.locator('.history-list')
  const before = await list.evaluate((element) => ({
    scrolls: element.scrollHeight > element.clientHeight + 1,
    overflowY: getComputedStyle(element).overflowY,
  }))
  expect(before.overflowY).toBe('visible')
  expect(before.scrolls).toBe(false)

  const panel = page.locator('.panel-content')
  await panel.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect
    .poll(() => panel.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0)

  // The last card is reachable without ever touching a second scroller.
  await expect(page.locator('.uvr-session-result').last()).toBeInViewport()
})

test('fits two cards on a phone screen @smoke', async ({ page }) => {
  const measured = await page.evaluate(() => {
    const panel = document.querySelector('.panel-content')
    const card = document.querySelector('.uvr-session-result')
    if (panel === null || card === null) return null
    const actions = card.querySelector('.session-result-actions')
    const children = actions === null ? [] : [...actions.children]
    return {
      cardHeight: Math.round(card.getBoundingClientRect().height),
      panelHeight: panel.clientHeight,
      // Same row means same top, within a pixel of rounding.
      actionTops: children.map((child) =>
        Math.round(child.getBoundingClientRect().top),
      ),
    }
  })

  expect(measured).not.toBeNull()
  const { cardHeight = 0, panelHeight = 0, actionTops = [] } = measured ?? {}

  // Was 386 in a 674 panel — one and a bit. Two whole cards now.
  expect(cardHeight * 2).toBeLessThanOrEqual(panelHeight)

  // The 40px that bought: the two actions share a row instead of stacking.
  expect(actionTops.length).toBeGreaterThanOrEqual(2)
  expect(Math.max(...actionTops) - Math.min(...actionTops)).toBeLessThanOrEqual(
    2,
  )
})

test('never scrolls sideways doing it @smoke', async ({ page }) => {
  const sideways = await page.evaluate(() => {
    const doc = document.scrollingElement
    return doc === null ? 0 : doc.scrollWidth - doc.clientWidth
  })
  expect(sideways).toBe(0)
})
