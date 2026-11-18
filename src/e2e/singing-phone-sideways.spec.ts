// ============================================================
// The Singing tab on a phone held on its side
// ============================================================
//
// A phone on its side is wider than the 768 px breakpoint, so the tab drew
// its desktop panel there: the sidebar, the top bar, the Vocal Guide header
// and the Performance monitor took the height, and at 844x390 the notes had
// 8 px. The narrower phones on their side had the phone stage already, in
// its portrait column, which left the notes 97 px of 360. Now every phone
// on its side gets the phone stage in two columns (src/App.tsx,
// SingingMobileStage): the song, the scrubber and the transport down the
// left, the notes the full height beside them; and the sidebar folds into
// the header's menu, as it does upright. Upright, on a tablet and at a desk
// nothing changes.
//
// Geometry, so only a browser can tell. A phone's user agent and touch,
// because a coarse pointer is half of what makes a phone on its side: a
// desk's window of the same size keeps the desktop panel.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

const PHONE = {
  hasTouch: true,
  isMobile: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
}

/** Phones on their side, as their browsers report them: two large, two small. */
const SIDEWAYS = [
  { width: 844, height: 390 },
  { width: 932, height: 430 },
  { width: 740, height: 360 },
  { width: 667, height: 375 },
] as const

const STAGE = '[data-testid="singing-mobile-stage"]'

/** The Singing tab, this server only, nothing over it. */
async function openSinging(
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
  })
  await page.goto('/#/singing')
  // The welcome and the plan are spent in storage, and a fresh load reads
  // them: the welcome's dialog, hidden, still takes the taps it covers.
  await dismissOverlays(page)
  await page.reload()
}

interface Sideways {
  /** The notes' height, as a share of the window's. */
  notesShare: number
  /** The transport ends left of where the notes begin. */
  besideTheControls: boolean
  /** The notes end above the tab bar, where there is one. */
  clearOfTheTabBar: boolean
  sidewaysScroll: number
  pageScroll: number
  /** Each control a singer needs: in the window, and a tap on it lands on it. */
  unreachable: string[]
}

function measureStage(page: Page): Promise<Sideways> {
  return page.evaluate((sel) => {
    const stage = document.querySelector<HTMLElement>(sel)
    if (stage === null) throw new Error('no phone stage')
    const notes = stage
      .querySelector<HTMLElement>('[data-stage-canvas]')
      ?.getBoundingClientRect()
    const transport = stage
      .querySelector<HTMLElement>('[data-testid="mobile-transport-bar"]')
      ?.getBoundingClientRect()
    if (notes === undefined || transport === undefined) {
      throw new Error('the stage has no notes or no transport')
    }
    const bar = document
      .querySelector('[data-tour="mobile-tabbar"]')
      ?.getBoundingClientRect()
    const scroller = document.scrollingElement ?? document.documentElement
    const names = [
      'Choose a song',
      'Key, scale and playback options',
      'Start the mic',
      'Play',
      'Practice options',
    ]
    const unreachable = names.filter((name) => {
      const button = [...stage.querySelectorAll('button')].find(
        (element) => element.getAttribute('aria-label') === name,
      )
      if (button === undefined) return true
      const r = button.getBoundingClientRect()
      const hit = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      )
      return !(
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        r.left >= 0 &&
        r.right <= innerWidth &&
        hit !== null &&
        button.contains(hit)
      )
    })
    return {
      notesShare: notes.height / innerHeight,
      besideTheControls: transport.right <= notes.left + 0.5,
      clearOfTheTabBar:
        bar === undefined || bar.height === 0 || notes.bottom <= bar.top + 0.5,
      sidewaysScroll: scroller.scrollWidth - scroller.clientWidth,
      pageScroll: scroller.scrollHeight - scroller.clientHeight,
      unreachable,
    }
  }, STAGE)
}

