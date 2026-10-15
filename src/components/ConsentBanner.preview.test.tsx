// ============================================================
// Consent preview: the cookie bar on dev and PR previews, with no Google tag
// ============================================================
//
// dev.mercurypitch.com and PR previews build without a Google tag, so before
// CONSENT_PREVIEW they never mounted the bar and nobody could check how it
// stacks on a phone. With the flag on and no tag, the bar mounts and behaves
// as production's does for the visitor, and nothing reaches Google: no
// gtag.js, no gtag(), nothing on the dataLayer.
//
// IS_TEST is false here on purpose. The production suites keep it true so a
// real gtag.js is never requested; this suite needs the script loader to be
// live, or "no script was injected" would prove nothing.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface TagWindow {
  dataLayer?: unknown[]
  gtag?: unknown
  __mpConsentBooted?: boolean
}

function tagWindow(): TagWindow {
  return window as unknown as TagWindow
}

function mockBuild(flags: { tag: boolean; preview: boolean }): void {
  vi.doMock('@/lib/defaults', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    GOOGLE_ADS_TAG_ID: flags.tag ? 'AW-TEST' : '',
    GA4_MEASUREMENT_ID: flags.tag ? 'G-TEST' : '',
    IS_TEST: flags.tag,
    CONSENT_PREVIEW: flags.preview,
  }))
}

function mockTimezone(tz: string): void {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () =>
      ({ resolvedOptions: () => ({ timeZone: tz }) }) as unknown as ReturnType<
        typeof Intl.DateTimeFormat
      >,
  )
}

/** Boot the page as an entry point does, for a given build and clock. */
async function setup(
  flags: { tag: boolean; preview: boolean },
  tz = 'Europe/Zagreb',
) {
  mockBuild(flags)
  mockTimezone(tz)
  const consent = await import('@/lib/consent')
  const { setupConsent } = await import('./ConsentBanner')
  setupConsent()
  return consent
}

function googleScripts(): Element[] {
  return [...document.querySelectorAll('script')].filter((s) =>
    /google/i.test(s.getAttribute('src') ?? ''),
  )
}

/** Nothing Google would receive: no gtag, no queued command. */
function expectNothingForGoogle(): void {
  expect(googleScripts()).toEqual([])
  expect(tagWindow().gtag).toBeUndefined()
  expect(tagWindow().dataLayer ?? []).toEqual([])
}

const bannerSpace = (): string =>
  document.documentElement.style.getPropertyValue('--consent-banner-space')

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  const w = tagWindow()
  delete w.__mpConsentBooted
  delete w.gtag
  delete w.dataLayer
  document.getElementById('mp-consent-root')?.remove()
})

afterEach(() => {
  cleanup()
  document.getElementById('mp-consent-root')?.remove()
  for (const s of googleScripts()) s.remove()
  vi.doUnmock('@/lib/defaults')
  vi.restoreAllMocks()
})

describe('consent preview (flag on, no Google tag)', () => {
  it('mounts the bar for a European clock and sends Google nothing', async () => {
    const consent = await setup({ tag: false, preview: true })

    expect(document.getElementById('mp-consent-root')).not.toBeNull()
    expect(consent.isConsentBannerOpen()).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Cookie consent' })).toBeTruthy()
    expect(consent.canReopenConsent()).toBe(true)
    expect(bannerSpace()).toMatch(/^\d+px$/)
    expectNothingForGoogle()
  })

  it('stores Accept and closes the bar, still sending Google nothing', async () => {
    const consent = await setup({ tag: false, preview: true })

    fireEvent.click(screen.getByTestId('consent-accept'))

    expect(consent.isConsentBannerOpen()).toBe(false)
    expect(consent.consentStatus()).toBe('granted')
    expect(JSON.parse(localStorage.getItem('mp.consent.v1') ?? '{}')).toEqual(
      expect.objectContaining({ status: 'granted', implicit: false }),
    )
    expect(bannerSpace()).toBe('')
    expectNothingForGoogle()
  })

  it('stores Decline, still sending Google nothing', async () => {
    const consent = await setup({ tag: false, preview: true })

    fireEvent.click(screen.getByTestId('consent-decline'))

    expect(consent.isConsentBannerOpen()).toBe(false)
    expect(consent.consentStatus()).toBe('denied')
    expect(JSON.parse(localStorage.getItem('mp.consent.v1') ?? '{}')).toEqual(
      expect.objectContaining({ status: 'denied' }),
    )
    expectNothingForGoogle()
  })

  it('keeps the bar shut after a stored choice, as production does', async () => {
    localStorage.setItem(
      'mp.consent.v1',
      JSON.stringify({ status: 'denied', at: 1, implicit: false }),
    )
    const consent = await setup({ tag: false, preview: true })

    expect(consent.isConsentBannerOpen()).toBe(false)
    expect(consent.consentStatus()).toBe('denied')
    expectNothingForGoogle()
  })

  it('does not ask a non-European clock, but Cookie settings still reopens it', async () => {
    const consent = await setup(
      { tag: false, preview: true },
      'America/New_York',
    )

    expect(consent.isConsentBannerOpen()).toBe(false)
    expect(consent.canReopenConsent()).toBe(true)

    const { LegalLinks } = await import('./LegalLinks')
    render(() => <LegalLinks />)
    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))

    expect(consent.isConsentBannerOpen()).toBe(true)
    expect(consent.isConsentSettingsOpen()).toBe(true)
    expectNothingForGoogle()
  })

  it('fires no Ads conversion and no GA4 event', async () => {
    const consent = await setup({ tag: false, preview: true })
    fireEvent.click(screen.getByTestId('consent-accept'))

    consent.trackAdConversion(consent.AD_CONVERSIONS.app_open)
    consent.trackGa4Event('cta_account_click')

    expect(tagWindow().dataLayer).toBeUndefined()
    expectNothingForGoogle()
  })
})

describe('consent preview off (flag off, no Google tag)', () => {
  it('mounts nothing and queues nothing, as before', async () => {
    const consent = await setup({ tag: false, preview: false })

    expect(document.getElementById('mp-consent-root')).toBeNull()
    expect(consent.isConsentBannerOpen()).toBe(false)
    expect(consent.canReopenConsent()).toBe(false)
    expect(bannerSpace()).toBe('')
    expectNothingForGoogle()
  })
})

describe('production (Google tag set)', () => {
  it('still boots Consent Mode with the flag on: the tag decides, not the flag', async () => {
    const consent = await setup({ tag: true, preview: true })

    expect(document.getElementById('mp-consent-root')).not.toBeNull()
    expect(consent.isConsentBannerOpen()).toBe(true)
    const queued = (tagWindow().dataLayer ?? []) as ArrayLike<unknown>[]
    expect(queued.some((c) => c[0] === 'consent' && c[1] === 'default')).toBe(
      true,
    )
  })
})
