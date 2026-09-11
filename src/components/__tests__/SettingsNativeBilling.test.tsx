// ============================================================
// SettingsPanel — the store binary carries no way to pay
// ============================================================
//
// App Store guideline 3.1.1 and Play's billing policy both reject a build that
// sells digital goods outside in-app purchase or links out to a payment page.
// PricingPanel does the first (Stripe checkout for credit packs) and the
// DonatePanel it mounts does the second (a Ko-fi link). `IS_NATIVE_BUILD` is
// what keeps both out of apps/mercurypitch.
//
// It is read once, at SettingsPanel's module evaluation, so a test cannot flip
// it after the fact: each case resets the module registry and imports the
// panel afresh. The Credits tab itself stays either way — only what it can
// mount changes.
//
// The changelog is the same problem one step away: nothing in it takes money,
// but the release notes it inlines from CHANGELOG.md tell the reader to buy
// credit packs through Stripe's checkout, and a reviewer reads the binary.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** Mount Settings with the native constant forced, on the tab it opens on. */
async function renderSettings(isNative: boolean): Promise<void> {
  vi.resetModules()
  vi.doMock('@/lib/native-build', () => ({
    IS_NATIVE_BUILD: isNative,
    CAN_TAKE_PAYMENT: !isNative,
  }))
  // Nothing reaches the network from a test process. Both panels fetch
  // pricing and identity on mount, and an errored resource would only add
  // noise to what is being asserted here.
  vi.doMock('@/db/services/billing-service', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return {
      ...actual,
      fetchPricing: vi.fn().mockResolvedValue(null),
      fetchBillingMe: vi.fn().mockResolvedValue(null),
      startCheckout: vi.fn(),
    }
  })
  vi.doMock('@/db/services/auth-service', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return {
      ...actual,
      accountHeld: () => false,
      fetchMe: vi.fn().mockResolvedValue(null),
      restoreAuth: vi.fn().mockResolvedValue(false),
    }
  })

  const { SettingsPanel } = await import('@/components/SettingsPanel')
  render(() => <SettingsPanel />)
}

/** Mount Settings on the Credits tab with the native constant forced. */
async function renderCreditsTab(isNative: boolean): Promise<void> {
  await renderSettings(isNative)
  fireEvent.click(screen.getByTestId('settings-tab-credits'))
}

/** Every anchor currently in the document, by href. */
const hrefs = (): string[] =>
  Array.from(document.querySelectorAll('a[href]')).map(
    (a) => a.getAttribute('href') ?? '',
  )

afterEach(() => {
  cleanup()
  vi.doUnmock('@/lib/native-build')
  vi.doUnmock('@/db/services/billing-service')
  vi.doUnmock('@/db/services/auth-service')
  vi.resetModules()
})

describe('SettingsPanel billing surfaces in a native build', () => {
  it('mounts no pricing and no donate UI, and links to no payment page', async () => {
    await renderCreditsTab(true)

    // The tab and its copy are untouched; what is gone is everything that
    // could take money.
    expect(screen.getByTestId('settings-tab-credits')).toBeInTheDocument()

    expect(screen.queryByTestId('pricing-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pricing-pack')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pricing-buy')).not.toBeInTheDocument()
    expect(screen.queryByTestId('donate-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('donate-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('donate-kofi')).not.toBeInTheDocument()

    expect(hrefs().some((href) => href.includes('ko-fi.com'))).toBe(false)

    // And the tab says why it is empty, rather than being empty. Every
    // "Get credits" shortcut in the app routes here.
    expect(screen.getByTestId('credits-not-for-sale')).toBeInTheDocument()
  })

  it('mounts both on the web, so only the native build loses them', async () => {
    await renderCreditsTab(false)

    // PricingPanel is lazy on the web now, so the panel arrives a microtask
    // after the tab is clicked rather than with it.
    expect(await screen.findByTestId('donate-panel')).toBeInTheDocument()
    expect(screen.getByTestId('donate-kofi')).toBeInTheDocument()
    expect(hrefs().some((href) => href.includes('ko-fi.com'))).toBe(true)
    expect(screen.queryByTestId('credits-not-for-sale')).not.toBeInTheDocument()
  })
})

describe('SettingsPanel release notes in a native build', () => {
  it('offers no changelog, so its purchase prose is out of the bundle', async () => {
    await renderSettings(true)

    // About is on the tab Settings opens on, and everything else about it is
    // untouched: only the control that mounts the modal is gone.
    expect(screen.getByTestId('about-version')).toBeInTheDocument()
    expect(screen.queryByTestId('whats-new-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('changelog-version')).not.toBeInTheDocument()
  })

  it('opens it on the web, so only the native build loses it', async () => {
    await renderSettings(false)

    fireEvent.click(screen.getByTestId('whats-new-btn'))

    // The modal is a lazy chunk now, so it arrives a microtask after the
    // click rather than with it.
    const versions = await screen.findAllByTestId('changelog-version')
    expect(versions.length).toBeGreaterThan(0)
  })
})
