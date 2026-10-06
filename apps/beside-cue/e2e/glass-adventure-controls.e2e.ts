// Museum controls — real mouse, keyboard and simultaneous touch through the shared surface.
import { expect, test } from '@playwright/test'
import { GLASS_GAME_ASSET_FILES } from '@irchiinnuss/glass-game/assets'
import { omitRasterOutput, openMuseum, value, verifyLookFirstMovementReacquisition, verifyMovementFirstThreeContacts, } from './helpers/glass-adventure-controls'
import { verifyNativeControlDefaults } from './helpers/glass-adventure-touch-defaults'
import { openCameraPreview, openGameSettings, } from './helpers/glass-ui-settings'

const MERC_MODEL_PATH = `/games/${GLASS_GAME_ASSET_FILES.merc}`

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
    page.getByRole('dialog', { name: 'Settings', exact: true }),
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
  await openGameSettings(page, 'Play')
  await page.getByRole('button', { name: 'How to play' }).focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('dialog', { name: 'A little room to wander.' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  const returnedSettings = page.getByRole('dialog', {
    name: 'Settings',
    exact: true,
  })
  await expect(returnedSettings).toBeVisible()
  await returnedSettings
    .getByRole('button', { name: 'Resume', exact: true })
    .click()
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

  await page.getByRole('button', { name: 'Open settings' }).focus()
  await page.keyboard.press('KeyV')
  await expect(adventure).toHaveAttribute('data-camera-mode', 'third-person')

  await viewport.focus()
  await page.keyboard.press('Escape')
  const pause = page.getByRole('dialog', { name: 'Settings', exact: true })
  await pause.getByRole('slider').first().focus()
  await page.keyboard.press('KeyV')
  await expect(adventure).toHaveAttribute('data-camera-mode', 'third-person')
  await pause.getByRole('tab', { name: 'Display', exact: true }).click()
  await pause.getByRole('radio', { name: 'First person' }).check()
  await expect(adventure).toHaveAttribute('data-camera-mode', 'first-person')
  await page.keyboard.press('KeyV')
  await expect(adventure).toHaveAttribute('data-camera-mode', 'first-person')
  await pause.getByRole('button', { name: 'Resume', exact: true }).click()

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
  test('native control taps suppress selection without suppressing modal inputs @smoke', async ({
    page,
    browserName,
  }) => {
    await verifyNativeControlDefaults(page, browserName)
  })

  test('Museum, Recenter and Settings stay separate and movement controls cannot be selected @smoke', async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await openMuseum(page, true)
    const chrome = [
      page.getByRole('button', { name: 'Leave museum', exact: true }),
      page.getByRole('button', { name: 'Recenter camera', exact: true }),
      page.getByRole('button', { name: 'Open settings', exact: true }),
    ]
    for (const width of [320, 390, 768, 1180]) {
      await page.setViewportSize({ width, height: 740 })
      const boxes = await Promise.all(
        chrome.map((control) => control.boundingBox()),
      )
      for (const box of boxes) {
        expect(box).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width)
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
      for (let a = 0; a < boxes.length; a++)
        for (let b = a + 1; b < boxes.length; b++) {
          const first = boxes[a]!,
            second = boxes[b]!
          expect(
            first.x + first.width <= second.x ||
              second.x + second.width <= first.x ||
              first.y + first.height <= second.y ||
              second.y + second.height <= first.y,
          ).toBe(true)
        }
    }
    await page.setViewportSize({ width: 320, height: 740 })
    await page.clock.runFor(32)
    // Proof capture is opt-in: shared CI GPUs can stall screenshot readback.
    // Geometry, computed styles, real rendering and input remain mandatory.
    if (process.env.GLASS_CONTROLS_PROOF === '1')
      await page.screenshot({ path: testInfo.outputPath('phone-controls.png') })
    await openGameSettings(page, 'Play')
    await page.getByRole('button', { name: 'How to play', exact: true }).tap()
    await expect(
      page.getByRole('dialog', { name: 'A little room to wander.' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
    await expect(settings).toBeVisible()
    await settings.getByRole('button', { name: 'Resume', exact: true }).tap()
    await openCameraPreview(page)
    await expect(
      page.getByRole('dialog', { name: 'Camera comfort tuning' }),
    ).toBeVisible()
    if (process.env.GLASS_CONTROLS_PROOF === '1')
      await page.screenshot({
        path: testInfo.outputPath('phone-tuning-panel.png'),
      })
    const sensitivity = page.getByLabel('Look sensitivity')
    const previousSensitivity = await sensitivity.inputValue()
    await sensitivity.focus()
    await page.keyboard.press('ArrowRight')
    expect(await sensitivity.inputValue()).not.toBe(previousSensitivity)
    expect(
      await sensitivity.evaluate((element) =>
        element.dispatchEvent(
          new Event('selectstart', { bubbles: true, cancelable: true }),
        ),
      ),
    ).toBe(true)
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
    await page.evaluate(() => {
      document.addEventListener('touchstart', (event) => {
        document.body.dataset.controlTouchPrevented = String(
          event.defaultPrevented,
        )
      })
    })
    const cdp = await context.newCDPSession(page)
    const knob = page.getByTestId('floating-stick-knob')
    const knobBox = (await knob.boundingBox())!
    const origin = {
      x: knobBox.x + knobBox.width / 2,
      y: knobBox.y + knobBox.height / 2,
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, ...origin }],
    })
    await expect(page.locator('body')).toHaveAttribute(
      'data-control-touch-prevented',
      'true',
    )
    // Real browser long press; the game clock alone does not drive native selection gestures.
    await page.waitForTimeout(850)
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      '',
    )
    await expect(page.getByTestId('floating-stick-base')).toHaveAttribute(
      'data-active',
      'true',
    )
    expect(
      await knob.evaluate((element) =>
        element.dispatchEvent(
          new Event('selectstart', { bubbles: true, cancelable: true }),
        ),
      ),
    ).toBe(false)
    const beforeDrag = [
      await value(page, 'player-x'),
      await value(page, 'player-z'),
    ]
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 1, x: origin.x + 30, y: origin.y - 16 }],
    })
    await expect(knob).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 30, -16)')
    await page.clock.runFor(100)
    expect(
      Math.hypot(
        (await value(page, 'player-x')) - beforeDrag[0],
        (await value(page, 'player-z')) - beforeDrag[1],
      ),
    ).toBeGreaterThan(0.03)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    })
    await expect(page.getByTestId('floating-stick-base')).toHaveAttribute(
      'data-active',
      'false',
    )
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
    await verifyMovementFirstThreeContacts(page, context, testInfo)
  })

  test('look can begin first while movement releases and reacquires independently @smoke', async ({
    page,
    context,
  }) => {
    await verifyLookFirstMovementReacquisition(page, context)
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

  test('narrow settings body scrolls by native touch while Resume stays visible @smoke', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await openMuseum(page)
    await page.keyboard.press('Escape')
    const adventure = page.getByTestId('glass-adventure')
    const pause = page.getByRole('dialog', { name: 'Settings', exact: true })
    await pause.getByRole('tab', { name: 'Display', exact: true }).tap()
    const firstPerson = pause.getByRole('radio', { name: 'First person' })
    const resume = pause.getByRole('button', { name: 'Resume', exact: true })
    await expect(pause).toBeVisible()
    await expect(resume).toBeInViewport()
    const bounds = await pause.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568)
    // The shared middle section scrolls independently of the fixed footer.
    const body = pause
      .getByRole('tabpanel', { name: 'Display', exact: true })
      .locator('..')
    const bodyBounds = (await body.boundingBox())!
    const start = {
      id: 61,
      x: bodyBounds.x + 1,
      y: bodyBounds.y + bodyBounds.height - 8,
    }
    const endY = bodyBounds.y + 8
    expect(
      await body.evaluate(
        (element, point) =>
          document.elementFromPoint(point.x, point.y) === element,
        start,
      ),
    ).toBe(true)
    const beforeScroll = await body.evaluate((element) => element.scrollTop)

    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [start],
    })
    for (const fraction of [0.2, 0.4, 0.6, 0.8, 1])
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...start, y: start.y - (start.y - endY) * fraction }],
      })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })

    await expect
      .poll(() => body.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(beforeScroll)
    await expect(firstPerson).toBeInViewport()
    await expect(resume).toBeInViewport()
    await firstPerson.tap()
    await expect(adventure).toHaveAttribute('data-camera-mode', 'first-person')
    await resume.tap()
    await expect(pause).toBeHidden()
    await cdp.detach()
  })
})

test('replay starts fresh while gameplay saves preserve durable completion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await omitRasterOutput(page)
  let mercModelRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === MERC_MODEL_PATH) mercModelRequests++
  })
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
    page.getByRole('dialog', { name: 'Glassworks is already complete.' }),
  ).toBeVisible()
  const decisionLayout = await page
    .getByRole('dialog', { name: 'Glassworks is already complete.' })
    .evaluate((dialog) => ({
      dialogWidth: dialog.getBoundingClientRect().width,
      viewportWidth: document.documentElement.clientWidth,
      pageOverflows: document.documentElement.scrollWidth > innerWidth,
    }))
  expect(decisionLayout.dialogWidth).toBeLessThanOrEqual(
    decisionLayout.viewportWidth,
  )
  expect(decisionLayout.pageOverflows).toBe(false)
  await expect(page.getByTestId('glass-adventure')).toHaveCount(0)
  expect(mercModelRequests).toBe(0)
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
  expect(mercModelRequests).toBe(1)
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
