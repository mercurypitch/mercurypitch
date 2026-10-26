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

const beat = (page: import('@playwright/test').Page, name: string) =>
  page.locator(`[data-beat="${name}"]`)

/**
 * From the first of the four questions to the plan: every question passed
 * with nothing picked. Each screen is waited for by its "Question N of 4"
 * line, so a tap never lands on the one leaving.
 */
async function skipToThePlan(page: import('@playwright/test').Page) {
  const questions = beat(page, 'questions')
  await expect(questions.getByText('Question 1 of 4')).toBeVisible({
    timeout: 10000,
  })
  await questions.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(questions.getByText('Question 2 of 4')).toBeVisible()
  await questions.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(questions.getByText('Question 3 of 4')).toBeVisible()
  await questions.getByRole('button', { name: 'Skip this one' }).click()
  await expect(questions.getByText('Question 4 of 4')).toBeVisible()
  await questions.getByRole('button', { name: 'Skip to my plan' }).click()
}

/** On to the Map from there: "See every room" on the plan. */
async function skipThePlanToTheMap(page: import('@playwright/test').Page) {
  await skipToThePlan(page)
  await beat(page, 'questions')
    .getByRole('button', { name: 'See every room' })
    .click()
  await expect(beat(page, 'map')).toBeVisible({ timeout: 10000 })
}

/**
 * The beat-2 button, whichever label it is wearing. This context grants
 * `microphone` up front, so beat 2 knows there is no prompt to explain
 * and says "Start listening"; a first-time visitor gets "Allow
 * microphone". Both open the mic — matching either is the point.
 */
const micStart = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Allow microphone|Start listening/ })

/**
 * Two voiceprints already on this device, as a visitor who has done
 * this before would have. Written straight to the local store — the
 * point under test is what the fork SAYS about them, and taking three
 * real ones would cost four and a half minutes of synthetic singing.
 */
const SEED_PRINTS = () => {
  localStorage.setItem(
    'mercurypitch.voiceprints.v1',
    JSON.stringify([
      {
        id: 'seed-newer',
        takenAt: '2026-07-30T10:00:00.000Z',
        twin: 'Freddie Mercury',
        source: 'onboarding',
        summary: {
          lowMidi: 43,
          highMidi: 76,
          semitones: 33,
          accuracy: 82,
          steadiness: 74,
        },
      },
      {
        id: 'seed-older',
        takenAt: '2026-06-02T10:00:00.000Z',
        twin: 'Freddie Mercury',
        source: 'mirror',
        summary: {
          lowMidi: 45,
          highMidi: 72,
          semitones: 27,
          accuracy: 71,
          steadiness: 66,
        },
      },
    ]),
  )
}

