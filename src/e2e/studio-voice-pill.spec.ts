// Studio voice pill — beside a collapsed sidebar the voice pill sits inside the rail, and with the sidebar open in the sidebar's foot, clear of the lanes, their instrument chips and the sidebar's own controls at any window height, with a mouse and on a touch screen; on a phone it stays in the header.
import { expect, type Page, test } from '@playwright/test'
import { importStudioAudio, openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** The pill's box, the sidebar's, and every lane row's, as painted. */
async function corner(
  page: Page,
): Promise<{ pill: Box; rail: Box | null; lanes: Box[] }> {
  return page.evaluate(() => {
    const box = (element: Element): Box => {
      const r = element.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    }
    const rail = document.querySelector('.app-sidebar')
    return {
      pill: box(document.querySelector('[data-voice-control-hud]')!),
      rail:
        rail === null || rail.getBoundingClientRect().width === 0
          ? null
          : box(rail),
      lanes: [...document.querySelectorAll('[data-studio-track]')].map(box),
    }
  })
}

/** Waits out the animations that run to an end: the pill and the sidebar
 *  slide as it opens. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
}

/** Every sidebar control that shows under the pill, with how many of the
 *  pill's pixels it takes: each pixel hit-tested with the pill hidden, so a
 *  control counts only where it is painted and would take the press. */
async function sidebarUnderPill(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const hud = document.querySelector<HTMLElement>('[data-voice-control-hud]')!
    const sidebar = document.querySelector('.app-sidebar')!
    const r = hud.getBoundingClientRect()
    const controls =
      'button, a[href], input, select, textarea, [role="slider"], [role="switch"]'
    const under: Record<string, number> = {}
    hud.style.visibility = 'hidden'
    for (let y = Math.ceil(r.top); y < r.bottom; y++)
      for (let x = Math.ceil(r.left); x < r.right; x++) {
        const control = document.elementFromPoint(x, y)?.closest(controls)
        if (control === null || control === undefined) continue
        if (!sidebar.contains(control)) continue
        const name =
          control.getAttribute('aria-label') ??
          control.textContent?.trim().slice(0, 40) ??
          control.tagName
        under[name] = (under[name] ?? 0) + 1
      }
    hud.style.visibility = ''
    return under
  })
}

/** How far apart two boxes are; negative when they overlap. */
function gap(a: Box, b: Box): number {
  return Math.max(
    b.left - a.right,
    a.left - b.right,
    b.top - a.bottom,
    a.top - b.bottom,
  )
}

const LANE_NAMES = [
  'Bass',
  'Keys',
  'Drums',
  'Pad',
  'Choir',
  'Organ',
  'Brass',
  'Strings',
  'Synth',
  'Shaker',
  'Horns',
  'Harp',
] as const

const RAIL_LAYOUTS = [
  {
    name: 'a computer',
    viewport: { width: 1280, height: 720 },
    touch: false,
  },
  {
    name: 'a tablet',
    viewport: { width: 1024, height: 768 },
    touch: true,
  },
] as const

