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

interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

async function bounds(page: Page, selector: string): Promise<Bounds> {
  return page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    }
  })
}

function gapBetween(a: Bounds, b: Bounds): number {
  const horizontal = Math.max(b.left - a.right, a.left - b.right, 0)
  const vertical = Math.max(b.top - a.bottom, a.top - b.bottom, 0)
  return Math.hypot(horizontal, vertical)
}

test('artwork offer shares the top header row above guidance and leaves controls reachable @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await openGarden(page)
  const offer = page.getByRole('button', { name: 'View nearby artwork' })
  const messageStack = page.getByTestId('glass-message-stack')
  const guidance = page.getByTestId('glass-progress-guidance')
  const help = page.getByRole('button', { name: 'How to play' })
  const title = page.getByRole('heading', {
    level: 1,
    name: 'Glassworks Journey',
  })
  await expect(messageStack).toHaveRole('status')
  await expect(messageStack).toHaveAttribute('aria-live', 'polite')
  await expect(messageStack).toHaveAttribute('aria-atomic', 'false')
  await expect(messageStack).toHaveAttribute('aria-label', 'Museum guidance')
  await expect(guidance).toHaveRole('paragraph')
  await expect(guidance).toHaveAttribute('data-guidance-kind', 'next')
  await expect(guidance).toContainText(
    'Next: Garden decanter. Follow its glowing circle, then tap Sing.',
  )

  for (const viewport of [
    { width: 320, height: 640, touch: true },
    { width: 768, height: 1024, touch: true },
    { width: 901, height: 600, touch: true },
    { width: 1024, height: 768, touch: true },
    { width: 1440, height: 900, touch: false },
  ]) {
    await page.setViewportSize(viewport)
    const offerBounds = await bounds(
      page,
      'button[aria-label="View nearby artwork"]',
    )
    const guidanceBounds = await guidance.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      }
    })
    const helpBounds = await bounds(page, 'button[aria-label="How to play"]')

    expect((offerBounds.left + offerBounds.right) / 2).toBeCloseTo(
      viewport.width / 2,
      0,
    )
    const pauseBounds = await bounds(page, 'button[aria-label="Pause game"]')
    const leaveBounds = await bounds(page, 'button[aria-label="Leave museum"]')
    const collectionBounds = await bounds(
      page,
      '[aria-label$="main exhibits opened"]',
    )
    expect((offerBounds.top + offerBounds.bottom) / 2).toBeCloseTo(
      (pauseBounds.top + pauseBounds.bottom) / 2,
      0,
    )
    expect(guidanceBounds.top).toBeGreaterThanOrEqual(offerBounds.bottom + 12)
    expect(gapBetween(offerBounds, pauseBounds)).toBeGreaterThanOrEqual(8)
    expect(gapBetween(offerBounds, leaveBounds)).toBeGreaterThanOrEqual(8)
    expect(gapBetween(offerBounds, collectionBounds)).toBeGreaterThanOrEqual(4)
    expect(gapBetween(offerBounds, helpBounds)).toBeGreaterThanOrEqual(12)
    if (viewport.width > 900) {
      await expect(title).toBeVisible()
      const identityBounds = await title.evaluate((element) => {
        const rect = element.parentElement!.getBoundingClientRect()
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        }
      })
      expect(gapBetween(offerBounds, identityBounds)).toBeGreaterThanOrEqual(8)
    } else await expect(title).toBeHidden()

    if (viewport.touch) await help.tap()
    else await help.click()
    const tutorial = page.getByRole('dialog').filter({
      has: page.getByRole('button', { name: 'Skip tutorial' }),
    })
    await expect(tutorial).toBeVisible()
    if (viewport.touch)
      await tutorial.getByRole('button', { name: 'Skip tutorial' }).tap()
    else await tutorial.getByRole('button', { name: 'Skip tutorial' }).click()
    await expect(tutorial).toHaveCount(0)
  }
})

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
  await button.click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('img').click()
  await dialog.getByRole('heading').click()
  await expect(dialog).toBeVisible()
  await dialog.locator('..').click({ position: { x: 2, y: 2 } })
  await expect(dialog).toHaveCount(0)
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
    await dialog.tap({ position: { x: 5, y: 5 } })
    await expect(dialog).toBeVisible()
    await dialog.locator('..').tap({ position: { x: 2, y: 2 } })
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: 'View nearby artwork' }).tap()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Back to the gallery' }).tap()
    await expect(dialog).toHaveCount(0)
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
