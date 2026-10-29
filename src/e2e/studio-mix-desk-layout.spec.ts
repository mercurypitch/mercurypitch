// Studio mixing desk layout — the desk leaves lanes to arrange, its top edge drags to a height the device keeps, zoom and the clip bar dock beside the lanes, and the selected lane reads at a glance in dark and light.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { importStudioAudio, openArrangement, readStudioProject, studioClip, studioRegion, timelineViewport, } from './helpers/dedicatedstudio-fixture'

const DESK_HEIGHT_KEY = 'mercurypitch.studio.mix-desk-height.v1'

async function openDesk(page: Page): Promise<Locator> {
  await studioRegion(page)
    .getByRole('button', { name: 'Mix', exact: true })
    .click()
  const desk = studioRegion(page).getByRole('region', {
    name: 'Mix',
    exact: true,
  })
  await expect(desk).toBeVisible()
  await settled(desk)
  return desk
}

/** Wait out an element's own CSS animations: the desk slides up as it opens. */
async function settled(locator: Locator): Promise<void> {
  await locator.evaluate((element) =>
    Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
}

/** Lanes whose whole row sits inside the arrangement's viewport. */
async function lanesInView(page: Page): Promise<number> {
  return timelineViewport(page).evaluate((viewport) => {
    const box = viewport.getBoundingClientRect()
    return [...viewport.querySelectorAll('[data-studio-track]')].filter(
      (lane) => {
        const row = lane.getBoundingClientRect()
        return row.top >= box.top - 1 && row.bottom <= box.bottom + 1
      },
    ).length
  })
}

async function fourLanes(page: Page): Promise<void> {
  await openArrangement(page)
  for (const name of ['Harmony', 'Bass', 'Keys'])
    await importStudioAudio(page, name, 2)
}

/**
 * Square pixels the zoom buttons and the selected-clip bar cover: of lane
 * rows below the ruler and inside the viewport, and of the ruler a person can
 * see and scrub, right of its sticky corner.
 */
async function dockedCover(
  page: Page,
): Promise<{ lanes: number; ruler: number }> {
  return timelineViewport(page).evaluate((viewport) => {
    const view = viewport.getBoundingClientRect()
    const right = view.left + viewport.clientWidth
    const bottom = view.top + viewport.clientHeight
    const ruler = viewport.querySelector('[aria-label="Song playhead"]')!
    const track = ruler.getBoundingClientRect()
    const corner = ruler.previousElementSibling!.getBoundingClientRect()
    const cover = (
      box: DOMRect,
      area: { left: number; top: number; right: number; bottom: number },
    ) => {
      const width =
        Math.min(box.right, area.right) - Math.max(box.left, area.left)
      const height =
        Math.min(box.bottom, area.bottom) - Math.max(box.top, area.top)
      return width > 0 && height > 0 ? width * height : 0
    }
    let lanes = 0
    let scrub = 0
    const controls = document.querySelectorAll(
      '[aria-label="Timeline zoom"], [aria-label="Selected clip"]',
    )
    for (const control of controls) {
      const box = control.getBoundingClientRect()
      scrub += cover(box, {
        left: Math.max(track.left, corner.right),
        top: track.top,
        right: Math.min(track.right, right),
        bottom: track.bottom,
      })
      for (const lane of viewport.querySelectorAll('[data-studio-track]')) {
        const row = lane.getBoundingClientRect()
        lanes += cover(box, {
          left: Math.max(row.left, view.left),
          top: Math.max(row.top, track.bottom),
          right: Math.min(row.right, right),
          bottom: Math.min(row.bottom, bottom),
        })
      }
    }
    return { lanes: Math.round(lanes), ruler: Math.round(scrub) }
  })
}

/** Zoom and the clip bar cover no lane and no ruler at rest, half-way down, or at the end. */
async function expectDockClear(page: Page): Promise<void> {
  const viewport = timelineViewport(page)
  for (const at of [0, 0.5, 1]) {
    await viewport.evaluate((element, share) => {
      element.scrollTop = (element.scrollHeight - element.clientHeight) * share
    }, at)
    expect(await dockedCover(page), `scrolled ${at * 100}% down`).toEqual({
      lanes: 0,
      ruler: 0,
    })
  }
  await viewport.evaluate((element) => {
    element.scrollTop = 0
  })
}

const DOCKED = [
  'Zoom out',
  'Zoom in',
  'Fit song to width',
  'Split',
  'Duplicate',
  'Delete',
  'Details',
]

/** The smallest side of each docked button, or 0 when any part of it is out of sight. */
async function dockedTargets(page: Page): Promise<Record<string, number>> {
  const sizes: Record<string, number> = {}
  for (const name of DOCKED) {
    const button = studioRegion(page)
      .locator('[aria-label="Timeline zoom"], [aria-label="Selected clip"]')
      .getByRole('button', { name, exact: true })
    sizes[name] = await button.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const host = element.closest('[data-studio-dock]') ?? document.body
      const room = host.getBoundingClientRect()
      const inside =
        box.top >= room.top - 0.5 &&
        box.bottom <= room.bottom + 0.5 &&
        box.left >= room.left - 0.5 &&
        box.right <= room.right + 0.5 &&
        box.bottom <= window.innerHeight
      return inside ? Math.round(Math.min(box.width, box.height)) : 0
    })
  }
  return sizes
}

