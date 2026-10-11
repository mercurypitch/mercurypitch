// ============================================================
// The Voice Mirror's account ask, against a mocked worker
// ============================================================
//
// The end-to-end half of REQ-VPR-023. The default e2e build has no API, so
// signing up from the ask can only be driven here (playwright.cloud.config.ts):
// the build believes in a cloud, and `page.route()` answers every call, so
// there is no worker, no D1, no mail and no real account. What it shows in the
// built page: a password sign-up from the ask takes the voiceprint on screen
// into the new account; a Google sign-up started from the ask leaves with the
// voiceprint hint and comes back to the same results with the take adopted;
// and the launch gift is named while the server features one.

import { expect, test, type Page, type Route } from '@playwright/test'

const VOICEPRINT_KEY = 'mercurypitch.voiceprints.v1'
const TAKEN_AT = '2026-10-11T08:00:00.000Z'
const NONCE = 'e2e-mirror-started-here-0123456789abcdefghijk'

/** A JWT the client accepts: it only ever decodes the payload. */
function clientToken(sub: string, provider: string): string {
  const payload = {
    sub,
    provider,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const body = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

function glide(from: number, to: number) {
  return Array.from({ length: 25 }, (_, i) => ({
    t: i * 0.32,
    f0: midiToFreq(from + ((to - from) * i) / 24),
    conf: 0.95,
  }))
}

/**
 * What a finished, signed-out Mirror run leaves in the browser: the take the
 * results restore from (#take-1), and the voiceprint record beside it, tagged
 * as made with nobody signed in.
 */
async function seedSignedOutRun(page: Page): Promise<void> {
  const take = {
    n: 1,
    savedAt: Date.parse(TAKEN_AT),
    deltaLine: 'TAKE-1',
    glides: [glide(48, 72), glide(72, 48)],
    result: {
      range: {
        lowMidi: 48,
        highMidi: 72,
        lowNote: 'C3',
        highNote: 'C5',
        semitones: 24,
        qualifyingMidis: Array.from({ length: 25 }, (_, i) => 48 + i),
        voiceHint: 'Tenor',
      },
      accuracy: null,
      steadiness: null,
    },
  }
  const voiceprint = {
    id: 'mirror-take-1',
    summary: {
      lowMidi: 48,
      highMidi: 72,
      semitones: 24,
      accuracy: null,
      steadiness: null,
    },
    twin: 'Freddie Mercury',
    source: 'mirror',
    takenAt: TAKEN_AT,
    madeBy: 'anonymous',
  }
  await page.addInitScript(
    ([key, attempts, records]) => {
      localStorage.setItem('mirror.attempts.v1', attempts)
      localStorage.setItem(key, records)
    },
    [
      VOICEPRINT_KEY,
      JSON.stringify([take]),
      JSON.stringify([voiceprint]),
    ] as const,
  )
}

type Uploaded = { userId?: string; takenAt?: string; source?: string }
type Sent = Record<string, unknown>

interface Cloud {
  uploaded: Uploaded[]
  registered: Sent[]
  googleStarts: Sent[]
}

const GIFT = {
  code: 'E2E-LAUNCH',
  credits: 5,
  expiresAt: '2027-01-01T00:00:00.000Z',
}

/**
 * Answer every db-worker call. Handlers are tried in REVERSE registration
 * order, so the catch-all goes first (see
 * google-signup-voiceprint-adoption.spec.ts).
 */
async function mockCloud(page: Page): Promise<Cloud> {
  const cloud: Cloud = { uploaded: [], registered: [], googleStarts: [] }
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })

  await page.route('**/cloud/api/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: route.request().method() === 'GET' ? '[]' : '{}',
    })
  })
  await page.route('**/cloud/api/voiceprints**', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Uploaded
      cloud.uploaded.push(body)
      await json(route, 201, { ...body, id: `srv-${cloud.uploaded.length}` })
      return
    }
    await json(route, 200, [])
  })
  await page.route('**/cloud/api/billing/promo/featured', (route) =>
    json(route, 200, { promo: GIFT }),
  )
  await page.route('**/cloud/api/auth/register', async (route) => {
    cloud.registered.push(route.request().postDataJSON() as Sent)
    await json(route, 200, {
      token: clientToken('mirror-new-account', 'password'),
      userId: 'mirror-new-account',
      isNew: true,
      user: {
        id: 'mirror-new-account',
        createdAt: TAKEN_AT,
        updatedAt: TAKEN_AT,
        authProvider: 'password',
        email: 'mirror-ask@example.test',
        emailVerified: false,
        lastLoginAt: null,
        isTestAccount: false,
        testAccountExpiresAt: null,
      },
    })
  })
  await page.route('**/cloud/api/auth/google/start', async (route) => {
    cloud.googleStarts.push(route.request().postDataJSON() as Sent)
    await json(route, 200, {
      url: new URL('/e2e-google-consent', route.request().url()).href,
    })
  })
  await page.route('**/e2e-google-consent', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<p>Google</p>',
    }),
  )
  // A build with a Turnstile key waits for a token: hand it one at once.
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `window.turnstile = {
        render: (el, opts) => { setTimeout(() => opts.callback('e2e-token'), 0); return 'w1' },
        reset: () => {},
        remove: () => {},
      }`,
    }),
  )
  return cloud
}

