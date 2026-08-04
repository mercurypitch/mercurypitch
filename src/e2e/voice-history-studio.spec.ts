// ============================================================
// Hear Yourself studio — capture, Twin Trails, reflections, and safe deletion
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

test('records Twin Trails, scrubs, reflects, and confirms deletion in-app @smoke', async ({
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

  await expect(
    page.getByRole('heading', { name: 'Room and waveform check' }),
  ).toBeFocused({ timeout: 10000 })
  await expect(
    page.getByRole('button', { name: 'Room', exact: true }),
  ).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Room and waveform check').first()).toBeVisible()
  await expect(page.getByText('Take Topography', { exact: true })).toBeVisible()
  await expect(page.getByText('1 mapped', { exact: true })).toBeVisible()
  await expect(
    page.locator('[data-testid="voice-history-page"] canvas'),
  ).not.toHaveCount(0)
  await page
    .getByRole('button', { name: 'Add reflection', exact: true })
    .click()
  await expect(page.getByLabel('Optional note')).toBeEnabled()
  await expect(page.getByTestId('reflection-target')).toContainText(
    'Earlier take',
  )
  await expect(page.getByTestId('reflection-target')).toContainText('0:00')
  await page.getByLabel('Optional note').fill('The first moment is clear.')
  await page.getByTestId('reflection-beacon-keep').click()
  const firstMarker = page
    .locator('[data-testid^="voice-atlas-marker-"]')
    .first()
  await expect(firstMarker).toBeVisible()
  await firstMarker.click()
  await expect(
    page.getByRole('button', { name: 'Pause Room and waveform check' }),
  ).toBeVisible()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('button', { name: 'Play Room and waveform check' }),
  ).toBeVisible()
  await page.getByTestId('reflection-beacon-remove').click()

  await page.getByRole('button', { name: 'Record another take' }).click()
  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.getByText('Recording now')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByRole('button', { name: 'Keep Take' })).toBeEnabled({
    timeout: 15000,
  })
  await page.getByRole('button', { name: 'Keep Take' }).click()

  await expect(page.getByText('2 / 2 mapped', { exact: true })).toBeVisible({
    timeout: 10000,
  })

  const laterCard = page.getByTestId('voice-atlas-card-later')
  await laterCard.click({ position: { x: 8, y: 8 } })
  await expect(laterCard).toHaveAttribute('data-selected', 'true')
  await page
    .getByRole('button', { name: 'Add reflection', exact: true })
    .click()
  await expect(page.getByTestId('reflection-target')).toContainText(
    'Later take',
  )
  const seek = page.getByTestId('voice-atlas-slider')
  await seek.scrollIntoViewIfNeeded()
  const seekBounds = await seek.boundingBox()
  if (seekBounds === null) throw new Error('Voice Atlas has no scrub bounds')
  const seekY = seekBounds.y + seekBounds.height / 2
  await page.mouse.move(seekBounds.x + seekBounds.width * 0.62, seekY)
  await page.mouse.down()
  await page.mouse.move(seekBounds.x + seekBounds.width * 0.68, seekY, {
    steps: 5,
  })
  await page.mouse.up()
  const seekMaximum = Number(await seek.getAttribute('aria-valuemax'))
  await expect
    .poll(
      async () =>
        Number(await seek.getAttribute('aria-valuenow')) / seekMaximum,
    )
    .toBeGreaterThan(0.64)
  const pointerProgress = Number(await seek.getAttribute('aria-valuenow'))
  await seek.focus()
  await seek.press('ArrowRight')
  await expect
    .poll(async () => Number(await seek.getAttribute('aria-valuenow')))
    .toBeGreaterThan(pointerProgress)

  await page.getByLabel('Optional note').fill('The onset opens here.')
  await page.getByTestId('reflection-beacon-curious').click()
  const marker = page.locator('[data-testid^="voice-atlas-marker-"]').first()
  await expect(marker).toBeVisible()
  await marker.click()
  await expect(page.getByText('The onset opens here.')).toBeVisible()
  await page.getByTestId('reflection-beacon-remove').click()
  await expect(marker).toHaveCount(0)

  await page.getByRole('button', { name: 'Record another take' }).click()
  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.getByText('Recording now')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByRole('button', { name: 'Keep Take' })).toBeEnabled({
    timeout: 15000,
  })
  await page.getByRole('button', { name: 'Keep Take' }).click()

  await expect(page.getByText('2 of 3 takes', { exact: true })).toBeVisible({
    timeout: 10000,
  })
  await page.getByRole('button', { name: 'Pattern', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Hear the pattern across attempts.' }),
  ).toBeVisible()
  await expect(page.getByText('3 takes woven')).toBeVisible()
  const loomLanes = page.locator('[data-testid^="practice-loom-lane-"]')
  await expect(loomLanes).toHaveCount(3)
  const middleLane = loomLanes.nth(1)
  await middleLane.scrollIntoViewIfNeeded()
  const loomBounds = await middleLane.boundingBox()
  if (loomBounds === null) throw new Error('Practice Loom has no scrub bounds')
  const loomY = loomBounds.y + loomBounds.height / 2
  await page.mouse.move(loomBounds.x + loomBounds.width * 0.58, loomY)
  await page.mouse.down()
  await page.mouse.move(loomBounds.x + loomBounds.width * 0.66, loomY, {
    steps: 6,
  })
  await page.mouse.up()
  const loomMaximum = Number(await middleLane.getAttribute('aria-valuemax'))
  await expect
    .poll(
      async () =>
        Number(await middleLane.getAttribute('aria-valuenow')) / loomMaximum,
    )
    .toBeGreaterThan(0.62)
  await expect(
    page.getByRole('button', { name: 'Pause Room and waveform check' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Play Room and waveform check' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^Pause / })).toHaveCount(0)
  const earlierSelect = page.getByRole('combobox', { name: 'Earlier take' })
  const fullSpanEarlier = await earlierSelect.inputValue()
  await expect(page.getByRole('button', { name: 'Full span' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Latest two' }).click()
  expect(await earlierSelect.inputValue()).not.toBe(fullSpanEarlier)
  await expect(
    page.getByRole('button', { name: 'Latest two' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Full span' }).click()
  await expect(earlierSelect).toHaveValue(fullSpanEarlier)

  await page.getByRole('button', { name: 'Room', exact: true }).click()
  const echo = page.getByTestId('voice-room-echo')
  await echo.scrollIntoViewIfNeeded()
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
    .getByRole('button', { name: 'Clear entire voice history', exact: true })
    .click()
  await page.getByTestId('confirm-phrase').fill('delete')
  await expect(
    page.getByRole('button', { name: 'Clear history', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.getByRole('button', { name: 'All takes', exact: false }).click()
  await page
    .getByRole('button', { name: 'Actions for Room and waveform check' })
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText(
    'Delete Room and waveform check from this device?',
  )
  expect(nativeDialogOpened).toBe(false)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('alertdialog')).not.toBeVisible()

  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await page.getByRole('button', { name: 'Room', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('Listening room').first()).toBeVisible()
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(horizontalOverflow).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: 'Close listening tools' }).click()
  await page
    .getByRole('button', { name: 'Add reflection', exact: true })
    .click()
  const mobileInspector = page.getByRole('dialog', {
    name: 'Listening tools',
  })
  await expect(mobileInspector).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Close listening tools' }),
  ).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect
    .poll(() =>
      mobileInspector.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    )
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(mobileInspector).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Add reflection', exact: true }),
  ).toBeFocused()

  await page.setViewportSize({ width: 1500, height: 1000 })

  await page.getByRole('button', { name: 'New practice thread' }).click()
  await page.getByLabel(/what do you want to repeat/i).fill('Temporary thread')
  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.getByText('Recording now')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByRole('button', { name: 'Keep Take' })).toBeEnabled({
    timeout: 15000,
  })
  await page.getByRole('button', { name: 'Keep Take' }).click()

  await page.getByRole('button', { name: 'Thread actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete this thread' }).click()
  await expect(page.getByRole('alertdialog')).toContainText(
    'Delete Temporary thread and its 1 take from this device?',
  )
  await page.getByTestId('confirm-phrase').fill('delete')
  await page.getByRole('button', { name: 'Delete thread' }).click()
  await expect(page.getByText('3 kept')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Room and waveform check').first()).toBeVisible()

  await page
    .getByRole('button', { name: 'Clear entire voice history', exact: true })
    .click()
  await page.getByTestId('confirm-phrase').fill('delete')
  await page.getByRole('button', { name: 'Clear history', exact: true }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Your first thread starts with one kept take.',
    }),
  ).toBeVisible({ timeout: 10000 })
  await expect(
    page.getByRole('button', { name: 'New practice thread' }),
  ).toBeFocused()
})