const scaleOf = async (page: Page) =>
  Number(
    await studioRegion(page)
      .locator('[data-studio-scale]')
      .getAttribute('data-studio-scale'),
  )

async function deskHeight(desk: Locator): Promise<number> {
  return Math.round((await desk.boundingBox())!.height)
}

test('Mix keeps lanes in view, moves nothing above it, and its top edge drags to a height this device keeps @smoke', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await fourLanes(page)
  const studio = studioRegion(page)
  const above = () =>
    studio
      .locator(
        '[data-studio-top-bar], [aria-label="Song playhead"], [data-studio-track]',
      )
      .evaluateAll((elements) =>
        elements.slice(0, 3).map((element) => {
          const box = element.getBoundingClientRect()
          return [box.left, box.top, box.width, box.height].map(Math.round)
        }),
      )
  const closed = await above()
  let desk = await openDesk(page)
  expect(await above()).toEqual(closed)
  expect(await lanesInView(page)).toBeGreaterThanOrEqual(3)
  const automatic = await deskHeight(desk)

  // Drag the top edge up 80 px: the desk grows by as much, and keeps it.
  const edge = desk.getByRole('separator', { name: 'Mix height' })
  const grip = (await edge.boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    grip.x + grip.width / 2,
    grip.y + grip.height / 2 - 80,
    { steps: 8 },
  )
  await page.mouse.up()
  await expect.poll(() => deskHeight(desk)).toBe(automatic + 80)
  expect(
    await page.evaluate((key) => localStorage.getItem(key), DESK_HEIGHT_KEY),
  ).toBe(String(automatic + 80))
  await page.keyboard.press('Escape')
  await expect(desk).toHaveCount(0)
  desk = await openDesk(page)
  expect(await deskHeight(desk)).toBe(automatic + 80)

  // A double-click on the edge returns to the automatic height.
  await desk.getByRole('separator', { name: 'Mix height' }).dblclick()
  await expect.poll(() => deskHeight(desk)).toBe(automatic)

  // A short window: the desk gives way so two lanes stay in view.
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport)
    await expect
      .poll(() => lanesInView(page), { message: `${viewport.height} px tall` })
      .toBeGreaterThanOrEqual(2)
  }
  // The desk starts compact on a short window, and its faders keep travel.
  expect(await deskHeight(desk)).toBeLessThan(300)
  const fader = desk.getByRole('slider', { name: 'Bass volume', exact: true })
  expect((await fader.boundingBox())!.height).toBeGreaterThanOrEqual(80)
  const open = await above()
  await page.keyboard.press('Escape')
  await expect(desk).toHaveCount(0)
  expect(await above()).toEqual(open)
})

test('Mix fits every strip at the same width, scrolls them sideways under a vertical wheel, and keeps desk text at 11 px or more', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  for (const name of [
    'Harmony',
    'Bass',
    'Drums',
    'Keys',
    'Acoustic guitar room mic take three',
  ])
    await importStudioAudio(page, name, 2)
  const desk = await openDesk(page)
  const strips = desk.locator('[data-studio-mix-strip]')
  const widths = await strips.evaluateAll((elements) =>
    elements.map((element) =>
      Math.round(element.getBoundingClientRect().width),
    ),
  )
  expect(new Set(widths).size).toBe(1)
  const row = desk.getByRole('group', { name: 'Lanes' })
  // Six strips fit at 1440, so no edge fades over one of them.
  await expect(row).not.toHaveAttribute('data-more-after', '')
  const long = desk.getByRole('button', {
    name: 'Acoustic guitar room mic take three',
    exact: true,
  })
  await expect(long).toHaveAttribute(
    'title',
    'Acoustic guitar room mic take three',
  )
  expect(
    await long.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true)
  const smallest = await desk.evaluate((element) => {
    let size = Infinity
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement
      if (!parent || !node.textContent?.trim()) continue
      const style = getComputedStyle(parent)
      if (
        style.display === 'none' ||
        parent.closest('[aria-hidden="true"] svg')
      )
        continue
      if (parent.getClientRects().length === 0) continue
      size = Math.min(size, Number.parseFloat(style.fontSize))
    }
    return size
  })
  expect(smallest).toBeGreaterThanOrEqual(11)

  // A seventh lane overflows the row; a vertical wheel scrolls it sideways.
  await page.keyboard.press('Escape')
  await studioRegion(page)
    .getByRole('button', { name: 'New lane', exact: true })
    .click()
  const again = await openDesk(page)
  const lanes = again.getByRole('group', { name: 'Lanes' })
  const overflow = await lanes.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  )
  expect(overflow).toBeGreaterThan(0)
  const box = (await lanes.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + 20)
  await page.mouse.wheel(0, 240)
  await expect
    .poll(() => lanes.evaluate((element) => element.scrollLeft))
    .toBe(overflow)
})