/** Who the browser now believes made each take. */
async function localTags(page: Page): Promise<Array<string | undefined>> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (raw === null) return []
    return (JSON.parse(raw) as Array<{ madeBy?: string }>).map((r) => r.madeBy)
  }, VOICEPRINT_KEY)
}

const ASK = 'mirror-account-ask'

test.describe('the Voice Mirror account ask', () => {
  test('a password sign-up from the ask takes the voiceprint into the account', async ({
    page,
  }) => {
    const cloud = await mockCloud(page)
    await seedSignedOutRun(page)
    await page.goto('/vocal-range-test#take-1')

    await expect(page.getByTestId('mirror-account-gift')).toContainText(
      '5 free Karaoke Night credits',
    )
    await page.getByRole('button', { name: 'Create my free account' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create your account' })
    await dialog.getByTestId('auth-email').fill('mirror-ask@example.test')
    await dialog.getByTestId('auth-password').fill('mirror-e2e-pass-1')
    await dialog.getByTestId('auth-submit').click()

    await expect
      .poll(() => cloud.uploaded.length, { timeout: 10_000 })
      .toBeGreaterThan(0)
    expect(cloud.uploaded[0]).toMatchObject({
      userId: 'mirror-new-account',
      takenAt: TAKEN_AT,
      source: 'mirror',
    })
    expect(await localTags(page)).toEqual(['mirror-new-account'])
    // The first mail may name the twin: the sign-up carried the hint.
    expect(cloud.registered[0].voiceprintHint).toMatchObject({
      twin: 'Freddie Mercury',
    })
    await expect(
      page.getByText('Confirm your email and your 5 credits arrive.'),
    ).toBeVisible()
    await expect(page.getByTestId(ASK)).toHaveCount(0)
  })

  test('Google sign-in from the ask leaves with the hint and the way back', async ({
    page,
  }) => {
    const cloud = await mockCloud(page)
    await seedSignedOutRun(page)
    await page.goto('/vocal-range-test#take-1')

    await page.getByRole('button', { name: 'Create my free account' }).click()
    await page.getByTestId('auth-google').click()

    await expect(page).toHaveURL(/\/e2e-google-consent$/)
    expect(cloud.googleStarts[0]).toMatchObject({
      returnTo: expect.stringMatching(/\/vocal-range-test$/),
      voiceprintHint: { twin: 'Freddie Mercury' },
    })
    expect(
      await page.evaluate(() => localStorage.getItem('mp:gauthReturnHash')),
    ).toBe('#take-1')
  })

  test('a Google sign-up comes back to the same results, take adopted', async ({
    page,
  }) => {
    const cloud = await mockCloud(page)
    await seedSignedOutRun(page)
    // As tapping "Continue with Google" left the browser.
    await page.addInitScript((nonce) => {
      localStorage.setItem(
        'mp:gauthPending',
        JSON.stringify({ nonce, expiresAt: Date.now() + 10 * 60 * 1000 }),
      )
      localStorage.setItem('mp:gauthReturnHash', '#take-1')
    }, NONCE)

    await page.goto(
      `/vocal-range-test#gauth=${clientToken('mirror-google-account', 'google')}&gauth_new=1&gauth_nonce=${NONCE}`,
    )

    await expect(page.locator('.mirror-delta')).toHaveText('TAKE-1')
    expect(new URL(page.url()).hash).toBe('#take-1')
    await expect(page.getByText('Signed in with Google')).toBeVisible()
    await expect
      .poll(() => cloud.uploaded.length, { timeout: 10_000 })
      .toBeGreaterThan(0)
    expect(cloud.uploaded[0]).toMatchObject({
      userId: 'mirror-google-account',
      takenAt: TAKEN_AT,
    })
    await expect(page.getByTestId(ASK)).toHaveCount(0)
  })
})
