// ============================================================
// A Google sign-up carries the voiceprint that led to it
// ============================================================
//
// The end-to-end half of REQ-VPR-014. The unit suite
// (src/tests/google-signup-voiceprint-adoption.test.ts) pins the rule
// against a mocked service; this drives the real built app through the
// real return fragment and asserts the take actually leaves the browser.
//
// Everything the app would send to the db-worker is answered by
// `page.route()`, so there is no worker, no D1 and no network here — but
// the build has a cloud API configured, which is the one thing the
// default e2e project cannot offer (see playwright.cloud.config.ts).

import { expect, test, type Page, type Route } from '@playwright/test'

const SUMMARY = {
  lowMidi: 48,
  highMidi: 72,
  semitones: 24,
  accuracy: 80,
  steadiness: 85,
}

const TAKEN_AT = '2026-08-20T10:00:00.000Z'
const VOICEPRINT_KEY = 'mercurypitch.voiceprints.v1'

/**
 * A JWT the CLIENT will accept: it only ever decodes the payload for
 * `sub` and `exp` — the signature is the worker's business, and this
 * token never reaches one.
 */
function clientToken(sub: string): string {
  const payload = {
    sub,
    provider: 'google',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const body = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

/** Rows the app POSTed to /api/voiceprints during this test. */
type Uploaded = { userId?: string; takenAt?: string; source?: string }

/**
 * Answer every db-worker call. Voiceprint reads start empty so an adopted
 * take is always "missing" and must be uploaded; writes are recorded.
 * Everything else gets an empty, successful shape — the app boots a lot
 * of stores and a 404 storm would drown the signal under test.
 */
async function mockCloud(page: Page): Promise<Uploaded[]> {
  const uploaded: Uploaded[] = []

  // Order matters, and backwards from how it reads: Playwright tries
  // handlers in REVERSE registration order, so the catch-all has to be
  // registered FIRST or it answers the voiceprint POST itself and the
  // upload under test disappears into it.
  await page.route('**/cloud/api/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: route.request().method() === 'GET' ? '[]' : '{}',
    })
  })

  await page.route('**/cloud/api/voiceprints**', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Uploaded
      uploaded.push(body)
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...body, id: `srv-${uploaded.length}` }),
      })
      return
    }
    // Empty account history, so an adopted take is always "missing" and
    // has to be uploaded rather than deduped away.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    })
  })

  return uploaded
}

/** A take made in the Voice Mirror with nobody signed in. */
async function seedAnonymousTake(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, takenAt, summary]) => {
      localStorage.setItem(
        key as string,
        JSON.stringify([
          {
            id: 'seed-anonymous',
            summary,
            twin: 'Freddie Mercury',
            source: 'onboarding',
            takenAt,
            // No madeBy: exactly what a signed-out capture writes.
          },
        ]),
      )
    },
    [VOICEPRINT_KEY, TAKEN_AT, SUMMARY] as const,
  )
}

/** What the device now believes about who made each take. */
async function localTags(page: Page): Promise<Array<string | undefined>> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (raw === null) return []
    return (JSON.parse(raw) as Array<{ madeBy?: string }>).map((r) => r.madeBy)
  }, VOICEPRINT_KEY)
}

test.describe('Google sign-up adoption', () => {
  test('a first-time Google account keeps the take made before it existed', async ({
    page,
  }) => {
    const uploaded = await mockCloud(page)
    await seedAnonymousTake(page)

    // Exactly what the worker's callback redirects to on a first sign-in.
    await page.goto(`/#gauth=${clientToken('google-user-1')}&gauth_new=1`)

    await expect
      .poll(() => uploaded.length, { timeout: 10_000 })
      .toBeGreaterThan(0)

    expect(uploaded[0].takenAt).toBe(TAKEN_AT)
    expect(uploaded[0].userId).toBe('google-user-1')
    expect(await localTags(page)).toEqual(['google-user-1'])
  })

  test('a returning Google user leaves the take unclaimed', async ({
    page,
  }) => {
    const uploaded = await mockCloud(page)
    await seedAnonymousTake(page)

    // Same arrival, no gauth_new: the worker resolved an account that
    // already existed, so this take is somebody's to offer, not to take.
    await page.goto(`/#gauth=${clientToken('google-user-1')}`)

    // Give the auth effect the same room the positive case gets, so this
    // asserts "never uploaded" rather than "not uploaded yet".
    await page.waitForTimeout(3_000)

    expect(uploaded).toHaveLength(0)
    expect(await localTags(page)).toEqual([undefined])
  })

  test('a take already tagged to another account is never adopted', async ({
    page,
  }) => {
    const uploaded = await mockCloud(page)
    await page.addInitScript(
      ([key, takenAt, summary]) => {
        localStorage.setItem(
          key as string,
          JSON.stringify([
            {
              id: 'seed-foreign',
              summary,
              twin: null,
              source: 'mirror',
              takenAt,
              madeBy: 'someone-else',
            },
          ]),
        )
      },
      [VOICEPRINT_KEY, TAKEN_AT, SUMMARY] as const,
    )

    await page.goto(`/#gauth=${clientToken('google-user-2')}&gauth_new=1`)
    await page.waitForTimeout(3_000)

    expect(uploaded).toHaveLength(0)
    expect(await localTags(page)).toEqual(['someone-else'])
  })
})
