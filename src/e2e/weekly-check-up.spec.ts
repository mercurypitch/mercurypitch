// ============================================================
// The weekly Check-up — from Home's card to then and now
// ============================================================
//
// Against the built app (docs/specs/weekly-check-up.ears.md, scenarios 1 and
// 2). This browser holds two voiceprints, as the voiceprint service stores
// them, sung 16 and 8 days ago: a Check-up is due, so Home offers it. The
// card opens the Voice Mirror in Check-up mode, and the guided run is sung
// for real by a synthetic microphone (helpers/tone-wav.ts). A steady A3 is
// not a clean range, so Now has no range to compare and the panel says so;
// its accuracy and steadiness still compare with Then's. The default e2e
// build has no API, so the history is this browser's and the panel says
// that too. With one take sung today, Home shows no card.
//
// What each surface says in every case is its unit tests'; this walks the
// one path a singer takes, from Home to the comparison.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { settledPlanSeed } from './helpers/plan-seed'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

// Written at module load: Chromium needs the file before it launches.
const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

const DAY = 24 * 60 * 60 * 1000
const VOICEPRINTS_KEY = 'mercurypitch.voiceprints.v1'

/** A voiceprint as src/db/services/voiceprint-service.ts stores one: G2 to C4. */
function voiceprint(daysAgo: number): Record<string, unknown> {
  return {
    id: `seeded-${daysAgo}`,
    takenAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
    twin: null,
    source: 'mirror',
    madeBy: 'anonymous',
    summary: {
      lowMidi: 43,
      highMidi: 60,
      semitones: 17,
      accuracy: 50,
      steadiness: 40,
    },
  }
}

/**
 * A returning visitor, once per context: First Light spent, the plan settled
 * (helpers/plan-seed.ts), the Mirror's overview seen, and these voiceprints on
 * this browser. Guarded, because an init script runs before every navigation
 * and the run's own take must survive the trip from Home to the Mirror.
 */
async function returningWith(page: Page, takes: unknown[]): Promise<void> {
  const version = (
    JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as {
      version: string
    }
  ).version
  await page.addInitScript(
    ({ takes, version, plan, key }) => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      if (sessionStorage.getItem('e2e.checkup.seeded') === '1') return
      sessionStorage.setItem('e2e.checkup.seeded', '1')
      localStorage.setItem('pitchperfect_welcome_version', version)
      localStorage.setItem('pitchperfect_onboarding_done', '1')
      localStorage.setItem(plan.key, plan.value)
      localStorage.setItem(
        'mirror.howto.v1',
        JSON.stringify({ seenAt: Date.now() }),
      )
      localStorage.setItem(key, JSON.stringify(takes))
    },
    { takes, version, plan: settledPlanSeed(), key: VOICEPRINTS_KEY },
  )
}

/** Sing the guided run: every "I'm ready" gate, and "I'm done" once a take
 *  has enough in it, until the results are up. */
async function singTheRun(page: Page): Promise<void> {
  const results = page.locator('.mirror-results')
  const ready = page.getByRole('button', { name: "I'm ready" })
  const done = page.getByRole('button', { name: "I'm done" })
  await expect(async () => {
    if (await ready.isVisible()) await ready.click()
    if (await done.isVisible()) await done.click()
    await expect(results).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 240_000, intervals: [500] })
}

test('Home offers the Check-up, and the Mirror compares the take with the first week', async ({
  page,
}) => {
  // The run is about a minute and a half of synthetic singing.
  test.setTimeout(300_000)
  await returningWith(page, [voiceprint(8), voiceprint(16)])
  await page.goto('/#/home')

  const card = page.getByTestId('home-checkup-card')
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expect(
    card.getByRole('heading', { name: 'A week since your last Check-up' }),
  ).toBeVisible()
  await expect(card).toContainText('A free account keeps every one')

  await card.getByRole('link', { name: 'Start my Check-up' }).click()
  await expect(page).toHaveURL(/\/mirror\?checkup=1$/)
  await expect(page.locator('.mirror-eyebrow')).toHaveText('Weekly Check-up')

  await page.getByRole('button', { name: 'Find my voice twin' }).click()
  await singTheRun(page)

  const panel = page.getByTestId('mirror-then-and-now')
  await expect(panel).toBeVisible({ timeout: 15_000 })
  await expect(
    panel.getByRole('heading', { name: 'Then and now' }),
  ).toBeVisible()
  await expect(panel.locator('[data-side="then"]')).toContainText('G2 to C4')
  await expect(panel.locator('[data-side="now"]')).toContainText(
    'No clean read',
  )
  await expect(panel.locator('[data-metric="steadiness"]')).toBeVisible()
  await expect(panel).toContainText("These readings are this browser's.")
  await expect(panel.getByTestId('mirror-then-and-now-account')).toBeVisible()
  // The panel takes the change line's place.
  await expect(page.locator('.mirror-delta')).toBeHidden()
})

test('Home shows no Check-up card the day a take was sung', async ({
  page,
}) => {
  await returningWith(page, [voiceprint(0)])
  await page.goto('/#/home')

  await expect(page.locator('.home-streak-card')).toBeVisible({
    timeout: 15_000,
  })
  // The card's chunk and its read have both landed by the time the network
  // is quiet; a card due now would be on the page.
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('home-checkup-card')).toHaveCount(0)
  await expect(page.getByTestId('home-checkup-slot')).toHaveCount(0)
})
