// ============================================================
// Exercise Stop & Score E2E Tests
// Verifies no "too much recursion" errors on exercise completion
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

const EXERCISES = [
  { name: 'long-note', label: 'Long Note' },
  { name: 'vibrato', label: 'Vibrato' },
  { name: 'slide', label: 'Slide' },
  { name: 'pitch-hold', label: 'Pitch Hold' },
  { name: 'mirror-melody', label: 'Mirror the Melody' },
  { name: 'pitch-pursuit', label: 'Pitch Pursuit' },
]

async function goToExercisesTab(page: any) {
  const tabBtn = page.locator('#tab-exercises')
  await tabBtn.click()
  await page.waitForTimeout(300)
}

async function selectExercise(page: any, label: string) {
  // ExerciseMenu shows exercise cards; click the one with matching text
  const card = page.locator('.exercise-card', { hasText: label }).first()
  await card.click()
  await page.waitForTimeout(400)
}

test.describe('Exercise Stop & Score Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
    await page.goto('/')
    await page.waitForSelector('#tab-exercises', { timeout: 10000 })
    await dismissOverlays(page)
  })

  for (const exercise of EXERCISES) {
    test(`${exercise.name}: start → stop completes without errors`, async ({
      page,
    }) => {
      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(err.message))

      await goToExercisesTab(page)
      await selectExercise(page, exercise.label)

      // Click Start (may auto-start, so check visibility)
      const startBtn = page.locator('.exercise-btn-primary:has-text("Start")')
      if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await startBtn.click()
        await page.waitForTimeout(500)
      }

      // Click Stop & Score
      const stopBtn = page.locator('.exercise-btn-secondary:has-text("Stop & Score")')
      if (await stopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await stopBtn.click()
        await page.waitForTimeout(800)
      }

      // Verify no infinite loop or recursion errors
      const fatalErrors = errors.filter(
        (e) =>
          e.includes('Infinite Loop') ||
          e.includes('too much recursion') ||
          e.includes('Maximum call stack'),
      )
      expect(fatalErrors).toHaveLength(0)
    })
  }

  test('vibrato: complete → Try Again → complete cycle stays stable', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await goToExercisesTab(page)
    await selectExercise(page, 'Vibrato')

    // Start
    const startBtn = page.locator('.exercise-btn-primary:has-text("Start")')
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click()
      await page.waitForTimeout(500)
    }

    // Stop & Score (first time)
    const stopBtn = page.locator('.exercise-btn-secondary:has-text("Stop & Score")')
    if (await stopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stopBtn.click()
      await page.waitForTimeout(500)
    }

    // Try Again
    const tryAgainBtn = page.locator('.exercise-btn-primary:has-text("Try Again")')
    if (await tryAgainBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tryAgainBtn.click()
      await page.waitForTimeout(500)
    }

    // Stop & Score (second time)
    const stopBtn2 = page.locator('.exercise-btn-secondary:has-text("Stop & Score")')
    if (await stopBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stopBtn2.click()
      await page.waitForTimeout(500)
    }

    const fatalErrors = errors.filter(
      (e) =>
        e.includes('Infinite Loop') ||
        e.includes('too much recursion') ||
        e.includes('Maximum call stack'),
    )
    expect(fatalErrors).toHaveLength(0)
  })

  test('exercise: complete → Back → re-enter → complete stable', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    // First round
    await goToExercisesTab(page)
    await selectExercise(page, 'Slide')

    const startBtn = page.locator('.exercise-btn-primary:has-text("Start")')
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click()
      await page.waitForTimeout(500)
    }

    const stopBtn = page.locator('.exercise-btn-secondary:has-text("Stop & Score")')
    if (await stopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stopBtn.click()
      await page.waitForTimeout(500)
    }

    // Back to menu
    const backBtn = page.locator('.back-btn')
    if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backBtn.click()
      await page.waitForTimeout(400)
    }

    // Re-enter same exercise
    await selectExercise(page, 'Slide')

    // Start again
    const startBtn2 = page.locator('.exercise-btn-primary:has-text("Start")')
    if (await startBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn2.click()
      await page.waitForTimeout(500)
    }

    // Stop again
    const stopBtn2 = page.locator('.exercise-btn-secondary:has-text("Stop & Score")')
    if (await stopBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stopBtn2.click()
      await page.waitForTimeout(500)
    }

    const fatalErrors = errors.filter(
      (e) =>
        e.includes('Infinite Loop') ||
        e.includes('too much recursion') ||
        e.includes('Maximum call stack'),
    )
    expect(fatalErrors).toHaveLength(0)
  })
})
