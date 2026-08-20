// ============================================================
// Karaoke Night's sign-in when the CAPTCHA widget never loads
// ============================================================
//
// The companion to KaraokeAccountTurnstile.test.tsx, which covers the
// unconfigured build. This one arms the site key and then takes the widget
// away — a CSP that blocks challenges.cloudflare.com, an ad blocker, a
// captive network. With no widget there is no token, and a button that
// waits for a token waits for ever.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

/** Whether the stand-in widget claims it could not load. */
let blocked = false

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  blocked = false
  vi.doMock('@/components/shared/Turnstile', () => ({
    default: (props: { onToken: (token: string) => void }) => (
      <button
        type="button"
        data-testid="fake-turnstile"
        onClick={() => props.onToken('a-fresh-token')}
      >
        solve
      </button>
    ),
    turnstileEnabled: true,
    turnstileUnavailable: () => blocked,
    resetTurnstile: vi.fn(),
  }))
})

afterEach(() => {
  vi.doUnmock('@/components/shared/Turnstile')
})

async function openForm(): Promise<void> {
  const { KaraokeAccount } =
    await import('@/features/karaoke-night/KaraokeAccount')
  render(() => <KaraokeAccount />)
  fireEvent.click(screen.getByText('Sign in'))
}

/** The form's own submit button — the topbar chip is also "Sign in". */
function submitButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    'form button[type="submit"]',
  )
  if (button === null) throw new Error('The form has no submit button')
  return button
}

function fillCredentials(): void {
  fireEvent.input(screen.getByPlaceholderText(/email/i), {
    target: { value: 'singer@example.com' },
  })
  fireEvent.input(screen.getByPlaceholderText(/password/i), {
    target: { value: 'Sup3rSecret!x' },
  })
}

describe('Karaoke Night sign-in with the CAPTCHA armed', () => {
  it('waits for a token while the widget is working', async () => {
    await openForm()
    fillCredentials()

    expect(submitButton()).toBeDisabled()
    fireEvent.click(screen.getByTestId('fake-turnstile'))
    expect(submitButton()).toBeEnabled()
  })

  it('lets the singer sign in when the widget could not load', async () => {
    blocked = true
    await openForm()
    fillCredentials()

    expect(submitButton()).toBeEnabled()
    fireEvent.click(submitButton())

    await waitFor(() =>
      expect(mocks.loginWithPassword).toHaveBeenCalledWith(
        'singer@example.com',
        'Sup3rSecret!x',
        '',
      ),
    )
  })
})
