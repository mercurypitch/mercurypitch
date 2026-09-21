// Floating museum journey — real pointer, lifecycle and durable-progress browser checks.

import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({
  viewport: { width: 1024, height: 768 },
  hasTouch: true,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
test.setTimeout(120_000)

async function openJourney(page: Page): Promise<Locator> {
  await page.addInitScript(() => {
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
  })
  await page.goto('/glass-game/?campaign=1')
  const lobby = page.getByTestId('glass-campaign')
  await expect(lobby).toBeVisible()
  await expect(lobby.locator('[data-map-state]')).toHaveAttribute(
    'data-map-state',
    'ready',
    { timeout: 60_000 },
  )
  return lobby
}

async function mapPoint(
  canvas: Locator,
  across: number,
  down: number,
): Promise<{ x: number; y: number }> {
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  return {
    x: bounds!.x + bounds!.width * across,
    y: bounds!.y + bounds!.height * down,
  }
}

test('mouse selects an island, while a drag remains navigation @smoke', async ({
  page,
}) => {
  const lobby = await openJourney(page)
  const frame = lobby.locator('[data-map-state]')
  const canvas = frame.locator('canvas')
  await expect(frame).toHaveAttribute('data-selected-stage', 'first-light-isle')

  const twins = await mapPoint(canvas, 0.58, 0.59)
  await page.mouse.move(twins.x, twins.y)
  await page.mouse.down()
  await page.mouse.up()
  await expect(frame).toHaveAttribute(
    'data-selected-stage',
    'twin-galleries-isle',
  )
  await expect(
    lobby.getByRole('button', {
      name: 'Open selected gallery: Twin Galleries',
    }),
  ).toBeVisible()
  const metrics = JSON.parse(
    (await canvas.getAttribute('data-renderer-metrics')) ?? 'null',
  ) as {
    drawCalls: number
    triangles: number
    waterTriangles: number
    waterDrawCalls: number
    secondaryRenderPasses: number
  } | null
  expect(metrics).toMatchObject({
    waterTriangles: 2688,
    waterDrawCalls: 5,
    secondaryRenderPasses: 1,
  })
  expect(metrics?.drawCalls).toBeGreaterThan(0)
  expect(metrics?.triangles).toBeGreaterThan(99_000)

  const dragStart = await mapPoint(canvas, 0.33, 0.36)
  await page.mouse.move(dragStart.x, dragStart.y)
  await page.mouse.down()
  await page.mouse.move(dragStart.x + 90, dragStart.y + 36, { steps: 6 })
  await page.mouse.up()
  await expect(frame).toHaveAttribute(
    'data-selected-stage',
    'twin-galleries-isle',
  )
})

test('native touch cancellation cannot select and a completed tap can', async ({
  page,
}) => {
  const lobby = await openJourney(page)
  const frame = lobby.locator('[data-map-state]')
  const canvas = frame.locator('canvas')
  const session = await page.context().newCDPSession(page)
  const glassworks = await mapPoint(canvas, 0.43, 0.34)

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...glassworks, id: 1 }],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: glassworks.x + 3, y: glassworks.y + 2, id: 1 }],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  })
  await expect(frame).toHaveAttribute('data-selected-stage', 'first-light-isle')

  const twins = await mapPoint(canvas, 0.58, 0.59)
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...twins, id: 2 }],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await expect(frame).toHaveAttribute(
    'data-selected-stage',
    'twin-galleries-isle',
  )
})

test('map asset failure and WebGL context loss recover with one live canvas', async ({
  page,
}) => {
  let mapRequests = 0
  await page.route(
    '**/journey-map-v1/floating-museum-map-kit-v1.glb',
    (route) => {
      mapRequests++
      if (mapRequests === 1) void route.abort('failed')
      else void route.continue()
    },
  )
  await page.goto('/glass-game/?campaign=1')
  const lobby = page.getByTestId('glass-campaign')
  const frame = lobby.locator('[data-map-state]')
  await expect(frame).toHaveAttribute('data-map-state', 'failed', {
    timeout: 60_000,
  })
  await lobby.getByRole('button', { name: 'Retry interactive map' }).click()
  await expect(frame).toHaveAttribute('data-map-state', 'ready', {
    timeout: 60_000,
  })
  await expect(frame.locator('canvas')).toHaveCount(1)
  expect(mapRequests).toBe(2)

  const contextLost = await frame.locator('canvas').evaluate((canvas) => {
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    const extension = context?.getExtension('WEBGL_lose_context')
    extension?.loseContext()
    return extension !== null && extension !== undefined
  })
  expect(contextLost).toBe(true)
  await expect(frame).toHaveAttribute('data-map-state', 'failed')
  await lobby.getByRole('button', { name: 'Retry interactive map' }).click()
  await expect(frame).toHaveAttribute('data-map-state', 'ready', {
    timeout: 60_000,
  })
  await expect(frame.locator('canvas')).toHaveCount(1)
})