for (const theme of ['dark', 'light'] as const) {
  test(`the selected lane reads at a glance in ${theme}, its strip is marked, and a strip's name selects its lane`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.addInitScript((value) => {
      localStorage.setItem('pitchperfect_theme', value)
    }, theme)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openArrangement(page)
    await importStudioAudio(page, 'Harmony', 2)
    const studio = studioRegion(page)
    const lanes = studio.locator('[data-studio-track]')
    // An empty stretch of the second lane, right of its clip.
    const empty = await lanes
      .nth(1)
      .locator('[data-studio-lane-audio]')
      .evaluate((element) => {
        const box = element.getBoundingClientRect()
        const clips = [...element.children].map(
          (child) => child.getBoundingClientRect().right,
        )
        return {
          x: Math.min(
            window.innerWidth - 40,
            Math.max(...clips, box.left) + 40,
          ),
          y: box.top + box.height / 2,
        }
      })
    await page.mouse.click(empty.x, empty.y)
    await expect(lanes.nth(1)).toHaveAttribute('data-selected', '')
    // The header eases to its new colour; read it once it has.
    const contrast = () =>
      lanes.evaluateAll((elements) => {
        const canvas = document.createElement('canvas').getContext('2d')!
        const rgb = (color: string) => {
          canvas.clearRect(0, 0, 1, 1)
          canvas.fillStyle = color
          canvas.fillRect(0, 0, 1, 1)
          return [...canvas.getImageData(0, 0, 1, 1).data.slice(0, 3)]
        }
        const luminance = (color: number[]) =>
          color
            .map((value) => {
              const channel = value / 255
              return channel <= 0.03928
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4
            })
            .reduce(
              (sum, channel, index) =>
                sum + channel * [0.2126, 0.7152, 0.0722][index],
              0,
            )
        const header = (lane: Element) =>
          rgb(
            getComputedStyle(lane.querySelector(':scope > div:first-child')!)
              .backgroundColor,
          )
        const [plain, chosen] = elements.map(header).map(luminance)
        return (
          (Math.max(plain, chosen) + 0.05) / (Math.min(plain, chosen) + 0.05)
        )
      })
    await expect.poll(contrast).toBeGreaterThanOrEqual(1.5)

    const desk = await openDesk(page)
    const strip = (id: number) =>
      desk.locator('[data-studio-mix-strip]').nth(id)
    await expect(strip(1)).toHaveAttribute('data-selected', '')
    await expect(strip(0)).not.toHaveAttribute('data-selected', '')
    await desk.getByRole('button', { name: 'Phrase', exact: true }).click()
    await expect(lanes.nth(0)).toHaveAttribute('data-selected', '')
    await expect(strip(0)).toHaveAttribute('data-selected', '')
  })
}

