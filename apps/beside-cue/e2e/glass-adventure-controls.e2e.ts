// Museum controls — real mouse, keyboard and simultaneous touch through the shared surface.
import { expect, test, type Page } from '@playwright/test'

test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})
// Include browser/context fixture setup in the budget. Calling setTimeout from
// inside a test happens after those fixtures have already been created.
// On CI head 413d9580, the SwiftShader phone and replay journeys exceeded 120s
// before passing on retry; this is an allowance, not a hardware performance gate.
test.setTimeout(180_000)

const RASTER_METHODS = [
  'clear',
  'drawArrays',
  'drawArraysInstanced',
  'drawElements',
  'drawElementsInstanced',
] as const

async function omitRasterOutput(page: Page): Promise<void> {
  // This spec asserts controller state and accessible UI. Keep the real scene
  // graph, input, RAF and physics paths, while omitting only SwiftShader pixel
  // output that can turn a few virtual frames into a minute of CI work.
  await page.addInitScript((methods) => {
    for (const name of methods)
      Object.defineProperty(WebGL2RenderingContext.prototype, name, {
        configurable: true,
        value: () => undefined,
      })
  }, RASTER_METHODS)
}

async function openMuseum(page: Page, renderPixels = false): Promise<void> {
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
  await page.clock.runFor(1_900)
  const heldStart = {
    x: await value(page, 'player-x'),
    z: await value(page, 'player-z'),
  }
  await page.keyboard.down('KeyD')
  await page.clock.runFor(350)
  await page.keyboard.up('KeyD')
  expect(
    Math.hypot(
      (await value(page, 'player-x')) - heldStart.x,
      (await value(page, 'player-z')) - heldStart.z,
    ),
  ).toBeGreaterThan(0.2)
  expect(await value(page, 'camera-yaw')).toBeCloseTo(draggedYaw, 5)
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

  await page.clock.runFor(1_900)
  expect(await value(page, 'camera-yaw')).toBeCloseTo(draggedYaw, 5)
  const strafeStart = {
    x: await value(page, 'player-x'),
    z: await value(page, 'player-z'),
  }
  await page.keyboard.down('KeyD')
  await page.clock.runFor(600)
  await page.keyboard.up('KeyD')
  const strafe = {
    x: (await value(page, 'player-x')) - strafeStart.x,
    z: (await value(page, 'player-z')) - strafeStart.z,
  }
  const expected = { x: Math.cos(draggedYaw), z: -Math.sin(draggedYaw) }
  expect(strafe.x * expected.x + strafe.z * expected.z).toBeGreaterThan(0.35)
  expect(Math.abs(strafe.x * expected.z - strafe.z * expected.x)).toBeLessThan(
    0.08,
  )
  const releasedTurn = Math.abs((await value(page, 'camera-yaw')) - draggedYaw)
  expect(releasedTurn).toBeGreaterThan(0.05)
  expect(releasedTurn).toBeLessThan(0.3)
  await page.clock.runFor(900)
  expect(
    Math.abs((await value(page, 'camera-yaw')) - draggedYaw),
  ).toBeGreaterThan(0.4)

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

// Each zoom starts at spawn so repeated travel cannot turn a wall collision
// into a false camera-intent result.
for (const wheel of [-1_100, 2_350, -1_250]) {
  test(`wheel zoom ${wheel} preserves brief side steps and follows a sustained turn @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 480 })
    await openMuseum(page)
    await page.mouse.move(320, 250)

    // Derive Merc's heading from actual travel, independently of the camera
    // API, at near, far and middle zoom across the parameterized cases.
    await page.mouse.wheel(0, wheel)
    await page.clock.runFor(32)
    const beforeTap = await value(page, 'camera-yaw')
    const tapStart = [
      await value(page, 'player-x'),
      await value(page, 'player-z'),
    ]
    await page.keyboard.down('KeyA')
    await page.clock.runFor(150)
    await page.keyboard.up('KeyA')
    await page.clock.runFor(700)
    expect(
      Math.hypot(
        (await value(page, 'player-x')) - tapStart[0],
        (await value(page, 'player-z')) - tapStart[1],
      ),
    ).toBeGreaterThan(0.15)
    expect(await value(page, 'camera-yaw')).toBeCloseTo(beforeTap, 5)

    // A sustained side input commits a deliberate turn, which completes even
    // after key-up. A brief correction above must not commit that same turn.
    const start = [await value(page, 'player-x'), await value(page, 'player-z')]
    await page.keyboard.down('KeyA')
    await page.clock.runFor(450)
    await page.keyboard.up('KeyA')
    await page.clock.runFor(1_500)
    const dx = (await value(page, 'player-x')) - start[0]
    const dz = (await value(page, 'player-z')) - start[1]
    expect(Math.hypot(dx, dz)).toBeGreaterThan(0.15)
    const heading = Math.atan2(-dx, -dz)
    const view = await value(page, 'camera-yaw')
    const error = Math.atan2(Math.sin(heading - view), Math.cos(heading - view))
    expect(Math.abs(error)).toBeLessThan(0.04)
  })
}

test('a sustained turn after a fresh manual look finishes after the quiet window @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 })
  await openMuseum(page)
  await page.mouse.move(320, 250)
  await page.mouse.down()
  await page.mouse.move(410, 250, { steps: 5 })
  await page.mouse.up()
  await page.clock.runFor(32)
  const manualYaw = await value(page, 'camera-yaw')
  await page.clock.runFor(1_200)
  expect(await value(page, 'camera-yaw')).toBeCloseTo(manualYaw, 5)
  // Move immediately after a second look gesture. The 1.15s manual quiet
  // window overlaps the held contact, then the bounded 80-degree/s response
  // still has enough time to finish the committed turn.
  await page.mouse.down()
  await page.mouse.move(430, 250, { steps: 3 })
  await page.mouse.up()
  await page.clock.runFor(32)
  const start = [await value(page, 'player-x'), await value(page, 'player-z')]
  await page.keyboard.down('KeyA')
  await page.clock.runFor(450)
  await page.keyboard.up('KeyA')
  await page.clock.runFor(2_200)
  const heading = Math.atan2(
    start[0] - (await value(page, 'player-x')),
    start[1] - (await value(page, 'player-z')),
  )
  expect(
    Math.hypot(
      start[0] - (await value(page, 'player-x')),
      start[1] - (await value(page, 'player-z')),
    ),
  ).toBeGreaterThan(0.15)
  const difference = heading - (await value(page, 'camera-yaw'))
  expect(
    Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))),
  ).toBeLessThan(0.04)
})

test('changing a held key chord steers from the current view @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 })
  await openMuseum(page)
  await page.mouse.move(320, 210)
  await page.mouse.down()
  await page.mouse.move(360, 210, { steps: 3 })
  await page.mouse.up()
  await page.clock.runFor(250)
  await page.keyboard.down('KeyA')
  await page.clock.runFor(200)

  async function expectTravel(heading: number): Promise<void> {
    // Allow the bounded physical acceleration to finish before measuring travel.
    await page.clock.runFor(180)
    const x = await value(page, 'player-x')
    const z = await value(page, 'player-z')
    await page.clock.runFor(160)
    const dx = (await value(page, 'player-x')) - x
    const dz = (await value(page, 'player-z')) - z
    expect(Math.hypot(dx, dz)).toBeGreaterThan(0.14)
    const difference = Math.atan2(-dx, -dz) - heading
    expect(
      Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))),
    ).toBeLessThan(0.12)
    expect(await value(page, 'player-y')).toBeCloseTo(0, 3)
  }

  const diagonalHeading = (await value(page, 'camera-yaw')) + Math.PI / 4
  await page.keyboard.down('KeyW')
  await expectTravel(diagonalHeading)
  const forwardHeading = await value(page, 'camera-yaw')
  await page.keyboard.up('KeyA')
  await expectTravel(forwardHeading)
  await page.keyboard.up('KeyW')
})

test('camera mode validates, guards the V shortcut and persists the pause setting @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const seeded = 'beside-cue:e2e:invalid-camera-mode-seeded'
    if (sessionStorage.getItem(seeded) !== null) return
    localStorage.setItem(
      'beside-cue:glass-adventure:camera-mode:v1',
      'unknown-camera',
    )
    sessionStorage.setItem(seeded, 'true')
  })
  await openMuseum(page)
  const adventure = page.getByTestId('glass-adventure')
  const viewport = page.getByLabel('Glass museum; drag to look around')
  await expect(adventure).toHaveAttribute('data-camera-mode', 'third-person')

  await viewport.focus()
  await page.keyboard.press('KeyV')
  await expect(adventure).toHaveAttribute('data-camera-mode', 'first-person')

  await page.keyboard.down('KeyV')
  await expect(adventure).toHaveAttribute('data-camera-mode', 'third-person')
  await page.keyboard.down('KeyV')
  await expect(adventure).toHaveAttribute('data-camera-mode', 'third-person')
  await page.keyboard.up('KeyV')
  await page.keyboard.press('Control+KeyV')
  await expect(adventure).toHaveAttribute('data-camera-mode', 'third-person')

  await page.getByRole('button', { name: 'Pause game' }).focus()
  await page.keyboard.press('KeyV')
  await expect(adventure).toHaveAttribute('data-camera-mode', 'third-person')

  await viewport.focus()
  await page.keyboard.press('Escape')
  const pause = page.getByRole('dialog', { name: 'Take a little breath.' })
  await pause.getByRole('slider').first().focus()
  await page.keyboard.press('KeyV')
  await expect(adventure).toHaveAttribute('data-camera-mode', 'third-person')
  await pause.getByRole('radio', { name: 'First person' }).check()
  await expect(adventure).toHaveAttribute('data-camera-mode', 'first-person')
  await page.keyboard.press('KeyV')
  await expect(adventure).toHaveAttribute('data-camera-mode', 'first-person')
  await pause.getByRole('button', { name: 'Back to the museum' }).click()

  await page.clock.resume()
  await page.reload()
  await expect(adventure).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  })
  await expect(adventure).toHaveAttribute('data-camera-mode', 'first-person')
})

test.describe('phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  test('Tune clears Help and movement controls cannot be selected @smoke', async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await openMuseum(page, true)
    const help = page.getByRole('button', { name: 'How to play' })
    const tune = page.getByRole('button', {
      name: 'Camera tuning',
      exact: true,
    })
    for (const width of [320, 390, 768, 1180]) {
      await page.setViewportSize({ width, height: 740 })
      const helpBox = await help.boundingBox()
      const tuneBox = await tune.boundingBox()
      expect(helpBox).not.toBeNull()
      expect(tuneBox).not.toBeNull()
      expect(
        tuneBox!.y - (helpBox!.y + helpBox!.height),
      ).toBeGreaterThanOrEqual(8)
      expect(tuneBox!.x + tuneBox!.width).toBeLessThanOrEqual(width)
    }
    await page.setViewportSize({ width: 320, height: 740 })
    await page.clock.runFor(32)
    // Proof capture is opt-in: shared CI GPUs can stall screenshot readback.
    // Geometry, computed styles, real rendering and input remain mandatory.
    if (process.env.GLASS_CONTROLS_PROOF === '1')
      await page.screenshot({ path: testInfo.outputPath('phone-controls.png') })
    await help.tap()
    await expect(
      page.getByRole('dialog', { name: 'A little room to wander.' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await tune.tap()
    await expect(
      page.getByRole('dialog', { name: 'Camera comfort tuning' }),
    ).toBeVisible()
    if (process.env.GLASS_CONTROLS_PROOF === '1')
      await page.screenshot({
        path: testInfo.outputPath('phone-tuning-panel.png'),
      })
    await page.getByRole('button', { name: 'Close camera tuning' }).tap()
    // Resume a released-input frame after the tutorial before pressing Jump.
    await page.clock.runFor(32)

    const jump = page.getByRole('button', { name: 'Jump', exact: true })
    await expect(jump.locator('span')).toHaveCSS('user-select', 'none')
    await expect(page.getByRole('group', { name: 'Move Merc' })).toHaveCSS(
      'user-select',
      'none',
    )
    const label = await jump.locator('span').boundingBox()
    expect(label).not.toBeNull()
    await page.mouse.move(label!.x, label!.y + label!.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      label!.x + label!.width,
      label!.y + label!.height / 2,
      { steps: 5 },
    )
    await page.mouse.up()
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      '',
    )
    await page.evaluate(() => {
      document.addEventListener(
        'contextmenu',
        (event) => {
          document.body.dataset.movementContextMenu = String(
            event.defaultPrevented,
          )
        },
        { once: true },
      )
    })
    await jump.click({ button: 'right' })
    await expect(page.locator('body')).toHaveAttribute(
      'data-movement-context-menu',
      'true',
    )
    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        {
          id: 1,
          x: label!.x + label!.width / 2,
          y: label!.y + label!.height / 2,
        },
      ],
    })
    await page.clock.runFor(100)
    expect(await value(page, 'player-y')).toBeGreaterThan(0.1)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  })
  test('three fingers move, orbit and jump independently; cancellation releases the controls @smoke', async ({
    page,
    context,
  }, testInfo) => {
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
    const origin = {
      x: stick!.x + Math.min(60, stick!.width * 0.36),
      y: stick!.y + stick!.height - 64,
    }
    const beforeContact = [
      await value(page, 'player-x'),
      await value(page, 'player-z'),
    ]
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, ...origin }],
    })
    await page.clock.runFor(120)
    expect(await value(page, 'player-x')).toBeCloseTo(beforeContact[0], 4)
    expect(await value(page, 'player-z')).toBeCloseTo(beforeContact[1], 4)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 1, x: origin.x + 4, y: origin.y - 2 }],
    })
    await page.clock.runFor(120)
    expect(await value(page, 'player-x')).toBeCloseTo(beforeContact[0], 4)
    expect(await value(page, 'player-z')).toBeCloseTo(beforeContact[1], 4)
    const movement = { id: 1, x: origin.x + 30, y: origin.y - 16 }
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
    if (process.env.GLASS_CONTROLS_PROOF === '1')
      await page.screenshot({
        path: testInfo.outputPath('floating-stick-active.png'),
      })
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

  test('look can begin first while movement releases and reacquires independently @smoke', async ({
    page,
    context,
  }) => {
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
      (await page
        .locator('html')
        .getAttribute('data-pointer-ownership-trace')) ?? '[]',
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
      (await page
        .locator('html')
        .getAttribute('data-pointer-ownership-trace')) ?? '[]',
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
  })

  test('tablet movement owns only its visible lower-left pad @smoke', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1180, height: 820 })
    await openMuseum(page)
    const pad = page.getByRole('group', { name: 'Move Merc' })
    const base = page.getByTestId('floating-stick-base')
    const padBox = await pad.boundingBox()
    expect(padBox).not.toBeNull()
    expect(padBox!.width).toBeLessThanOrEqual(160)
    expect(padBox!.height).toBeLessThanOrEqual(160)
    await expect(base).toHaveCSS('opacity', '0.62')

    const cdp = await context.newCDPSession(page)
    const lookStart = { id: 11, x: 330, y: 500 }
    const initialYaw = await value(page, 'camera-yaw')
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [lookStart],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...lookStart, x: lookStart.x + 44 }],
    })
    await page.clock.runFor(32)
    expect(
      Math.abs((await value(page, 'camera-yaw')) - initialYaw),
    ).toBeGreaterThan(0.1)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [{ ...lookStart, x: lookStart.x + 44 }],
    })
  })

  test('narrow pause settings scroll by native touch to the camera choice and resume @smoke', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await openMuseum(page)
    await page.keyboard.press('Escape')
    const adventure = page.getByTestId('glass-adventure')
    const pause = page.getByRole('dialog', { name: 'Take a little breath.' })
    const firstPerson = pause.getByRole('radio', { name: 'First person' })
    const resume = pause.getByRole('button', { name: 'Back to the museum' })
    await expect(pause).toBeVisible()
    await expect(resume).not.toBeInViewport()
    const beforeScroll = await pause.evaluate(
      (dialog) => dialog.parentElement?.scrollTop ?? -1,
    )

    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 61, x: 10, y: 500 }],
    })
    for (const y of [420, 330, 240, 150, 80])
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ id: 61, x: 10, y }],
      })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })

    await expect
      .poll(() =>
        pause.evaluate((dialog) => dialog.parentElement?.scrollTop ?? -1),
      )
      .toBeGreaterThan(beforeScroll)
    await expect(firstPerson).toBeInViewport()
    await expect(resume).toBeInViewport()
    await firstPerson.check()
    await expect(adventure).toHaveAttribute('data-camera-mode', 'first-person')
    await resume.click()
    await expect(pause).toBeHidden()
    await cdp.detach()
  })
})

test('replay starts fresh while gameplay saves preserve durable completion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 })
  await omitRasterOutput(page)
  const completedProgress = {
    version: 1,
    levelId: 'glassworks',
    checkpointId: 'hero',
    finished: true,
    completedBreakableIds: [
      'glassworks.first-goblet',
      'glassworks.rounded-vase',
      'glassworks.hero-display',
    ],
  }
  await page.addInitScript((progress) => {
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
    localStorage.setItem(
      'beside-cue:glass-adventure:progress:glassworks',
      JSON.stringify(progress),
    )
  }, completedProgress)
  await page.goto('/glass-game/')
  await expect(
    page.getByRole('dialog', { name: 'You made the museum sing.' }),
  ).toBeVisible()
  await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
    'data-completed',
    '3',
  )
  await page.getByRole('button', { name: 'Play this gallery again' }).click()
  await expect(page.getByLabel('0 of 3 main exhibits opened')).toBeVisible({
    timeout: 30_000,
  })
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
  const savedAfterLoad = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('beside-cue:glass-adventure:progress:glassworks')!,
    ),
  )
  expect(savedAfterLoad).toEqual(completedProgress)

  const adventure = page.getByTestId('glass-adventure')
  await page.keyboard.down('KeyW')
  try {
    await expect(adventure).toHaveAttribute('data-checkpoint', 'jump-arrival', {
      timeout: 5000,
    })
  } finally {
    await page.keyboard.up('KeyW')
  }
  const savedAfterMovement = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('beside-cue:glass-adventure:progress:glassworks')!,
    ),
  )
  expect(savedAfterMovement).toEqual({
    version: 2,
    levelId: 'glassworks',
    checkpointId: 'jump-arrival',
    completedBreakableIds: [
      'glassworks.first-goblet',
      'glassworks.rounded-vase',
      'glassworks.hero-display',
    ],
    finished: true,
    rewards: {
      version: 1,
      discoveredEncounterIds: [],
      collectedCoinIds: [],
      qualityResults: [],
      collectedPortraitIds: [],
    },
  })
})
