// ============================================================
// LegalLinks: the legal row and the sign-up line
// ============================================================
//
// The consent module reads the tag ids at load, so this file mocks a build
// that ships a Google tag (as production does) and imports everything fresh
// per test. IS_TEST stays true, so no real gtag.js is ever requested.

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
  document.getElementById('mp-consent-root')?.remove()
})

afterEach(() => {
  cleanup()
  document.getElementById('mp-consent-root')?.remove()
})

describe('LegalLinks', () => {
  it('links Privacy, Terms and Imprint to the landing documents, in that order', async () => {
    const { LegalLinks } = await import('./LegalLinks')

    render(() => <LegalLinks />)

    const links = screen
      .getByRole('navigation', { name: 'Legal' })
      .querySelectorAll('a')
    expect(
      Array.from(links).map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['Privacy', 'https://about.mercurypitch.com/privacy'],
      ['Terms', 'https://about.mercurypitch.com/terms'],
      ['Imprint', 'https://about.mercurypitch.com/imprint/'],
    ])
  })

  it('leaves Cookie settings out on a page that mounted no banner to reopen', async () => {
    const { LegalLinks } = await import('./LegalLinks')

    render(() => <LegalLinks />)

    expect(
      screen.queryByRole('button', { name: 'Cookie settings' }),
    ).not.toBeInTheDocument()
  })

  it('reopens the consent banner after the visitor already chose', async () => {
    // Arrange: the page booted consent and the visitor declined, so the
    // banner is gone. GDPR Art. 7(3): changing that must be as easy as giving it.
    const { setupConsent } = await import('./ConsentBanner')
    const { declineConsent } = await import('@/lib/consent')
    const { LegalLinks } = await import('./LegalLinks')
    setupConsent()
    declineConsent()
    render(() => <LegalLinks />)
    expect(
      screen.queryByRole('dialog', { name: 'Cookie consent' }),
    ).not.toBeInTheDocument()

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))

    // Assert
    const banner = screen.getByRole('dialog', { name: 'Cookie consent' })
    expect(banner).toBeInTheDocument()
    expect(screen.getByTestId('consent-accept')).toBeInTheDocument()
    expect(screen.getByTestId('consent-decline')).toBeInTheDocument()
  })
})

describe('SignUpLegalLine', () => {
  it('names the Terms a new account accepts and links the Privacy Notice', async () => {
    const { SignUpLegalLine } = await import('./LegalLinks')

    render(() => <SignUpLegalLine />)

    const line = screen.getByTestId('signup-legal-line')
    // The no-break space keeps "Privacy Notice" on one line.
    expect(line.textContent?.replace(/\u00a0/g, ' ')).toBe(
      'By creating an account you accept our Terms. Our Privacy Notice explains what we keep and why.',
    )
    expect(
      screen.getByRole('link', { name: 'Terms' }).getAttribute('href'),
    ).toBe('https://about.mercurypitch.com/terms')
    expect(
      screen
        .getByRole('link', { name: /^Privacy\sNotice$/ })
        .getAttribute('href'),
    ).toBe('https://about.mercurypitch.com/privacy')
  })
})
