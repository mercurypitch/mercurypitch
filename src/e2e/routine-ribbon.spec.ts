// ============================================================
// Routine ribbon E2E — the drill knows it is part of the session
// ============================================================
//
// The unit tests cover the ribbon's logic against a rendered component. This
// covers the wiring they cannot see: that a routine seeded in storage
// survives into the real app, that ExerciseShell actually renders the ribbon
// for every drill, and that a drill outside the routine still gets a clean
// screen.
//
// The routine is seeded through `addInitScript` deliberately — it lives in a
// persisted signal that reads localStorage once at module load, so seeding
// after navigation seeds nothing.

import { expect, test } from '@playwright/test'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

// Written at module load: Chromium needs the file before it launches.
// Without a synthetic mic the drill never leaves idle ("Microphone access
// denied"), so the run that advances the routine never happens.
const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

/** Warm-up done, Long Note current, Scale Runner still to come. */
const ROUTINE = {
  templateId: 'e2e-routine',
  completedSegments: [0],
  template: {
    id: 'e2e-routine',
    name: "Today's Session",
    description: 'seeded by the ribbon spec',
    segments: [
      { type: 'warmup', durationSec: 60, config: { pattern: 'sirens' } },
      { type: 'exercise', durationSec: 150, config: { exercise: 'long-note' } },
      {
        type: 'exercise',
        durationSec: 150,
        config: { exercise: 'scale-runner' },
      },
    ],
  },
}

async function openExercise(page: any, label: string): Promise<void> {
  await page.locator('#tab-exercises').click()
  await page.waitForTimeout(300)
  await page.locator('.exercise-card', { hasText: label }).first().click()
  await page.waitForTimeout(400)
}

test.describe('Routine ribbon', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((routine) => {
      ;(window as any).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
      localStorage.setItem(
        'mp_daily_routine',
        JSON.stringify({
          ...routine,
          // Same shape as todayStr(): a routine dated anything else is not
          // today's and the app ignores it.
          date: new Date().toISOString().slice(0, 10),
        }),
      )
    }, ROUTINE)
    await page.goto('/')
    await page.waitForSelector('#tab-exercises', { timeout: 10000 })
    await dismissOverlays(page)
  })

  test('shows the position and the whole session inside the drill', async ({
    page,
  }) => {
    await openExercise(page, 'Long Note')

    const ribbon = page.getByTestId('routine-ribbon')
    await expect(ribbon).toBeVisible()
    await expect(ribbon).toContainText('2 of 3')
    // The warm-up is named by its pattern, not by the exercise that runs it.
    await expect(ribbon).toContainText('Sirens')
    await expect(ribbon).toContainText('Long Note')
    await expect(ribbon).toContainText('Scale Runner')
    await expect(
      ribbon.getByRole('button', { name: /back to routine/i }),
    ).toBeVisible()
  })

  test('offers the next segment once this one is scored', async ({ page }) => {
    await openExercise(page, 'Long Note')
    const ribbon = page.getByTestId('routine-ribbon')
    await expect(ribbon).not.toContainText('Next:')

    // Asserted rather than probed: a silently-skipped run would leave this
    // test passing for the wrong reason, which is how it first went green.
    await page.locator('.exercise-btn-primary:has-text("Start")').click()
    const stop = page.locator('.exercise-btn-stop')
    await expect(stop).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(700)
    await stop.click()

    // Finishing the run advances the routine, and the ribbon follows rather
    // than disappearing at the moment it becomes most useful.
    await expect(ribbon).toContainText('Next:')
    await expect(ribbon).toContainText('Scale Runner')
    await expect(ribbon).toContainText('3 of 3')
  })

  test('stays away from a drill that is not part of the session', async ({
    page,
  }) => {
    // Vibrato is in no segment, so finishing it ticks nothing off and the
    // ribbon must not claim a step.
    await openExercise(page, 'Vibrato')
    await expect(page.locator('.exercise-runner')).toBeVisible()
    await expect(page.getByTestId('routine-ribbon')).toHaveCount(0)
  })
})
