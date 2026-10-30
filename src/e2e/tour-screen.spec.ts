// ============================================================
// A tour starts on the page it shows, whatever the singer has open
// ============================================================
//
// Owner report, 2026-10-29: the Exercises tour, started inside Long Note,
// pointed at a drill list that was not on screen, and the Sing tour pointed
// at a line the Notation view does not draw. A tour now asks before it
// closes what is open over its page, and sets the view each step needs,
// putting it back once the tour ends (src/lib/tour-screen.ts). What counts
// is what the singer can see, so it is asked here, in a browser:
//
// - the Exercises tour from inside Long Note asks first. Not now leaves Long
//   Note open with no tour; Take the tour closes it and spotlights the list;
// - Merc's Sing tour from Notation draws the pitch line at its line stops,
//   and Notation is back once the tour ends;
// - the Guide's Compose section from Sheet Music rings the piano roll, and
//   Sheet Music is back once the tour ends.
// - a tour that would leave Hear Yourself with a take not kept asks first,
//   as a tab change does: Cancel keeps the take and starts no tour, Discard
//   take lets the tour go.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const version = (
  JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
  ) as { version: string }
).version

// A microphone for Hear Yourself's take: a steady tone, granted.
test.use({
  viewport: { width: 1280, height: 800 },
  launchOptions: { args: fakeMicArgs(writeToneWav()) },
  permissions: ['microphone'],
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript((v) => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_welcome_version', v)
    localStorage.setItem('pitchperfect_onboarding_done', '1')
    localStorage.setItem('pitchperfect_focus_mode', 'false')
    localStorage.setItem('pitchperfect_survey_seen', '1')
    // No first-visit chips over the pages walked, but Singing's, which
    // starts Merc's tour.
    for (const tab of ['home', 'exercises', 'compose']) {
      localStorage.setItem(`pitchperfect_page_tour_offered_${tab}`, 'true')
    }
  }, version)
})

const stepTitle = (page: Page) =>
  page.locator('[class*="walkthroughStepTitle"]')
const spotlight = (page: Page) =>
  page.locator('[class*="walkthroughHighlight"]')

/** The spotlight is up, around the middle of what `selector` matches. */
async function expectRinged(page: Page, selector: string): Promise<void> {
  await expect(async () => {
    const ring = await spotlight(page).boundingBox()
    const target = await page.locator(selector).first().boundingBox()
    if (ring === null || target === null) throw new Error('not laid out')
    const x = target.x + target.width / 2
    const y = target.y + target.height / 2
    expect(x).toBeGreaterThanOrEqual(ring.x)
    expect(x).toBeLessThanOrEqual(ring.x + ring.width)
    expect(y).toBeGreaterThanOrEqual(ring.y)
    expect(y).toBeLessThanOrEqual(ring.y + ring.height)
  }).toPass({ timeout: 5000 })
}

test('the Exercises tour asks before it closes Long Note, then starts on the list', async ({
  page,
}) => {
  await page.goto('/#/exercises')
  await page.locator('.exercise-card', { hasText: 'Long Note' }).first().click()
  await expect(page.locator('.exercises-grid')).toHaveCount(0)
  const tour = page.getByTitle('Take a guided tour of this page')
  const ask = page.getByRole('alertdialog')

  await tour.click()
  await expect(ask).toContainText('Leave Long Note for the Exercises tour?')
  await page.getByRole('button', { name: 'Not now' }).click()
  await expect(ask).toHaveCount(0)
  await expect(page.locator('.exercises-grid')).toHaveCount(0)
  await expect(stepTitle(page)).toHaveCount(0)

  await tour.click()
  await page.getByRole('button', { name: 'Take the tour' }).click()
  await expect(page.locator('.exercises-grid')).toBeVisible()
  await expect(stepTitle(page)).toHaveText('Singing exercises')
  await expectRinged(page, '.exercises-header')
})

