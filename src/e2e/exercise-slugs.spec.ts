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
//
// An `ear-drill` slug opens an Ear Lab drill on a lesson's set of its
// items instead (src/lib/ear/subsets.ts, through EarLabPage.tsx), in
// Merc's room, the web's face of the Ear Lab since Nov 2026: the room
// at idle names the set on its Begin pad, and a run's pads are the set's
// alone. From the bench, a station's sheet starts a drill whole, its run
// under way at once.

import type { Locator, Page } from '@playwright/test'
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

/** Merc's room, on the drill a slug opened. */
const earStage = (page: Page): Locator => page.getByTestId('ear-stage')

/** Start Leap from Shape's sheet on Merc's bench: whole, its run started. */
async function leapFromTheBench(page: Page): Promise<void> {
  await page
    .locator('[data-testid="merc-station"][data-faculty="shape"]')
    .click()
  await page
    .getByTestId('merc-station-row')
    .filter({ hasText: 'Leap' })
    .first()
    .click()
}

/** A run's answer pads, armed. */
const armedPads = (page: Page): Locator =>
  earStage(page).getByTestId('ear-stage-pads').getByRole('button')

/** The Begin pad, where the stage names a set at idle on every width. */
const begin = (page: Page): Locator =>
  earStage(page).getByRole('button', { name: /^Begin/ })

/** A run's answer pads, once Begin has started one. */
async function runPads(page: Page): Promise<Locator> {
  await begin(page).click()
  return earStage(page).getByTestId('ear-stage-pads').getByRole('button')
}

test("/exercises/quarters-halves-and-eighths opens The Chart on Lesson 17's quarters, halves and eighths", async ({
  page,
}) => {
  await openSlug(page, 'quarters-halves-and-eighths', '17')

  await expect(earStage(page)).toHaveAttribute('data-ear-drill', 'chart')
  // Eight of the fifteen charts, none on triplets or sixteenths.
  await expect(begin(page)).toContainText(
    '12 charts · quarters and eighths only',
  )
  await expect(page).toHaveURL(/\/#\/ear-lab$/)
})

test("/exercises/three-four-or-six-eight opens Subdivide on Lesson 19's 3/4 and 6/8, two pads every round", async ({
  page,
}) => {
  await openSlug(page, 'three-four-or-six-eight', '19')

  await expect(earStage(page)).toHaveAttribute('data-ear-drill', 'subdivide')
  await expect(begin(page)).toContainText('12 rounds · 3/4 and 6/8')
  await expect(await runPads(page)).toHaveText([/3\/4/, /6\/8/])
})

test("/exercises/perfect-or-tritone opens Leap on Lesson 23's perfect intervals and the tritone, on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSlug(page, 'perfect-or-tritone', '23')

  await expect(earStage(page)).toHaveAttribute('data-ear-drill', 'leap')
  await expect(begin(page)).toContainText('12 rounds · P4, TT, P5 and P8')
  await expect(await runPads(page)).toHaveText([
    /P4\s*Perfect 4th/,
    /TT\s*Tritone/,
    /P5\s*Perfect 5th/,
    /P8\s*Octave/,
  ])
})

test("/exercises/te-or-ti opens Gravity on Lesson 25's Te and Ti", async ({
  page,
}) => {
  await openSlug(page, 'te-or-ti', '25')

  await expect(earStage(page)).toHaveAttribute('data-ear-drill', 'gravity')
  await expect(begin(page)).toContainText('12 rounds · ♭7 (Te) and 7 (Ti)')
  await expect(await runPads(page)).toHaveText([/♭7\s*Te/, /7\s*Ti/])
})

test("/exercises/major-or-dominant-seventh opens Stack on Lesson 27's major and dominant seventh", async ({
  page,
}) => {
  await openSlug(page, 'major-or-dominant-seventh', '27')

  await expect(earStage(page)).toHaveAttribute('data-ear-drill', 'stack')
  await expect(begin(page)).toContainText('12 rounds · major and dominant 7th')
  await expect(await runPads(page)).toHaveText([
    /Maj\s*Major/,
    /7\s*Dominant 7th/,
  ])
})