for (const layout of RAIL_LAYOUTS) {
  test.describe(`Studio voice pill on ${layout.name}`, () => {
    test.use({
      viewport: layout.viewport,
      hasTouch: layout.touch,
      isMobile: layout.touch,
    })

    test('sits inside the collapsed rail, at least 2 px clear of every lane', async ({
      page,
    }) => {
      test.setTimeout(90_000)
      await openArrangement(page)
      await expect(page.locator('.app-sidebar.collapsed')).toBeVisible()
      await expect(page.locator('[data-voice-control-hud]')).toBeVisible()
      // Lanes until one runs past the pill's foot, so the clearance below
      // has a lane beside the pill to measure. Compact lanes are 64 px.
      for (const name of LANE_NAMES) {
        const { pill, lanes } = await corner(page)
        if (lanes.some((lane) => lane.bottom > pill.bottom)) break
        await importStudioAudio(page, name, 1)
      }

      const { pill, rail, lanes } = await corner(page)
      expect(rail).not.toBeNull()
      expect(pill.left).toBeGreaterThanOrEqual(rail!.left)
      expect(pill.right).toBeLessThanOrEqual(rail!.right)
      // Some lane runs past the pill's height, so the check below has a
      // neighbour to measure against.
      expect(lanes.some((lane) => lane.bottom > pill.bottom)).toBe(true)
      for (const lane of lanes)
        expect(gap(pill, lane)).toBeGreaterThanOrEqual(2)
    })

    test("with the sidebar open, sits in the sidebar's empty foot, clear of every lane", async ({
      page,
    }) => {
      test.setTimeout(90_000)
      await openArrangement(page)
      for (const name of LANE_NAMES.slice(0, 10))
        await importStudioAudio(page, name, 1)
      await page.getByRole('button', { name: 'Expand sidebar' }).click()
      await expect(page.locator('.app-sidebar:not(.collapsed)')).toBeVisible()
      const hud = page.locator('[data-voice-control-hud]')
      await expect(hud).toBeVisible()
      await settle(page)
      const { pill, rail, lanes } = await corner(page)
      expect(lanes.some((lane) => lane.bottom > pill.bottom)).toBe(true)
      expect.soft(pill.left).toBeGreaterThanOrEqual(rail!.left)
      expect.soft(pill.right).toBeLessThanOrEqual(rail!.right)
      for (const lane of lanes)
        expect.soft(gap(pill, lane)).toBeGreaterThanOrEqual(2)
      // Under it, the sidebar's own ground and none of its links.
      const under = await hud.evaluate((element) => {
        const r = element.getBoundingClientRect()
        ;(element as HTMLElement).style.visibility = 'hidden'
        const found = [
          [r.left + 2, r.top + 2],
          [r.right - 2, r.top + 2],
          [r.left + 2, r.bottom - 2],
          [r.right - 2, r.bottom - 2],
        ].map(([x, y]) => document.elementFromPoint(x, y)?.tagName)
        ;(element as HTMLElement).style.visibility = ''
        return found
      })
      expect.soft(under).toEqual(['ASIDE', 'ASIDE', 'ASIDE', 'ASIDE'])
    })
  })
}

// The sidebar's controls reach its foot in a window under about 430 px
// tall: at 1280x400 the pill sat on Auto-calibrate.
const WINDOWS = [
  { width: 1280, height: 400 },
  { width: 1280, height: 430 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
] as const

for (const viewport of WINDOWS) {
  test.describe(`Studio voice pill in a ${viewport.width}x${viewport.height} window`, () => {
    test.use({ viewport })

    test("with the sidebar open, shows none of the sidebar's controls under it, at the sidebar's top or its end", async ({
      page,
    }) => {
      test.setTimeout(90_000)
      await openArrangement(page)
      await page.getByRole('button', { name: 'Expand sidebar' }).click()
      const sidebar = page.locator('.app-sidebar:not(.collapsed)')
      await expect(sidebar).toBeVisible()
      await expect(page.locator('[data-voice-control-hud]')).toBeVisible()
      await settle(page)

      const under: Record<string, Record<string, number>> = {}
      for (const end of ['top', 'end'] as const) {
        await sidebar.evaluate((element, end) => {
          element.scrollTop = end === 'top' ? 0 : element.scrollHeight
        }, end)
        under[end] = await sidebarUnderPill(page)
      }

      console.log(
        `[voice-pill] ${viewport.width}x${viewport.height} ${JSON.stringify(under)}`,
      )
      expect(under).toEqual({ top: {}, end: {} })
    })
  })
}

test.describe('Studio voice pill on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('stays in the header, off the lanes', async ({ page }) => {
    await openArrangement(page)
    await importStudioAudio(page, 'Bass', 1)
    const pill = page.locator('[data-voice-control-hud]')
    await expect(pill).toHaveAttribute('data-placement', 'docked')
    await expect(studioRegion(page)).toBeVisible()
    const { pill: box, lanes } = await corner(page)
    for (const lane of lanes) expect(gap(box, lane)).toBeGreaterThanOrEqual(2)
  })
})
