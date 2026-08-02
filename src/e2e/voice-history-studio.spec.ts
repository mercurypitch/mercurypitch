// ============================================================
// Hear Yourself studio — live capture, room slider, and safe deletion
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

test('records visibly, drags a room control, and confirms deletion in-app @smoke', async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await page.waitForSelector('#app-tabs', { timeout: 10000 })
  await dismissOverlays(page)
  await page.locator('#tab-voice-history').click()
  await expect(page.getByTestId('voice-history-page')).toBeVisible()

  await page.getByRole('button', { name: 'New practice thread' }).click()
  await page
    .getByLabel(/what do you want to repeat/i)
    .fill('Room and waveform check')
  await page.getByRole('button', { name: 'Start recording' }).click()

  await expect(page.getByText('Recording now')).toBeVisible({ timeout: 10000 })
  await expect(page.getByTestId('live-voice-capture')).toBeVisible()
  await expect(page.getByTestId('live-voice-status')).toContainText(
    'voice input and pitch detected',
    { timeout: 10000 },
  )
  await page.waitForTimeout(900)

  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByRole('button', { name: 'Keep Take' })).toBeEnabled({
    timeout: 15000,
  })
  await page.getByRole('button', { name: 'Keep Take' }).click()

  await expect(page.getByText('Listening room')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Room and waveform check').first()).toBeVisible()
  await expect(
    page.locator('[data-testid="voice-history-page"] canvas'),
  ).not.toHaveCount(0)
  await page.getByRole('button', { name: 'Play take' }).click()

  const echo = page.getByTestId('voice-room-echo')
  const bounds = await echo.boundingBox()
  if (bounds === null) throw new Error('Echo room slider has no bounds')
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(bounds.x + 2, y)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 0.72, y, { steps: 8 })
  await page.mouse.up()
  expect(Number(await echo.inputValue())).toBeGreaterThan(50)
  await expect(page.getByText('Custom room')).toBeVisible()

  let nativeDialogOpened = false
  page.on('dialog', (dialog) => {
    nativeDialogOpened = true
    void dialog.dismiss()
  })

  await page
    .getByRole('button', { name: 'Clear all voice history', exact: true })
    .click()
  await page.getByTestId('confirm-phrase').fill('delete')
  await expect(
    page.getByRole('button', { name: 'Clear history', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText(
    'Delete Room and waveform check from this device?',
  )
  expect(nativeDialogOpened).toBe(false)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('alertdialog')).not.toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('Listening room')).toBeVisible()
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(horizontalOverflow).toBeLessThanOrEqual(1)

  await page.setViewportSize({ width: 1500, height: 1000 })
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Delete take', exact: true }).click()
  await expect(page.getByText('0 kept · 0 B')).toBeVisible({ timeout: 10000 })
  await expect(
    page.getByRole('button', { name: 'New practice thread' }),
  ).toBeFocused()
})
