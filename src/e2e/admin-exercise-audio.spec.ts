// ============================================================
// Admin exercise audio — real-pointer two-boundary clip review
// ============================================================

import { expect, test } from '@playwright/test'
import { TONE_HZ, writeToneWav } from './helpers/tone-wav'

const REVIEW_AUDIO = writeToneWav(TONE_HZ, 20)

test('real mouse selects both clip boundaries before finalizing @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_admin_key', 'e2e-admin-key')
    localStorage.setItem('pitchperfect_welcome_version', '1')
  })
  await page.goto('/#/admin/exercises')

  await expect(
    page.getByRole('heading', { name: 'Vocal Exercises' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'New exercise' }).click()
  await page.getByRole('button', { name: 'Set up example audio' }).click()
  await page.getByLabel('Transcript').fill('Nay')
  await page.getByLabel(/Choose audio file/).setInputFiles(REVIEW_AUDIO)

  const review = page.getByRole('region', { name: 'Review example audio' })
  await expect(review).toBeVisible()
  await expect(
    review.getByRole('button', { name: 'Use 15-second clip' }),
  ).toBeVisible()

  const dragHandle = async (
    label: 'Clip start' | 'Clip end',
    fromMs: number,
    toMs: number,
  ): Promise<void> => {
    const handle = review.getByLabel(label)
    await handle.scrollIntoViewIfNeeded()
    const bounds = await handle.boundingBox()
    expect(bounds).not.toBeNull()
    if (bounds === null) return
    const thumbWidth = 18
    const usableWidth = bounds.width - thumbWidth
    const xFor = (milliseconds: number): number =>
      bounds.x + thumbWidth / 2 + (milliseconds / 20_000) * usableWidth
    const y = bounds.y + bounds.height / 2

    await page.mouse.move(xFor(fromMs), y)
    await page.mouse.down()
    await page.mouse.move(xFor(toMs), y, { steps: 8 })
    await page.mouse.up()
  }

  await dragHandle('Clip end', 15_000, 12_000)
  await expect(review.getByLabel('Clip end')).toHaveValue('12000')
  await expect(
    review.getByRole('button', { name: 'Use 12-second clip' }),
  ).toBeVisible()

  await dragHandle('Clip start', 0, 3_000)
  await expect(review.getByLabel('Clip start')).toHaveValue('3000')
  await expect(
    review.getByRole('button', { name: 'Use 9-second clip' }),
  ).toBeVisible()
  await expect(
    review.getByRole('button', { name: 'Preview selected clip' }),
  ).toBeEnabled()
  await expect(review.getByRole('button', { name: 'Discard' })).toBeEnabled()
})
