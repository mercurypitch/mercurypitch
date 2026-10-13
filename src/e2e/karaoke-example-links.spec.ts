// ============================================================
// Karaoke Night song links and zen=1 — on a real page
// ============================================================
//
// REQ-SKL-012 and REQ-SKL-013. Every test starts in a fresh browser
// context, so it is a first visit: Karaoke Night has never seeded the
// examples library, and a song link has to wait for that seed before it
// can stage the example's row.
//
// The e2e build has no API, so the page's example list is the shipped
// manifest alone (Goodbye to Spring, the legacy slug). Tests that need
// another example swap that manifest for one with a real slug. Stems and
// lyrics are routed to local files: nothing here touches R2.
//
// Observation channels: the funnel logs `[kn-funnel] <event>` to the
// console (the network beacon is off in this build), the address bar, and
// which stage is on screen. The zen stage is `karaoke-mobile-stage`; the
// desktop mixer is `.stem-mixer--performance`.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(220, 2)
const PHONE = { width: 390, height: 844 }

const NOTHING_IN_THE_DARK = {
  slug: 'nothing-in-the-dark',
  title: 'Nothing in the Dark',
  artist: 'Josh Woodward',
  attribution: {
    text: 'Music: "Nothing in the Dark" by Josh Woodward',
    url: 'https://www.joshwoodward.com/',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  stems: {
    vocal: 'https://r2.e2e.invalid/demo/nothing-in-the-dark/vocal.m4a',
    instrumental:
      'https://r2.e2e.invalid/demo/nothing-in-the-dark/instrumental.m4a',
  },
  lyrics: 'https://r2.e2e.invalid/demo/nothing-in-the-dark/lyrics.lrc',
  durationSec: 2,
}

// Route requests in the page itself, not behind a service worker's back.
test.use({ serviceWorkers: 'block' })

interface Watch {
  staged: () => number
  errors: string[]
}

/** Local stems and lyrics, an optional manifest swap, and the funnel log. */
async function prepare(
  page: Page,
  manifest?: Record<string, unknown>,
): Promise<Watch> {
  await page.route('**/demo/**/*.m4a', (route) =>
    route.fulfill({ path: TONE_WAV, contentType: 'audio/wav' }),
  )
  await page.route('**/demo/**/lyrics.lrc', (route) =>
    route.fulfill({
      body: '[00:00.50]Song link words',
      contentType: 'text/plain',
    }),
  )
  if (manifest !== undefined) {
    await page.route('**/karaoke-demo-song.json', (route) =>
      route.fulfill({ json: manifest }),
    )
  }
  const events: string[] = []
  const errors: string[] = []
  page.on('console', (message) => {
    const text = message.text()
    if (text.startsWith('[kn-funnel]'))
      events.push(text.replace('[kn-funnel]', '').trim())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return {
    staged: () =>
      events.filter((event) => event === 'karaoke_example_staged').length,
    errors,
  }
}

const zenStage = (page: Page) => page.getByTestId('karaoke-mobile-stage')
const mixer = (page: Page) => page.locator('.stem-mixer--performance')
const search = (page: Page) => new URL(page.url()).search

/** Whether the examples seed wrote this session's row to IndexedDB. */
async function rowSeeded(page: Page, sessionId: string): Promise<boolean> {
  return page.evaluate(
    async (id) =>
      new Promise<boolean>((resolve, reject) => {
        const open = indexedDB.open('MercuryPitchDB')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const all = db
            .transaction('uvrSessions', 'readonly')
            .objectStore('uvrSessions')
            .getAll()
          all.onsuccess = () => {
            db.close()
            resolve(
              (all.result as { appSessionId?: string }[]).some(
                (row) => row.appSessionId === id,
              ),
            )
          }
          all.onerror = () => {
            db.close()
            reject(all.error)
          }
        }
      }),
    sessionId,
  )
}

test.describe('Karaoke Night song links', () => {
  test('a song link stages its example on a first desktop visit @smoke', async ({
    page,
  }) => {
    const watch = await prepare(page, NOTHING_IN_THE_DARK)
    await page.goto('/karaoke-night?song=nothing-in-the-dark')

    await expect(mixer(page)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.sm-header-titles h2')).toContainText(
      'Nothing in the Dark',
    )
    // Desktop without zen=1 keeps the mixer.
    await expect(zenStage(page)).toHaveCount(0)
    await expect.poll(watch.staged, { timeout: 10_000 }).toBe(1)
    // It staged the library row the seed wrote, not a bare manifest.
    expect(
      await rowSeeded(page, 'karaoke-night-demo:nothing-in-the-dark'),
    ).toBe(true)
    // The readable link survives being consumed.
    expect(search(page)).toBe('?song=nothing-in-the-dark')

    // Closing the stage takes the song out of the address.
    await mixer(page).locator('button[title="Back"]').click()
    await expect(
      page.getByRole('heading', { name: 'Your stage is set' }),
    ).toBeVisible()
    expect(search(page)).toBe('')
    expect(watch.errors).toEqual([])
  })

  test.describe('on a phone', () => {
    test.use({ viewport: PHONE })

    test('a song link opens the zen stage, as every phone stage does', async ({
      page,
    }) => {
      const watch = await prepare(page, NOTHING_IN_THE_DARK)
      await page.goto('/karaoke-night?song=nothing-in-the-dark')

      await expect(zenStage(page)).toBeVisible({ timeout: 20_000 })
      await expect(zenStage(page)).toContainText('Nothing in the Dark')
      await expect.poll(watch.staged, { timeout: 10_000 }).toBe(1)
      expect(search(page)).toBe('?song=nothing-in-the-dark')
      expect(watch.errors).toEqual([])
    })

    test('zen=1 changes nothing on a phone', async ({ page }) => {
      const watch = await prepare(page)
      await page.goto('/karaoke-night?song=goodbye-to-spring&zen=1')

      await expect(zenStage(page)).toBeVisible({ timeout: 20_000 })
      // Back on a phone leaves the stage, as it does without the param:
      // zen was never switched on, so there is no mixer to return to.
      await zenStage(page)
        .getByRole('button', { name: 'Back', exact: true })
        .click()
      await expect(
        page.getByRole('heading', { name: 'Your stage is set' }),
      ).toBeVisible()
      await expect(mixer(page)).toHaveCount(0)
      expect(watch.errors).toEqual([])
    })
  })

  test('the original demo answers to goodbye-to-spring, with zen=1 on a desktop', async ({
    page,
  }) => {
    const watch = await prepare(page)
    await page.goto('/karaoke-night?song=goodbye-to-spring&zen=1')

    await expect(zenStage(page)).toBeVisible({ timeout: 20_000 })
    await expect(zenStage(page)).toContainText('Goodbye to Spring')
    await expect.poll(watch.staged, { timeout: 10_000 }).toBe(1)
    expect(await rowSeeded(page, 'karaoke-night-demo')).toBe(true)
    expect(search(page)).toBe('?song=goodbye-to-spring&zen=1')

    // Back from a desktop zen returns to the mixer with the song still
    // staged, and the address stops asking for zen.
    await zenStage(page)
      .getByRole('button', { name: 'Back', exact: true })
      .click()
    await expect(mixer(page)).toBeVisible()
    await expect(zenStage(page)).toHaveCount(0)
    expect(search(page)).toBe('?song=goodbye-to-spring')
    expect(watch.errors).toEqual([])
  })

  test('the legacy slug resolves and is rewritten to the readable one', async ({
    page,
  }) => {
    const watch = await prepare(page)
    await page.goto('/karaoke-night?song=karaoke-night')

    await expect(mixer(page)).toBeVisible({ timeout: 20_000 })
    expect(search(page)).toBe('?song=goodbye-to-spring')
    expect(watch.errors).toEqual([])
  })

  test('zen=1 alone opens the next staged song in zen on a desktop', async ({
    page,
  }) => {
    const watch = await prepare(page)
    await page.goto('/karaoke-night?zen=1')

    await expect(
      page.getByRole('heading', { name: 'Your stage is set' }),
    ).toBeVisible({ timeout: 20_000 })
    await page
      .locator('.kn-hero')
      .getByRole('button', { name: 'Sing this song' })
      .click()

    await expect(zenStage(page)).toBeVisible({ timeout: 20_000 })
    expect(watch.errors).toEqual([])
  })

  test('an unknown slug opens Karaoke Night as usual, with no error', async ({
    page,
  }) => {
    const watch = await prepare(page)
    await page.goto('/karaoke-night?song=not-a-real-song&zen=1')

    await expect(
      page.getByRole('heading', { name: 'Your stage is set' }),
    ).toBeVisible({ timeout: 20_000 })
    // The opener loaded, so the slug was checked against the real list.
    await expect(
      page.locator('.kn-card--demo').getByRole('heading', {
        name: 'Goodbye to Spring',
      }),
    ).toBeVisible()
    await expect.poll(() => search(page)).toBe('?zen=1')
    const notifications = page.getByRole('region', { name: 'Notifications' })
    await expect(notifications.getByRole('alert')).toHaveCount(0)
    await expect(notifications.getByRole('status')).toHaveCount(0)
    await expect(mixer(page)).toHaveCount(0)
    await expect(zenStage(page)).toHaveCount(0)
    expect(watch.staged()).toBe(0)
    expect(watch.errors).toEqual([])
  })
})

test.describe('Karaoke Night ?session= links', () => {
  test('a session link still stages the demo exactly as before', async ({
    page,
  }) => {
    const watch = await prepare(page)
    await page.goto('/karaoke-night?session=karaoke-night-demo')

    await expect(mixer(page)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.sm-header-titles h2')).toContainText(
      'Goodbye to Spring',
    )
    expect(search(page)).toBe('?session=karaoke-night-demo')
    // The session path never counted as an example staging; it still does not.
    expect(watch.staged()).toBe(0)
    expect(watch.errors).toEqual([])
  })

  test('session wins over song, and combines with zen=1', async ({ page }) => {
    const watch = await prepare(page, NOTHING_IN_THE_DARK)
    await page.goto(
      '/karaoke-night?session=karaoke-night-demo%3Anothing-in-the-dark&song=goodbye-to-spring&zen=1',
    )

    await expect(zenStage(page)).toBeVisible({ timeout: 20_000 })
    await expect(zenStage(page)).toContainText('Nothing in the Dark')
    expect(search(page)).toBe(
      '?session=karaoke-night-demo%3Anothing-in-the-dark&zen=1',
    )
    expect(watch.staged()).toBe(0)
    expect(watch.errors).toEqual([])
  })
})
