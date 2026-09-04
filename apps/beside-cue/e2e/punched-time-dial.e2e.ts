// ============================================================
// Punched Clock — real-mouse drag and pointer-capture contract
// ============================================================
//
// Synthetic pointer events can pass while capture or coordinate mapping is
// broken. This spec turns the actual Settings record in Chromium and observes
// the same synchronized time field a person can use as a precise fallback.

import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'

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
    page.getByRole('heading', { name: 'A better choice, kept close.' }),
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
