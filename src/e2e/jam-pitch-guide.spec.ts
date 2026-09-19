// ============================================================
// Jam song room — working out a missing pitch guide
// ============================================================
//
// A song nobody has ever opened in the stem mixer has no stored analysis,
// so the room drew empty lanes and said nothing. This drives the whole
// replacement path in a real browser: the host fetches the vocal stem,
// decodes it, runs the shared analysis, and the lanes stop apologising
// the moment the line lands.
//
// The stems are intercepted rather than fetched from R2 -- a spec must
// not depend on a bucket, and a known tone is the only way to say what
// the analysis should find. The delay on the vocal route is deliberate:
// without it the run finishes before the progress strip can be read,
// which would make the assertion a race rather than a check.

import type { Page, Route } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeToneWav } from './helpers/tone-wav'
import { dismissOverlays } from './helpers/ui'

/** A4 for four seconds: long enough to segment, short enough to be quick. */
const VOCAL_WAV = readFileSync(writeToneWav(440, 4))

/**
 * Where a screenshot goes.
 *
 * Playwright's own per-test folder by default, so the spec carries no
 * machine's directory layout around with it. Point JAM_STAGE_ARTIFACTS at
 * somewhere a person will actually look to collect them instead.
 */
function shot(name: string): string {
  const directory = process.env.JAM_STAGE_ARTIFACTS
  if (directory === undefined) return test.info().outputPath(name)
  mkdirSync(directory, { recursive: true })
  return join(directory, name)
}

const LYRICS = ['[00:00.00]First line', '[00:02.00]Second line', ''].join('\n')

/**
 * How long the vocal stem takes to arrive.
 *
 * The strip appears before the fetch and the analysis of four seconds of
 * tone takes a few hundred milliseconds, so without a stall there is no
 * window in which "working" is true for long enough to photograph.
 */
const STEM_DELAY_MS = 1500

interface StemRoutes {
  /** Make the next vocal fetch fail with a 500. */
  breakVocal: () => void
  /** Put it back. */
  mendVocal: () => void
}

/**
 * Serve the demo's stems and words from here rather than from R2.
 *
 * The instrumental is the same tone: it only ever reaches an <audio>
 * element, and nothing in this spec plays it.
 */
async function serveDemoStems(page: Page): Promise<StemRoutes> {
  let vocalBroken = false

  await page.route(
    '**/demo/goodbye-to-spring/vocal.m4a',
    async (route: Route) => {
      if (vocalBroken) {
        await route.fulfill({ status: 500, body: 'no' })
        return
      }
      await new Promise((resolve) => setTimeout(resolve, STEM_DELAY_MS))
      await route.fulfill({ contentType: 'audio/wav', body: VOCAL_WAV })
    },
  )
  await page.route('**/demo/goodbye-to-spring/instrumental.m4a', (route) =>
    route.fulfill({ contentType: 'audio/wav', body: VOCAL_WAV }),
  )
  await page.route('**/demo/goodbye-to-spring/lyrics.lrc', (route) =>
    route.fulfill({ contentType: 'text/plain', body: LYRICS }),
  )

  return {
    breakVocal: () => {
      vocalBroken = true
    },
    mendVocal: () => {
      vocalBroken = false
    },
  }
}

/**
 * Create the preview room and load the bundled song, with NO seeded
 * analysis -- which is the state this whole spec is about.
 */
async function openSongRoom(page: Page): Promise<void> {
  await page.goto('/#/jam')
  await dismissOverlays(page)
  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(
    page.getByText('Preview room — these peers are not real'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Choose a drill or a song' }).click()
  await page
    .getByRole('button', { name: /Goodbye to Spring/ })
    .first()
    .click()
  await expect(page.getByTestId('jam-split-handle')).toBeVisible()
}

const notice = (page: Page) => page.getByTestId('jam-pitch-notice')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('pitchperfect_theme', 'dark')
      localStorage.setItem('pitchperfect_theme_source', 'manual')
    } catch {
      /* storage blocked — the app's own default is dark anyway */
    }
  })
})

