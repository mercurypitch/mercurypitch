import type { CDPSession, Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

const readSliderValue = async (slider: Locator): Promise<number> =>
  Number(await slider.getAttribute('aria-valuenow'))

const rememberCapturedPointer = async (target: Locator): Promise<void> => {
  await target.evaluate((element) => {
    element.addEventListener('gotpointercapture', (event) => {
      element.setAttribute(
        'data-last-captured-pointer',
        String((event as PointerEvent).pointerId),
      )
    })
  })
}

const expectCaptureReleased = async (target: Locator): Promise<void> => {
  await expect
    .poll(() =>
      target.evaluate((element) => {
        const pointerId = Number(
          element.getAttribute('data-last-captured-pointer'),
        )
        return (
          Number.isFinite(pointerId) && !element.hasPointerCapture(pointerId)
        )
      }),
    )
    .toBe(true)
}

const dispatchTouch = async (
  session: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
  x?: number,
  y?: number,
): Promise<void> => {
  await session.send('Input.dispatchTouchEvent', {
    type,
    touchPoints:
      type === 'touchEnd' || type === 'touchCancel'
        ? []
        : [
            {
              x: x ?? 0,
              y: y ?? 0,
              id: 1,
              radiusX: 8,
              radiusY: 8,
              force: 1,
            },
          ],
  })
}

const openSinging = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/#/singing')
  await page.waitForSelector('#app-tabs, [data-tour="mobile-tabbar"]', {
    timeout: 10_000,
  })
  await dismissOverlays(page)
  const singingTab = page.locator('#tab-singing')
  if ((await singingTab.count()) > 0) await singingTab.click()
}

const createLoopMarkers = async (page: Page): Promise<void> => {
  const rail = page.getByTestId('singing-seek-rail')
  await expect(rail).toBeVisible()
  const box = await rail.boundingBox()
  if (box === null) throw new Error('Singing seek rail has no bounding box')

  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2)
  await page.getByTestId('loop-a-btn').click()
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2)
  await page.getByTestId('loop-b-btn').click()

  await expect(page.getByTestId('loop-marker-a')).toBeVisible()
  await expect(page.getByTestId('loop-marker-b')).toBeVisible()
}

test.describe('shared drag gesture verification', () => {
  test('navigation pan releases after the pointer leaves the window and recovers (REQ-DRAG-001, REQ-DRAG-002)', async ({
    page,
  }) => {
    await openSinging(page)
    const nav = page.locator('#app-tabs')
    await page.locator('#tab-settings').click()
    await expect(page.locator('#tab-settings')).toHaveAttribute(
      'aria-current',
      'page',
    )
    await page.locator('#tab-singing').click()
    await expect(page.locator('#tab-singing')).toHaveAttribute(
      'aria-current',
      'page',
    )
    await nav.evaluate((element) => {
      element.style.flex = '0 0 360px'
      element.style.width = '360px'
      element.scrollLeft = 60
    })
    await rememberCapturedPointer(nav)

    const box = await nav.boundingBox()
    if (box === null) throw new Error('App navigation has no bounding box')
    const start = await nav.evaluate((element) => element.scrollLeft)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(-20, box.y + box.height / 2, { steps: 8 })
    await page.mouse.up()

    await expect(nav).not.toHaveClass(/dragging/)
    await expectCaptureReleased(nav)
    expect(await nav.evaluate((element) => element.scrollLeft)).toBeGreaterThan(
      start,
    )
    await page.waitForTimeout(0)
    await page.locator('#tab-settings').click()
    await expect(page.locator('#tab-settings')).toHaveAttribute(
      'aria-current',
      'page',
    )
    await page.locator('#tab-singing').click()

    const recoveredStart = await nav.evaluate((element) => element.scrollLeft)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 4 })
    await page.mouse.up()
    expect(await nav.evaluate((element) => element.scrollLeft)).not.toBe(
      recoveredStart,
    )
  })

  test('loop marker handles mouse, touch cancellation, and keyboard (REQ-DRAG-002, REQ-DRAG-004, REQ-DRAG-005)', async ({
    page,
  }) => {
    await openSinging(page)
    await createLoopMarkers(page)

    const markerA = page.getByTestId('loop-marker-a')
    await expect(markerA).toHaveAttribute('role', 'slider')
    await expect(markerA).toHaveAttribute('aria-orientation', 'horizontal')
    await rememberCapturedPointer(markerA)

    const markerABox = await markerA.boundingBox()
    if (markerABox === null)
      throw new Error('Loop A marker has no bounding box')
    const beforeMouse = await readSliderValue(markerA)
    await page.mouse.move(
      markerABox.x + markerABox.width / 2,
      markerABox.y + markerABox.height / 2,
    )
    await page.mouse.down()
    await page.mouse.move(
      markerABox.x + markerABox.width / 2 + 35,
      markerABox.y + markerABox.height / 2,
      { steps: 5 },
    )
    await page.mouse.up()
    expect(await readSliderValue(markerA)).not.toBe(beforeMouse)
    await expectCaptureReleased(markerA)

    await markerA.focus()
    const beforeKeyboard = await readSliderValue(markerA)
    await markerA.press('ArrowRight')
    expect(await readSliderValue(markerA)).toBeGreaterThan(beforeKeyboard)

    const markerB = page.getByTestId('loop-marker-b')
    await rememberCapturedPointer(markerB)
    const session = await page.context().newCDPSession(page)
    let markerBBox = await markerB.boundingBox()
    if (markerBBox === null)
      throw new Error('Loop B marker has no bounding box')
    const touchX = markerBBox.x + markerBBox.width / 2
    const touchY = markerBBox.y + markerBBox.height / 2

    await dispatchTouch(session, 'touchStart', touchX, touchY)
    await dispatchTouch(session, 'touchMove', touchX - 30, touchY)
    await dispatchTouch(session, 'touchCancel')
    await expectCaptureReleased(markerB)

    const beforeRecovery = await readSliderValue(markerB)
    markerBBox = await markerB.boundingBox()
    if (markerBBox === null) throw new Error('Loop B marker disappeared')
    const recoveryX = markerBBox.x + markerBBox.width / 2
    const recoveryY = markerBBox.y + markerBBox.height / 2
    await dispatchTouch(session, 'touchStart', recoveryX, recoveryY)
    await dispatchTouch(session, 'touchMove', recoveryX - 25, recoveryY)
    await dispatchTouch(session, 'touchEnd')

    expect(await readSliderValue(markerB)).not.toBe(beforeRecovery)
    await expectCaptureReleased(markerB)
  })

  test('mobile scrubber handles mouse and interrupted touch drags (REQ-DRAG-002, REQ-DRAG-005)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openSinging(page)
    const scrubber = page.getByRole('slider', { name: 'Playback position' })
    await expect(scrubber).toBeVisible()
    await rememberCapturedPointer(scrubber)

    let box = await scrubber.boundingBox()
    if (box === null) throw new Error('Mobile scrubber has no bounding box')
    const beforeMouse = await readSliderValue(scrubber)
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height / 2, {
      steps: 5,
    })
    await page.mouse.up()
    expect(await readSliderValue(scrubber)).not.toBe(beforeMouse)
    await expectCaptureReleased(scrubber)

    const session = await page.context().newCDPSession(page)
    box = await scrubber.boundingBox()
    if (box === null) throw new Error('Mobile scrubber disappeared')
    const startX = box.x + box.width * 0.3
    const touchY = box.y + box.height / 2
    await dispatchTouch(session, 'touchStart', startX, touchY)
    await dispatchTouch(session, 'touchMove', box.x + box.width + 30, touchY)
    await dispatchTouch(session, 'touchCancel')
    await expectCaptureReleased(scrubber)

    const beforeRecovery = await readSliderValue(scrubber)
    await dispatchTouch(session, 'touchStart', startX, touchY)
    await dispatchTouch(session, 'touchMove', box.x + box.width * 0.8, touchY)
    await dispatchTouch(session, 'touchEnd')

    expect(await readSliderValue(scrubber)).not.toBe(beforeRecovery)
    await expectCaptureReleased(scrubber)
  })
})

