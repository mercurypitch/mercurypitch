// Gallery inspection — artwork remains reachable without aiming a low camera at high walls.
import { expect, test, type Page } from '@playwright/test'

test.use({
  viewport: { width: 800, height: 600 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

async function openGarden(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Keep real scene geometry, raycasts and input; pixels have separate proofs.
    for (const method of [
      'clear',
      'drawArrays',
      'drawArraysInstanced',
      'drawElements',
      'drawElementsInstanced',
    ])
      Object.defineProperty(WebGL2RenderingContext.prototype, method, {
        configurable: true,
        value: () => undefined,
      })
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(
      `${prefix}progress:glassworks-journey/journey`,
      JSON.stringify({
        version: 1,
        levelId: 'glassworks-journey/journey',
        checkpointId: 'glassworks-journey/journey/garden/checkpoint/entry',
        completedBreakableIds: [
          'glassworks-journey/journey/vestibule/encounter/vestibule-goblet',
        ],
      }),
    )
  })
  await page.goto('/glass-game/?layout=journey')
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 60_000 },
  )
}

test('a visible painting opens from its canvas surface with mouse and touch @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await openGarden(page)
  const game = page.getByTestId('glass-adventure')
  const yaw = Number(await game.getAttribute('data-camera-yaw'))
  let remaining = -(Math.PI / 2 - yaw) / 0.005
  while (Math.abs(remaining) > 0.01) {
    const distance = Math.max(-240, Math.min(240, remaining))
    await page.mouse.move(512, 384)
    await page.mouse.down()
    await page.mouse.move(512 + distance, 384, { steps: 8 })
    await page.mouse.up()
    remaining -= distance
  }
  await expect
    .poll(async () => Number(await game.getAttribute('data-camera-yaw')))
    .toBeCloseTo(Math.PI / 2, 2)
  // Unobscured point on the real inset at this checkpoint and explicit yaw.
  const artwork = { x: 250, y: 115 }
  const dialog = page.getByRole('dialog', { name: 'The garden between notes' })
  await page.mouse.click(artwork.x, artwork.y)
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Back to the gallery' }).click()
  await page.touchscreen.tap(artwork.x, artwork.y)
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Back to the gallery' }).tap()
  // Returning a drag to its starting point must not turn it back into a tap.
  await page.mouse.move(artwork.x, artwork.y)
  await page.mouse.down()
  await page.mouse.move(artwork.x + 30, artwork.y, { steps: 4 })
  await page.mouse.move(artwork.x, artwork.y, { steps: 4 })
  await page.mouse.up()
  await expect(dialog).toHaveCount(0)
})

test('nearby artwork opens with real mouse, traps focus, and returns to the same camera @smoke', async ({
  page,
}) => {
  await openGarden(page)
  const button = page.getByRole('button', { name: 'View nearby artwork' })
  await expect(button).toBeVisible()
  const game = page.getByTestId('glass-adventure')
  const before = await game.getAttribute('data-camera-yaw')
  await button.click()
  const dialog = page.getByRole('dialog', { name: 'The garden between notes' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('img')).toBeVisible()
  const close = dialog.getByRole('button', { name: 'Back to the gallery' })
  expect(
    await close.evaluate((element) => getComputedStyle(element).color),
  ).toBe('rgb(255, 249, 232)')
  await expect(close).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  const position = await game.getAttribute('data-player-z')
  await page.keyboard.press('KeyW')
  expect(await game.getAttribute('data-player-z')).toBe(position)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await game.getAttribute('data-camera-yaw')).toBe(before)
  await expect(
    page.getByLabel('Glass museum; drag to look around'),
  ).toBeFocused()
  await page.mouse.move(400, 290)
  await page.mouse.down()
  await page.mouse.move(450, 295, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('phone and tablet touch inspection fits, and backgrounding does not resume the world', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await openGarden(page)
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: 'View nearby artwork' }).tap()
    const dialog = page.getByRole('dialog', {
      name: 'The garden between notes',
    })
    await expect(dialog).toBeVisible()
    const dimensions = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        overflow: element.scrollWidth > element.clientWidth,
      }
    })
    expect(dimensions.left).toBeGreaterThanOrEqual(0)
    expect(dimensions.right).toBeLessThanOrEqual(viewport.width)
    expect(dimensions.bottom).toBeLessThanOrEqual(viewport.height)
    expect(dimensions.overflow).toBe(false)
    await dialog.getByRole('button', { name: 'Back to the gallery' }).tap()
  }
  await page.getByRole('button', { name: 'View nearby artwork' }).tap()
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(
    page.getByRole('dialog', { name: 'The garden between notes' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('dialog', { name: 'Take a little breath.' }),
  ).toBeVisible()
})
