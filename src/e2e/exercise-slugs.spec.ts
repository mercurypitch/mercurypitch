// ============================================================
// Exercise slugs: a deep link opens its drill, set up as the slug says
// ============================================================
//
// /exercises/<slug> names a launch in src/features/exercises/slug-map.ts,
// which applyExerciseSlug (src/App.tsx) hands to the exercise as its
// one-shot launch override. Unit tests reach the registry and the exercise;
// only a browser reaches the hand-off between them, so this spec checks
// what the drill's setup screen promises after the whole trip, and that
// the launch ends when the singer leaves the drill.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/** Open a slug's address as production's Worker serves it, from a lesson. */
async function openSlug(
  page: Page,
  slug: string,
  lesson: string,
): Promise<void> {
  // Production's Worker answers /exercises/<slug> with the app's shell
  // (src/worker.ts). The e2e server has no such rule, so do what it does.
  await page.route(new RegExp(`/exercises/${slug}\\?`), async (route) => {
    const shell = await route.fetch({
      url: new URL('/', route.request().url()).href,
    })
    await route.fulfill({ response: shell })
  })
  await page.goto(`/exercises/${slug}?lesson=${lesson}`)
}

test("/exercises/leap-ladder opens Interval Trainer on Lesson 9's five leaps", async ({
  page,
}) => {
  await openSlug(page, 'leap-ladder', '09')

  await expect(page.locator('h2.exercise-title')).toHaveText('Interval Trainer')
  // A fresh profile's level asks for six rounds, and the hint names the
  // slug's intervals, not the pool's "Major 2nd through Octave".
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 rounds · Minor 3rd through Octave',
  )
})

test("leaving leap-ladder's drill leaves the menu's Interval Trainer on its own pool", async ({
  page,
}) => {
  await openSlug(page, 'leap-ladder', '09')
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 rounds · Minor 3rd through Octave',
  )

  // Back clears the launch (resetExerciseLaunchState in App.tsx); without
  // that, the slug's list would follow the singer into the next open.
  await page.locator('.back-btn').click()
  await page
    .locator('.exercise-card', { hasText: 'Interval Trainer' })
    .first()
    .click()

  await expect(page.locator('h2.exercise-title')).toHaveText('Interval Trainer')
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 rounds · Major 2nd through Octave',
  )
})

test("/exercises/thirds-on-a-drone opens Drone Intonation on Lesson 10's two thirds", async ({
  page,
}) => {
  await openSlug(page, 'thirds-on-a-drone', '10')

  await expect(page.locator('h2.exercise-title')).toHaveText('Drone Intonation')
  // A fresh profile's level asks for six rounds, the hint names the slug's
  // two thirds, and the drone starts on the default tenor preset's anchor.
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 rounds · Minor 3rd and Major 3rd · Drone: E3',
  )
})

test("leaving thirds-on-a-drone's drill leaves the menu's Drone Intonation on its own pool", async ({
  page,
}) => {
  await openSlug(page, 'thirds-on-a-drone', '10')
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 rounds · Minor 3rd and Major 3rd · Drone: E3',
  )

  // Back clears the launch (resetExerciseLaunchState in App.tsx); without
  // that, the slug's thirds would follow the singer into the next open.
  await page.locator('.back-btn').click()
  await page
    .locator('.exercise-card', { hasText: 'Drone Intonation' })
    .first()
    .click()

  await expect(page.locator('h2.exercise-title')).toHaveText('Drone Intonation')
  await expect(page.locator('.idle-hint')).toHaveText('6 rounds · Drone: E3')
})
