// Studio mix desk strip edge — each strip's coloured top line follows the strip's rounded corners instead of ending square inside them.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

async function openDesk(page: Page): Promise<Locator> {
  await studioRegion(page)
    .getByRole('button', { name: 'Mix', exact: true })
    .click()
  const desk = studioRegion(page).getByRole('region', {
    name: 'Mix',
    exact: true,
  })
  await expect(desk).toBeVisible()
  await desk.evaluate((element) =>
    Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
  return desk
}

/**
 * Each strip's corner radius and the radius its hue line is drawn with. A
 * browser shrinks radii that do not fit their box (CSS Backgrounds 3,
 * "Overlapping Curves"), so the line's is worked out from its box as the
 * browser does, not read as written.
 */
async function stripCorners(desk: Locator) {
  return desk.evaluate((element) => {
    const strips = [
      ...element.querySelectorAll<HTMLElement>('[data-studio-mix-strip]'),
    ]
    const px = (value: string) => Number.parseFloat(value) || 0
    return strips.map((strip) => {
      const own = getComputedStyle(strip)
      const line = getComputedStyle(strip, '::before')
      const width =
        px(line.width) + px(line.borderLeftWidth) + px(line.borderRightWidth)
      const height =
        px(line.height) + px(line.borderTopWidth) + px(line.borderBottomWidth)
      const tl = px(line.borderTopLeftRadius)
      const tr = px(line.borderTopRightRadius)
      const bl = px(line.borderBottomLeftRadius)
      const br = px(line.borderBottomRightRadius)
      const fit = Math.min(
        1,
        width / Math.max(tl + tr, 1e-9),
        width / Math.max(bl + br, 1e-9),
        height / Math.max(tl + bl, 1e-9),
        height / Math.max(tr + br, 1e-9),
      )
      const box = strip.getBoundingClientRect()
      return {
        strip: px(own.borderTopLeftRadius),
        line: Math.round(tl * fit * 100) / 100,
        // The line's box against the strip's: it starts at the strip's outer edge.
        lineTop:
          Math.round(
            (box.top + px(own.borderTopWidth) + px(line.top) - box.top) * 100,
          ) / 100,
        lineThickness: px(line.borderTopWidth) || px(line.height),
      }
    })
  })
}

test("Mix desk strips draw their hue line along the strip's rounded corners", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  const desk = await openDesk(page)
  const corners = await stripCorners(desk)
  console.log(`strip corners: ${JSON.stringify(corners)}`)
  expect(corners.length).toBeGreaterThan(0)
  for (const corner of corners) {
    expect(corner.strip).toBe(10)
    // The line bends with the strip's outer edge, at the strip's own radius.
    expect(corner.line).toBe(corner.strip)
    expect(corner.lineTop).toBe(0)
    expect(corner.lineThickness).toBe(3)
  }
})