test.describe('a song with no pitch guide', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('says it is working one out, then stops saying anything @smoke', async ({
    page,
  }) => {
    await serveDemoStems(page)
    await openSongRoom(page)

    // 1. It says what it is doing, and says it as a progressbar.
    await expect(notice(page)).toHaveAttribute('data-state', 'working')
    const bar = page.getByRole('progressbar', {
      name: 'Working out the pitch guide',
    })
    await expect(bar).toBeVisible()
    await expect(bar).toHaveAttribute('aria-valuemin', '0')
    await expect(bar).toHaveAttribute('aria-valuemax', '100')
    const now = Number(await bar.getAttribute('aria-valuenow'))
    expect(now).toBeGreaterThanOrEqual(0)
    expect(now).toBeLessThanOrEqual(100)
    await page.screenshot({ path: shot('desktop-pitch-working.png') })

    // 2. The song is singable while it works: the words scroll, the
    //    transport is live, and the lanes are there to sing into.
    await expect(page.locator('[data-line="0"]')).toBeVisible()
    await expect(page.getByTestId('jam-lane-zoom')).toBeVisible()

    // 3. The strip goes away, because the line arrived.
    await expect(notice(page)).toHaveCount(0, { timeout: 30000 })
    await page.screenshot({ path: shot('desktop-pitch-ready.png') })

    // 4. And it is a real line, not an empty one: the tone is A4, which
    //    is midi 69, and the analysis is what put it there.
    const midis = await page.evaluate(async () => {
      const open = indexedDB.open('MercuryPitchDB')
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      const rows = await new Promise<{ segmentedNotesJson?: string }[]>(
        (resolve, reject) => {
          const req = db
            .transaction(['offlinePitchAnalysis'], 'readonly')
            .objectStore('offlinePitchAnalysis')
            .getAll()
          req.onsuccess = () =>
            resolve(req.result as { segmentedNotesJson?: string }[])
          req.onerror = () => reject(req.error)
        },
      )
      db.close()
      return rows.flatMap((row) =>
        (JSON.parse(row.segmentedNotesJson ?? '[]') as { midi: number }[]).map(
          (n) => n.midi,
        ),
      )
    })
    expect(midis.length).toBeGreaterThan(0)
    expect(midis).toContain(69)
  })

  test('says so, and offers a way back, when it cannot @smoke', async ({
    page,
  }) => {
    const routes = await serveDemoStems(page)
    routes.breakVocal()
    await openSongRoom(page)

    await expect(notice(page)).toHaveAttribute('data-state', 'unavailable', {
      timeout: 30000,
    })
    // A failure somebody is sitting in front of has to announce itself.
    await expect(notice(page)).toHaveAttribute('role', 'status')
    await expect(notice(page)).toHaveAttribute('aria-live', 'polite')
    const retry = page.getByRole('button', { name: 'Try again' })
    await expect(retry).toBeVisible()
    // The toast says the same thing, for anyone looking elsewhere.
    await expect(page.getByText(/did not finish/i).first()).toBeVisible()
    await page.screenshot({ path: shot('desktop-pitch-unavailable.png') })

    // Nothing retries itself: the strip is still there a few seconds on.
    await page.waitForTimeout(2000)
    await expect(notice(page)).toHaveAttribute('data-state', 'unavailable')

    // And the singer's own retry works.
    routes.mendVocal()
    await retry.click()
    await expect(notice(page)).toHaveAttribute('data-state', 'working')
    await expect(notice(page)).toHaveCount(0, { timeout: 30000 })
  })
})

test.describe('the same thing on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('fits the strip under a stacked stage @smoke', async ({ page }) => {
    await serveDemoStems(page)
    await openSongRoom(page)

    await expect(notice(page)).toHaveAttribute('data-state', 'working')
    // It must not push the lanes off the bottom or the page sideways.
    const box = await notice(page).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(390)
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
    await page.screenshot({ path: shot('phone-pitch-working.png') })
    await expect(notice(page)).toHaveCount(0, { timeout: 30000 })
  })

  test('gives a thumb something to press when it fails @smoke', async ({
    page,
  }) => {
    // A separate page on purpose: once a run succeeds the analysis is in
    // this profile's database, and the song never asks again.
    const routes = await serveDemoStems(page)
    routes.breakVocal()
    await openSongRoom(page)

    await expect(notice(page)).toHaveAttribute('data-state', 'unavailable', {
      timeout: 30000,
    })
    const retry = page.getByRole('button', { name: 'Try again' })
    const retryBox = await retry.boundingBox()
    expect(retryBox).not.toBeNull()
    expect(retryBox!.height).toBeGreaterThanOrEqual(24)
    await page.screenshot({ path: shot('phone-pitch-unavailable.png') })
  })
})
