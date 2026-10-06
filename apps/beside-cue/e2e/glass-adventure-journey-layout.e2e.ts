// Museum map layout — viewport-sized landscapes and legible projected selection.
import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({
  viewport: { width: 320, height: 640 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

async function openMap(page: Page): Promise<Locator> {
  await page.goto('/glass-game/?campaign=1')
  const lobby = page.getByTestId('glass-campaign')
  await expect(lobby.locator('[data-map-state]')).toHaveAttribute(
    'data-map-state',
    'ready',
    { timeout: 60_000 },
  )
  return lobby
}

async function expectInsideViewport(
  control: Locator,
  width: number,
  height: number,
): Promise<void> {
  const bounds = await control.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height)
}

test('rotation keeps a full-height map, compact selection and usable entry @smoke', async ({
  page,
}) => {
  const lobby = await openMap(page)
  const canvas = lobby.locator('canvas')
  const rail = lobby.getByRole('navigation', { name: 'Select a museum island' })
  const entry = lobby.getByRole('button', {
    name: 'Open selected gallery: First Light Gallery',
  })
  for (const viewport of [
    { width: 740, height: 320 },
    { width: 852, height: 393 },
    { width: 320, height: 640 },
  ]) {
    await page.setViewportSize(viewport)
    await expect
      .poll(async () => (await canvas.boundingBox())?.height)
      .toBe(viewport.height)
    await expectInsideViewport(rail, viewport.width, viewport.height)
    await expectInsideViewport(entry, viewport.width, viewport.height)
    for (const button of await rail.getByRole('button').all()) {
      await expectInsideViewport(button, viewport.width, viewport.height)
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    await expect(lobby.locator('[data-journey-label]:visible')).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width)
  }
  await rail
    .getByRole('button', {
      name: 'Select Glassworks Journey on the museum map',
      exact: true,
    })
    .tap()
  await expect(lobby.locator('[data-map-state]')).toHaveAttribute(
    'data-selected-stage',
    'glassworks-isle',
  )
  await expect(
    lobby.getByRole('button', {
      name: 'Open selected gallery: Glassworks Journey',
    }),
  ).toBeVisible()
})

test('tablet and desktop label only the selected marker without covering other anchors @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  const lobby = await openMap(page)
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    const labels = lobby.locator('[data-journey-label]')
    await expect(labels).toHaveCount(4)
    await expect(lobby.locator('[data-journey-title]:visible')).toHaveCount(1)
    const selected = lobby.locator('[data-journey-label][aria-pressed="true"]')
    await expect(selected.locator('[data-journey-title]')).toHaveText(
      'First Light Gallery',
    )
    const boxes = await labels.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        }
      }),
    )
    for (let a = 0; a < boxes.length; a++)
      for (let b = a + 1; b < boxes.length; b++) {
        const first = boxes[a]!,
          second = boxes[b]!
        expect(
          first.right <= second.left ||
            second.right <= first.left ||
            first.bottom <= second.top ||
            second.bottom <= first.top,
        ).toBe(true)
      }
    const canvas = lobby.locator('canvas')
    for (const label of await labels.all()) {
      await expect(label).toHaveAttribute('data-projected', 'true')
      const bounds = (await canvas.boundingBox())!
      const point = {
        x: bounds.x + Number(await label.getAttribute('data-projected-x')),
        y: bounds.y + Number(await label.getAttribute('data-projected-y')),
      }
      expect(
        await canvas.evaluate(
          (element, p) => document.elementFromPoint(p.x, p.y) === element,
          point,
        ),
      ).toBe(true)
    }
  }
  await lobby.locator('[data-journey-label="twin-galleries-isle"]').tap()
  await expect(lobby.locator('[data-journey-title]:visible')).toHaveText(
    'Twin Galleries',
  )
  await expect(lobby.locator('[data-map-state]')).toHaveAttribute(
    'data-selected-stage',
    'twin-galleries-isle',
  )
  await expect(page.getByTestId('glass-adventure')).toHaveCount(0)
})

