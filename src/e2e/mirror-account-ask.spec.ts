// ============================================================
// Voice Mirror — the account ask under the results.
//
// The owner's rule (11 Oct 2026), against the built page: a browser with no
// account is asked after the first voiceprint and after another one, last
// under the shares; a signed-in account and a signed-out one this browser
// remembers are never asked; and a tap opens the account dialog on its
// sign-up pane, counted once. The default e2e build has no API, so nothing
// here signs anybody up: src/e2e-cloud/mirror-account-ask.spec.ts does that
// against a mocked worker.
// ============================================================
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

function glide(from: number, to: number) {
  return Array.from({ length: 25 }, (_, i) => ({
    t: i * 0.32,
    f0: midiToFreq(from + ((to - from) * i) / 24),
    conf: 0.95,
  }))
}

/** A saved take, as src/lib/mirror/attempts.ts stores one. */
function attempt(n: number): Record<string, unknown> {
  return {
    n,
    savedAt: 1_700_000_000_000 + n,
    deltaLine: `TAKE-${n}`,
    glides: [glide(48, 74), glide(74, 48)],
    result: {
      range: {
        lowMidi: 48,
        highMidi: 74,
        lowNote: 'C3',
        highNote: 'D5',
        semitones: 26,
        qualifyingMidis: Array.from({ length: 27 }, (_, i) => 48 + i),
        voiceHint: 'Tenor',
      },
      accuracy: null,
      steadiness: null,
    },
  }
}

async function seedTakes(page: Page): Promise<void> {
  await page.addInitScript(
    (json: string) => localStorage.setItem('mirror.attempts.v1', json),
    JSON.stringify([attempt(1), attempt(2)]),
  )
}

/** A session token the client accepts: it only ever decodes the payload. */
function accountToken(): string {
  const payload = {
    sub: 'e2e-account',
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

/** The Mirror's funnel events this browser recorded, in order. */
async function funnelEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('mirror.funnel.v1')
    if (raw === null) return []
    return (JSON.parse(raw) as Array<{ event: string }>).map((e) => e.event)
  })
}

const ASK = 'mirror-account-ask'

test('asks a browser with no account, last under the shares', async ({
  page,
}) => {
  await seedTakes(page)
  await page.goto('/vocal-range-test#take-1')

  const ask = page.getByTestId(ASK)
  await expect(ask).toBeVisible()
  await expect(
    ask.getByRole('heading', { name: 'Keep your voiceprints' }),
  ).toBeVisible()
  await expect(page.locator('.mirror-results > :last-child')).toHaveAttribute(
    'data-testid',
    ASK,
  )
})

test('asks again on another voiceprint', async ({ page }) => {
  await seedTakes(page)
  await page.goto('/mirror#take-2')

  await expect(page.locator('.mirror-delta')).toHaveText('TAKE-2')
  await expect(page.getByTestId(ASK)).toBeVisible()
})

test('a tap opens the sign-up form and is counted once', async ({ page }) => {
  await seedTakes(page)
  await page.goto('/vocal-range-test#take-1')

  await page.getByRole('button', { name: 'Create my free account' }).click()

  await expect(
    page.getByRole('dialog', { name: 'Create your account' }),
  ).toBeVisible()
  const events = await funnelEvents(page)
  expect(events.filter((e) => e === 'cta_account_click')).toHaveLength(1)
  // Restoring a take is not a finished run: no results_view, before or after.
  expect(events).not.toContain('results_view')
})

test('never asks a signed-in account', async ({ page }) => {
  await seedTakes(page)
  await page.addInitScript(
    (token: string) => localStorage.setItem('mp:authToken', token),
    accountToken(),
  )
  await page.goto('/vocal-range-test#take-1')

  await expect(page.locator('.mirror-delta')).toHaveText('TAKE-1')
  await expect(page.getByTestId(ASK)).toHaveCount(0)
})

test('never asks a signed-out account this browser remembers', async ({
  page,
}) => {
  await seedTakes(page)
  // How this browser last signed in (src/lib/last-sign-in.ts): the method,
  // stored as the bare word, kept through a sign-out on purpose.
  await page.addInitScript(() =>
    localStorage.setItem('pitchperfect_last_sign_in', 'google'),
  )
  await page.goto('/vocal-range-test#take-1')

  await expect(page.locator('.mirror-delta')).toHaveText('TAKE-1')
  await expect(page.getByTestId(ASK)).toHaveCount(0)
})
