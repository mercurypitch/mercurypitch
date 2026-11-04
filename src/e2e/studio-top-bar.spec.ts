// Studio top bar — the transport stays centred at every width, the song title keeps its words, the save status never runs into the transport, the actions keep the bar's gap from it just past every fold and while Punch shows, and a phone sheet draws no handle it cannot use.
import { expect, type Page, test } from '@playwright/test'
import { openArrangement, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'

interface BarLayout {
  offCentre: number
  titleClipped: boolean
  statusIntoTransport: number
  smallestTarget: number
  /** From the transport's right edge to the actions, or null on rows of their own. */
  actionsGap: number | null
}

async function barLayout(page: Page): Promise<BarLayout> {
  return studioRegion(page)
    .locator('[data-studio-top-bar]')
    .evaluate((bar) => {
      const box = (element: Element | null) => element!.getBoundingClientRect()
      const transport = box(bar.querySelector('[aria-label="Song playback"]'))
      const own = box(bar)
      const title = bar.querySelector('[aria-label="Song options"] span')!
      const status = box(bar.querySelector('[role="status"]'))
      const actions = box(
        bar.querySelector('[data-tour="studio.history"]')!.parentElement,
      )
      const sameRow =
        actions.top < transport.bottom && actions.bottom > transport.top
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
        actionsGap: sameRow ? Math.round(actions.left - transport.right) : null,
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

/**
 * Every bar width from `from` to `to` px, two at a time, where the actions
 * share the transport's row but sit nearer it than the bar's own 16 px gap.
 * Just past each fold is where they met: a fold comes when the unfolded
 * actions no longer fit, so the widths it misses are the ones it was due at.
 */
async function crowdedWidths(
  page: Page,
  from: number,
  to: number,
): Promise<string[]> {
  const bar = studioRegion(page).locator('[data-studio-top-bar]')
  const viewport = page.viewportSize()!
  // The bar is the viewport less the app's own chrome beside it.
  const chrome =
    viewport.width - (await bar.evaluate((element) => element.clientWidth))
  const crowded: string[] = []
  for (let width = from; width <= to; width += 2) {
    await page.setViewportSize({
      width: width + chrome,
      height: viewport.height,
    })
    await expect
      .poll(() => bar.evaluate((element) => element.clientWidth))
      .toBe(width)
    const gap = (await barLayout(page)).actionsGap
    if (gap !== null && gap < 16) crowded.push(`${width} px bar: ${gap} px`)
  }
  return crowded
}

test('Studio top bar keeps its actions 16 px clear of the transport just past every fold', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  expect(await crowdedWidths(page, 860, 1440)).toEqual([])
})

test('Studio top bar keeps its actions clear of the transport while Punch shows', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  const studio = studioRegion(page)
  await studioClip(page, 'Phrase').click()
  await studio
    .getByRole('toolbar', { name: 'Selected clip' })
    .getByRole('button', { name: 'Range', exact: true })
    .click()
  await expect(
    studio.getByRole('button', { name: 'Punch in', exact: true }),
  ).toBeVisible()
  // Punch widens the transport; just past each fold is where it met the actions.
  for (const width of [1440, 1366, 1280, 1152, 1024, 992, 900]) {
    await page.setViewportSize({ width, height: 900 })
    await expect
      .poll(async () => Math.abs((await barLayout(page)).offCentre), {
        message: `${width} px wide`,
      })
      .toBeLessThanOrEqual(3)
    // The bar's own 16 px gap, or the transport on a row of its own.
    expect(
      (await barLayout(page)).actionsGap ?? 16,
      `${width} px wide`,
    ).toBeGreaterThanOrEqual(16)
  }
})

test.describe('on a tablet', () => {
  test.use({
    viewport: { width: 1180, height: 820 },
    hasTouch: true,
    isMobile: true,
  })

  test('Studio top bar keeps finger-sized actions 16 px clear of the transport just past every fold', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 1600, height: 900 })
    await openArrangement(page)
    expect(await crowdedWidths(page, 900, 1540)).toEqual([])
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
