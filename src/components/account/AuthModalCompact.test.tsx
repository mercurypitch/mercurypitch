// ============================================================
// AuthModal on a phone: one row per field, two ways in up front
// ============================================================
//
// The sheet used to scroll on a phone (owner test, 2026-10-11). What made it
// fit, in terms a test can hold it to: each field's label sits inside its box
// and is still the field's name, Google and the phone share one row, a
// passkey is a link beside the mailed code instead of a row of its own, and
// the product-updates box is one unticked sentence. The layout itself is
// measured in src/e2e/auth-sheet.spec.ts.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const passkeyMocks = vi.hoisted(() => ({
  passkeysAvailable: vi.fn(async () => false),
  platformAuthenticatorAvailable: vi.fn(async () => false),
}))

vi.mock('@/db/services/auth-service', () => ({
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  isTwofaChallenge: () => false,
  takeGoogleTwofaChallenge: () => null,
  takeNativeTwofaChallenge: () => null,
}))

vi.mock('@/db/services/auth-passkey-service', () => ({
  passkeysAvailable: () => passkeyMocks.passkeysAvailable(),
  signInWithPasskey: vi.fn(() => new Promise(() => {})),
}))

vi.mock('@/lib/webauthn', () => ({
  platformAuthenticatorAvailable: () =>
    passkeyMocks.platformAuthenticatorAvailable(),
  conditionalMediationAvailable: async () => false,
  describeWebAuthnError: () => '',
}))

import { closeAuthModal, openAuthModal } from '@/stores/ui-store'
import { AuthModal } from './AuthModal'

beforeEach(() => {
  passkeyMocks.passkeysAvailable.mockResolvedValue(false)
  passkeyMocks.platformAuthenticatorAvailable.mockResolvedValue(false)
})

afterEach(() => {
  closeAuthModal()
  cleanup()
})

/** The label element that names `input`, and the text it shows. */
function labelOf(input: HTMLElement): HTMLLabelElement {
  const label = input.closest('label')
  if (label === null) throw new Error('field has no label')
  return label
}

describe('the fields', () => {
  it('names each field by its own label, drawn inside the box', async () => {
    render(() => <AuthModal />)
    openAuthModal('register')
    const email = await screen.findByTestId('auth-email')

    expect(screen.getByRole('textbox', { name: 'Email' })).toBe(email)
    expect(
      screen.getByRole('textbox', { name: 'Display name (optional)' }),
    ).toBe(screen.getByTestId('auth-display-name'))
    // The words follow the input inside its label: that sibling is what the
    // stylesheet floats into the box, so no field spends a row on its label.
    for (const id of ['auth-display-name', 'auth-email', 'auth-password']) {
      const input = screen.getByTestId(id)
      expect(input.nextElementSibling?.textContent).toBe(
        labelOf(input).textContent,
      )
    }
  })

  it('keeps the reveal button out of the password label', async () => {
    // Inside the label, the button's own name ("Show password") became part
    // of the field's name for a screen reader.
    render(() => <AuthModal />)
    openAuthModal('login')
    await screen.findByTestId('auth-email')

    const password = screen.getByTestId('auth-password')
    expect(screen.getByLabelText('Password', { selector: 'input' })).toBe(
      password,
    )
    expect(labelOf(password).textContent).toBe('Password')
    expect(screen.getByTestId('auth-password-toggle').closest('label')).toBe(
      null,
    )
  })
})

describe('the ways in', () => {
  it('puts Google and the phone on one row', async () => {
    render(() => <AuthModal />)
    openAuthModal('login')
    const google = await screen.findByTestId('auth-google')
    const phone = screen.getByTestId('auth-phone')

    // A row of their own, holding the two of them and nothing else.
    expect([...(google.parentElement?.children ?? [])]).toEqual([google, phone])
    // Google's branding rules forbid a button that says only "Google".
    expect(google.textContent).toBe('Continue with Google')
    expect(
      screen.getByRole('button', { name: 'Sign in with your phone' }),
    ).toBe(phone)
  })

  it('offers a passkey beside the mailed code, not as a row of its own', async () => {
    passkeyMocks.passkeysAvailable.mockResolvedValue(true)
    passkeyMocks.platformAuthenticatorAvailable.mockResolvedValue(true)
    render(() => <AuthModal />)
    openAuthModal('login')

    const passkey = await screen.findByTestId('auth-passkey')
    expect(passkey.parentElement).toBe(
      screen.getByTestId('auth-email-code-link').parentElement,
    )
    expect(passkey.textContent).toBe('Use a passkey')
  })
})

describe('the product-updates box', () => {
  it('asks in one unticked sentence, apart from the Terms line', async () => {
    render(() => <AuthModal />)
    openAuthModal('register')
    await screen.findByTestId('auth-email')

    const box = screen.getByTestId(
      'register-newsletter-optin',
    ) as HTMLInputElement
    expect(box.checked).toBe(false)
    expect(labelOf(box).textContent).toBe(
      'Email me product updates. Unsubscribe anytime.',
    )
    expect(labelOf(box).contains(screen.getByTestId('signup-legal-line'))).toBe(
      false,
    )
  })
})
