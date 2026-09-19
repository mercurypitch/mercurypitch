// ============================================================
// The product-updates box asks, and only sends what was ticked
// ============================================================
//
// Two properties, and the first one is the whole feature: the box starts
// unticked. A pre-ticked consent box is not consent under the GDPR, so a list
// built from one cannot be mailed at all — and nothing about the screen would
// look wrong on the day that was discovered.
//
// The second is that the answer travels WITH the register request. Asking
// afterwards would mean a second call that can fail on its own, leaving an
// account that exists and an answer that does not.

import { fireEvent, render } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/google-sign-in', () => ({
  startGoogleSignIn: vi.fn(async () => null),
  googleSignInPending: () => false,
  googleSignInUnavailableReason: null,
}))
vi.mock('@/db/services/auth-service', () => ({
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(async () => ({ userId: 'u1' })),
  requestPasswordReset: vi.fn(),
  isTwofaChallenge: () => false,
  takeGoogleTwofaChallenge: vi.fn((): string | null => null),
}))
vi.mock('@/db/services/auth-mfa-service', () => ({ verifyTwofa: vi.fn() }))
vi.mock('@/db/services/voiceprint-service', () => ({
  adoptDeviceVoiceprints: vi.fn(async () => 0),
}))

import { AuthModal } from '@/components/account/AuthModal'
import { registerWithPassword } from '@/db/services/auth-service'
import { closeAuthModal, openAuthModal } from '@/stores/ui-store'

const EMAIL = 'singer@example.com'
const PASSWORD = 'Newsletter123pass'

beforeEach(() => {
  localStorage.clear()
  closeAuthModal()
  vi.clearAllMocks()
})

function fillAndSubmit(
  screen: ReturnType<typeof render>,
  tickUpdates: boolean,
): void {
  fireEvent.input(screen.getByTestId('auth-email'), {
    target: { value: EMAIL },
  })
  fireEvent.input(screen.getByTestId('auth-password'), {
    target: { value: PASSWORD },
  })
  if (tickUpdates) {
    fireEvent.click(screen.getByTestId('register-newsletter-optin'))
  }
  fireEvent.click(screen.getByTestId('auth-submit'))
}

describe('the product-updates box on the register form', () => {
  it('is unticked when the form opens', () => {
    openAuthModal('register')
    const screen = render(() => <AuthModal />)
    const box = screen.getByTestId(
      'register-newsletter-optin',
    ) as HTMLInputElement
    expect(box.checked).toBe(false)
  })

  it('is not offered when signing in', () => {
    openAuthModal('login')
    const screen = render(() => <AuthModal />)
    expect(screen.queryByTestId('register-newsletter-optin')).toBeNull()
  })

  it('sends the yes with the account, not after it', async () => {
    openAuthModal('register')
    const screen = render(() => <AuthModal />)
    fillAndSubmit(screen, true)
    await vi.waitFor(() => expect(registerWithPassword).toHaveBeenCalled())
    expect(registerWithPassword).toHaveBeenCalledWith(
      EMAIL,
      PASSWORD,
      '',
      '',
      true,
    )
  })

  it('sends a no when it was left alone', async () => {
    openAuthModal('register')
    const screen = render(() => <AuthModal />)
    fillAndSubmit(screen, false)
    await vi.waitFor(() => expect(registerWithPassword).toHaveBeenCalled())
    expect(registerWithPassword).toHaveBeenCalledWith(
      EMAIL,
      PASSWORD,
      '',
      '',
      false,
    )
  })

  it('forgets a tick when the form is reopened', () => {
    openAuthModal('register')
    const screen = render(() => <AuthModal />)
    fireEvent.click(screen.getByTestId('register-newsletter-optin'))
    closeAuthModal()
    openAuthModal('register')
    const box = screen.getByTestId(
      'register-newsletter-optin',
    ) as HTMLInputElement
    expect(box.checked).toBe(false)
  })
})
