// Museum controls — real mouse, keyboard and simultaneous touch through the shared surface.
import { expect, test, type Page } from '@playwright/test'

test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
// Include browser/context fixture setup in the budget. Calling setTimeout from
// inside a test happens after those fixtures have already been created.
test.setTimeout(120_000)

async function openMuseum(page: Page): Promise<void> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('requestfailed', (request) =>
    errors.push(`${request.url()} ${request.failure()?.errorText}`),
  )
  await page.addInitScript(() =>
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen'),
  )
  const response = await page.goto('/glass-game/')
  expect(response?.status()).toBe(200)
  try {
    await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 30_000 },
    )
  } catch (error) {
    throw new Error(`Museum did not open: ${errors.join('; ')}`, {
      cause: error,
    })
  }
  await page.clock.install()
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 3_600_000)
}
async function value(page: Page, key: string): Promise<number> {
  return Number(
    await page.getByTestId('glass-adventure').getAttribute(`data-${key}`),
  )
}

test('mouse orbit releases, pause cancels a held drag, and keyboard motion stops @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 })
  await openMuseum(page)
  const initialYaw = await value(page, 'camera-yaw')
  await page.mouse.move(320, 210)
  await page.mouse.down()
  await page.mouse.move(400, 220, { steps: 4 })
  await page.clock.runFor(32)
  const draggedYaw = await value(page, 'camera-yaw')
  expect(Math.abs(draggedYaw - initialYaw)).toBeGreaterThan(0.2)
  await page.mouse.up()
  await page.mouse.move(470, 240)
  await page.clock.runFor(32)
  expect(await value(page, 'camera-yaw')).toBeCloseTo(draggedYaw, 5)

  await page.mouse.down()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('dialog', { name: 'Take a little breath.' }),
  ).toBeVisible()
  await page.mouse.move(520, 200)
  await page.keyboard.press('Escape')
  await page.mouse.move(540, 210)
  await page.clock.runFor(32)
  expect(await value(page, 'camera-yaw')).toBeCloseTo(draggedYaw, 5)
  await page.mouse.up()

  const x = await value(page, 'player-x')
  const z = await value(page, 'player-z')
  await page.keyboard.down('KeyW')
  await page.clock.runFor(250)
  await page.keyboard.up('KeyW')
  expect(
    Math.hypot(
      (await value(page, 'player-x')) - x,
      (await value(page, 'player-z')) - z,
    ),
  ).toBeGreaterThan(0.15)
  await page.clock.runFor(200)
  const stopped = [await value(page, 'player-x'), await value(page, 'player-z')]
  await page.clock.runFor(200)
  expect(await value(page, 'player-x')).toBeCloseTo(stopped[0], 4)
  expect(await value(page, 'player-z')).toBeCloseTo(stopped[1], 4)
  await page.getByRole('button', { name: 'How to play' }).focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('dialog', { name: 'A little room to wander.' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test.describe('phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  test('three fingers move, orbit and jump independently; cancellation releases the controls @smoke', async ({
    page,
    context,
  }) => {
    await openMuseum(page)
    const cdp = await context.newCDPSession(page)
    const stick = await page
      .getByRole('group', { name: 'Move Merc' })
      .boundingBox()
    const jump = await page
      .getByRole('button', { name: 'Jump', exact: true })
      .boundingBox()
    expect(stick).not.toBeNull()
    expect(jump).not.toBeNull()
    const centre = {
      x: stick!.x + stick!.width / 2,
      y: stick!.y + stick!.height / 2,
    }
    const movement = { id: 1, x: centre.x + 20, y: centre.y - 8 }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, ...centre }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [movement],
    })
    const x = await value(page, 'player-x')
    const z = await value(page, 'player-z')
    await page.clock.runFor(100)
    expect(
      Math.hypot(
        (await value(page, 'player-x')) - x,
        (await value(page, 'player-z')) - z,
      ),
    ).toBeGreaterThan(0.03)
    const yaw = await value(page, 'camera-yaw')
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [movement, { id: 2, x: 220, y: 380 }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [movement, { id: 2, x: 265, y: 390 }],
    })
    await page.clock.runFor(32)
    expect(Math.abs((await value(page, 'camera-yaw')) - yaw)).toBeGreaterThan(
      0.1,
    )
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        movement,
        { id: 2, x: 265, y: 390 },
        { id: 3, x: jump!.x + jump!.width / 2, y: jump!.y + jump!.height / 2 },
      ],
    })
    await page.clock.runFor(100)
    expect(await value(page, 'player-y')).toBeGreaterThan(0.1)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    })
    await page.clock.runFor(200)
    const released = [
      await value(page, 'player-x'),
      await value(page, 'player-z'),
      await value(page, 'camera-yaw'),
    ]
    await page.clock.runFor(200)
    expect(await value(page, 'player-x')).toBeCloseTo(released[0], 4)
    expect(await value(page, 'player-z')).toBeCloseTo(released[1], 4)
    expect(await value(page, 'camera-yaw')).toBeCloseTo(released[2], 5)
    expect(
      await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      })),
    ).toEqual({ width: 390, height: 844 })
  })
})

test('a completed gallery restores, then replay starts a fresh visit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 })
  await page.addInitScript(() => {
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
    localStorage.setItem(
      'beside-cue:glass-adventure:progress:glassworks',
      JSON.stringify({
        version: 1,
        levelId: 'glassworks',
        checkpointId: 'hero',
        finished: true,
        completedBreakableIds: [
          'glassworks.first-goblet',
          'glassworks.rounded-vase',
          'glassworks.hero-display',
        ],
      }),
    )
  })
  await page.goto('/glass-game/')
  await expect(
    page.getByRole('dialog', { name: 'You made the museum sing.' }),
  ).toBeVisible()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '3',
  )
  await page.getByRole('button', { name: 'Play this gallery again' }).click()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 },
  )
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '0',
  )
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-checkpoint',
    'arrival',
  )
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const saved = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('beside-cue:glass-adventure:progress:glassworks')!,
    ),
  )
  expect(saved.completedBreakableIds).toEqual([])
  expect(saved.finished).toBe(false)
})