test('map settings retain independent sound and appearance without remounting the scene', async ({
  page,
}) => {
  const lobby = await openMap(page)
  const canvas = lobby.locator('canvas')
  await canvas.evaluate((element) =>
    element.setAttribute('data-layout-identity', 'original'),
  )
  const settings = lobby.getByRole('button', { name: 'Open museum settings' })
  await settings.tap()
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('checkbox', { name: 'Mute museum sound' }).check()
  const music = dialog.getByRole('slider', { name: 'Museum music volume' })
  await music.focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  await expect(music).toHaveValue('1')
  await dialog.getByRole('tab', { name: 'Appearance', exact: true }).click()
  await dialog.getByRole('button', { name: 'Celadon', exact: true }).click()
  await expect(
    lobby.locator('xpath=ancestor::*[@data-game-theme][1]'),
  ).toHaveAttribute('data-game-theme', 'dark')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(settings).toBeFocused()
  await expect(canvas).toHaveAttribute('data-layout-identity', 'original')
  await settings.click()
  await dialog.getByRole('tab', { name: 'Sound', exact: true }).click()
  await expect(
    dialog.getByRole('checkbox', { name: 'Mute museum sound' }),
  ).toBeChecked()
  await expect(music).toHaveValue('1')
  await dialog.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.reload()
  await expect(lobby).toBeVisible()
  await expect(
    lobby.locator('xpath=ancestor::*[@data-game-theme][1]'),
  ).toHaveAttribute('data-game-theme', 'dark')
  await settings.click()
  await expect(
    dialog.getByRole('checkbox', { name: 'Mute museum sound' }),
  ).toBeChecked()
  await expect(
    dialog.getByRole('slider', { name: 'Museum music volume' }),
  ).toHaveValue('1')
})

test('short landscape map settings keep their frame and footer inside the dialog @smoke', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 740, height: 320 })
  const lobby = await openMap(page)
  const settings = lobby.getByRole('button', { name: 'Open museum settings' })
  await settings.tap()
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true })
  for (const theme of ['Crystal', 'Celadon']) {
    await dialog.getByRole('tab', { name: 'Appearance', exact: true }).click()
    await dialog.getByRole('button', { name: theme, exact: true }).click()
    await dialog.getByRole('tab', { name: 'Sound', exact: true }).click()
    const surface = dialog.locator('[data-game-surface]').first()
    const frame = surface.locator(':scope > [data-game-frame]')
    await expect(frame).toBeVisible()
    await expect
      .poll(async () =>
        frame.evaluate((element) =>
          Number(element.getAttribute('viewBox')?.split(' ')[3]),
        ),
      )
      .toBe((await surface.boundingBox())!.height)
    await page.screenshot({
      path: testInfo.outputPath(`${theme}-settings.png`),
    })
    const bounds = (await dialog.boundingBox())!
    const surfaceBounds = (await surface.boundingBox())!
    const frameBounds = (await frame.boundingBox())!
    expect(frameBounds).toEqual(surfaceBounds)
    await expectInsideViewport(dialog, 740, 320)
    const footer = dialog.locator('footer')
    const actions = await footer.getByRole('button').all()
    for (const element of [surface, frame, footer, ...actions]) {
      await expectInsideViewport(element, 740, 320)
      const elementBounds = (await element.boundingBox())!
      expect(elementBounds.x).toBeGreaterThanOrEqual(bounds.x)
      expect(elementBounds.y).toBeGreaterThanOrEqual(bounds.y)
      expect(elementBounds.x + elementBounds.width).toBeLessThanOrEqual(
        bounds.x + bounds.width,
      )
      expect(elementBounds.y + elementBounds.height).toBeLessThanOrEqual(
        bounds.y + bounds.height,
      )
    }
    for (const button of actions) {
      const buttonBounds = (await button.boundingBox())!
      expect(buttonBounds.width).toBeGreaterThanOrEqual(44)
      expect(buttonBounds.height).toBeGreaterThanOrEqual(44)
    }
  }
  await dialog.getByRole('button', { name: 'Resume', exact: true }).tap()
  await expect(dialog).not.toBeVisible()
  await expect(settings).toBeFocused()
})
