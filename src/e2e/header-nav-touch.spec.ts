// Header nav touch targets — on a phone on its side, every tab in the header's nav takes a press 44 px tall and as wide as the 8 px between tabs allows, without taking a neighbour's, and a tap just under a tab opens it.
import { expect, test } from '@playwright/test'
import { type HitArea, hitArea, sharePress } from './helpers/hit-area'
import { dismissOverlays, waitForNav } from './helpers/ui'

test.use({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
})

test('on a phone on its side, each header tab takes a 44 px tall press, as wide as its neighbours leave it, and none of theirs', async ({
  page,
}) => {
  await page.goto('/')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  const tabs = page.locator('#app-tabs .app-tab')
  const areas: (HitArea & { name: string })[] = []
  for (const tab of await tabs.all()) {
    if (!(await tab.isVisible())) continue
    const name =
      (await tab.getAttribute('aria-label')) ??
      (await tab.textContent())?.trim() ??
      'tab'
    areas.push({ name, ...(await hitArea(tab)) })
  }
  expect(areas.length).toBeGreaterThan(4)
  // The room the strip makes for the presses moves nothing: each tab stays
  // centred in the header's row.
  const header = (await page.locator('header').first().boundingBox())!
  const middle = header.y + header.height / 2

  for (const [index, area] of areas.entries()) {
    console.log(
      `[nav-touch] ${area.name} box ${area.box.map(Math.round).join('x')} hit ${area.hit.join('x')}`,
    )
    expect.soft(area.hit[1], `${area.name} height`).toBeGreaterThanOrEqual(44)
    expect
      .soft(
        Math.abs((area.rect[1] + area.rect[3]) / 2 - middle),
        `${area.name} off the row's middle`,
      )
      .toBeLessThanOrEqual(1)
    // Tabs stand 8 px apart, so each reaches 4 px either side, to the middle
    // of each gap. Hit-testing steps a whole pixel at a time from the centre,
    // so it can read a pixel short of the box it finds.
    expect
      .soft(area.hit[0], `${area.name} width`)
      .toBeGreaterThanOrEqual(Math.min(44, area.box[0] + 8) - 1)
    const next = areas[index + 1]
    if (next !== undefined)
      expect
        .soft(
          sharePress(area.rect, next.rect),
          `${area.name} and ${next.name} share a press`,
        )
        .toBe(false)
  }
})

test('a tap just under a tab, off its drawn box, opens that tab', async ({
  page,
}) => {
  await page.goto('/')
  await waitForNav(page, 30_000)
  await dismissOverlays(page)
  const singing = page.locator('#tab-singing')
  await expect(singing).not.toHaveClass(/\bactive\b/)
  const box = (await singing.boundingBox())!

  // 18 px under its centre: 6 px below the 24 px it draws.
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2 + 18)

  await expect(singing).toHaveClass(/\bactive\b/)
})
