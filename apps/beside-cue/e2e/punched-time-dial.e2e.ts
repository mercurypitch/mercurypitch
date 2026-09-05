// ============================================================
// Punched Clock — real-mouse drag and pointer-capture contract
// ============================================================
//
// Synthetic pointer events can pass while capture or coordinate mapping is
// broken. This spec turns the actual Settings record in Chromium and observes
// the same synchronized time field a person can use as a precise fallback.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

interface TouchPoint {
  readonly x: number
  readonly y: number
}

async function dispatchTouchPath(
  page: Page,
  points: readonly TouchPoint[],
  beforeRelease?: () => Promise<void>,
): Promise<void> {
  const first = points[0]
  if (first === undefined || points.length < 2) {
    throw new Error('A touch path needs at least two points.')
  }
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 1,
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...first, id: 1, radiusX: 5, radiusY: 5, force: 1 }],
  })
  try {
    for (const point of points.slice(1)) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            ...point,
            id: 1,
            radiusX: 5,
            radiusY: 5,
            force: 1,
          },
        ],
      })
    }
    await beforeRelease?.()
  } finally {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await session.detach()
  }
}

async function waitForScrollToSettle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let quietTimer = 0
        const finish = (): void => {
          window.removeEventListener('scroll', restart, true)
          resolve()
        }
        const restart = (): void => {
          window.clearTimeout(quietTimer)
          quietTimer = window.setTimeout(finish, 220)
        }
        window.addEventListener('scroll', restart, {
          capture: true,
          passive: true,
        })
        restart()
      }),
  )
}

async function rememberCapturedPointer(target: Locator): Promise<void> {
  await target.evaluate((element) => {
    element.addEventListener('gotpointercapture', (event) => {
      element.setAttribute(
        'data-last-captured-pointer',
        String((event as PointerEvent).pointerId),
      )
    })
  })
}

async function capturedPointerIsActive(target: Locator): Promise<boolean> {
  return target.evaluate((element) => {
    const pointerId = Number(element.getAttribute('data-last-captured-pointer'))
    return Number.isFinite(pointerId) && element.hasPointerCapture(pointerId)
  })
}

async function capturedPointerIsReleased(target: Locator): Promise<boolean> {
  return target.evaluate((element) => {
    const pointerId = Number(element.getAttribute('data-last-captured-pointer'))
    return Number.isFinite(pointerId) && !element.hasPointerCapture(pointerId)
  })
}

function clockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/u.exec(value)
  if (match === null) return null
  return Number(match[1]) * 60 + Number(match[2])
}

