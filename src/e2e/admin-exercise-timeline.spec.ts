// ============================================================
// Admin exercise timeline — real-pointer authoring and safe section changes
// ============================================================

import { expect, test } from '@playwright/test'

test('real mouse adds a note and dirty navigation uses the app modal @smoke', async ({
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

  const canvas = page
    .getByTestId('exercise-authoring-timeline')
    .locator('canvas')
  await canvas.scrollIntoViewIfNeeded()
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  if (bounds === null) return

  await page.mouse.click(
    bounds.x + bounds.width * 0.65,
    bounds.y + bounds.height * 0.3,
  )

  await expect(page.getByRole('article', { name: 'note note-2' })).toBeVisible()

  const studioNavigation = page.getByRole('navigation', {
    name: 'Content Studio sections',
  })
  const ascentSection = studioNavigation.getByRole('button', {
    name: /Ascent/,
  })
  await ascentSection.click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Leave unsaved changes?' }),
  ).toBeVisible()
  await expect(page).toHaveURL(/#\/admin\/exercises$/)

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('alertdialog')).toBeHidden()

  await ascentSection.click()
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(page.getByRole('heading', { name: 'The Ascent' })).toBeVisible()
  await expect(page).toHaveURL(/#\/admin\/ascent$/)
})
