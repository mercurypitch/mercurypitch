// Studio lane lines — a lane's volume and pan lines take points from a click or a tap, move by drag and keys, clear, undo and stay in the song.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, readStudioProject, setStudioZoom, STUDIO_RATE, studioRegion, } from './helpers/dedicatedstudio-fixture'

test.use({ serviceWorkers: 'block' })

/** The saved line for the first lane's `param`, or undefined with none. */
async function savedLine(page: Page, param: 'volume' | 'pan') {
  return (await readStudioProject(page)).tracks[0].automation?.[param]
}

async function openLines(page: Page): Promise<Locator> {
  const toggle = studioRegion(page).getByRole('button', {
    name: 'Phrase volume and pan lines',
    exact: true,
  })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  const area = studioRegion(page).locator('[data-studio-line]')
  await expect(area).toBeVisible()
  return area
}

/** A saved point's value is within `slack` of `value`: a pointer lands on a pixel, not on a decibel. */
function near(
  point: { value: number } | undefined,
  value: number,
  slack: number,
): boolean {
  return point !== undefined && Math.abs(point.value - value) <= slack
}

async function box(locator: Locator) {
  const found = await locator.boundingBox()
  if (!found) throw new Error('The line must be on screen.')
  return found
}

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('Studio draws a volume line with clicks, drags and keys, each one undoable edit, and holds the fader to it @smoke', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000)
    await openArrangement(page)
    await setStudioZoom(page, 40)
    const area = await openLines(page)
    const lane = await box(area)
    const before = await readStudioProject(page)

    // 40 px a second: a click 80 px in, halfway down, is 2 s at -24 dB,
    // the frame on the snap grid and the value within a pixel's worth.
    await page.mouse.click(lane.x + 80, lane.y + lane.height / 2)
    await expect
      .poll(async () => (await savedLine(page, 'volume'))?.length)
      .toBe(1)
    const [added] = (await savedLine(page, 'volume')) ?? []
    expect(added.frame).toBe(2 * STUDIO_RATE)
    expect(near(added, -24, 1)).toBe(true)
    expect((await readStudioProject(page)).revision).toBe(before.revision + 1)
    const header = studioRegion(page).locator('[data-studio-track]').first()
    await expect(
      header.getByRole('slider', { name: 'Phrase volume' }),
    ).toBeDisabled()
    await expect(header.getByText('Line', { exact: true })).toBeVisible()

    // A second later and a quarter of the lane higher: 3 s at -6 dB.
    const point = area.getByRole('button', { name: /^Volume point at 0:02/ })
    const start = await box(point)
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      start.x + start.width / 2 + 40,
      start.y + start.height / 2 - lane.height / 4,
      { steps: 10 },
    )
    await expect(area).toContainText(/dB at 0:03$/)
    await page.mouse.up()
    await expect
      .poll(async () => (await savedLine(page, 'volume'))?.[0].frame)
      .toBe(3 * STUDIO_RATE)
    const [dragged] = (await savedLine(page, 'volume')) ?? []
    expect(near(dragged, added.value + 18, 1)).toBe(true)
    expect((await readStudioProject(page)).revision).toBe(before.revision + 2)
    await page.screenshot({ path: testInfo.outputPath('volume-line.png') })

    // The dragged point keeps the focus: two presses of Up, one edit.
    const moved = area.getByRole('button', { name: /^Volume point at 0:03/ })
    await expect(moved).toBeFocused()
    await moved.press('ArrowUp')
    await moved.press('ArrowUp')
    await expect
      .poll(() => savedLine(page, 'volume'))
      .toEqual([
        {
          frame: 3 * STUDIO_RATE,
          value: Math.round((dragged.value + 2) * 10) / 10,
        },
      ])
    expect((await readStudioProject(page)).revision).toBe(before.revision + 4)
    await moved.press('Delete')
    await expect.poll(() => savedLine(page, 'volume')).toBeUndefined()
    await expect(
      header.getByRole('slider', { name: 'Phrase volume' }),
    ).toBeEnabled()

    // Two points, cleared from the bar, back with one Undo.
    await page.mouse.click(lane.x + 40, lane.y + 4)
    await page.mouse.click(lane.x + 120, lane.y + lane.height - 4)
    await expect
      .poll(async () => (await savedLine(page, 'volume'))?.length)
      .toBe(2)
    const bar = studioRegion(page).getByRole('toolbar', {
      name: 'Phrase lines',
    })
    await bar.getByRole('button', { name: 'Clear line' }).click()
    await expect.poll(() => savedLine(page, 'volume')).toBeUndefined()
    await studioRegion(page)
      .getByRole('button', { name: /^Undo / })
      .click()
    await expect
      .poll(async () => (await savedLine(page, 'volume'))?.length)
      .toBe(2)

    // Done closes the line; the lane's clip takes clicks again.
    await bar.getByRole('button', { name: 'Done' }).click()
    await expect(area).toHaveCount(0)
  })

  test('Studio keeps a pan line apart from the volume line, left at the top', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await openArrangement(page)
    await setStudioZoom(page, 40)
    const area = await openLines(page)
    const bar = studioRegion(page).getByRole('toolbar', {
      name: 'Phrase lines',
    })
    await bar.getByRole('button', { name: 'Pan' }).click()
    await expect(area).toHaveAttribute('data-studio-line', 'pan')
    const lane = await box(area)
    // A quarter of the way down is halfway to the left.
    await page.mouse.click(lane.x + 40, lane.y + lane.height / 4)
    await expect
      .poll(async () => (await savedLine(page, 'pan'))?.length)
      .toBe(1)
    const [point] = (await savedLine(page, 'pan')) ?? []
    expect(point.frame).toBe(STUDIO_RATE)
    expect(near(point, -0.5, 0.03)).toBe(true)
    expect(await savedLine(page, 'volume')).toBeUndefined()
    const header = studioRegion(page).locator('[data-studio-track]').first()
    await expect(
      header.getByRole('slider', { name: 'Phrase pan' }),
    ).toBeDisabled()
    await expect(
      header.getByRole('slider', { name: 'Phrase volume' }),
    ).toBeEnabled()
  })
})

test.describe('on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('Studio draws and deletes a volume point with taps on a phone lane @smoke', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000)
    await openArrangement(page)
    const area = await openLines(page)
    const lane = await box(area)
    await page.touchscreen.tap(
      lane.x + lane.width / 2,
      lane.y + lane.height / 2,
    )
    await expect
      .poll(async () => (await savedLine(page, 'volume'))?.length)
      .toBe(1)
    const [point] = (await savedLine(page, 'volume')) ?? []
    expect(point.value).toBeGreaterThan(-30)
    expect(point.value).toBeLessThan(-18)
    const bar = studioRegion(page).getByRole('toolbar', {
      name: 'Phrase lines',
    })
    for (const button of await bar.getByRole('button').all()) {
      const target = await box(button)
      const name = (await button.getAttribute('title')) ?? undefined
      expect(target.height, name).toBeGreaterThanOrEqual(44)
      expect(target.x + target.width, name).toBeLessThanOrEqual(390 - 12)
    }
    await page.screenshot({
      path: testInfo.outputPath('phone-volume-line.png'),
    })
    await bar.getByRole('button', { name: 'Delete point' }).tap()
    await expect.poll(() => savedLine(page, 'volume')).toBeUndefined()
    await bar.getByRole('button', { name: 'Done' }).tap()
    await expect(area).toHaveCount(0)
  })
})