test.describe('a phone on its side', () => {
  test.use(PHONE)

  test('gives the notes at least 60% of the window, and nothing scrolls sideways @smoke', async ({
    page,
  }) => {
    await openSinging(page, SIDEWAYS[0])
    await expect(page.locator(STAGE)).toBeVisible()

    const stage = await measureStage(page)

    expect(stage.notesShare).toBeGreaterThanOrEqual(0.6)
    expect(stage.sidewaysScroll).toBe(0)
  })

  for (const size of SIDEWAYS) {
    test(`at ${size.width}x${size.height}, lays the notes the full height beside the controls, every control in reach`, async ({
      page,
    }) => {
      await openSinging(page, size)
      await expect(page.locator(STAGE)).toBeVisible()
      // Not the desktop panel's stage, which held the notes at 8 px.
      await expect(page.locator('#canvas-container')).toHaveCount(0)

      const stage = await measureStage(page)

      expect(stage.notesShare).toBeGreaterThanOrEqual(0.6)
      expect({
        besideTheControls: stage.besideTheControls,
        clearOfTheTabBar: stage.clearOfTheTabBar,
        sidewaysScroll: stage.sidewaysScroll,
        pageScroll: stage.pageScroll,
        unreachable: stage.unreachable,
      }).toEqual({
        besideTheControls: true,
        clearOfTheTabBar: true,
        sidewaysScroll: 0,
        pageScroll: 0,
        unreachable: [],
      })
    })
  }

  test('folds the sidebar into the menu, as upright', async ({ page }) => {
    await openSinging(page, SIDEWAYS[0])
    const sidebar = page.locator('aside.app-sidebar')
    const leftEdge = async (): Promise<number> =>
      Math.round((await sidebar.boundingBox())?.x ?? Number.NaN)

    // Off the page, not beside the stage.
    expect((await sidebar.boundingBox())?.x ?? 0).toBeLessThan(0)

    await page.getByRole('button', { name: 'Menu', exact: true }).tap()
    await expect.poll(leftEdge).toBe(0)

    await page
      .locator('.sidebar-backdrop')
      .tap({ position: { x: 600, y: 200 } })
    await expect.poll(leftEdge).toBeLessThan(0)
  })

  test('keeps the same stage as the phone turns, so the notes are not drawn again', async ({
    page,
  }) => {
    await openSinging(page, { width: 390, height: 844 })
    await expect(page.locator(STAGE)).toBeVisible()
    await page
      .locator(STAGE)
      .evaluate((stage) => stage.setAttribute('data-was-upright', ''))

    await page.setViewportSize(SIDEWAYS[0])

    await expect(page.locator(`${STAGE}[data-was-upright]`)).toBeVisible()
    expect((await measureStage(page)).besideTheControls).toBe(true)
  })
})

test.describe('everywhere else, nothing changes', () => {
  test.describe('a phone upright', () => {
    test.use(PHONE)

    test('keeps one column: the chips, the notes, then the transport', async ({
      page,
    }) => {
      await openSinging(page, { width: 390, height: 844 })
      await expect(page.locator(STAGE)).toBeVisible()

      const column = await page.evaluate((sel) => {
        const stage = document.querySelector<HTMLElement>(sel)!
        const box = (selector: string): DOMRect =>
          stage.querySelector(selector)!.getBoundingClientRect()
        const notes = box('[data-stage-canvas]')
        const chips = box('[data-tour="singing-mobile-chips"]')
        const transport = box('[data-testid="mobile-transport-bar"]')
        return {
          fullWidth: Math.round(notes.width) === innerWidth,
          notesUnderTheChips: notes.top >= chips.bottom - 0.5,
          transportUnderTheNotes: transport.top >= notes.bottom - 0.5,
        }
      }, STAGE)

      expect(column).toEqual({
        fullWidth: true,
        notesUnderTheChips: true,
        transportUnderTheNotes: true,
      })
    })
  })

  test.describe('a tablet on its side', () => {
    test.use({ hasTouch: true, isMobile: true })

    test('keeps the desktop panel beside the sidebar', async ({ page }) => {
      await openSinging(page, { width: 1024, height: 768 })

      await expect(page.locator('#practice-panel')).toBeVisible()
      await expect(page.locator(STAGE)).toHaveCount(0)
      expect((await page.locator('aside.app-sidebar').boundingBox())?.x).toBe(0)
    })
  })

  test.describe('a desk', () => {
    for (const size of [
      { width: 1440, height: 900 },
      // As short as a phone on its side, with a mouse: still a desk.
      { width: 844, height: 390 },
    ]) {
      test(`keeps the desktop panel at ${size.width}x${size.height}`, async ({
        page,
      }) => {
        await openSinging(page, size)

        await expect(page.locator('#practice-panel')).toBeVisible()
        await expect(page.locator(STAGE)).toHaveCount(0)
        await expect(
          page.getByRole('button', { name: 'Menu', exact: true }),
        ).toBeHidden()
      })
    }
  })
})
