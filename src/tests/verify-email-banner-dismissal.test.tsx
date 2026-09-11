// ============================================================
// The verify-email nudge comes back at the next sign-in
// ============================================================
//
// A dismissal is per tab session, and on a phone a tab session can be weeks.
// The nudge and its Resend button must return for the next sign-in, or
// whoever dismissed it once never sees a way to resend again. A reload while
// signed in is not a sign-in and keeps the dismissal.

import { fireEvent, render, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  signedIn: false,
  stamp: null as null | (() => number),
  bump: null as null | ((n: number) => void),
}))
vi.mock('@/db/services/auth-service', async () => {
  const { createSignal } = await import('solid-js')
  const [authStamp, setAuthStamp] = createSignal(0)
  auth.stamp = authStamp
  auth.bump = setAuthStamp
  return {
    authStamp,
    hasValidToken: () => auth.signedIn,
    fetchMe: vi.fn(async () => ({
      user: {
        authProvider: 'password',
        email: 'singer@example.com',
        emailVerified: false,
      },
    })),
    resendVerificationEmail: vi.fn(async () => undefined),
    takeEmailVerifyResult: () => null,
  }
})
vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

import { VerifyEmailBanner } from '@/components/account/VerifyEmailBanner'

const bumpAuth = (): void => {
  auth.bump!((auth.stamp!() ?? 0) + 1)
}

describe('VerifyEmailBanner dismissal', () => {
  beforeEach(() => {
    sessionStorage.clear()
    auth.signedIn = false
  })

  it('returns after a sign-out and a fresh sign-in, but not on a reload', async () => {
    auth.signedIn = true
    const { queryByTestId, getByLabelText } = render(() => (
      <VerifyEmailBanner />
    ))
    await waitFor(() =>
      expect(queryByTestId('verify-email-banner')).not.toBeNull(),
    )

    fireEvent.click(getByLabelText('Dismiss'))
    expect(queryByTestId('verify-email-banner')).toBeNull()
    expect(sessionStorage.getItem('mp:verifyBannerDismissed')).toBe('1')

    // A re-check while still signed in (a reload, a token refresh) keeps it.
    bumpAuth()
    await Promise.resolve()
    expect(queryByTestId('verify-email-banner')).toBeNull()

    // Sign out, then in again: the nudge and its Resend are back.
    auth.signedIn = false
    bumpAuth()
    await waitFor(() => expect(queryByTestId('verify-email-banner')).toBeNull())
    auth.signedIn = true
    bumpAuth()
    await waitFor(() =>
      expect(queryByTestId('verify-email-banner')).not.toBeNull(),
    )
    expect(sessionStorage.getItem('mp:verifyBannerDismissed')).toBeNull()
  })
})
