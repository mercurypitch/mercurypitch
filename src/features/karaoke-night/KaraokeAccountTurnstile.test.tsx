// ============================================================
// Karaoke Night's password form and the Turnstile gate
// ============================================================
//
// Karaoke Night has its own account UI, entirely separate from the settings
// AuthModal. When the CAPTCHA was added to the worker, only AuthModal was
// wired for it — which would have turned every Karaoke Night sign-in into a
// 400 the moment the secret was set, on a surface nobody would have thought
// to test. These tests pin the wiring on THIS surface.
//
// The first test is the one that protects everybody: with no site key
// configured — which is every build until one is set, and every test run —
// the form must behave exactly as it did before the CAPTCHA existed.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  registerWithPassword: vi.fn(async () => ({}) as never),
  loginWithPassword: vi.fn(async () => ({}) as never),
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  registerWithPassword: mocks.registerWithPassword,
  loginWithPassword: mocks.loginWithPassword,
  takeGoogleRedirectResult: () => null,
}))

vi.mock('@/lib/standalone-account', () => ({
  account: () => null,
  credits: () => null,
  refreshAccount: async () => {},
  signedIn: () => false,
  signOutStandalone: () => {},
}))

vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

import { KaraokeAccount } from '@/features/karaoke-night/KaraokeAccount'

beforeEach(() => {
  vi.clearAllMocks()
})

/** Open the account modal on its password form. */
function openForm(): void {
  render(() => <KaraokeAccount />)
  fireEvent.click(screen.getByText('Sign in'))
}

/**
 * The form's own submit button. Queried by role alone this is ambiguous —
 * the topbar chip that OPENS the modal is also labelled "Sign in".
 */
function submitButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    'form button[type="submit"]',
  )
  if (button === null) throw new Error('The form has no submit button')
  return button
}

function fillCredentials(): void {
  const email = screen.getByPlaceholderText(/email/i)
  fireEvent.input(email, { target: { value: 'singer@example.com' } })
  const password = screen.getByPlaceholderText(/password/i)
  fireEvent.input(password, { target: { value: 'Sup3rSecret!x' } })
}

describe('Karaoke Night sign-in with the CAPTCHA unconfigured', () => {
  it('signs in exactly as before, with nothing blocking the button', async () => {
    // No VITE_TURNSTILE_SITE_KEY in a test build, so the widget is inert.
    // This is the no-regression guarantee for every surface that shares this
    // form: karaoke, and the rooms that send people here to sign in.
    openForm()
    fillCredentials()

    const submit = submitButton()
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() =>
      expect(mocks.loginWithPassword).toHaveBeenCalledWith(
        'singer@example.com',
        'Sup3rSecret!x',
        // The token the form has: empty, because there is no widget to issue
        // one. The worker's gate is likewise disabled, so this is accepted.
        '',
      ),
    )
  })

  it('creates an account exactly as before', async () => {
    openForm()
    fireEvent.click(screen.getByText('New here? Create an account'))
    fillCredentials()

    fireEvent.click(submitButton())

    await waitFor(() =>
      expect(mocks.registerWithPassword).toHaveBeenCalledWith(
        'singer@example.com',
        'Sup3rSecret!x',
        undefined,
        '',
      ),
    )
  })

  it('re-arms after a rejected attempt instead of dying', async () => {
    // Turnstile tokens are single-use. Without the reset in the catch, a
    // failed attempt leaves a spent token in the form and every retry is
    // refused by the server — the button looks alive and never works.
    mocks.loginWithPassword.mockRejectedValueOnce(new Error('Wrong password'))
    openForm()
    fillCredentials()

    fireEvent.click(submitButton())
    expect(await screen.findByText('Wrong password')).toBeInTheDocument()

    fireEvent.click(submitButton())
    await waitFor(() =>
      expect(mocks.loginWithPassword).toHaveBeenCalledTimes(2),
    )
  })
})