test('an ear-drill slug opens its set from inside the app, signed in, over the drill already open', async ({
  page,
}) => {
  // A signed-in profile: a session token the app reads as live.
  await page.addInitScript(() => {
    const part = (value: object): string =>
      btoa(JSON.stringify(value)).replace(/=+$/u, '')
    const exp = Math.floor(Date.now() / 1000) + 3600
    localStorage.setItem(
      'mp:authToken',
      `${part({ alg: 'none' })}.${part({ sub: 'e2e-user', provider: 'password', exp })}.sig`,
    )
  })
  // Inside the app first, on Leap whole: its run under way, twelve pads.
  await page.goto('/?lesson=23#/ear-lab')
  await leapFromTheBench(page)
  await expect(earStage(page)).toHaveAttribute('data-ear-drill', 'leap')
  await expect(armedPads(page)).toHaveCount(12, { timeout: 20_000 })

  await openSlug(page, 'perfect-or-tritone', '23')

  await expect(earStage(page)).toHaveAttribute('data-ear-drill', 'leap')
  await expect(begin(page)).toContainText('12 rounds · P4, TT, P5 and P8')
  // Still signed in: the launch spent nothing of the session.
  expect(
    await page.evaluate(() => localStorage.getItem('mp:authToken')),
  ).not.toBeNull()
})

test("leaving perfect-or-tritone's drill leaves the bench's Leap whole", async ({
  page,
}) => {
  await openSlug(page, 'perfect-or-tritone', '23')
  await expect(begin(page)).toContainText('P4, TT, P5 and P8')

  // Closing the room forgets the set (EarLabPage.tsx); the bench opens
  // Leap whole, on all twelve and its own rating.
  await earStage(page).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTestId('merc-bench')).toBeVisible()
  await leapFromTheBench(page)

  await expect(earStage(page)).toHaveAttribute('data-ear-drill', 'leap')
  await expect(begin(page)).toHaveCount(0)
  await expect(armedPads(page)).toHaveCount(12, { timeout: 20_000 })
})

test("/exercises/sing-what-you-see opens Sight-Singing on Lesson 16's two phrases, in G", async ({
  page,
}) => {
  await openSlug(page, 'sing-what-you-see', '16')

  await expect(page.locator('h2.exercise-title')).toHaveText('Sight-Singing')
  // Both phrases as one line, in the lesson's key, with its one sharp.
  await expect(page.locator('.idle-hint')).toHaveText('10 notes · G major')
  const staff = page.getByTestId('sight-staff')
  await expect(staff).toHaveAttribute('data-key', 'G')
  await expect(page.getByTestId('sight-key-sign')).toHaveCount(1)
  await expect(page.getByTestId('sight-note')).toHaveCount(10)
  // The default tenor preset sings the lower voice's G3, read on the treble
  // staff an octave up, as a tenor's part is written.
  await expect(page.getByTestId('sight-note').first()).toHaveAttribute(
    'data-midi',
    '55',
  )
})

test("leaving sing-what-you-see's drill leaves the menu's Sight-Singing on the Singing tab's key", async ({
  page,
}) => {
  await openSlug(page, 'sing-what-you-see', '16')
  await expect(page.locator('.idle-hint')).toHaveText('10 notes · G major')

  // Back clears the launch (resetExerciseLaunchState in App.tsx); without
  // that, the lesson's line and key would follow the singer into the next
  // open.
  await page.locator('.back-btn').click()
  await page
    .locator('.exercise-card', { hasText: 'Sight-Singing' })
    .first()
    .click()

  await expect(page.locator('h2.exercise-title')).toHaveText('Sight-Singing')
  await expect(page.locator('.idle-hint')).toHaveText('6 notes · C major')
  await expect(page.getByTestId('sight-key-sign')).toHaveCount(0)
})

test("/exercises/sight-sing-harmonic-minor opens Sight-Singing in Lesson 25's A harmonic minor", async ({
  page,
}) => {
  await openSlug(page, 'sight-sing-harmonic-minor', '25')

  await expect(page.locator('h2.exercise-title')).toHaveText('Sight-Singing')
  await expect(page.locator('.idle-hint')).toHaveText(
    '6 notes · A harmonic minor',
  )
  await expect(page.getByTestId('sight-staff')).toHaveAttribute('data-key', 'A')
  // A minor's signature is empty; its G sharps are signed where they fall.
  await expect(page.getByTestId('sight-key-sign')).toHaveCount(0)
})
