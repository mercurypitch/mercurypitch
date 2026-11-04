// Studio navigation — the wheel, a trackpad and fingers over the lanes scroll and zoom the arrangement as in a DAW, a drag along the ruler draws the range Repeat loops, and the wheel over the clock moves the playhead.
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { importStudioAudio, openArrangement, studioClip, studioRegion, timelineViewport, } from './helpers/dedicatedstudio-fixture'

/** The timeline's zoom, in pixels per second. */
async function scale(page: Page): Promise<number> {
  return Number(
    await studioRegion(page)
      .locator('[data-studio-scale]')
      .getAttribute('data-studio-scale'),
  )
}

/** Seconds of song under `clientX`, as the ruler measures them. */
async function secondsAt(page: Page, clientX: number): Promise<number> {
  const ruler = (await studioRegion(page)
    .getByRole('slider', { name: 'Song playhead' })
    .boundingBox())!
  return (clientX - ruler.x) / (await scale(page))
}

async function scrollOf(page: Page) {
  return timelineViewport(page).evaluate((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop,
    roomX: element.scrollWidth - element.clientWidth,
    roomY: element.scrollHeight - element.clientHeight,
  }))
}

/** A point on the first lane's empty space, `x` pixels into the lanes. */
async function laneSpace(page: Page, x: number) {
  const lane = (await studioRegion(page)
    .locator('[data-studio-lane-audio]')
    .first()
    .boundingBox())!
  return { x: lane.x + x, y: lane.y + lane.height / 2 }
}

/** Lanes until the arrangement is taller than its window, `most` at most. */
async function fillLanes(page: Page, most: number): Promise<void> {
  for (let lane = 2; lane <= most; lane++) {
    if ((await scrollOf(page)).roomY > 40) return
    await importStudioAudio(page, `Take${lane}`)
  }
}

/** CDP touch input runs through Chromium's own touch and scrolling. */
async function touch(
  page: Page,
  fingers: { x: number; y: number }[][],
): Promise<void> {
  const session = await page.context().newCDPSession(page)
  const points = (step: number) =>
    fingers.map((path, id) => ({ ...path[step], id }))
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: points(0),
    })
    for (let step = 1; step < fingers[0].length; step++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: points(step),
      })
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  } finally {
    await session.detach()
  }
}

function path(from: { x: number; y: number }, dx: number, dy: number) {
  return Array.from({ length: 13 }, (_, step) => ({
    x: from.x + (dx * step) / 12,
    y: from.y + (dy * step) / 12,
  }))
}

/** Two fingers `gap` px either side of `at`, spreading by `spread` each. */
function spreading(at: { x: number; y: number }, gap: number, spread: number) {
  return [
    path({ x: at.x - gap, y: at.y }, -spread, 0),
    path({ x: at.x + gap, y: at.y }, spread, 0),
  ]
}

const pageZoom = (page: Page) =>
  page.evaluate(() => window.visualViewport?.scale ?? 1)

