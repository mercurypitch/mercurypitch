// ── Signing a television in by scanning it ───────────────────────────
//
// The cheaper of the two device specs, and deliberately first: no WebRTC,
// two contexts of one browser, and the more security-sensitive flow of the
// pair. A code on a screen is not a credential, and the only way to show
// that is to try using one as if it were.
//
// The unit tests cover both halves in isolation — `PhoneSignIn.test.tsx`,
// `DeviceLinkModal.test.tsx`, and the worker's own `auth.test.ts` for
// start/poll/approve. What none of them span is the seam: the TV's poll
// token and the phone's session are held by two different browsers, and
// they meet only in D1.
//
// Needs the db-worker. See docs/agent/TWO-DEVICE-E2E.md.

import type { Browser, BrowserContextOptions } from '@playwright/test'
import { expect, test } from '@playwright/test'
import type { Device } from './helpers/devices'
import { contextDevice, openApp } from './helpers/devices'

const AUTH_TOKEN_KEY = 'mp:authToken'

interface Account {
  email: string
  password: string
  name: string
}

/**
 * Two accounts, fixed across runs, reused rather than re-created.
 *
 * A fresh email per run was the obvious thing and the wrong one:
 * registration is capped at five per five minutes per address, which one
 * run of this file spends and a second run inside the window cannot
 * afford. Two runs back to back then fail on the rate limiter rather than
 * on anything the specs are about. The local D1 keeps these between runs,
 * so `signIn` registers each of them exactly once, ever.
 */
const OWNER: Account = {
  email: 'e2e-devices-owner@example.invalid',
  password: 'Sings-In-Tune-2026',
  name: 'E2E Owner Phone',
}

const STRANGER: Account = {
  email: 'e2e-devices-stranger@example.invalid',
  password: 'Sings-In-Tune-2026',
  name: 'E2E Other Phone',
}

/** The account this browser holds, or null — read from the token itself. */
async function accountOf(device: Device): Promise<string | null> {
  return device.page.evaluate((key) => {
    const token = localStorage.getItem(key)
    if (token == null || token === '') return null
    const body = token.split('.')[1]
    if (body === undefined) return null
    try {
      const claims = JSON.parse(
        atob(body.replace(/-/g, '+').replace(/_/g, '/')),
      ) as { provider?: string; sub?: string }
      return claims.provider === 'anonymous' ? null : (claims.sub ?? null)
    } catch {
      return null
    }
  }, AUTH_TOKEN_KEY)
}

/**
 * Sign-ins already made, by email.
 *
 * Kept for the life of the worker process so a whole file — and a whole
 * `--repeat-each` run — costs one sign-in per account rather than one per
 * test. The limiter allows ten per five minutes, which three tests
 * signing in twice apiece will spend before the third run finishes.
 */
const sessions = new Map<string, string>()

/**
 * A phone already holding `account`, without asking the worker again if
 * this process has signed that account in before.
 */
async function signedInDevice(
  browser: Browser,
  name: string,
  account: Account,
): Promise<Device> {
  const saved = sessions.get(account.email)
  if (saved !== undefined) {
    const device = await contextDevice(
      browser,
      name,
      JSON.parse(saved) as BrowserContextOptions['storageState'],
    )
    await openApp(device, '#/')
    await expect
      .poll(() => accountOf(device), { timeout: 20_000 })
      .not.toBeNull()
    return device
  }
  const device = await contextDevice(browser, name)
  await signIn(device, account)
  sessions.set(
    account.email,
    JSON.stringify(await device.context.storageState()),
  )
  return device
}

/** Wait for a real account, returning null if none turns up in time. */
async function waitForAccount(
  device: Device,
  ms: number,
): Promise<string | null> {
  const deadline = Date.now() + ms
  for (;;) {
    const id = await accountOf(device)
    if (id !== null) return id
    if (Date.now() >= deadline) return null
    await device.page.waitForTimeout(250)
  }
}

/**
 * Put a real account on this device: sign in, or register if this is the
 * first time these specs have ever run against this database.
 */
async function signIn(
  device: Device,
  account: Account,
): Promise<string | null> {
  await openApp(device, '#/')
  await openAuthModal(device, 'login')
  await device.page.getByTestId('auth-email').fill(account.email)
  await device.page.getByTestId('auth-password').fill(account.password)
  await device.page.getByTestId('auth-submit').click()

  // Poll `accountOf` rather than "is there a token": a device that has
  // written anything already holds an ANONYMOUS token, and waiting for one
  // to exist is satisfied instantly by an identity that is not an account.
  if ((await waitForAccount(device, 10_000)) === null) {
    await openAuthModal(device, 'register')
    await device.page.getByTestId('auth-display-name').fill(account.name)
    await device.page.getByTestId('auth-email').fill(account.email)
    await device.page.getByTestId('auth-password').fill(account.password)
    await device.page.getByTestId('auth-submit').click()
  }

  await expect.poll(() => accountOf(device), { timeout: 30_000 }).not.toBeNull()
  return accountOf(device)
}

