// ============================================================
// The low tier keeps every scrim see-through
// ============================================================
//
// Owner report, 2026-10-21, on a tablet: in the Karaoke mixer, after playing
// a song and opening a few menus, the mixer's Tour showed only its tooltip --
// the app behind it was gone. The Zen song list then drew its songs as grey
// boxes, and Home's Learn dialog opened over an empty screen. A reload made
// it all go away.
//
// The frame sampler (src/lib/device-tier.ts) had dropped the tablet to the
// low tier mid-song, for the rest of the session, and performance-mode.css
// gave every element whose class CONTAINED "overlay", "sheet" or "modal" an
// opaque --bg-card on that tier: the tour's full-screen overlay, the Learn
// dialog's backdrop, the rows of a sheet. Here the tier is forced the way a
// singer can force it -- Settings, Quality, "Performance" -- and every surface
// of the report is opened on it.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { openSeededSong } from './helpers/mixer-song'
import { dismissOverlays } from './helpers/ui'

test.use({ permissions: ['microphone'] })

const DESK = { width: 1440, height: 900 }

/** The alpha of a computed colour: rgba(), rgb() or color(srgb … / a). */
function alphaOf(color: string): number {
  if (color === 'transparent') return 0
  const slash = /\/\s*([\d.]+)\s*\)$/.exec(color)
  if (slash !== null) return Number(slash[1])
  const parts = /rgba?\(([^)]+)\)/.exec(color)?.[1].split(',') ?? []
  return parts.length === 4 ? Number(parts[3]) : 1
}

/** Settings > Display & Controls > Quality > Performance, before boot. */
async function chooseLowTier(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('pitchperfect_performance_mode', 'low')
  })
}

const backgroundOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor)

const perfTier = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.perfTier)

test.describe('on the low tier', () => {
  test.beforeEach(async ({ page }) => {
    await chooseLowTier(page)
  })

  test('the mixer tour leaves the mixer on screen around its spotlight', async ({
    page,
  }) => {
    await openSeededSong(page, DESK)
    expect(await perfTier(page)).toBe('low')

    await page.getByRole('button', { name: 'Tour', exact: true }).click()
    await expect(page.locator('[class*="walkthroughStepTitle"]')).toHaveText(
      'Mix the stems',
    )

    // The overlay only catches clicks; the dim is the spotlight's own shadow.
    const overlay = await backgroundOf(page, '[class*="walkthroughOverlay"]')
    expect(alphaOf(overlay), `overlay background ${overlay}`).toBe(0)

    // And the dim stays a dim: the stem controls show through the hole.
    const stems = page.locator('[data-tour="mixer.stems"]')
    const spotlight = page.locator('[class*="walkthroughHighlight"]')
    await expect
      .poll(async () => {
        const target = await stems.boundingBox()
        const lit = await spotlight.boundingBox()
        return (
          target !== null &&
          lit !== null &&
          Math.abs(target.x - lit.x) < 12 &&
          Math.abs(target.width - lit.width) < 24
        )
      })
      .toBe(true)
  })

  test("Home's Learn dialog opens over the page, not over nothing", async ({
    page,
  }) => {
    await page.setViewportSize(DESK)
    await page.goto('/#/home')
    await dismissOverlays(page)
    expect(await perfTier(page)).toBe('low')

    await page.getByTestId('home-learn').click()
    const scrim = page.locator('[class*="walkthroughSelectionOverlay"]')
    await expect(scrim).toBeVisible()
    const color = await backgroundOf(
      page,
      '[class*="walkthroughSelectionOverlay"]',
    )
    expect(alphaOf(color), `Learn backdrop ${color}`).toBeLessThan(1)
    expect(alphaOf(color), `Learn backdrop ${color}`).toBeGreaterThan(0)
  })

  test("the Zen song list draws its songs on the sheet's own colour", async ({
    page,
  }) => {
    await openSeededSong(page, DESK)
    await page.getByRole('button', { name: 'Zen', exact: true }).click()
    await page.getByRole('button', { name: 'Open the song list' }).click()

    const row = page.getByTestId('sheet-panel').locator('li button').first()
    await expect(row).toBeVisible()
    for (const selector of [
      '[data-testid="sheet-panel"] li button',
      '[data-testid="sheet-panel"] ul',
      '[data-testid="sheet-panel"] p',
    ]) {
      const color = await backgroundOf(page, selector)
      expect(alphaOf(color), `${selector} background ${color}`).toBe(0)
    }
  })
})
