// Studio top bar — the transport stays centred at every width, the song title keeps its words, the save status never runs into the transport, and a phone sheet draws no handle it cannot use.
import { expect, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

interface BarLayout {
  offCentre: number
  titleClipped: boolean
  statusIntoTransport: number
  smallestTarget: number
}

async function barLayout(page: Page): Promise<BarLayout> {
  return studioRegion(page)
    .locator('header')
    .first()
    .evaluate((bar) => {
      const box = (element: Element | null) => element!.getBoundingClientRect()
      const transport = box(bar.querySelector('[aria-label="Song playback"]'))
      const own = box(bar)
      const title = bar.querySelector('[aria-label="Song options"] span')!
      const status = box(bar.querySelector('[role="status"]'))
      const overlapsTransport =
        status.right > transport.left &&
        status.left < transport.right &&
        status.bottom > transport.top &&
        status.top < transport.bottom
      return {
        offCentre: Math.round(
          transport.left + transport.width / 2 - (own.left + own.width / 2),
        ),
        titleClipped: title.scrollWidth > title.clientWidth + 1,
        statusIntoTransport: overlapsTransport
          ? Math.round(status.right - transport.left)
          : 0,
        smallestTarget: Math.min(
          ...[...bar.querySelectorAll('button, input')]
            .map((element) => element.getBoundingClientRect())
            .filter((rect) => rect.width > 0)
            .map((rect) => Math.min(rect.width, rect.height)),
        ),
      }
    })
}

test('Studio top bar keeps the transport centred and the song title whole from 1440 to 900 px @smoke', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  for (const width of [1440, 1366, 1280, 1100, 1024, 900]) {
    await page.setViewportSize({ width, height: 900 })
    await expect
      .poll(async () => Math.abs((await barLayout(page)).offCentre), {
        message: `${width} px wide`,
      })
      .toBeLessThanOrEqual(3)
    const layout = await barLayout(page)
    expect(layout.titleClipped, `${width} px wide`).toBe(false)
    expect(layout.statusIntoTransport, `${width} px wide`).toBe(0)
  }
})

test.describe('on a tablet', () => {
  test.use({
    viewport: { width: 1180, height: 820 },
    hasTouch: true,
    isMobile: true,
  })

  test('Studio top bar keeps the transport centred, the title whole and every target finger-sized', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openArrangement(page)
    for (const viewport of [
      { width: 1180, height: 820 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport)
      await expect
        .poll(async () => Math.abs((await barLayout(page)).offCentre), {
          message: `${viewport.width} px wide`,
        })
        .toBeLessThanOrEqual(3)
      const layout = await barLayout(page)
      expect(layout.titleClipped, `${viewport.width} px wide`).toBe(false)
      expect(layout.statusIntoTransport, `${viewport.width} px wide`).toBe(0)
      expect(
        layout.smallestTarget,
        `${viewport.width} px wide`,
      ).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('Studio sheets draw no grab handle, since dragging one does nothing', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openArrangement(page)
    await studioRegion(page)
      .getByRole('button', { name: 'Sound', exact: true })
      .tap()
    const heading = studioRegion(page)
      .getByRole('heading', { name: 'Sound', exact: true })
      .locator('xpath=..')
    await expect(heading).toBeVisible()
    expect(
      await heading.evaluate(
        (element) => getComputedStyle(element, '::before').content,
      ),
    ).toBe('none')
  })
})
