// Studio keys — Space and Home drive Studio's own song, and the singing transport's keys stay out of it.
//
// The app's shortcuts (src/features/keyboard/useKeyboardShortcuts.ts) answer
// Home, R, P and the Up and Down arrows for the singing transport. Studio
// plays its own audio graph, so on Studio they would only change modes,
// speed and position behind the page: R and P raised "Mode: Repeat" and
// "Mode: Practice" over a Studio song, and the arrows moved the singing
// speed. Space is Studio's own toggle (installSpacePlaybackToggle).
import { expect, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

const SPEED_KEY = 'pitchperfect_playback_speed'

test.describe('Studio keys', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Space plays and pauses the song, Home goes to its start, and R, P and the arrows change nothing else @smoke', async ({
    page,
  }) => {
    await openArrangement(page)
    const studio = studioRegion(page)
    const clock = studio.getByLabel('Playhead in seconds', { exact: true })
    const speedBefore = await page.evaluate(
      (key) => localStorage.getItem(key),
      SPEED_KEY,
    )

    await clock.fill('0:02')
    await clock.press('Enter')
    await expect(clock).toHaveValue('0:02.000')
    await studio.locator('[data-tour="studio.workspace"]').focus()
    for (const key of ['KeyR', 'KeyP', 'ArrowUp', 'ArrowDown'])
      await page.keyboard.press(key)
    await page.keyboard.press('Home')

    await expect(clock).toHaveValue('0:00.000')
    await expect(page.getByText('Mode: Repeat', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Mode: Practice', { exact: true })).toHaveCount(
      0,
    )
    expect(
      await page.evaluate((key) => localStorage.getItem(key), SPEED_KEY),
    ).toBe(speedBefore)

    await page.keyboard.press('Space')
    await expect(
      studio.getByRole('button', { name: 'Pause song', exact: true }),
    ).toBeVisible()
    await page.keyboard.press('Space')
    await expect(
      studio.getByRole('button', { name: 'Play song', exact: true }),
    ).toBeVisible()
  })
})