test('phone exposes the island rail and selected entry in its first viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const lobby = await openJourney(page)
  const rail = lobby.getByRole('navigation', { name: 'Select a museum island' })
  const entry = lobby.getByRole('button', {
    name: 'Open selected gallery: First Light Gallery',
  })
  await expect(rail).toBeVisible()
  await expect(entry).toBeVisible()
  const entryBounds = await entry.boundingBox()
  expect(entryBounds).not.toBeNull()
  expect(entryBounds!.y + entryBounds!.height).toBeLessThanOrEqual(640)
  const horizontalLayout = await lobby.evaluate((element) => ({
    overflowX: getComputedStyle(element).overflowX,
    viewportWidth: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
  }))
  expect(horizontalLayout.overflowX).toBe('hidden')
  expect(horizontalLayout.pageWidth).toBeLessThanOrEqual(
    horizontalLayout.viewportWidth,
  )

  await entry.click()
  const gallery = page.getByTestId('glass-adventure')
  await expect(gallery).toHaveAttribute(
    'data-level-id',
    'glassworks-chamber/chamber',
  )
  await expect(gallery).toHaveAttribute('data-ready', 'true', {
    timeout: 60_000,
  })
  await page.getByRole('button', { name: 'Leave museum', exact: true }).tap()
  await expect(lobby.locator('[data-map-state]')).toHaveAttribute(
    'data-map-state',
    'ready',
    { timeout: 60_000 },
  )
  await expect(lobby.locator('canvas')).toHaveCount(1)
})

test('saved portrait appears independently from singing-quality stars', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'beside-cue:glass-adventure:progress:glassworks-journey/journey',
      JSON.stringify({
        version: 2,
        levelId: 'glassworks-journey/journey',
        checkpointId: 'glassworks-journey/journey/vestibule/checkpoint/entry',
        completedBreakableIds: [],
        finished: false,
        rewards: {
          version: 1,
          discoveredEncounterIds: [],
          collectedCoinIds: [],
          qualityResults: [],
          collectedPortraitIds: ['glassworks-awakened-muse'],
        },
      }),
    )
  })
  await page.goto('/glass-game/?campaign=1')
  const lobby = page.getByTestId('glass-campaign')
  await lobby
    .getByRole('navigation', { name: 'Select a museum island' })
    .getByRole('button', { name: /Glassworks Journey/u })
    .click()
  await expect(
    lobby.getByText('Portrait collected · She Who Woke the Glass'),
  ).toBeVisible()
  await expect(lobby.locator('[aria-label*="saved pitch"]')).toHaveCount(0)
  await expect(lobby.getByText('Singing quality not yet graded')).toHaveCount(0)
})

test('leaving during the soundtrack fade cannot mount a stale gallery', async ({
  page,
}) => {
  const lobby = await openJourney(page)
  // Keep both actions in one browser turn so a fast machine cannot finish the
  // short audio fade before the second Playwright command reaches the page.
  await lobby.evaluate((element) => {
    const enter = element.querySelector<HTMLButtonElement>(
      '[aria-label="Open selected gallery: First Light Gallery"]',
    )
    const leave = element.querySelector<HTMLButtonElement>(
      '[aria-label="Leave Glassworks"]',
    )
    if (enter === null || leave === null) throw new Error('Missing map actions')
    enter.click()
    leave.click()
  })
  await page.waitForURL((url) => url.pathname === '/')
  await expect(page.getByTestId('glass-adventure')).toHaveCount(0)
  await expect(page.getByTestId('glass-campaign')).toHaveCount(0)
})
