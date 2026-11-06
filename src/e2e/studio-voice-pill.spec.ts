// Studio voice pill — beside a collapsed sidebar the voice pill sits inside the rail, clear of the lanes and their role plates, with a mouse and on a touch screen; on a phone it stays in the header.
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

/** How far apart two boxes are; negative when they overlap. */
function gap(a: Box, b: Box): number {
  return Math.max(
    b.left - a.right,
    a.left - b.right,
    b.top - a.bottom,
    a.top - b.bottom,
  )
}

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
      // Enough lanes to run under the pill's corner.
      for (const name of ['Bass', 'Keys', 'Drums', 'Pad', 'Choir'])
        await importStudioAudio(page, name, 1)
      await expect(page.locator('.app-sidebar.collapsed')).toBeVisible()
      await expect(page.locator('[data-voice-control-hud]')).toBeVisible()

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
