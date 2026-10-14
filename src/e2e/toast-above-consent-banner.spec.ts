// ============================================================
// On a phone, toasts stand above the cookie consent banner
// ============================================================
//
// Both live at the foot of a phone screen: the toast stack sits just above the
// tab bar, and the consent banner sits 1rem off the bottom edge at the highest
// z-index on the page. A new visitor in Europe has the banner open until they
// answer it, so every toast raised in that time was drawn underneath it. On
// 14 Oct 2026 the owner signed up with Google from the onboarding Map and saw
// no word of the launch gift. A production build at 390px with a Europe clock
// showed why: "Signed in with Google" and "5 credits added. Try one in Karaoke
// Night." were both raised, and both were under the banner.
//
// The e2e build ships no Google tag, so the real banner never mounts here. It
// is stood in for by what it publishes while open, `--consent-banner-space` on
// <html> (ConsentBanner.tsx, publishSpace), plus a box of that height at the
// foot of the window. A failed Google return raises the toast: it is a toast
// the app raises on load with no cloud API.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/** The banner's footprint at 390px: three lines of copy and two buttons,
 *  plus its 16px gap to the window's foot. */
const BANNER_SPACE = 176

test.use({ viewport: { width: 390, height: 844 } })

async function raiseGoogleFailureToast(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
    // The return counts only for the browser that started it
    // (google-return-nonce.ts), so this one has.
    localStorage.setItem(
      'mp:gauthPending',
      JSON.stringify({ nonce: 'e2e-nonce', expiresAt: Date.now() + 600_000 }),
    )
  })
  await page.goto('/#gauth_error=access_denied&gauth_nonce=e2e-nonce')
}

async function standInForBanner(page: Page, space: number): Promise<void> {
  await page.evaluate((px) => {
    document.documentElement.style.setProperty(
      '--consent-banner-space',
      `${px}px`,
    )
    const banner = document.createElement('section')
    banner.id = 'e2e-consent-stand-in'
    banner.style.cssText = `position:fixed;left:16px;right:16px;bottom:16px;height:${px - 16}px;z-index:2147483000;background:#222`
    document.body.appendChild(banner)
  }, space)
}

test('a toast raised while the consent banner is open stands clear of it @smoke', async ({
  page,
}) => {
  await raiseGoogleFailureToast(page)
  const toast = page.getByRole('alert').filter({
    hasText: 'Google sign-in failed',
  })
  await expect(toast).toBeVisible()

  await standInForBanner(page, BANNER_SPACE)

  await expect
    .poll(async () => {
      const box = await toast.boundingBox()
      return box === null ? null : Math.round(box.y + box.height)
    })
    .toBeLessThanOrEqual(844 - BANNER_SPACE)
})

test('with no banner, toasts keep their place just above the tab bar', async ({
  page,
}) => {
  await raiseGoogleFailureToast(page)
  const toast = page.getByRole('alert').filter({
    hasText: 'Google sign-in failed',
  })
  await expect(toast).toBeVisible()

  // Polled: the toast slides up 10px as it enters, and visible already holds
  // on its first frame, when its foot is still below where it settles.
  const foot = async (): Promise<number | null> => {
    const box = await toast.boundingBox()
    return box === null ? null : Math.round(box.y + box.height)
  }
  // Above the tab bar (54px plus a 0.6rem gap), and no higher than the
  // banner's room would put it.
  await expect.poll(foot).toBeLessThanOrEqual(844 - 54)
  expect(await foot()).toBeGreaterThan(844 - BANNER_SPACE)
})
