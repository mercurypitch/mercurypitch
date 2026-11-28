// ============================================================
// A signed-in singer reaches their own data while the API answers nothing
// ============================================================
//
// On a network whose proxy holds every request to the API host for about a
// minute (measured on a corporate network, 27 Nov 2026), a signed-in
// singer could not read or write anything kept on the device for that
// minute, on every page load: opening the database waited for
// /api/auth/me. A lesson page is a document of its own, so Lessons, then
// Back, paid the minute again.
//
// Here no API call is ever answered, which is the held network with no end.
// The device's own data must be there within a few seconds anyway, before
// and after a reload, and the singer is told once per page load that the
// servers are out of reach.
//
// Once one call has found the API out of reach, the page leaves it alone for
// a while (src/db/api-reachability.ts): what it asks for in that time is
// refused at once instead of waiting out a deadline of its own, and nothing
// is sent. A person's press, such as Try again, is sent anyway.
//
// The default e2e build has no API (VITE_API_BASE_URL is empty, so every
// page uses the local database alone and none of this code runs), so this
// lives in the cloud suite (playwright.cloud.config.ts). The database is
// reached through the E2E bridge (src/lib/e2e-bridge.ts): a karaoke playlist
// is kept on the device only, never in the cloud.

import { expect, test, type Page } from '@playwright/test'

const NOTICE = "Can't reach Mercury Pitch's servers from this network."
/** What "within a few seconds" means here; the API's read deadline is 8 s. */
const PROMPTLY_MS = 3_000

// UTC, as playwright.config.ts pins it: a European clock shows the consent
// banner, which has nothing to do with this.
test.use({ timezoneId: 'UTC' })

interface PlaylistsBridge {
  createPlaylist: (name: string) => Promise<{ id: string; name: string }>
  getPlaylistsReactive: () => { name: string }[]
}

/** A worker-shaped JWT. The client decodes `sub`, `provider` and `exp`. */
function accountToken(): string {
  const payload = {
    sub: 'e2e-held-singer',
    provider: 'password',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
}

/** A returning, signed-in singer, with the bridge on and no first-run sheets. */
async function seedReturningSinger(page: Page, token: string): Promise<void> {
  await page.addInitScript((value) => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
    const seen: Record<string, string> = {
      pitchperfect_welcome_version: '1',
      pitchperfect_onboarding_done: '1',
      pitchperfect_survey_dismissed: '1',
      pitchperfect_survey_seen: '1',
      pitchperfect_whats_new_seen_v2: '0.9',
      'mp:userId': 'e2e-held-device',
    }
    for (const [key, item] of Object.entries(seen))
      localStorage.setItem(key, item)
    if (localStorage.getItem('mp:authToken') === null)
      localStorage.setItem('mp:authToken', value)
  }, token)
}

/**
 * Nothing answers the API, and nothing leaves this machine: a request to any
 * other host is refused, so the build's other settings can never reach a
 * real service.
 */
async function holdTheApi(page: Page): Promise<void> {
  await page.context().route(
    (url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => route.abort(),
  )
  await page.route('**/cloud/api/**', () => {
    // Never fulfilled, continued or aborted: the request hangs.
  })
}

/** The paths of the API requests the page sends, in order, from now on. */
function apiRequests(page: Page): string[] {
  const sent: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith('/cloud/api/')) sent.push(pathname)
  })
  return sent
}

function playlists(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (
      window as unknown as { __karaokePlaylists: PlaylistsBridge }
    ).__karaokePlaylists
      .getPlaylistsReactive()
      .map((p) => p.name),
  )
}

