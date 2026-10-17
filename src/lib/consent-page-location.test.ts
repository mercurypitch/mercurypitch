// ── page_location never carries the URL fragment ──────────────────────
//
// The app is hash-routed, so a one-time credential can sit in location.hash
// while gtag.js loads: a password-reset token (#/reset-password?token=…) or
// the Google redirect JWT (#gauth=…). gtag's default page_location is the full
// href, which would hand that secret to Google on the first `config` hit.
//
// Two layers are pinned here. The helper that strips the fragment is tested on
// its own, and then initConsent() is run with IS_TEST switched off (the real
// defaults module is mocked only for the four values consent.ts reads) so the
// actual `config` pushes on the dataLayer are inspected — the guard that
// normally keeps gtag out of tests is exactly what would otherwise leave this
// line unexercised.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  IS_TEST: false,
  GA4_MEASUREMENT_ID: 'G-TEST',
  GOOGLE_ADS_TAG_ID: 'AW-TEST',
  CONSENT_PREVIEW: false,
}))

import { initConsent, locationWithoutFragment } from '@/lib/consent'

interface GtagWindow extends Window {
  dataLayer?: unknown[]
  gtag?: unknown
  __mpConsentBooted?: boolean
}

const w = window as unknown as GtagWindow

/** The dataLayer's `config` commands, as [command, id, params] tuples. */
function configPushes(): Array<[string, string, Record<string, unknown>]> {
  return (w.dataLayer ?? [])
    .map((entry) => Array.from(entry as ArrayLike<unknown>))
    .filter((args) => args[0] === 'config')
    .map((args) => args as [string, string, Record<string, unknown>])
}

function visit(path: string): void {
  history.replaceState(null, '', path)
}

beforeEach(() => {
  delete w.dataLayer
  delete w.gtag
  delete w.__mpConsentBooted
  localStorage.clear()
})

afterEach(() => {
  delete w.dataLayer
  delete w.gtag
  delete w.__mpConsentBooted
  for (const script of Array.from(document.head.querySelectorAll('script'))) {
    script.remove()
  }
  visit('/')
})

describe('locationWithoutFragment', () => {
  it('drops a reset-password token carried in the hash, keeps the search', () => {
    visit('/path/?mp_internal=1#/reset-password?token=SECRET')
    const result = locationWithoutFragment()
    expect(result).toBe(`${window.location.origin}/path/?mp_internal=1`)
    expect(result).not.toContain('#')
    expect(result).not.toContain('SECRET')
  })

  it('drops the Google redirect JWT carried in the hash', () => {
    visit('/?x=1#gauth=JWT.VALUE&gauth_nonce=n')
    const result = locationWithoutFragment()
    expect(result).toBe(`${window.location.origin}/?x=1`)
    expect(result).not.toContain('#')
    expect(result).not.toContain('JWT.VALUE')
  })

  it('returns origin, path and search unchanged when there is no hash', () => {
    visit('/mirror?v=abc')
    expect(locationWithoutFragment()).toBe(
      `${window.location.origin}/mirror?v=abc`,
    )
  })
})

describe('the gtag config pushes', () => {
  it('carry page_location without the fragment, for Ads and GA4 alike', () => {
    visit('/?mp_internal=1#/reset-password?token=SECRET')

    initConsent()

    const configs = configPushes()
    expect(configs.map(([, id]) => id).sort()).toEqual(['AW-TEST', 'G-TEST'])
    for (const [, , params] of configs) {
      expect(params.page_location).toBe(locationWithoutFragment())
      expect(params.page_location).toBe(
        `${window.location.origin}/?mp_internal=1`,
      )
      expect(String(params.page_location)).not.toContain('#')
      expect(String(params.page_location)).not.toContain('SECRET')
    }
  })

  it('never puts the raw href, and so the token, anywhere on the dataLayer', () => {
    visit('/#gauth=JWT.VALUE')

    initConsent()

    const flattened = JSON.stringify(
      (w.dataLayer ?? []).map((entry) =>
        Array.from(entry as ArrayLike<unknown>),
      ),
    )
    expect(flattened).not.toContain('JWT.VALUE')
    expect(flattened).not.toContain('#gauth')
    // And the tag itself was asked for, so this ran the real loadTag path.
    expect(
      document.head.querySelector(
        'script[src^="https://www.googletagmanager.com/gtag/js"]',
      ),
    ).not.toBeNull()
  })
})