async function openAuthModal(device: Device, pane: string): Promise<void> {
  await device.page.evaluate((which) => {
    const pp = window as unknown as {
      __pp?: { appStore?: { openAuthModal?: (p: string) => void } }
    }
    pp.__pp?.appStore?.openAuthModal?.(which)
  }, pane)
}

test.describe('signing in with a phone', () => {
  // `wrangler dev` falls over from time to time, and when it does every
  // assertion in this file fails as "no account appeared" — which reads as
  // a broken sign-in rather than as a missing worker. Ask it directly, and
  // say so.
  test.beforeAll(async ({ request }) => {
    const api = process.env.E2E_DEVICES_API ?? 'http://localhost:8788'
    // A GET at a route that does not exist. Any answer at all proves the
    // worker is up, and unlike a probe login it does not spend one of the
    // ten sign-ins per five minutes these specs are already close to.
    const res = await request
      .get(`${api}/api/health`, { failOnStatusCode: false })
      .catch(() => null)
    expect(
      res,
      `The db-worker is not answering on ${api}. Start it with: cd workers/db-worker && npx wrangler dev --port 8788 --var JWT_SECRET:e2e-local-secret`,
    ).not.toBeNull()
  })

  test('the phone approves, and only then does the television get in', async ({
    browser,
  }) => {
    const tv = await contextDevice(browser, 'tv')
    const phone = await signedInDevice(browser, 'phone', OWNER)

    try {
      // ── The phone gets an account of its own ───────────────────────
      const phoneAccount = await accountOf(phone)
      expect(phoneAccount).not.toBeNull()

      // ── The television asks ────────────────────────────────────────
      await openApp(tv, '#/')
      expect(await accountOf(tv)).toBeNull()
      await openAuthModal(tv, 'login')
      await tv.page.getByTestId('auth-phone').click()
      const code = (
        await tv.page.getByTestId('phone-sign-in-code').innerText()
      ).replace(/\s+/g, '')
      expect(code).toMatch(/^[A-Z0-9]{8}$/)

      // The property the worker tests assert and the integration never
      // has: the code is public — it is on a screen — so holding it must
      // buy nothing on its own. Two poll intervals is long enough that a
      // TV which signed itself in would have done so by now.
      await tv.page.waitForTimeout(6000)
      expect(await accountOf(tv)).toBeNull()
      await expect(tv.page.getByTestId('phone-sign-in-waiting')).toBeVisible()

      // ── The phone is shown the request, and confirms it ────────────
      // Following the link only ASKS. Anything else and a link somebody
      // can be sent would sign in a device they have never seen.
      await phone.page.goto(
        `${new URL(phone.page.url()).origin}/#/link:${code}`,
      )
      await expect(phone.page.getByTestId('device-link-modal')).toBeVisible()
      await expect(phone.page.getByTestId('device-link-ask')).toBeVisible()
      expect(await accountOf(tv)).toBeNull()

      await phone.page.getByTestId('device-link-approve').click()
      await expect(phone.page.getByTestId('device-link-approved')).toBeVisible()

      // ── And the television is in, as the phone's account ───────────
      await expect
        .poll(() => accountOf(tv), { timeout: 30_000 })
        .toBe(phoneAccount)
    } finally {
      await tv.close()
      await phone.close()
    }
  })

  test('a spent code cannot be replayed by somebody else', async ({
    browser,
  }) => {
    const tv = await contextDevice(browser, 'tv')
    const phone = await signedInDevice(browser, 'phone', OWNER)
    let other: Device | null = null

    try {
      await openApp(tv, '#/')
      await openAuthModal(tv, 'login')
      await tv.page.getByTestId('auth-phone').click()
      const code = (
        await tv.page.getByTestId('phone-sign-in-code').innerText()
      ).replace(/\s+/g, '')

      const origin = new URL(phone.page.url()).origin
      await phone.page.goto(`${origin}/#/link:${code}`)
      await phone.page.getByTestId('device-link-approve').click()
      await expect(phone.page.getByTestId('device-link-approved')).toBeVisible()
      await expect.poll(() => accountOf(tv), { timeout: 30_000 }).not.toBeNull()

      // The code was on a screen, so assume it was read. A second person
      // holding it must be told it is spent rather than being offered the
      // chance to attach a television to their own account instead — or,
      // worse, to the first person's. `claimedAt` is what makes it
      // single-use, and the TV's successful poll is what sets it.
      other = await signedInDevice(browser, 'other-phone', STRANGER)
      await other.page.goto(`${origin}/#/link:${code}`)
      await expect(other.page.getByTestId('device-link-stale')).toBeVisible()
      await expect(other.page.getByTestId('device-link-approve')).toHaveCount(0)
    } finally {
      await tv.close()
      await phone.close()
      await other?.close()
    }
  })
})