test("Merc's Sing tour draws its line in Melody, and Notation comes back after", async ({
  page,
}) => {
  await page.goto('/#/singing')
  const chip = page.getByTestId('tour-chip')
  await expect(chip).toBeVisible()
  const views = page.locator('[data-tour="view.sheet-toggle"]')
  const notation = views.getByRole('button', { name: /Notation/ })
  const melody = views.getByRole('button', { name: /Melody/ })
  await notation.click()
  await expect(notation).toHaveAttribute('aria-pressed', 'true')

  await chip.getByRole('button').first().click()
  const bubble = page.getByTestId('coach-bubble')
  await expect(page.locator('#coach-title')).toHaveText('Start the mic')
  await bubble.getByRole('button', { name: 'Skip this step' }).click()

  await expect(page.locator('#coach-title')).toHaveText('Sing any note')
  await expect(melody).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#canvas-container canvas').first()).toBeVisible()

  await page.getByRole('button', { name: 'End tour' }).click()
  await expect(bubble).toHaveCount(0)
  await expect(notation).toHaveAttribute('aria-pressed', 'true')
})

test('the Compose section rings the piano roll from Sheet Music, and Sheet Music comes back after', async ({
  page,
}) => {
  await page.goto('/#/compose')
  const sheet = page.getByTestId('view-sheet-music')
  await sheet.click()
  await expect(sheet).toHaveAttribute('aria-selected', 'true')

  await page.getByTitle('Interactive guide tours').click()
  await page
    .locator('[class*="guideSectionName"]', { hasText: /^Compose$/ })
    .click()
  await expect(stepTitle(page)).toHaveText('Compose tab')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await expect(stepTitle(page)).toHaveText('Piano Roll')
  await expect(page.getByTestId('view-piano-roll')).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expectRinged(page, '[data-tour="compose.piano-roll"]')

  await page.getByRole('button', { name: 'Skip tour' }).click()
  await expect(stepTitle(page)).toHaveCount(0)
  await expect(sheet).toHaveAttribute('aria-selected', 'true')
})

test.describe('from Hear Yourself, with a take not kept', () => {
  /** The take's clock has passed its first second. */
  async function waitForRecordedSecond(page: Page): Promise<void> {
    const elapsed = page.locator('time[aria-label$=" elapsed"]').last()
    await expect
      .poll(async () => {
        const duration = await elapsed.getAttribute('datetime')
        const match = /^PT(\d+)S$/.exec(duration ?? '')
        return Number(match?.[1] ?? 0)
      })
      .toBeGreaterThanOrEqual(1)
  }

  test('a tour asks before the take goes, and Cancel keeps it with no tour', async ({
    page,
  }) => {
    test.setTimeout(60000)
    await page.goto('/#/voice-history')
    await expect(page.getByTestId('voice-history-page')).toBeVisible()
    await page.getByRole('button', { name: 'Record freely' }).click()
    await page.getByLabel(/what do you want to repeat/i).fill('Tour check')
    await page.getByRole('button', { name: 'Start recording' }).click()
    await expect(page.getByText('Recording now')).toBeVisible({
      timeout: 10000,
    })
    await waitForRecordedSecond(page)
    await page.getByRole('button', { name: 'Stop recording' }).click()
    const keep = page.getByRole('button', { name: 'Keep Take' })
    await expect(keep).toBeEnabled({ timeout: 15000 })

    const startExercisesTour = async (): Promise<void> => {
      await page.getByTitle('Interactive guide tours').click()
      await page
        .locator('[class*="guideSectionName"]', { hasText: /^Exercises$/ })
        .click()
    }

    await startExercisesTour()
    await expect(page.getByRole('alertdialog')).toContainText(
      'Discard this temporary take?',
    )
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(keep).toBeEnabled()
    await expect(stepTitle(page)).toHaveCount(0)
    await expect(page.getByTestId('voice-history-page')).toBeVisible()

    await startExercisesTour()
    await page.getByRole('button', { name: 'Discard take' }).click()
    await expect(stepTitle(page)).toHaveText('Singing exercises')
    await expectRinged(page, '.exercises-header')
  })
})
