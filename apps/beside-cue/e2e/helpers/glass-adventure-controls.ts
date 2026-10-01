// Glass adventure control helpers — shared scene setup, metrics and native pointer-ownership proof.

import { expect, type BrowserContext, type Page } from '@playwright/test'

const RASTER_METHODS = [
  'blitFramebuffer',
  'clear',
  'drawArrays',
  'drawArraysInstanced',
  'drawElements',
  'drawElementsInstanced',
  'generateMipmap',
] as const

export async function omitRasterOutput(page: Page): Promise<void> {
  // Control specs assert controller state and accessible UI. Keep the real
  // scene graph, resources, input, RAF and physics paths while omitting pixel
  // draws plus GPU-side multisample resolves and mipmap generation.
  await page.addInitScript((methods) => {
    for (const name of methods)
      Object.defineProperty(WebGL2RenderingContext.prototype, name, {
        configurable: true,
        value: () => undefined,
      })
  }, RASTER_METHODS)
}

export async function openMuseum(
  page: Page,
  renderPixels = false,
): Promise<void> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('requestfailed', (request) =>
    errors.push(`${request.url()} ${request.failure()?.errorText}`),
  )
  if (!renderPixels) await omitRasterOutput(page)
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

export async function value(page: Page, key: string): Promise<number> {
  return Number(
    await page.getByTestId('glass-adventure').getAttribute(`data-${key}`),
  )
}

export async function verifyLookFirstMovementReacquisition(
  page: Page,
  context: BrowserContext,
): Promise<void> {
  await openMuseum(page)
  await page.evaluate(() => {
    const trace: {
      pointerId: number
      target: string
      type: string
    }[] = []
    const record = (event: Event) => {
      const pointer = event as PointerEvent
      const element = pointer.target as Element | null
      trace.push({
        pointerId: pointer.pointerId,
        target:
          element?.closest('[aria-label]')?.getAttribute('aria-label') ??
          element?.tagName ??
          'unknown',
        type: pointer.type,
      })
      document.documentElement.dataset.pointerOwnershipTrace =
        JSON.stringify(trace)
    }
    for (const type of [
      'pointerdown',
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ])
      document.addEventListener(type, record, true)
  })
  const cdp = await context.newCDPSession(page)
  const stick = await page
    .getByRole('group', { name: 'Move Merc' })
    .boundingBox()
  expect(stick).not.toBeNull()
  const look = { id: 1, x: 310, y: 380 }
  const lookMoved = { id: 1, x: 345, y: 390 }
  const origin = {
    x: stick!.x + Math.min(60, stick!.width * 0.36),
    y: stick!.y + stick!.height - 64,
  }
  const movement = { id: 2, x: origin.x + 30, y: origin.y - 20 }

  const initialYaw = await value(page, 'camera-yaw')
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [look],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [lookMoved],
  })
  await page.clock.runFor(32)
  expect(
    Math.abs((await value(page, 'camera-yaw')) - initialYaw),
  ).toBeGreaterThan(0.1)

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [lookMoved, { id: 2, ...origin }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [lookMoved, movement],
  })
  const firstStart = {
    x: await value(page, 'player-x'),
    z: await value(page, 'player-z'),
  }
  await page.clock.runFor(140)
  expect(
    Math.hypot(
      (await value(page, 'player-x')) - firstStart.x,
      (await value(page, 'player-z')) - firstStart.z,
    ),
  ).toBeGreaterThan(0.03)

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [movement],
  })
  await page.clock.runFor(300)
  const released = {
    x: await value(page, 'player-x'),
    z: await value(page, 'player-z'),
  }
  await page.clock.runFor(200)
  expect(await value(page, 'player-x')).toBeCloseTo(released.x, 4)
  expect(await value(page, 'player-z')).toBeCloseTo(released.z, 4)
  const releaseTrace = JSON.parse(
    (await page.locator('html').getAttribute('data-pointer-ownership-trace')) ??
      '[]',
  ) as { pointerId: number; target: string; type: string }[]
  const firstDowns = releaseTrace.filter(
    (event) => event.type === 'pointerdown',
  )
  const lookPointer = firstDowns.find((event) => event.target !== 'Move Merc')
  const firstMovementPointer = firstDowns.find(
    (event) => event.target === 'Move Merc',
  )
  expect(lookPointer).toBeDefined()
  expect(firstMovementPointer).toBeDefined()
  expect(releaseTrace).toContainEqual({
    pointerId: firstMovementPointer!.pointerId,
    target: 'Move Merc',
    type: 'pointerup',
  })
  expect(
    releaseTrace.some(
      (event) =>
        event.pointerId === lookPointer!.pointerId &&
        (event.type === 'pointerup' || event.type === 'pointercancel'),
    ),
  ).toBe(false)

  const secondMovement = { id: 3, x: origin.x - 26, y: origin.y - 24 }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [lookMoved, { id: 3, ...origin }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [lookMoved, secondMovement],
  })
  const secondStart = {
    x: await value(page, 'player-x'),
    z: await value(page, 'player-z'),
  }
  await page.clock.runFor(140)
  expect(
    Math.hypot(
      (await value(page, 'player-x')) - secondStart.x,
      (await value(page, 'player-z')) - secondStart.z,
    ),
  ).toBeGreaterThan(0.03)
  const reacquiredTrace = JSON.parse(
    (await page.locator('html').getAttribute('data-pointer-ownership-trace')) ??
      '[]',
  ) as { pointerId: number; target: string; type: string }[]
  const reacquiredDowns = reacquiredTrace.filter(
    (event) => event.type === 'pointerdown',
  )
  expect(reacquiredDowns).toHaveLength(3)
  expect(
    reacquiredDowns.filter(
      (event) => event.pointerId === lookPointer!.pointerId,
    ),
  ).toHaveLength(1)
  const secondMovementPointer = reacquiredDowns.at(-1)!
  expect(secondMovementPointer.target).toBe('Move Merc')
  expect(secondMovementPointer.pointerId).not.toBe(
    firstMovementPointer!.pointerId,
  )

  const yawBeforeConcurrentLook = await value(page, 'camera-yaw')
  const positionBeforeConcurrentLook = {
    x: await value(page, 'player-x'),
    z: await value(page, 'player-z'),
  }
  const lookAfterReacquire = { ...lookMoved, x: lookMoved.x - 38 }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [lookAfterReacquire, secondMovement],
  })
  await page.clock.runFor(140)
  expect(
    Math.abs((await value(page, 'camera-yaw')) - yawBeforeConcurrentLook),
  ).toBeGreaterThan(0.1)
  expect(
    Math.hypot(
      (await value(page, 'player-x')) - positionBeforeConcurrentLook.x,
      (await value(page, 'player-z')) - positionBeforeConcurrentLook.z,
    ),
  ).toBeGreaterThan(0.03)

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  })
}
