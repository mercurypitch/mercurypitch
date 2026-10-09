// ============================================================
// Every page that takes a Google return takes only its own
// ============================================================
//
// Login CSRF, end to end. The worker hands a Google sign-in back in the URL
// fragment, and a fragment is a link anyone can write, so a link holding the
// sender's own session used to sign whoever opened it in to the sender's
// account. Four documents take a Google return: the main app, Karaoke Night,
// Guitar Night and Drum Night. Each must refuse a return this browser never
// started and keep one it did, which is the nonce the app kept when it
// started the sign-in (src/lib/google-return-nonce.ts).
//
// Built with a cloud API configured (playwright.cloud.config.ts), and every
// call to it answered here, so no worker and no network are involved.

import { expect, test, type Page, type Route } from '@playwright/test'

const NONCE = 'e2e-started-here-0123456789abcdefghijklmnop'

/** A JWT the client accepts: it decodes `sub` and `exp`, nothing more. */
function clientToken(sub: string): string {
  const payload = {
    sub,
    provider: 'google',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${body}.signature`
}

/** Answer every API call with an empty success, so nothing signs out. */
async function quietCloud(page: Page): Promise<void> {
  await page.route('**/cloud/api/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: route.request().method() === 'GET' ? '[]' : '{}',
    })
  })
}

/** Leave the browser as starting a Google sign-in leaves it. */
async function startSignInHere(page: Page): Promise<void> {
  await page.addInitScript((nonce) => {
    localStorage.setItem(
      'mp:gauthPending',
      JSON.stringify({ nonce, expiresAt: Date.now() + 10 * 60 * 1000 }),
    )
  }, NONCE)
}

/** Open `url`, wait for the page to take the fragment, and read the session. */
async function land(page: Page, url: string): Promise<string | null> {
  await page.goto(url)
  await expect
    .poll(() => page.evaluate(() => window.location.hash))
    .not.toContain('gauth')
  return page.evaluate(() => localStorage.getItem('mp:authToken'))
}

const PAGES = [
  { name: 'the main app', path: '/' },
  { name: 'Karaoke Night', path: '/karaoke' },
  { name: 'Guitar Night', path: '/guitar-night' },
  { name: 'Drum Night', path: '/drum-night' },
]

for (const { name, path } of PAGES) {
  test.describe(name, () => {
    test('refuses a session it never asked for', async ({ page }) => {
      await quietCloud(page)

      const stored = await land(
        page,
        `${path}#gauth=${clientToken('sender')}&gauth_new=1`,
      )

      expect(stored).toBeNull()
    })

    test('keeps the session from the sign-in it started', async ({ page }) => {
      await quietCloud(page)
      await startSignInHere(page)
      const token = clientToken('singer')

      const stored = await land(
        page,
        `${path}#gauth=${token}&gauth_nonce=${NONCE}`,
      )

      expect(stored).toBe(token)
    })
  })
}
