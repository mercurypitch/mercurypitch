// Studio mixing desk — a real mouse on a lane fader and a master dial, Escape back to Mix, finger-sized on a tablet.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { center, importStudioAudio, openArrangement, readStudioProject, studioRegion, timelineViewport, } from './helpers/dedicatedstudio-fixture'

async function openDesk(page: Page, tap = false): Promise<Locator> {
  const mix = studioRegion(page).getByRole('button', {
    name: 'Mix',
    exact: true,
  })
  if (tap) await mix.tap()
  else await mix.click()
  const desk = studioRegion(page).getByRole('region', {
    name: 'Mix',
    exact: true,
  })
  await expect(desk).toBeVisible()
  return desk
}

test('Studio mixing desk moves a lane fader and a master dial as one edit each, and Escape returns to Mix @smoke', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  await importStudioAudio(page, 'Harmony')
  const desk = await openDesk(page)
  await expect(desk).toBeFocused()
  expect(
    await desk
      .getByRole('slider', { name: / volume$/ })
      .evaluateAll((faders) =>
        faders.map((fader) => fader.getAttribute('aria-label')),
      ),
  ).toEqual(['Phrase volume', 'Harmony volume'])

  // The desk takes room from the timeline instead of covering it.
  const timeline = await timelineViewport(page).boundingBox()
  const drawer = await desk.boundingBox()
  if (!timeline || !drawer) throw new Error('The timeline or desk is hidden.')
  expect(timeline.y + timeline.height).toBeLessThanOrEqual(drawer.y + 1)
  expect(drawer.height).toBeGreaterThanOrEqual(300)
  expect(drawer.height).toBeLessThanOrEqual(350)

  const before = await readStudioProject(page)
  const fader = desk.getByRole('slider', {
    name: 'Harmony volume',
    exact: true,
  })
  const rail = await fader.boundingBox()
  if (!rail) throw new Error('The Harmony fader is not visible.')
  const x = rail.x + rail.width / 2
  // Unity gain sits 60 of the fader's 72 dB up from the floor. The fader
  // drags from where it is, so the drag below moves it by its length.
  await page.mouse.move(x, rail.y + rail.height * (1 - 60 / 72))
  await page.mouse.down()
  await page.mouse.move(x, rail.y + rail.height * 0.8, { steps: 10 })
  expect((await readStudioProject(page)).revision).toBe(before.revision)
  await page.mouse.up()
  await expect
    .poll(async () => (await readStudioProject(page)).revision)
    .toBe(before.revision + 1)
  const faded = (await readStudioProject(page)).tracks.find(
    (track) => track.name === 'Harmony',
  )!
  expect(faded.gainDb).toBeLessThan(-30)
  await expect(desk.locator('output').nth(1)).toHaveText(
    `${faded.gainDb.toFixed(1)} dB`,
  )

  const dial = desk.getByTitle(
    'Space: drag up or down. Double-click for the centre.',
  )
  const point = await center(dial)
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x, point.y - 40, { steps: 8 })
  await expect(
    desk.getByRole('slider', { name: 'Space', exact: true }),
  ).toHaveAttribute('aria-valuetext', /toward Big$/)
  expect((await readStudioProject(page)).revision).toBe(before.revision + 1)
  await page.mouse.up()
  await expect
    .poll(async () => (await readStudioProject(page)).revision)
    .toBe(before.revision + 2)
  const space = (await readStudioProject(page)).mix.macros.space
  expect(space).toBeGreaterThanOrEqual(45)
  expect(space).toBeLessThanOrEqual(55)

  await page.keyboard.press('Escape')
  await expect(desk).toHaveCount(0)
  await expect(
    studioRegion(page).getByRole('button', { name: 'Mix', exact: true }),
  ).toBeFocused()
})

test.describe('on a tablet', () => {
  test.use({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  })

  test('Studio mixing desk gives every control a finger-sized target @smoke', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openArrangement(page)
    await importStudioAudio(page, 'Harmony')
    const desk = await openDesk(page, true)
    const small: string[] = []
    // Buttons, faders, pan knobs and dial faces: the drawn knobs take the
    // finger, while their native ranges stay under them for the keys.
    const targets = desk.locator(
      'button, input[aria-label$=" volume"], [title^="Pan "], [title*="drag up or down"]',
    )
    for (const target of await targets.all()) {
      // A short desk swaps its Close button between two places; one is hidden.
      if (!(await target.isVisible())) continue
      const box = await target.boundingBox()
      const name =
        (await target.getAttribute('aria-label')) ??
        (await target.getAttribute('title')) ??
        (await target.textContent())
      if (!box || box.width < 44 || box.height < 44)
        small.push(`${name}: ${box?.width}x${box?.height}`)
    }
    expect(small).toEqual([])
    expect(await targets.count()).toBeGreaterThan(20)
  })
})