test('the Punched Clock follows a real mouse turn and releases cleanly @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?devSeed')

  await expect(
    page.getByRole('heading', { name: 'Your current pressing' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(
    page.getByRole('heading', { name: 'Daily reminder' }),
  ).toBeVisible()

  const dial = page.getByRole('slider', {
    name: 'Turn the record to choose a reminder time',
  })
  const exactTime = page.getByLabel('Type exact time')
  await dial.scrollIntoViewIfNeeded()
  await waitForScrollToSettle(page)
  await expect(dial).toBeVisible()
  await expect(exactTime).toHaveValue('')
  await rememberCapturedPointer(dial)

  const bounds = await dial.boundingBox()
  if (bounds === null) throw new Error('Punched Clock has no bounding box.')

  const before = await exactTime.inputValue()
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  const outerRingRadius = Math.min(bounds.width, bounds.height) * 0.46

  await page.mouse.move(centerX + outerRingRadius, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX, centerY + outerRingRadius, { steps: 12 })

  await expect.poll(() => capturedPointerIsActive(dial)).toBe(true)
  await expect.poll(() => exactTime.inputValue()).not.toBe(before)
  const whileHeld = await exactTime.inputValue()
  expect(clockMinutes(whileHeld)).not.toBeNull()

  await page.mouse.up()

  await expect.poll(() => capturedPointerIsReleased(dial)).toBe(true)
  await expect
    .poll(async () => {
      const minutes = clockMinutes(await exactTime.inputValue())
      return minutes === null ? null : minutes % 5
    })
    .toBe(0)

  const settled = await exactTime.inputValue()
  const settledMinutes = clockMinutes(settled)
  expect(settled).not.toBe(before)
  expect(settledMinutes).not.toBeNull()
  await expect(dial).toHaveAttribute('aria-valuenow', String(settledMinutes))
  await expect(dial).toHaveAttribute(
    'aria-valuetext',
    `Around ${settled}; editing minutes`,
  )
})

test('a vertical touch beginning on the record scrolls the Settings page instead of turning time @smoke', async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Trusted touch input uses Chromium CDP.',
  )
  await page.setViewportSize({ width: 390, height: 664 })
  await page.goto('/?devSeed')

  await expect(
    page.getByRole('heading', { name: 'Your current pressing' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  const dial = page.getByRole('slider', {
    name: 'Turn the record to choose a reminder time',
  })
  const exactTime = page.getByLabel('Type exact time')
  await dial.evaluate((element) =>
    element.scrollIntoView({ block: 'center', behavior: 'auto' }),
  )
  await expect(dial).toBeVisible()
  await expect(exactTime).toHaveValue('')
  await expect
    .poll(() =>
      dial.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const visibleWidth = Math.max(
          0,
          Math.min(bounds.right, window.innerWidth) - Math.max(bounds.left, 0),
        )
        const visibleHeight = Math.max(
          0,
          Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0),
        )
        return (visibleWidth * visibleHeight) / (bounds.width * bounds.height)
      }),
    )
    .toBeGreaterThanOrEqual(0.8)

  const beforeScroll = await page.evaluate(() => window.scrollY)
  const bounds = await dial.boundingBox()
  if (bounds === null) throw new Error('Punched Clock has no bounding box.')
  const x = bounds.x + bounds.width * 0.86
  const startY = bounds.y + bounds.height * 0.5

  const endY = Math.max(24, startY - 150)
  const touchPath = Array.from({ length: 9 }, (_, index) => ({
    x,
    y: startY + ((endY - startY) * index) / 8,
  }))
  await dispatchTouchPath(page, touchPath)

  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(beforeScroll + 24)
  await expect(exactTime).toHaveValue('')
})

test('a trusted tangential touch keeps turning through a circular drag @smoke', async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Trusted touch input uses Chromium CDP.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?devSeed')

  await expect(
    page.getByRole('heading', { name: 'Your current pressing' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  const dial = page.getByRole('slider', {
    name: 'Turn the record to choose a reminder time',
  })
  const exactTime = page.getByLabel('Type exact time')
  await dial.evaluate((element) =>
    element.scrollIntoView({ block: 'center', behavior: 'auto' }),
  )
  await waitForScrollToSettle(page)
  await expect(exactTime).toHaveValue('')
  await expect(dial).toHaveAttribute('aria-valuenow', '600')
  await rememberCapturedPointer(dial)
  const beforeScroll = await page.evaluate(() => window.scrollY)
  const bounds = await dial.boundingBox()
  if (bounds === null) throw new Error('Punched Clock has no bounding box.')
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  const radius = Math.min(bounds.width, bounds.height) * 0.41
  const circularPath = Array.from({ length: 13 }, (_, index) => {
    const angle = (-90 + (90 * index) / 12) * (Math.PI / 180)
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    }
  })

  await dispatchTouchPath(page, circularPath, async () => {
    // The complete 12-to-3 arc must reach +15 minutes while still held.
    // A cancelled first movement can also produce a nonempty snapped time.
    await expect(exactTime).toHaveValue('10:15')
    await expect(dial).toHaveAttribute('aria-valuenow', '615')
    await expect(dial.locator('..').locator('..')).toHaveAttribute(
      'data-dragging',
      'true',
    )
    await expect.poll(() => capturedPointerIsActive(dial)).toBe(true)
    expect(await page.evaluate(() => window.scrollY)).toBe(beforeScroll)
  })

  await expect.poll(() => capturedPointerIsReleased(dial)).toBe(true)
  await expect
    .poll(async () => {
      const minutes = clockMinutes(await exactTime.inputValue())
      return minutes === null ? null : minutes % 5
    })
    .toBe(0)
})