// A real touch context, not just a narrow one: the bar's hit strip grows
// under `pointer: coarse`, and that query is false in a desktop Chromium
// however small the window is.
test.describe('jam song bar on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  // The bar carried a bare onClick until this spec: a tap jumped, a drag
  // did nothing, on a mouse or a finger. Reported from a phone, so the
  // touch half is the half that matters.
  test('drags with a finger and does not seek the room on a cancelled touch (REQ-DRAG-002, REQ-DRAG-005)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    })
    await page.goto('/#/jam')
    await dismissOverlays(page)

    await page.getByRole('button', { name: 'Create Room' }).click()
    await page.getByRole('button', { name: 'Choose a drill or a song' }).click()
    const drawer = page.getByRole('dialog', {
      name: 'Choose a song or a drill',
    })
    await drawer.getByRole('button', { name: /Goodbye to Spring/ }).click()

    const bar = page.getByRole('slider', { name: 'Song position' })
    await expect(bar).toBeVisible()
    // The room creator is the host, so the bar is live rather than a
    // read-only readout.
    await expect(bar).toHaveAttribute('aria-disabled', 'false')
    await rememberCapturedPointer(bar)

    const box = await bar.boundingBox()
    if (box === null) throw new Error('Jam song bar has no bounding box')
    const y = box.y + box.height / 2

    // A phone-sized target. 4px was the visible bar, not the hit strip.
    expect(box.height).toBeGreaterThanOrEqual(28)

    const session = await page.context().newCDPSession(page)
    const touchStartX = box.x + box.width * 0.1
    await dispatchTouch(session, 'touchStart', touchStartX, y)
    await dispatchTouch(session, 'touchMove', box.x + box.width * 0.5, y)
    // Mid-drag the bar previews the target -- it does not seek the room on
    // every move, because a jam seek is audible everywhere at once.
    const midDrag = await readSliderValue(bar)
    expect(midDrag).toBeGreaterThan(0)
    await dispatchTouch(session, 'touchMove', box.x + box.width * 0.85, y)
    await dispatchTouch(session, 'touchEnd')
    const afterTouch = await readSliderValue(bar)
    // Release commits where the finger ended, not where it passed through.
    expect(afterTouch).toBeGreaterThan(midDrag)
    await expectCaptureReleased(bar)

    // A snatched-away gesture -- a system swipe, an incoming call -- must
    // leave the song where it was. Everybody in the room hears a seek.
    await dispatchTouch(session, 'touchStart', touchStartX, y)
    await dispatchTouch(session, 'touchMove', box.x + box.width * 0.95, y)
    await dispatchTouch(session, 'touchCancel')
    await expectCaptureReleased(bar)
    expect(await readSliderValue(bar)).toBe(afterTouch)
  })
})
