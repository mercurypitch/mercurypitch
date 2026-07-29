// ============================================================
// First Light onboarding — the microphone beats
// ============================================================
//
// Beats 2, 4, 5 and 7, driven by a synthetic microphone. Chromium's
// plain fake device produces silence, which `voice-session` rejects on
// purpose, so these beats are unreachable without a generated tone fed
// in via --use-file-for-fake-audio-capture (see helpers/tone-wav.ts).
//
// Separate from onboarding.spec.ts because launchOptions cannot be
// scoped to a describe block — the flags apply to the whole file, and
// the silent-input case needs a browser WITHOUT them.
//
// NOT covered: beat 7's registration form. The e2e build sets
// VITE_API_BASE_URL empty (so the suite exercises the local IndexedDB
// path), which makes the Keep beat render its no-cloud fallback rather
// than the email/password offer. Verifying the account path needs a run
// against a real db-worker, and stays manual for now.

import { expect, test } from '@playwright/test'
import { fakeMicArgs, FRESH_VISITOR_INIT, TONE_NOTE, writeToneWav, } from './helpers/tone-wav'

const DESKTOP = { width: 1440, height: 900 }

// Written at module load: Chromium needs the file before it launches.
const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

const door = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Show me around' })

const beat = (page: import('@playwright/test').Page, name: string) =>
  page.locator(`[data-beat="${name}"]`)

test.describe('First Light with a microphone', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FRESH_VISITOR_INIT)
  })

  test('beat 2 hears the note and says it back', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    await door(page).click()
    await page.getByRole('button', { name: 'Sing one note' }).click()
    await page.getByRole('button', { name: 'Allow microphone' }).click()

    // The claim the whole beat rests on: we heard you, and here is what.
    const heard = beat(page, 'first-light').locator('h1')
    await expect(heard).toContainText(TONE_NOTE, { timeout: 20000 })

    // And the frequency is reported alongside, not just a bare name.
    await expect(beat(page, 'first-light')).toContainText(/Hz/)
  })

  test('the fork names the note back and the short track reaches the Map', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    await door(page).click()
    await page.getByRole('button', { name: 'Sing one note' }).click()
    await page.getByRole('button', { name: 'Allow microphone' }).click()
    await expect(beat(page, 'first-light').locator('h1')).toContainText(
      TONE_NOTE,
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: 'Keep going' }).click()

    // Beat 3 carries what beat 2 heard, rather than repeating a headline.
    const fork = beat(page, 'fork')
    await expect(fork).toBeVisible()
    await expect(fork).toContainText(TONE_NOTE)

    await page.getByRole('button', { name: /Take me in/ }).click()
    await expect(beat(page, 'map')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Your first stop')).toBeVisible()

    await page.getByRole('button', { name: /Start singing|Done/ }).click()
    await expect(page.locator('#app-tabs')).toBeVisible()
  })

  test('the full track runs the voiceprint through to the twin and the Map', async ({
    page,
  }) => {
    // The voiceprint is deliberately ~90 seconds of singing; this test
    // walks all of it, so it needs far more than the default budget.
    test.setTimeout(300000)

    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    await door(page).click()
    await page.getByRole('button', { name: 'Sing one note' }).click()
    await page.getByRole('button', { name: 'Allow microphone' }).click()
    await expect(beat(page, 'first-light').locator('h1')).toContainText(
      TONE_NOTE,
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: 'Keep going' }).click()
    await page.getByRole('button', { name: /Map my whole voice/ }).click()

    const voiceprint = beat(page, 'voiceprint')
    await expect(voiceprint).toBeVisible()

    // Each task waits behind an "I'm ready" gate. Clear them as they
    // appear rather than assuming a fixed count — the number of gates is
    // a content decision that should be free to change.
    const ready = page.getByRole('button', { name: "I'm ready" })
    const deadline = Date.now() + 240000
    while (Date.now() < deadline) {
      if (
        await beat(page, 'twin')
          .isVisible()
          .catch(() => false)
      )
        break
      if (await ready.isVisible().catch(() => false)) {
        await ready.click().catch(() => undefined)
      }
      await page.waitForTimeout(500)
    }

    // The payoff: a twin, and the numbers a voiceprint record stores.
    const twin = beat(page, 'twin')
    await expect(twin).toBeVisible({ timeout: 30000 })
    await expect(twin).toContainText(/steadiness/i)

    await page.getByRole('button', { name: /See my map/ }).click()

    // Beat 7 offers the account when there is something to keep; it is
    // dismissible, and "Not now" must still reach the Map.
    const keep = beat(page, 'keep')
    if (await keep.isVisible().catch(() => false)) {
      await expect(keep).toContainText(/keep/i)
      await page.getByRole('button', { name: /Not now/ }).click()
    }

    await expect(beat(page, 'map')).toBeVisible({ timeout: 15000 })
  })
})