test("with Mix open, zoom and the selected clip's commands stand beside the arrangement, clear of every lane and the ruler, and still work", async ({
  page,
}) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await fourLanes(page)
  // Harmony's clip is on lane 2, where the floating bar sat with Mix open.
  await studioClip(page, 'Harmony').click()
  const bar = studioRegion(page).getByRole('toolbar', {
    name: 'Selected clip',
  })
  await expect(bar).toBeVisible()
  const desk = await openDesk(page)
  await expect(bar).toBeVisible()
  await expectDockClear(page)
  for (const [name, size] of Object.entries(await dockedTargets(page)))
    expect(size, name).toBeGreaterThanOrEqual(28)
  const scale = await scaleOf(page)
  await studioRegion(page)
    .getByRole('button', { name: 'Zoom in', exact: true })
    .click()
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(scale)
  const before = (await readStudioProject(page)).clips.length
  await bar.getByRole('button', { name: 'Duplicate', exact: true }).click()
  await expect
    .poll(async () => (await readStudioProject(page)).clips.length)
    .toBe(before + 1)

  // A desk dragged tall leaves a short arrangement: the dock keeps every
  // command in sight, two to a row.
  const edge = desk.getByRole('separator', { name: 'Mix height' })
  const grip = (await edge.boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2, 0, { steps: 8 })
  await page.mouse.up()
  await expect
    .poll(async () => (await timelineViewport(page).boundingBox())!.height)
    .toBeLessThan(200)
  await expectDockClear(page)
  for (const [name, size] of Object.entries(await dockedTargets(page)))
    expect(size, `${name} on a short arrangement`).toBeGreaterThanOrEqual(28)
  await desk.getByRole('separator', { name: 'Mix height' }).dblclick()

  // Closed again, zoom returns to the arrangement's foot.
  await page.keyboard.press('Escape')
  await expect(desk).toHaveCount(0)
  const zoom = (await studioRegion(page)
    .getByRole('group', { name: 'Timeline zoom' })
    .boundingBox())!
  const view = (await timelineViewport(page).boundingBox())!
  expect(view.y + view.height - (zoom.y + zoom.height)).toBeLessThan(40)
})

test.describe('on a tablet', () => {
  test.use({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  })

  test('Mix keeps two lanes in view and every control finger-sized', async ({
    page,
  }) => {
    test.setTimeout(150_000)
    await fourLanes(page)
    await studioRegion(page)
      .getByRole('button', { name: 'Mix', exact: true })
      .tap()
    const desk = studioRegion(page).getByRole('region', {
      name: 'Mix',
      exact: true,
    })
    await expect(desk).toBeVisible()
    await settled(desk)
    expect(await lanesInView(page)).toBeGreaterThanOrEqual(2)
    // The edge a finger drags is 24 px tall; studio-mix-desk.spec.ts holds
    // every control on the desk to 44 px.
    const edge = (await desk
      .getByRole('separator', { name: 'Mix height' })
      .boundingBox())!
    expect(edge.height).toBeGreaterThanOrEqual(24)
    await expect(
      desk.getByRole('button', { name: 'Close Mix', exact: true }),
    ).toBeVisible()
    // Nothing in the master column is cut off at the desk's floor.
    const clipped = await desk.evaluate((element) => {
      const floor = element.getBoundingClientRect().bottom
      return [...element.querySelectorAll('[data-studio-mix-master] *')]
        .filter((child) => {
          const box = child.getBoundingClientRect()
          return box.height > 0 && box.bottom > floor + 1
        })
        .map((child) => child.textContent?.trim() ?? child.tagName)
    })
    expect(clipped).toEqual([])
  })

  test("with Mix open, zoom and the selected clip's commands stand beside the arrangement at finger size, clear of every lane and the ruler", async ({
    page,
  }) => {
    test.setTimeout(150_000)
    await fourLanes(page)
    await studioClip(page, 'Harmony').tap()
    await expect(
      studioRegion(page).getByRole('toolbar', { name: 'Selected clip' }),
    ).toBeVisible()
    await studioRegion(page)
      .getByRole('button', { name: 'Mix', exact: true })
      .tap()
    const desk = studioRegion(page).getByRole('region', {
      name: 'Mix',
      exact: true,
    })
    await expect(desk).toBeVisible()
    await settled(desk)
    await expectDockClear(page)
    for (const [name, size] of Object.entries(await dockedTargets(page)))
      expect(size, name).toBeGreaterThanOrEqual(44)
    const scale = await scaleOf(page)
    await studioRegion(page)
      .getByRole('group', { name: 'Timeline zoom' })
      .getByRole('button', { name: 'Zoom in', exact: true })
      .tap()
    await expect.poll(() => scaleOf(page)).toBeGreaterThan(scale)
  })

  test('in portrait, with Mix open, every docked command stays in sight at finger size', async ({
    page,
  }) => {
    test.setTimeout(150_000)
    await page.setViewportSize({ width: 768, height: 1024 })
    await fourLanes(page)
    await studioClip(page, 'Harmony').tap()
    await studioRegion(page)
      .getByRole('button', { name: 'Mix', exact: true })
      .tap()
    const desk = studioRegion(page).getByRole('region', {
      name: 'Mix',
      exact: true,
    })
    await expect(desk).toBeVisible()
    await settled(desk)
    await expectDockClear(page)
    for (const [name, size] of Object.entries(await dockedTargets(page)))
      expect(size, name).toBeGreaterThanOrEqual(44)
  })
})
