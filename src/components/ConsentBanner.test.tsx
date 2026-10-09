// ============================================================
// ConsentBanner: the two choices and Cookie settings
// ============================================================
//
// The consent module reads the tag ids at load, so this file mocks a build
// that ships a Google tag and imports everything fresh per test. IS_TEST
// stays true, so no real gtag.js is ever requested.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  GOOGLE_ADS_TAG_ID: 'AW-TEST',
  GA4_MEASUREMENT_ID: 'G-TEST',
  IS_TEST: true,
}))

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  const w = window as unknown as { __mpConsentBooted?: boolean }
  delete w.__mpConsentBooted
})

afterEach(cleanup)

async function openBanner() {
  const consent = await import('@/lib/consent')
  const { ConsentBanner } = await import('./ConsentBanner')
  consent.initConsent()
  render(() => <ConsentBanner />)
  return consent
}

describe('ConsentBanner', () => {
  it('gives Accept and Decline the same styling, so neither is the default', async () => {
    // EDPB cookie banner taskforce: a brighter Accept beside a muted Decline
    // steers the choice.
    const consent = await openBanner()
    consent.openConsentSettings()

    const accept = screen.getByTestId('consent-accept')
    const decline = screen.getByTestId('consent-decline')

    expect(accept.className).toBe(decline.className)
  })

  it('shows the current choice when reopened from Cookie settings', async () => {
    const consent = await openBanner()
    consent.acceptConsent()

    consent.openConsentSettings()

    expect(screen.getByTestId('consent-status').textContent).toMatch(
      /^You accepted cookies on \d{1,2} [A-Z][a-z]+ \d{4}\.$/,
    )
  })

  it('closes Cookie settings from its close button without changing the choice', async () => {
    const consent = await openBanner()
    consent.declineConsent()
    consent.openConsentSettings()

    fireEvent.click(
      screen.getByRole('button', { name: 'Close cookie settings' }),
    )

    expect(consent.isConsentBannerOpen()).toBe(false)
    expect(consent.consentStatus()).toBe('denied')
  })
})
