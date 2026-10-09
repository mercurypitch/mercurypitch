// ============================================================
// The sign-up dialog and the launch gift
// ============================================================
//
// A password sign-up made while the gift is on offer says where the credits
// are: they arrive with the confirm link. And a sign-up opened from the
// Map's "Get my 5 credits" tells the worker it started with Karaoke Night,
// which picks the first mail's picture; the gift is Karaoke Night credits.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetGoogleSignInPending } from '@/lib/google-sign-in'

const mocks = vi.hoisted(() => ({
  registerWithPassword: vi.fn(async (..._args: unknown[]) => ({})),
  googleSignInUrl: vi.fn(async () => 'http://api.test/api/auth/google/start'),
  showNotification: vi.fn(),
  signUpGiftMessage: vi.fn((): string | null => null),
}))

vi.mock('@/db/services/auth-service', () => ({
  registerWithPassword: mocks.registerWithPassword,
  googleSignInUrl: mocks.googleSignInUrl,
  loginWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  isTwofaChallenge: () => false,
  takeGoogleTwofaChallenge: () => null,
  takeNativeTwofaChallenge: () => null,
}))
vi.mock('@/db/services/auth-passkey-service', () => ({
  passkeysAvailable: async () => false,
  signInWithPasskey: vi.fn(),
}))
vi.mock('@/lib/webauthn', () => ({
  platformAuthenticatorAvailable: async () => false,
  conditionalMediationAvailable: async () => false,
  describeWebAuthnError: () => 'That did not work.',
}))
vi.mock('@/features/account/sign-in-methods', () => ({
  appleSignInOffered: () => false,
  nativeGoogleSignInOffered: () => false,
  webGoogleSignInOffered: () => true,
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  adoptDeviceVoiceprints: vi.fn(async () => 0),
  buildVoiceprintHint: () => undefined,
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: mocks.showNotification,
}))
vi.mock('@/stores/launch-gift-store', () => ({
  signUpGiftMessage: mocks.signUpGiftMessage,
}))
vi.mock('@/components/account/PhoneSignIn', () => ({
  PhoneSignIn: () => null,
}))

import { AuthModal } from '@/components/account/AuthModal'
import { closeAuthModal, openAuthModal } from '@/stores/ui-store'

async function register(): Promise<void> {
  fireEvent.input(await screen.findByTestId('auth-email'), {
    target: { value: 'singer@example.com' },
  })
  fireEvent.input(screen.getByTestId('auth-password'), {
    target: { value: 'Secret123!' },
  })
  fireEvent.click(screen.getByTestId('auth-submit'))
  await waitFor(() => expect(mocks.registerWithPassword).toHaveBeenCalled())
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.signUpGiftMessage.mockReturnValue(null)
  resetGoogleSignInPending()
  closeAuthModal()
})

afterEach(cleanup)

describe('a password sign-up while the gift is on offer', () => {
  it('says the credits arrive when the email is confirmed', async () => {
    mocks.signUpGiftMessage.mockReturnValue(
      'Confirm your email and your 5 credits arrive.',
    )
    render(() => <AuthModal />)
    openAuthModal('register')

    await register()

    await waitFor(() =>
      expect(mocks.showNotification).toHaveBeenCalledWith(
        'Confirm your email and your 5 credits arrive.',
        'info',
      ),
    )
  })

  it('says what it always said with no gift on offer', async () => {
    render(() => <AuthModal />)
    openAuthModal('register')

    await register()

    await waitFor(() =>
      expect(mocks.showNotification).toHaveBeenCalledWith(
        'Account created — progress is now synced',
        'info',
      ),
    )
  })
})

describe('a sign-up opened for Karaoke Night credits', () => {
  it('tells the worker it started with Karaoke Night', async () => {
    render(() => <AuthModal />)
    openAuthModal('register', { signupSource: 'karaoke' })

    await register()

    expect(mocks.registerWithPassword).toHaveBeenCalledWith(
      'singer@example.com',
      'Secret123!',
      '',
      '',
      expect.objectContaining({ signupSource: 'karaoke' }),
    )
  })

  it('carries the source through Google as well', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: vi.fn(), href: 'http://localhost/' },
    })
    render(() => <AuthModal />)
    openAuthModal('register', { signupSource: 'karaoke' })

    fireEvent.click(await screen.findByTestId('auth-google'))

    await waitFor(() =>
      expect(mocks.googleSignInUrl).toHaveBeenCalledWith({
        signupSource: 'karaoke',
      }),
    )
  })

  it('forgets the source when the dialog is next opened from elsewhere', async () => {
    render(() => <AuthModal />)
    openAuthModal('register', { signupSource: 'karaoke' })
    closeAuthModal()
    openAuthModal('register')

    await register()

    const extras = mocks.registerWithPassword.mock.calls[0]?.[4]
    expect(extras).toEqual(expect.any(Object))
    expect(extras).not.toHaveProperty('signupSource')
  })
})