test.describe('Studio navigation on a computer', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('the wheel scrolls the lanes, Shift with it moves through the song, and Ctrl with it zooms about the pointer @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openArrangement(page)
    await fillLanes(page, 8)
    const at = await laneSpace(page, 500)
    await page.mouse.move(at.x, at.y)

    await page.mouse.wheel(0, 120)
    await expect.poll(async () => (await scrollOf(page)).top).toBeGreaterThan(0)
    expect((await scrollOf(page)).left).toBe(0)

    await page.keyboard.down('Shift')
    await page.mouse.wheel(0, 300)
    await page.keyboard.up('Shift')
    await expect
      .poll(async () => (await scrollOf(page)).left)
      .toBeGreaterThan(0)

    const before = await secondsAt(page, at.x)
    expect(await scale(page)).toBe(40)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -100)
    await page.keyboard.up('Control')
    await expect.poll(() => scale(page)).toBe(50)
    // The moment under the pointer stays under it, within a pixel.
    expect(Math.abs((await secondsAt(page, at.x)) - before) * 50).toBeLessThan(
      1,
    )
    expect(await pageZoom(page)).toBe(1)
    await expect(
      studioRegion(page)
        .getByRole('group', { name: 'Timeline zoom' })
        .getByText('125%'),
    ).toBeVisible()
  })

  test('over lanes that all fit, the wheel moves through the song instead of doing nothing', async ({
    page,
  }) => {
    await openArrangement(page)
    expect((await scrollOf(page)).roomY).toBe(0)
    const at = await laneSpace(page, 400)
    await page.mouse.move(at.x, at.y)
    await page.mouse.wheel(0, 300)
    await expect.poll(async () => (await scrollOf(page)).left).toBe(300)
    await page.mouse.wheel(0, -300)
    await expect.poll(async () => (await scrollOf(page)).left).toBe(0)
  })

  test('zoom has its keys: = and - step about the playhead, Z fits the song', async ({
    page,
  }) => {
    await openArrangement(page)
    const zoom = studioRegion(page).getByRole('group', {
      name: 'Timeline zoom',
    })
    await expect(zoom.getByText('100%')).toBeVisible()
    await page.keyboard.press('=')
    await expect.poll(() => scale(page)).toBe(60)
    await page.keyboard.press('-')
    await page.keyboard.press('-')
    await expect.poll(() => scale(page)).toBe(30)
    await page.keyboard.press('z')
    // The 4 s song and a second of room fill the lanes, from the start.
    await expect.poll(() => scale(page)).toBeGreaterThan(150)
    const clip = (await studioClip(page).boundingBox())!
    const lanes = (await timelineViewport(page).boundingBox())!
    expect(clip.x + clip.width).toBeLessThanOrEqual(lanes.x + lanes.width)
    expect(clip.x + clip.width).toBeGreaterThan(lanes.x + lanes.width * 0.7)
    expect((await scrollOf(page)).left).toBe(0)
  })

  test('a drag along the ruler draws the range Repeat loops, and a click seeks @smoke', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openArrangement(page)
    const studio = studioRegion(page)
    const ruler = studio.getByRole('slider', { name: 'Song playhead' })
    const box = (await ruler.boundingBox())!
    const y = box.y + box.height / 2
    await page.mouse.move(box.x + 40, y)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, y, { steps: 8 })
    await page.mouse.up()
    await expect(studio.locator('[data-studio-range]')).toBeVisible()
    // A drag draws, it does not seek.
    await expect(ruler).toHaveAttribute('aria-valuenow', '0')

    await page.mouse.click(box.x + 80, y)
    await expect
      .poll(async () => Number(await ruler.getAttribute('aria-valuenow')))
      .toBeCloseTo(2, 1)

    const repeat = studio.getByRole('button', { name: 'Repeat range' })
    await repeat.click()
    await expect(repeat).toHaveAttribute('aria-pressed', 'true')
    await studio.getByRole('button', { name: 'Play song', exact: true }).click()
    const seen: number[] = []
    await expect
      .poll(
        async () => {
          seen.push(Number(await ruler.getAttribute('aria-valuenow')))
          return seen.some((now, at) => at > 0 && now < seen[at - 1] - 0.5)
        },
        { timeout: 15_000 },
      )
      .toBe(true)
    // Round the range's end, never on to the song's.
    expect(Math.max(...seen)).toBeLessThan(3.3)
    await studio
      .getByRole('button', { name: 'Pause song', exact: true })
      .click()
  })

  test('the wheel over the clock moves the playhead a grid step a notch, Shift a finer one, with no click', async ({
    page,
  }) => {
    await openArrangement(page)
    const clock = studioRegion(page).getByLabel('Playhead in seconds')
    await clock.hover()
    // At 40 px/s with Snap on, the grid is a second.
    await page.mouse.wheel(0, -100)
    await expect(clock).toHaveValue('0:01.000')
    await page.mouse.wheel(0, -100)
    await expect(clock).toHaveValue('0:02.000')
    await page.keyboard.down('Shift')
    await page.mouse.wheel(0, -100)
    await page.keyboard.up('Shift')
    await expect(clock).toHaveValue('0:02.100')
    await page.mouse.wheel(0, 100)
    await expect(clock).toHaveValue('0:02.000')
    await expect(clock).not.toBeFocused()
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})

test.describe('Studio navigation on a tablet', () => {
  test.use({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  })

  test('one finger pans the lanes both ways, and two zoom the timeline, never the page @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openArrangement(page)
    await fillLanes(page, 6)
    const at = await laneSpace(page, 420)

    await touch(page, [path(at, -240, 0)])
    await expect
      .poll(async () => (await scrollOf(page)).left)
      .toBeGreaterThan(100)
    await touch(page, [path(at, 0, -160)])
    await expect
      .poll(async () => (await scrollOf(page)).top)
      .toBeGreaterThan(40)

    const before = await scale(page)
    await touch(page, spreading(at, 60, 60))
    await expect.poll(() => scale(page)).toBeGreaterThan(before * 1.3)
    expect(await pageZoom(page)).toBe(1)
  })
})

test.describe('Studio navigation on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('a phone opens on the whole song, zooms in from the corner or with a pinch, and pans', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openArrangement(page)
    const zoom = studioRegion(page).getByRole('group', {
      name: 'Timeline zoom',
    })
    await expect.poll(async () => (await scrollOf(page)).roomX).toBe(0)
    await expect(zoom.getByRole('button', { name: 'Zoom out' })).toBeDisabled()

    const fit = await scale(page)
    await zoom.getByRole('button', { name: 'Zoom in' }).tap()
    await zoom.getByRole('button', { name: 'Zoom in' }).tap()
    await expect.poll(() => scale(page)).toBeGreaterThan(fit)
    await expect
      .poll(async () => (await scrollOf(page)).roomX)
      .toBeGreaterThan(0)
    await touch(page, [path(await laneSpace(page, 200), -150, 0)])
    await expect
      .poll(async () => (await scrollOf(page)).left)
      .toBeGreaterThan(40)

    // Zooming out all the way is the phone's fit again.
    const out = zoom.getByRole('button', { name: 'Zoom out' })
    for (let step = 0; step < 12 && (await out.isEnabled()); step++)
      await out.tap()
    await expect.poll(() => scale(page)).toBe(fit)
    await expect.poll(async () => (await scrollOf(page)).roomX).toBe(0)

    await touch(page, spreading(await laneSpace(page, 140), 40, 50))
    await expect.poll(() => scale(page)).toBeGreaterThan(fit * 1.3)
    expect(await pageZoom(page)).toBe(1)
  })
})