test.describe('First Light with a microphone', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FRESH_VISITOR_INIT)
  })

  test('beat 2 hears the note and says it back', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    await page.getByRole('button', { name: 'Sing one note' }).click()
    await micStart(page).click()

    // The claim the whole beat rests on: we heard you, and here is what.
    const heard = beat(page, 'first-light').locator('h1')
    await expect(heard).toContainText(TONE_NOTE, { timeout: 20000 })

    // And the frequency is reported alongside, not just a bare name.
    await expect(beat(page, 'first-light')).toContainText(/Hz/)
  })

  test('the Fork asks one question, and "Not now" reaches the four questions and then the Map without a voiceprint', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    await page.getByRole('button', { name: 'Sing one note' }).click()
    await micStart(page).click()
    await expect(beat(page, 'first-light').locator('h1')).toContainText(
      TONE_NOTE,
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: 'Keep going' }).click()

    // One screen, one button (owner decisions V2 and V8): the question,
    // the voiceprint behind it, and the way out at the top right.
    const fork = beat(page, 'fork')
    await expect(fork).toBeVisible()
    await expect(fork.locator('h1')).toHaveText(
      'Which legend has a range like yours?',
    )
    await expect(fork.getByRole('button')).toHaveText(['Find my twin'])
    await expect(page.getByRole('button', { name: /Take me in/ })).toHaveCount(
      0,
    )

    // Past the walk, the four questions come first while the plan is due
    // (a fresh visitor's is), and "See every room" on the plan opens the Map.
    // It asks first: no voiceprint has been made in this run.
    await page.getByRole('button', { name: 'Not now' }).click()
    await page
      .getByRole('alertdialog', { name: 'Skip your voiceprint?' })
      .getByRole('button', { name: 'Yes, skip' })
      .click()
    await expect(beat(page, 'questions')).toBeVisible({ timeout: 10000 })
    await expect(beat(page, 'voiceprint')).toHaveCount(0)
    await skipThePlanToTheMap(page)
    await expect(page.getByText('Your first stop')).toBeVisible()

    await page.getByRole('button', { name: /Start singing|Done/ }).click()
    await expect(page.locator('#app-tabs')).toBeVisible()
  })

  test('a returning visitor is told they already mapped their voice', async ({
    page,
  }) => {
    await page.addInitScript(SEED_PRINTS)
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    await page.getByRole('button', { name: 'Sing one note' }).click()
    await micStart(page).click()
    await expect(beat(page, 'first-light').locator('h1')).toContainText(
      TONE_NOTE,
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: 'Keep going' }).click()

    // The whole point: no new measurement as the lead button for
    // someone who has already done exactly that, twice.
    const fork = beat(page, 'fork')
    await expect(fork).toBeVisible()
    await expect(fork).toContainText(/already mapped your voice/i)
    await expect(fork).toContainText('2 voiceprints')
    await expect(
      page.getByRole('button', { name: /Find my twin/ }),
    ).toHaveCount(0)

    // The gallery, then the plan and the Map — never a second measurement.
    // The way on says where it leads: the four questions, while the plan is
    // due (a fresh visitor's is), not the Map.
    await page.getByRole('button', { name: /See my voiceprints/ }).click()
    const prints = beat(page, 'prints')
    await expect(prints).toBeVisible()
    await expect(prints).toContainText('2 voiceprints')
    await expect(prints).toContainText('Earlier takes')
    await expect(page.getByRole('button', { name: /See my map/ })).toHaveCount(
      0,
    )

    await page.getByRole('button', { name: /Make my plan/ }).click()
    await expect(beat(page, 'questions')).toBeVisible({ timeout: 10000 })
    await skipThePlanToTheMap(page)
    await expect(beat(page, 'voiceprint')).toHaveCount(0)
  })

  test('the full track runs the voiceprint through to the twin and the Map', async ({
    page,
  }) => {
    // The voiceprint is deliberately ~90 seconds of singing; this test
    // walks all of it, so it needs far more than the default budget.
    test.setTimeout(300000)

    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    await page.getByRole('button', { name: 'Sing one note' }).click()
    await micStart(page).click()
    await expect(beat(page, 'first-light').locator('h1')).toContainText(
      TONE_NOTE,
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: 'Keep going' }).click()
    await page.getByRole('button', { name: 'Find my twin' }).click()

    const voiceprint = beat(page, 'voiceprint')
    await expect(voiceprint).toBeVisible()

    // Each task waits behind an "I'm ready" gate. Clear them as they
    // appear rather than assuming a fixed count — the number of gates is
    // a content decision that should be free to change. What the one step
    // counter said at each gate is kept (owner decision V7).
    const ready = page.getByRole('button', { name: "I'm ready" })
    const counter = voiceprint.locator('[data-step-counter]')
    const counters: string[] = []
    const deadline = Date.now() + 240000
    while (Date.now() < deadline) {
      if (
        await beat(page, 'twin')
          .isVisible()
          .catch(() => false)
      )
        break
      if (await ready.isVisible().catch(() => false)) {
        const said = (await counter.textContent().catch(() => null)) ?? ''
        if (said !== '' && counters[counters.length - 1] !== said)
          counters.push(said)
        await ready.click().catch(() => undefined)
      }
      await page.waitForTimeout(500)
    }
    expect(counters).toEqual([
      'Step 1 of 4 · about 90 seconds',
      'Step 2 of 4 · Glide down',
      'Step 3 of 4 · Hold',
      'Step 4 of 4 · Match',
    ])

    // The payoff: a twin, and the numbers a voiceprint record stores, on
    // one stat card (owner testing, 11 Oct 2026).
    const twin = beat(page, 'twin')
    await expect(twin).toBeVisible({ timeout: 30000 })
    await expect(twin).toContainText(/steadiness/i)
    await expect(twin.locator('[data-stat-card]')).toHaveCount(1)
    // A steady tone reads A3 to A3: a range read that is not clean, so the
    // card draws no ridge and no range, as the line above it says.
    await expect(twin).toContainText("couldn't get a clean read")
    await expect(twin.locator('[data-ridge]')).toHaveCount(0)
    await expect(twin.locator('[data-stat="range"]')).toHaveCount(0)
    // The line under the card names what follows the account offer: the plan
    // while it is due (a fresh visitor's is), not the Map.
    await expect(twin).toContainText('Next, your plan')

    // "Continue", not "See my map": this advances to `keep`, and the four
    // questions and the Map are further on. The Prints beat above says
    // "Make my plan", because from there the questions really are next.
    await page.getByRole('button', { name: /^Continue$/ }).click()

    // Beat 7 offers the account when there is something to keep; it is
    // dismissible, and "Not now" (top right, in the rail) must still reach
    // the four questions, and through them the Map.
    const keep = beat(page, 'keep')
    if (await keep.isVisible().catch(() => false)) {
      await expect(keep).toContainText(/keep/i)
      // What an account keeps, in rows, with or without the launch gift
      // (the dev API decides whether a code is featured).
      await expect(keep).toContainText(/Your voiceprint and range, saved/)
      // No range card for the unclean read.
      await expect(keep.getByTestId('keep-range')).toHaveCount(0)
      await page.getByRole('button', { name: /Not now/ }).click()
    }
    await expect(beat(page, 'questions')).toBeVisible({ timeout: 15000 })
    await skipToThePlan(page)

    // The plan: an unclean range is not a narrow one, so the solid scores
    // lead to Karaoke Night, not the Ascent's Range week.
    const questions = beat(page, 'questions')
    await expect(questions.locator('[data-kind="start"]')).toHaveAttribute(
      'data-dest',
      'karaokeNight',
    )
    await questions.getByRole('button', { name: 'See every room' }).click()

    const map = beat(page, 'map')
    await expect(map).toBeVisible({ timeout: 15000 })
    // Declining the offer must leave a way back to it on the Map.
    await expect(map).toContainText(
      /Save it (to a free account|and get the launch gift)/i,
    )
  })
})
