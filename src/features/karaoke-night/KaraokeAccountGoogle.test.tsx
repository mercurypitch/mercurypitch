// ============================================================
// Karaoke Night's "Continue with Google" button
// ============================================================
//
// Signing in with Google absorbs this browser's anonymous progress into the
// Google account, permanently — so the worker now requires the device secret
// to allow it, and a secret has no business in a URL that lands in browser
// history, server logs and Referer headers. `googleSignInUrl()` therefore
// POSTs and RESOLVES the consent URL instead of assembling one.
//
// That turned this button's handler from a synchronous expression into an
// awaited call that can fail. Karaoke Night is a standalone surface with its
// own account UI, so this covers THIS surface's wiring: that a failure lands
// in its own error line rather than the notification the settings panel uses.
//
// This comment used to claim the same change "is covered by their own files"
// in AuthModal and AccountSection. It was not — both were uncovered, and the
// claim is what stopped anyone looking. Now the shared half lives in
// lib/google-sign-in with its own unit tests, and all three surfaces have a
// wiring test.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetGoogleSignInPending } from '@/lib/google-sign-in'

const mocks = vi.hoisted(() => ({
  googleSignInUrl: vi.fn(async () => 'https://accounts.google.com/consent?x=1'),
  assign: vi.fn(),
}))

// Partial: VerifyEmailBanner renders inside this component and reaches for
// authStamp/fetchMe, which have nothing to do with the button under test.
vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  googleSignInUrl: mocks.googleSignInUrl,
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
  resetGoogleSignInPending()
  vi.clearAllMocks()
  mocks.googleSignInUrl.mockResolvedValue(
    'https://accounts.google.com/consent?x=1',
  )
  // jsdom refuses a real navigation; the assertion is that we asked for one.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      assign: mocks.assign,
      href: 'http://localhost/',
      origin: 'http://localhost',
      pathname: '/',
      search: '',
      hash: '',
    },
  })
})

/** Open the account modal and hand back its Google button. */
async function googleButton(): Promise<HTMLElement> {
  render(() => <KaraokeAccount />)
  fireEvent.click(screen.getByText('Sign in'))
  return await waitFor(() => screen.getByText('Continue with Google'))
}

describe('Continue with Google', () => {
  it('navigates to the consent url the worker handed back', async () => {
    fireEvent.click(await googleButton())

    await waitFor(() =>
      expect(mocks.assign).toHaveBeenCalledWith(
        'https://accounts.google.com/consent?x=1',
      ),
    )
    // Asked for, not assembled: the device secret rides in the POST body.
    expect(mocks.googleSignInUrl).toHaveBeenCalledTimes(1)
  })

  it('says so rather than navigating to nothing when the ask fails', async () => {
    // The failure this introduced. Before, the handler was
    // `window.location.assign(googleSignInUrl())` — synchronous, nothing to
    // reject. Now an offline device or a 500 rejects, and an unhandled
    // rejection would leave the button looking dead.
    mocks.googleSignInUrl.mockRejectedValue(new Error('offline'))

    fireEvent.click(await googleButton())

    await waitFor(() =>
      expect(
        screen.getByText('Could not reach Google sign-in. Try again.'),
      ).toBeTruthy(),
    )
    expect(mocks.assign).not.toHaveBeenCalled()
  })
})
