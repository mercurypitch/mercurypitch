// ============================================================
// Zen stage spacebar transport
// ============================================================
//
// Space toggles the zen session (start / pause / resume) no matter what
// was last clicked — the stage owns the key while it is open (the global
// shortcut hook is suspended). Needs the synthetic microphone: starting
// a session acquires the mic, and Chromium's silent fake device is
// rejected by voice-session on purpose. launchOptions apply per file,
// hence the dedicated spec (same pattern as onboarding-mic.spec.ts).

import { expect, test } from '@playwright/test'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

async function openZenMonitor(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.addInitScript(() => {
    ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await page.waitForSelector('#app')
  await dismissOverlays(page)
  await page.evaluate(() => {
    const bridge = (
      window as Window & {
        __pp?: {
          appStore?: { openSingingZen?: (launch: unknown) => void }
        }
      }
    ).__pp
    bridge?.appStore?.openSingingZen?.({ mode: 'monitor', source: 'singing' })
  })
  await expect(page.getByTestId('zen-pitch-stage')).toBeVisible()
}

test.describe('Zen spacebar play/pause', () => {
  test('space starts, pauses and resumes the session @smoke', async ({
    page,
  }) => {
    await openZenMonitor(page)
    const transport = page.getByTestId('zen-transport')
    await expect(transport).toContainText('Start')

    // Click somewhere neutral first — the binding must not depend on any
    // particular element having focus.
    await page.getByTestId('zen-pitch-canvas').click({ force: true })

    await page.keyboard.press('Space')
    await expect(transport).toContainText('Pause', { timeout: 10000 })

    await page.keyboard.press('Space')
    await expect(transport).toContainText('Resume')

    await page.keyboard.press('Space')
    await expect(transport).toContainText('Pause')
  })

  test('space keeps working after clicking the transport button itself', async ({
    page,
  }) => {
    await openZenMonitor(page)
    const transport = page.getByTestId('zen-transport')

    // Start via the button — focus now rests on it.
    await transport.click()
    await expect(transport).toContainText('Pause', { timeout: 10000 })

    // Space must toggle exactly once (no native double-activation).
    await page.keyboard.press('Space')
    await expect(transport).toContainText('Resume')
  })
})

test.describe('Exercise spacebar transport', () => {
  test('spacebar toggles the exercise even with a button focused @smoke', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.addInitScript(() => {
      ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
    await page.goto('/')
    await page.waitForSelector('#tab-exercises', { timeout: 10000 })
    await dismissOverlays(page)

    await page.locator('#tab-exercises').click()
    await page
      .locator('.exercise-card', { hasText: 'Long Note' })
      .first()
      .click()

    // Reach the active state (needs the synthetic mic — a silent device is
    // rejected and Start silently stays idle, which is why this lives in
    // the fake-mic spec).
    const startBtn = page.locator('.exercise-btn-primary:has-text("Start")')
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click()
    }
    const stopBtn = page.locator('.exercise-btn-stop')
    await expect(stopBtn).toBeVisible({ timeout: 10000 })

    // Focus a button and press Space — the old guard skipped button
    // targets while the global hook swallowed the key's native
    // activation, leaving Space completely dead exactly like this.
    await stopBtn.focus()
    await page.keyboard.press('Space')
    await expect(stopBtn).toBeHidden({ timeout: 5000 })

    // From the result screen Space runs Try Again — active once more.
    await page.keyboard.press('Space')
    await expect(stopBtn).toBeVisible({ timeout: 5000 })
    expect(errors).toHaveLength(0)
  })
})
