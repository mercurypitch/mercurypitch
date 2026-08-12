// ============================================================
// Guided Voice Check — guarded Pitch Centre capture and temporary review
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'
import { fakeMicArgs, TONE_HZ, writeToneWav } from './helpers/tone-wav'

// The guided route includes a rehearsal before its three measured landings.
// Keep the source longer than the complete capture instead of relying on the
// browser-specific fake-device loop behaviour.
const TONE_WAV = writeToneWav(TONE_HZ, 20)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

test('guides a safe check and keeps pointer seeking silent @smoke', async ({
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

  await expect(
    page.getByRole('heading', {
      name: 'Start with one moment you can hear.',
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Find my next focus' }).click()

  const guidedCheck = page.getByTestId('guided-voice-check')
  await expect(guidedCheck).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Find one focus you can hear.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Check comfort and begin' }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Does singing feel comfortable today?',
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Yes, continue' }).click()

  await expect(
    page.getByRole('heading', {
      name: 'Three notes, centred where you are comfortable.',
    }),
  ).toBeVisible()
  const startCheck = page.getByRole('button', {
    name: 'Start three landings',
  })
  await expect(startCheck).toBeDisabled()
  await page.getByRole('button', { name: 'Try one landing' }).click()
  await expect(page.getByText('Rehearsal complete.')).toBeVisible({
    timeout: 12000,
  })
  await expect(startCheck).toBeEnabled()

  await startCheck.click()
  await expect(page.getByText('Recording now')).toBeVisible({
    timeout: 12000,
  })
  await expect(
    page.getByRole('heading', { name: 'How did that feel?' }),
  ).toBeVisible({ timeout: 25000 })
  await page.getByRole('button', { name: 'Workable' }).click()

  const scrubber = page.getByTestId('guided-preview-scrubber')
  await expect(scrubber).toBeVisible()
  const playTemporary = page.getByRole('button', {
    name: 'Play temporary take',
  })
  await expect(playTemporary).toBeVisible()

  await scrubber.scrollIntoViewIfNeeded()
  const scrubBounds = await scrubber.boundingBox()
  if (scrubBounds === null) {
    throw new Error('Guided preview has no scrub bounds')
  }
  await page.mouse.click(
    scrubBounds.x + scrubBounds.width * 0.62,
    scrubBounds.y + scrubBounds.height / 2,
  )
  await expect
    .poll(async () => Number(await scrubber.getAttribute('aria-valuenow')))
    .toBeGreaterThan(58)
  await expect(playTemporary).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Pause temporary take' }),
  ).toHaveCount(0)

  const evidenceMarkers = page.getByRole('button', {
    name: /(?:What held|Current focus) at .* Seek without playing\./,
  })
  await expect(evidenceMarkers).toHaveCount(2)
  const evidenceBounds = await evidenceMarkers.first().boundingBox()
  expect(evidenceBounds?.width).toBeGreaterThanOrEqual(44)
  expect(evidenceBounds?.height).toBeGreaterThanOrEqual(44)
  await evidenceMarkers.first().click()
  await expect(playTemporary).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Pause temporary take' }),
  ).toHaveCount(0)

  await scrubber.focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('button', { name: 'Pause temporary take' }),
  ).toBeVisible()
  await page.keyboard.press('Space')
  await expect(playTemporary).toBeVisible()

  await page.getByRole('button', { name: 'Keep Focus Take' }).click()
  await expect(
    page.getByRole('button', { name: 'Focus Take kept' }),
  ).toBeVisible()
  await expect(guidedCheck).toBeVisible()
  await page.getByRole('button', { name: 'Return to history' }).click()
  await expect(page.getByTestId('saved-guided-focus')).toBeVisible()
  await expect(page.getByText('Saved Focus reading')).toBeVisible()
  const checkAgain = page.getByRole('button', { name: 'Check again' })
  await expect(checkAgain).toBeFocused()
  const savedEvidence = page.getByRole('button', {
    name: /Saved (?:What held|Current focus) at .* Seek without playing\./,
  })
  await expect(savedEvidence).toHaveCount(2)
  await savedEvidence.first().click()
  await expect(page.getByRole('button', { name: /^Pause / })).toHaveCount(0)

  await page.getByRole('button', { name: 'Practise Pitch Hold' }).click()
  await expect(page.getByRole('heading', { name: 'Pitch Hold' })).toBeVisible()
  await expect(page.getByText('1 set · 3 holds · 5s each')).toBeVisible()
  await expect(page.getByText('0 of 3 holds complete')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Begin first hold' }),
  ).toBeVisible()
  await page.getByRole('button', { name: /Back/u }).click()
  await expect(page.getByTestId('saved-guided-focus')).toBeVisible()
  await expect(checkAgain).toBeVisible()

  await page.getByRole('button', { name: 'Practise Pitch Hold' }).click()
  await expect(page.getByRole('heading', { name: 'Pitch Hold' })).toBeVisible()
  await page.locator('#tab-home').click()
  await expect(page.locator('#tab-home')).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.locator('#tab-voice-history').click()
  await expect(page.getByTestId('saved-guided-focus')).toBeVisible()
  await expect(checkAgain).toBeVisible()
})