test('a signed-in singer saves and reads back their own data while the API holds every request', async ({
  page,
}) => {
  const token = accountToken()
  await seedReturningSinger(page, token)
  await holdTheApi(page)

  await page.goto('/')
  await expect(page.getByTestId('home-lessons')).toBeVisible()
  await page.waitForFunction(() => '__karaokePlaylists' in window)

  const saved = await page.evaluate(
    (ms) =>
      Promise.race([
        (
          window as unknown as { __karaokePlaylists: PlaylistsBridge }
        ).__karaokePlaylists
          .createPlaylist('Kept on this device')
          .then((p) => p.name),
        new Promise<string>((resolve) =>
          setTimeout(() => resolve('still waiting'), ms),
        ),
      ]),
    PROMPTLY_MS,
  )
  expect(saved).toBe('Kept on this device')

  // A lesson page is a document of its own, so Back from it is a reload.
  await page.reload()
  await expect(page.getByTestId('home-lessons')).toBeVisible()
  await page.waitForFunction(() => '__karaokePlaylists' in window)
  await expect
    .poll(() => playlists(page), { timeout: PROMPTLY_MS })
    .toContain('Kept on this device')

  // Out of reach is not signed out: the session stays for when it answers.
  expect(await page.evaluate(() => localStorage.getItem('mp:authToken'))).toBe(
    token,
  )
})

test('the singer is told once that the servers are out of reach, and nothing waits on it', async ({
  page,
}) => {
  await seedReturningSinger(page, accountToken())
  await holdTheApi(page)

  await page.goto('/')
  await expect(page.getByTestId('home-lessons')).toBeVisible()

  // The first call to give up does it: /api/auth/me, at its 8 s deadline.
  const notice = page.getByText(NOTICE)
  await expect(notice).toBeVisible({ timeout: 12_000 })
  await expect(notice).toHaveCount(1)
  // A toast, not a dialog: nothing is held behind it.
  await expect(
    page.getByRole('status').filter({ hasText: NOTICE }),
  ).toHaveCount(1)
  await expect(page.locator('[aria-modal="true"], dialog[open]')).toHaveCount(0)
})

test('once a call finds the servers out of reach, the page stops asking them for a while', async ({
  page,
}) => {
  await seedReturningSinger(page, accountToken())
  await holdTheApi(page)
  const sent = apiRequests(page)

  await page.goto('/')
  await expect(page.getByTestId('home-lessons')).toBeVisible()
  // The first call to give up, at its 8 s deadline, raises the notice.
  await expect(page.getByText(NOTICE)).toBeVisible({ timeout: 12_000 })
  const before = sent.length

  // The Legends view reads the running Legend from the API. Asked now, it
  // is refused at once: the card says it can't reach the server within
  // moments rather than at a deadline of its own, and the API host hears
  // nothing.
  await page.evaluate(() => {
    location.hash = '#/leaderboard'
  })
  await page.getByTestId('legends-tab').click()
  await expect(
    page.getByTestId('legends-showcase').getByTestId('legend-unreachable'),
  ).toBeVisible({ timeout: PROMPTLY_MS })
  expect(sent.slice(before)).toEqual([])
})

test('Try again on the Legend card asks the servers once, even while they are out of reach', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await seedReturningSinger(page, accountToken())
  await holdTheApi(page)
  const sent = apiRequests(page)
  const legendReads = () =>
    sent.filter((path) => path.endsWith('/api/weekly/active')).length

  await page.goto('/')
  // Its first read gives up by its 8 s deadline, which is also what leaves
  // the API alone for a while.
  const retry = page.getByTestId('legend-retry')
  await expect(retry).toBeVisible({ timeout: 12_000 })
  const before = legendReads()

  await retry.click()
  await expect.poll(legendReads).toBe(before + 1)
  // While that read is out the button waits where it is, and pressing it
  // again sends nothing: one press, one request. (Forced: Playwright will not
  // press a button that says it is disabled, and a singer still can.)
  await expect(retry).toHaveAttribute('aria-disabled', 'true')
  await retry.click({ force: true })
  await retry.click({ force: true })
  // Unanswered, it gives up by the same 8 s deadline, and the card still
  // says it can't reach the server.
  await page.waitForEvent('requestfailed', {
    predicate: (request) => request.url().endsWith('/api/weekly/active'),
    timeout: 12_000,
  })
  await expect(page.getByTestId('legend-unreachable')).toBeVisible()
  await expect(retry).not.toHaveAttribute('aria-disabled', 'true')
  expect(legendReads()).toBe(before + 1)
})
