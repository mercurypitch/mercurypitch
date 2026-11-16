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
    '6 rounds · Minor 3rd and Major 3rd · Piano tuning · Drone: E3',
  )
})

test("leaving thirds-on-a-drone's drill leaves the menu's Drone Intonation on its own pool", async ({
  page,
}) => {
  await openSlug(page, 'thirds-on-a-drone', '10')
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 rounds · Minor 3rd and Major 3rd · Piano tuning · Drone: E3',
  )

  // Back clears the launch (resetExerciseLaunchState in App.tsx); without
  // that, the slug's thirds would follow the singer into the next open.
  await page.locator('.back-btn').click()
  await page
    .locator('.exercise-card', { hasText: 'Drone Intonation' })
    .first()
    .click()

  await expect(page.locator('h2.exercise-title')).toHaveText('Drone Intonation')
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 rounds · Piano tuning · Drone: E3',
  )
})

test("/exercises/perfect-intervals opens Interval Trainer on Lesson 23's three perfect intervals", async ({
  page,
}) => {
  await openSlug(page, 'perfect-intervals', '23')

  await expect(page.locator('h2.exercise-title')).toHaveText('Interval Trainer')
  // All three are named: "Perfect 4th through Octave" would promise the
  // tritone the lesson sets apart from them.
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 rounds · Perfect 4th, Perfect 5th and Octave',
  )
})

test("/exercises/harmony-on-a-drone opens Drone Intonation on Lesson 24's fifth, major third and octave", async ({
  page,
}) => {
  await openSlug(page, 'harmony-on-a-drone', '24')

  await expect(page.locator('h2.exercise-title')).toHaveText('Drone Intonation')
  // Scored as pure intervals, the ones the lesson listens for.
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 rounds · Major 3rd, Perfect 5th and Octave · Pure tuning · Drone: E3',
  )
  const tuning = page.getByRole('group', { name: 'Tuning' })
  await expect(tuning.getByRole('button', { name: 'Pure' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test("leaving harmony-on-a-drone's drill leaves the menu's Drone Intonation on the singer's own tuning", async ({
  page,
}) => {
  await openSlug(page, 'harmony-on-a-drone', '24')
  await expect(page.locator('.idle-hint')).toContainText('Pure tuning')

  // Back clears the launch, and the launch never wrote over the singer's
  // saved tuning: the piano's.
  await page.locator('.back-btn').click()
  await page
    .locator('.exercise-card', { hasText: 'Drone Intonation' })
    .first()
    .click()

  await expect(page.locator('h2.exercise-title')).toHaveText('Drone Intonation')
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 rounds · Piano tuning · Drone: E3',
  )
})

test("/exercises/harmonic-minor-run opens Scale Runner on Lesson 25's harmonic minor, from A", async ({
  page,
}) => {
  await openSlug(page, 'harmonic-minor-run', '25')

  await expect(page.locator('h2.exercise-title')).toHaveText('Scale Runner')
  await expect(page.locator('.idle-hint')).toHaveText(
    '8 notes · Harmonic Minor · up',
  )
  // The lesson's key, in the octave whose run fits the default tenor preset.
  await expect(page.getByLabel(/^Starting Note: A3\./)).toBeVisible()
})

test("/exercises/minor-pentatonic-run opens Scale Runner on Lesson 20's minor pentatonic", async ({
  page,
}) => {
  await openSlug(page, 'minor-pentatonic-run', '20')

  await expect(page.locator('h2.exercise-title')).toHaveText('Scale Runner')
  // Five notes and the octave.
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 notes · Minor Pentatonic · up',
  )
})

test("leaving harmonic-minor-run's drill leaves the menu's Scale Runner on its own scale", async ({
  page,
}) => {
  await openSlug(page, 'harmonic-minor-run', '25')
  await expect(page.locator('.idle-hint')).toHaveText(
    '8 notes · Harmonic Minor · up',
  )

  // Back clears the launch (resetExerciseLaunchState in App.tsx); without
  // that, the slug's scale would follow the singer into the next open.
  await page.locator('.back-btn').click()
  await page
    .locator('.exercise-card', { hasText: 'Scale Runner' })
    .first()
    .click()

  await expect(page.locator('h2.exercise-title')).toHaveText('Scale Runner')
  await expect(page.locator('.idle-hint')).toHaveText('8 notes · Major · up')
})

test("/exercises/read-the-note opens Read the Note, Lesson 15's drill", async ({
  page,
}) => {
  await openSlug(page, 'read-the-note', '15')

  await expect(page.locator('h2.exercise-title')).toHaveText('Read the Note')
  // A fresh profile's level keeps to the staff, on the default tenor
  // preset's treble clef.
  await expect(page.locator('.idle-hint')).toHaveText(
    '10 notes · Treble staff · lines and spaces',
  )
})

test("/exercises/name-the-cadence opens Name the Cadence on Lesson 28's four cadences", async ({
  page,
}) => {
  await openSlug(page, 'name-the-cadence', '28')

  await expect(page.locator('h2.exercise-title')).toHaveText('Name the Cadence')
  // The slug's level, not a fresh profile's, which would ask for three.
  await expect(page.locator('.idle-hint')).toHaveText(
    '8 cadences · Perfect, Imperfect, Plagal and Interrupted',
  )
})

test("/exercises/sing-it-in-time opens Sing It in Time on Lesson 18's two bars", async ({
  page,
}) => {
  await openSlug(page, 'sing-it-in-time', '18')

  await expect(page.locator('h2.exercise-title')).toHaveText('Sing It in Time')
  // The slug's level, Lesson 18's checkpoint, whatever level the singer has
  // reached: a raised one would ask for eighths at 72 or more.
  await expect(page.locator('.idle-hint')).toHaveText(
    '3 tunes · 60 BPM · quarters and halves, steps and thirds',
  )
})

test('/exercises/triads opens Chord Stacker on the four triads in root position', async ({
  page,
}) => {
  await openSlug(page, 'triads', '27')

  await expect(page.locator('h2.exercise-title')).toHaveText('Chord Stacker')
  await expect(page.locator('.idle-hint')).toHaveText(
    '5 chords · Triads · Root position',
  )
  // The pickers say the same: the launch chose for this visit.
  const chords = page.getByRole('group', { name: 'Chords' })
  await expect(chords.getByRole('button', { name: 'Triads' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const inversions = page.getByRole('group', { name: 'Inversions' })
  await expect(inversions.getByRole('button', { name: 'Off' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test("leaving triads' drill leaves the menu's Chord Stacker on the singer's own chords", async ({
  page,
}) => {
  await openSlug(page, 'triads', '27')
  await expect(page.locator('.idle-hint')).toHaveText(
    '5 chords · Triads · Root position',
  )

  // Back clears the launch (resetExerciseLaunchState in App.tsx), and the
  // launch never wrote over the singer's saved choice: the sevenths.
  await page.locator('.back-btn').click()
  await page
    .locator('.exercise-card', { hasText: 'Chord Stacker' })
    .first()
    .click()

  await expect(page.locator('h2.exercise-title')).toHaveText('Chord Stacker')
  await expect(page.locator('.idle-hint')).toHaveText(
    '5 chords · Seventh chords · Root position',
  )
})
