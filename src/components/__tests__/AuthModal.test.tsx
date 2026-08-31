// ============================================================
// AuthModal Component Tests — sign-in / register / forgot flows
// ============================================================
// Drives the real ui-store open/close signals; the auth-service calls
// are mocked.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetGoogleSignInPending } from '@/lib/google-sign-in'

const mocks = vi.hoisted(() => ({
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  googleSignInUrl: vi.fn(() => 'http://api.test/api/auth/google/start'),
  // Real behaviour, not a constant: the modal branches on this, and a mock
  // that always says "no" would hide a challenge these tests never see.
  isTwofaChallenge: (outcome: unknown) =>
    (outcome as { twofaRequired?: boolean } | null)?.twofaRequired === true,
  takeGoogleTwofaChallenge: vi.fn((): string | null => null),
}))

const mfaMocks = vi.hoisted(() => ({ verifyTwofa: vi.fn() }))

const codeMocks = vi.hoisted(() => ({
  requestLoginCode: vi.fn(),
  verifyLoginCode: vi.fn(),
}))

const passkeyMocks = vi.hoisted(() => ({
  // Off by default: jsdom has no authenticator, and every pre-existing test
  // in this file describes a browser without one.
  passkeysAvailable: vi.fn(async () => false),
  platformAuthenticatorAvailable: vi.fn(async () => false),
  conditionalMediationAvailable: vi.fn(async () => false),
  signInWithPasskey: vi.fn(),
}))

vi.mock('@/db/services/auth-service', () => mocks)

vi.mock('@/db/services/auth-mfa-service', () => ({
  verifyTwofa: (...a: unknown[]) => mfaMocks.verifyTwofa(...a),
}))

vi.mock('@/db/services/auth-email-code-service', () => ({
  requestLoginCode: (...a: unknown[]) => codeMocks.requestLoginCode(...a),
  verifyLoginCode: (...a: unknown[]) => codeMocks.verifyLoginCode(...a),
}))

vi.mock('@/db/services/auth-passkey-service', () => ({
  passkeysAvailable: () => passkeyMocks.passkeysAvailable(),
  signInWithPasskey: (...a: unknown[]) => passkeyMocks.signInWithPasskey(...a),
}))

vi.mock('@/lib/webauthn', () => ({
  platformAuthenticatorAvailable: () =>
    passkeyMocks.platformAuthenticatorAvailable(),
  conditionalMediationAvailable: () =>
    passkeyMocks.conditionalMediationAvailable(),
  describeWebAuthnError: (err: unknown) =>
    err instanceof Error ? err.message : 'That did not work.',
}))

vi.mock('../account/PhoneSignIn', () => ({
  PhoneSignIn: (props: { onLinked: () => void }) => (
    <button
      type="button"
      data-testid="complete-phone-link"
      onClick={() => props.onLinked()}
    >
      Complete phone link
    </button>
  ),
}))

import { closeAuthModal, openAuthModal } from '@/stores/ui-store'
import { AuthModal } from '../account/AuthModal'

beforeEach(() => {
  resetGoogleSignInPending()
  vi.clearAllMocks()
  mocks.takeGoogleTwofaChallenge.mockReturnValue(null)
  passkeyMocks.passkeysAvailable.mockResolvedValue(false)
  passkeyMocks.platformAuthenticatorAvailable.mockResolvedValue(false)
  passkeyMocks.conditionalMediationAvailable.mockResolvedValue(false)
  closeAuthModal()
})

describe('AuthModal', () => {
  it('stays hidden until opened', () => {
    render(() => <AuthModal />)
    expect(screen.queryByTestId('auth-modal-overlay')).not.toBeInTheDocument()
  })

  it('signs in with email and password, then closes', async () => {
    mocks.loginWithPassword.mockResolvedValue({})
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)

    openAuthModal('login')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    expect(mocks.loginWithPassword).toHaveBeenCalledWith(
      'maff@example.com',
      'secret123',
      '',
    )
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(
        screen.queryByTestId('auth-modal-overlay'),
      ).not.toBeInTheDocument(),
    )
  })

  it('registers with email, password and display name', async () => {
    mocks.registerWithPassword.mockResolvedValue({})
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)

    openAuthModal('register')
    fireEvent.input(await screen.findByTestId('auth-display-name'), {
      target: { value: 'Maff' },
    })
    fireEvent.input(screen.getByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() =>
      expect(mocks.registerWithPassword).toHaveBeenCalledWith(
        'maff@example.com',
        'secret123',
        'Maff',
        '',
      ),
    )
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1))
  })

  it('uses the requested tone without changing the shared dialog contract', async () => {
    render(() => <AuthModal tone="guitar-night" />)

    openAuthModal('login')

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('auth-modal-overlay')).toHaveAttribute(
      'data-tone',
      'guitar-night',
    )
  })

  it('moves focus into the newly selected account pane', async () => {
    render(() => <AuthModal tone="guitar-night" />)

    openAuthModal('login')
    const createAccount = await screen.findByTestId('auth-switch-register')
    createAccount.focus()
    fireEvent.click(createAccount)

    await waitFor(() =>
      expect(screen.getByTestId('auth-display-name')).toHaveFocus(),
    )
  })

  it('reconciles account-aware UI when phone linking completes', async () => {
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)

    openAuthModal('login')
    fireEvent.click(await screen.findByTestId('auth-phone'))
    fireEvent.click(await screen.findByTestId('complete-phone-link'))

    expect(onAuthenticated).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(
        screen.queryByTestId('auth-modal-overlay'),
      ).not.toBeInTheDocument(),
    )
  })

  it('blocks registration while the password fails the policy', async () => {
    render(() => <AuthModal />)

    openAuthModal('register')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    // No digit — fails the letter+number policy
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'onlyletters' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    expect(await screen.findByTestId('auth-error')).toBeInTheDocument()
    expect(mocks.registerWithPassword).not.toHaveBeenCalled()
  })

  it('sends a reset link from the forgot pane', async () => {
    mocks.requestPasswordReset.mockResolvedValue(undefined)
    render(() => <AuthModal />)

    openAuthModal('login')
    fireEvent.click(await screen.findByTestId('auth-forgot-link'))

    // Forgot pane: email only, no password field
    expect(screen.queryByTestId('auth-password')).not.toBeInTheDocument()
    fireEvent.input(screen.getByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() =>
      expect(mocks.requestPasswordReset).toHaveBeenCalledWith(
        'maff@example.com',
        '',
      ),
    )
    expect(await screen.findByTestId('auth-forgot-sent')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading')).toHaveFocus())
  })

  it('can close a stalled request without running its host continuation', async () => {
    let finishLogin: (() => void) | undefined
    mocks.loginWithPassword.mockReturnValue(
      new Promise((resolve) => {
        finishLogin = () => resolve({})
      }),
    )
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)

    openAuthModal('login')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true'),
    )

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    finishLogin?.()
    await Promise.resolve()
    expect(onAuthenticated).not.toHaveBeenCalled()
  })

  it('surfaces server errors in the form', async () => {
    mocks.loginWithPassword.mockRejectedValue(
      new Error('Invalid email or password'),
    )
    render(() => <AuthModal />)

    openAuthModal('login')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'wrong-pass1' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    const error = await screen.findByTestId('auth-error')
    expect(error.textContent).toContain('Invalid email or password')
    // Still open so the user can retry
    expect(screen.getByTestId('auth-modal-overlay')).toBeInTheDocument()
  })

  it('clears the password after a failed sign-in so autofill can refill it', async () => {
    mocks.loginWithPassword.mockRejectedValue(
      new Error('Invalid email or password'),
    )
    render(() => <AuthModal />)

    openAuthModal('login')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    const password = screen.getByTestId('auth-password') as HTMLInputElement
    fireEvent.input(password, { target: { value: 'wrong-pass1' } })
    // Revealed as text — a manager would skip the field for this too.
    fireEvent.click(screen.getByTestId('auth-password-toggle'))
    expect(password.type).toBe('text')
    fireEvent.click(screen.getByTestId('auth-submit'))

    await screen.findByTestId('auth-error')
    // Password managers refuse to overwrite a non-empty (or revealed)
    // password input, so a failed attempt must leave the field empty and
    // hidden again; the email stays for the retry.
    expect(password.value).toBe('')
    expect(password.type).toBe('password')
    expect((screen.getByTestId('auth-email') as HTMLInputElement).value).toBe(
      'maff@example.com',
    )
  })

  it('keeps the typed password when a register attempt is rejected', async () => {
    mocks.registerWithPassword.mockRejectedValue(
      new Error('Email already registered'),
    )
    render(() => <AuthModal />)

    openAuthModal('register')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    const password = screen.getByTestId('auth-password') as HTMLInputElement
    fireEvent.input(password, { target: { value: 'secret123' } })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await screen.findByTestId('auth-error')
    // A register fix-up wants the attempt kept — only sign-in clears.
    expect(password.value).toBe('secret123')
  })

  it('closes from the header button', async () => {
    render(() => <AuthModal />)

    openAuthModal('login')
    fireEvent.click(await screen.findByTestId('auth-modal-close'))
    await waitFor(() =>
      expect(
        screen.queryByTestId('auth-modal-overlay'),
      ).not.toBeInTheDocument(),
    )
  })
})

// The wiring the extraction to lib/google-sign-in left behind: this modal
// shows a failed start inline, next to the form. Untested until now — the
// Karaoke copy's own test claimed "the same change in AuthModal and
// AccountSection is covered by their own files", and it was not.
describe('Continue with Google', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: vi.fn(), href: 'http://localhost/' },
    })
  })

  it('navigates to the consent url the worker handed back', async () => {
    render(() => <AuthModal />)
    openAuthModal('login')

    fireEvent.click(await screen.findByTestId('auth-google'))

    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith(
        'http://api.test/api/auth/google/start',
      ),
    )
  })

  it('shows the failure inline rather than navigating to nothing', async () => {
    mocks.googleSignInUrl.mockImplementation(() => {
      throw new Error('offline')
    })
    render(() => <AuthModal />)
    openAuthModal('login')

    fireEvent.click(await screen.findByTestId('auth-google'))

    await waitFor(() =>
      expect(
        screen.getByText('Could not reach Google sign-in. Try again.'),
      ).toBeTruthy(),
    )
    expect(window.location.assign).not.toHaveBeenCalled()
  })
})

// ── The second-factor pane ───────────────────────────────────────────
//
// The password buying nothing on its own is the whole point of the feature,
// so these assert on what is NOT stored as much as on what is shown.

describe('the second factor', () => {
  it('asks for a code instead of closing when the account owes one', async () => {
    mocks.loginWithPassword.mockResolvedValue({
      twofaRequired: true,
      ceremony: 'ceremony-token',
    })
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)

    openAuthModal('login')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    expect(await screen.findByTestId('auth-twofa-form')).toBeTruthy()
    // The modal is still open and nothing was announced as a sign-in.
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(screen.getByTestId('auth-modal-overlay')).toBeTruthy()
  })

  it('spends the ceremony token, not the password, on the code', async () => {
    mocks.loginWithPassword.mockResolvedValue({
      twofaRequired: true,
      ceremony: 'ceremony-token',
    })
    mfaMocks.verifyTwofa.mockResolvedValue({ token: 'jwt' })
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)

    openAuthModal('login')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    fireEvent.input(await screen.findByTestId('auth-twofa-code'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByTestId('auth-twofa-submit'))

    await waitFor(() =>
      expect(mfaMocks.verifyTwofa).toHaveBeenCalledWith(
        'ceremony-token',
        '123456',
      ),
    )
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1))
    expect(mocks.loginWithPassword).toHaveBeenCalledTimes(1)
  })

  it('keeps the pane open and says why when the code is wrong', async () => {
    mocks.loginWithPassword.mockResolvedValue({
      twofaRequired: true,
      ceremony: 'ceremony-token',
    })
    mfaMocks.verifyTwofa.mockRejectedValue(new Error('That code did not match'))
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)

    openAuthModal('login')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    fireEvent.input(await screen.findByTestId('auth-twofa-code'), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByTestId('auth-twofa-submit'))

    await waitFor(() =>
      expect(screen.getByText('That code did not match')).toBeTruthy(),
    )
    expect(screen.getByTestId('auth-twofa-form')).toBeTruthy()
    expect(onAuthenticated).not.toHaveBeenCalled()
  })

  it('picks up a challenge carried back from the Google redirect', async () => {
    // Google's redirect lands on the app, not on a fetch this modal made, so
    // the challenge arrives through the parked signal rather than a return
    // value. Missing it would look like a sign-in that silently did nothing.
    mocks.takeGoogleTwofaChallenge.mockReturnValue('google-ceremony')
    render(() => <AuthModal />)

    openAuthModal('login')

    expect(await screen.findByTestId('auth-twofa-form')).toBeTruthy()
  })
})

// ── Signing in with a mailed code ────────────────────────────────────
//
// The pane must be reachable, must not leak whether the address is
// registered, and must hand a code sign-in that still owes a second factor
// straight to the pane that asks for one.

describe('signing in with a mailed code', () => {
  it('reaches the pane from the sign-in form', async () => {
    render(() => <AuthModal />)
    openAuthModal('login')

    fireEvent.click(await screen.findByTestId('auth-email-code-link'))

    // No password field: needing no password is the entire point.
    await waitFor(() =>
      expect(screen.queryByTestId('auth-password')).not.toBeInTheDocument(),
    )
    expect(screen.getByTestId('auth-email')).toBeTruthy()
  })

  it('says "if an account exists" rather than confirming one does', async () => {
    // The endpoint answers identically for a registered and an unregistered
    // address. Copy that claimed otherwise would undo that on the screen.
    codeMocks.requestLoginCode.mockResolvedValue('code-ceremony')
    render(() => <AuthModal />)
    openAuthModal('login')

    fireEvent.click(await screen.findByTestId('auth-email-code-link'))
    fireEvent.input(screen.getByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() =>
      expect(screen.getByTestId('auth-email-code-form')).toBeTruthy(),
    )
    expect(screen.getByText(/if an account exists/i)).toBeTruthy()
  })

  it('spends the ceremony from the request, not the address', async () => {
    codeMocks.requestLoginCode.mockResolvedValue('code-ceremony')
    codeMocks.verifyLoginCode.mockResolvedValue({ token: 'jwt' })
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)
    openAuthModal('login')

    fireEvent.click(await screen.findByTestId('auth-email-code-link'))
    fireEvent.input(screen.getByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    fireEvent.input(await screen.findByTestId('auth-email-code-input'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByTestId('auth-email-code-submit'))

    await waitFor(() =>
      expect(codeMocks.verifyLoginCode).toHaveBeenCalledWith(
        'code-ceremony',
        '123456',
      ),
    )
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1))
  })

  it('hands a code sign-in that still owes a second factor to the 2FA pane', async () => {
    codeMocks.requestLoginCode.mockResolvedValue('code-ceremony')
    codeMocks.verifyLoginCode.mockResolvedValue({
      twofaRequired: true,
      ceremony: 'twofa-ceremony',
    })
    mfaMocks.verifyTwofa.mockResolvedValue({ token: 'jwt' })
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)
    openAuthModal('login')

    fireEvent.click(await screen.findByTestId('auth-email-code-link'))
    fireEvent.input(screen.getByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))
    fireEvent.input(await screen.findByTestId('auth-email-code-input'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByTestId('auth-email-code-submit'))

    expect(await screen.findByTestId('auth-twofa-form')).toBeTruthy()
    expect(onAuthenticated).not.toHaveBeenCalled()

    // And the SECOND ceremony is the one spent — not the mailed code's.
    fireEvent.input(screen.getByTestId('auth-twofa-code'), {
      target: { value: '654321' },
    })
    fireEvent.click(screen.getByTestId('auth-twofa-submit'))
    await waitFor(() =>
      expect(mfaMocks.verifyTwofa).toHaveBeenCalledWith(
        'twofa-ceremony',
        '654321',
      ),
    )
  })

  it('shows a wrong code inline and keeps the pane', async () => {
    codeMocks.requestLoginCode.mockResolvedValue('code-ceremony')
    codeMocks.verifyLoginCode.mockRejectedValue(
      new Error('That code is not valid or has expired'),
    )
    render(() => <AuthModal />)
    openAuthModal('login')

    fireEvent.click(await screen.findByTestId('auth-email-code-link'))
    fireEvent.input(screen.getByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))
    fireEvent.input(await screen.findByTestId('auth-email-code-input'), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByTestId('auth-email-code-submit'))

    await waitFor(() =>
      expect(
        screen.getByText('That code is not valid or has expired'),
      ).toBeTruthy(),
    )
    expect(screen.getByTestId('auth-email-code-form')).toBeTruthy()
  })

  it('drops the mailed code when the reader goes back to sign in', async () => {
    // Leaving the flow must not leave a live ceremony behind for the next
    // pane to accidentally spend.
    codeMocks.requestLoginCode.mockResolvedValue('code-ceremony')
    render(() => <AuthModal />)
    openAuthModal('login')

    fireEvent.click(await screen.findByTestId('auth-email-code-link'))
    fireEvent.input(screen.getByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))
    fireEvent.input(await screen.findByTestId('auth-email-code-input'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByTestId('auth-email-code-back'))

    await waitFor(() =>
      expect(screen.getByTestId('auth-password')).toBeTruthy(),
    )
    fireEvent.click(screen.getByTestId('auth-email-code-link'))
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    const field = (await screen.findByTestId(
      'auth-email-code-input',
    )) as HTMLInputElement
    expect(field.value).toBe('')
  })
})

// ── Signing in with a passkey ────────────────────────────────────────
//
// The button must not exist unless BOTH the deployment and the browser can do
// it — a control that opens a dialog saying no reads as the site being broken.

describe('passkey sign-in', () => {
  function armPasskeys(): void {
    passkeyMocks.passkeysAvailable.mockResolvedValue(true)
    passkeyMocks.platformAuthenticatorAvailable.mockResolvedValue(true)
  }

  it('offers nothing where the deployment has no relying-party id', async () => {
    // A PR preview on workers.dev. The browser is willing; the domain cannot.
    passkeyMocks.passkeysAvailable.mockResolvedValue(false)
    passkeyMocks.platformAuthenticatorAvailable.mockResolvedValue(true)
    render(() => <AuthModal />)
    openAuthModal('login')

    await screen.findByTestId('auth-email')
    expect(screen.queryByTestId('auth-passkey')).not.toBeInTheDocument()
  })

  it('offers nothing where the browser has no authenticator', async () => {
    passkeyMocks.passkeysAvailable.mockResolvedValue(true)
    passkeyMocks.platformAuthenticatorAvailable.mockResolvedValue(false)
    render(() => <AuthModal />)
    openAuthModal('login')

    await screen.findByTestId('auth-email')
    expect(screen.queryByTestId('auth-passkey')).not.toBeInTheDocument()
  })

  it('signs in without asking for a second factor', async () => {
    // A user-verified passkey is possession and inherence in one gesture, so
    // the 2FA pane must NOT appear after one. This is the assertion that
    // catches somebody "helpfully" routing it through the same fork.
    armPasskeys()
    passkeyMocks.signInWithPasskey.mockResolvedValue({ token: 'jwt' })
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)
    openAuthModal('login')

    fireEvent.click(await screen.findByTestId('auth-passkey'))

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('auth-twofa-form')).not.toBeInTheDocument()
  })

  it('shows a cancelled dialog inline and stays open', async () => {
    armPasskeys()
    passkeyMocks.signInWithPasskey.mockRejectedValue(
      new Error('That was cancelled.'),
    )
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)
    openAuthModal('login')

    fireEvent.click(await screen.findByTestId('auth-passkey'))

    await waitFor(() =>
      expect(screen.getByText('That was cancelled.')).toBeTruthy(),
    )
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(screen.getByTestId('auth-modal-overlay')).toBeTruthy()
  })
})

// ── Conditional UI ───────────────────────────────────────────────────
//
// The mechanism behind "your password manager offers the passkey". It shows
// nothing by itself: the browser checks its own store and, if it holds one,
// puts it in the email field's autofill dropdown. So the things worth pinning
// are that it is armed without a press, that it is torn down with the form,
// and that its abort never reaches the screen as an error.

describe('passkey autofill', () => {
  function armConditional(): void {
    passkeyMocks.passkeysAvailable.mockResolvedValue(true)
    passkeyMocks.platformAuthenticatorAvailable.mockResolvedValue(true)
    passkeyMocks.conditionalMediationAvailable.mockResolvedValue(true)
  }

  it('tags the email field so the browser can offer a passkey there', async () => {
    render(() => <AuthModal />)
    openAuthModal('login')

    const email = (await screen.findByTestId('auth-email')) as HTMLInputElement
    // Without the `webauthn` token the conditional request has nowhere to
    // surface, and the whole feature silently does nothing.
    expect(email.getAttribute('autocomplete')).toBe('username webauthn')
  })

  it('arms itself on open, with no press', async () => {
    armConditional()
    passkeyMocks.signInWithPasskey.mockReturnValue(new Promise(() => {}))
    render(() => <AuthModal />)
    openAuthModal('login')

    await waitFor(() =>
      expect(passkeyMocks.signInWithPasskey).toHaveBeenCalledWith(
        expect.objectContaining({ conditional: true }),
      ),
    )
  })

  it('does not arm where the browser cannot offer autofill', async () => {
    passkeyMocks.passkeysAvailable.mockResolvedValue(true)
    passkeyMocks.platformAuthenticatorAvailable.mockResolvedValue(true)
    passkeyMocks.conditionalMediationAvailable.mockResolvedValue(false)
    render(() => <AuthModal />)
    openAuthModal('login')

    await screen.findByTestId('auth-email')
    expect(passkeyMocks.signInWithPasskey).not.toHaveBeenCalled()
  })

  it('aborts the request when the dialog closes', async () => {
    // A conditional request outliving its form leaves the browser's autofill
    // wired to a screen that has gone.
    armConditional()
    let captured: AbortSignal | undefined
    passkeyMocks.signInWithPasskey.mockImplementation(
      (opts: { signal?: AbortSignal }) => {
        captured = opts.signal
        return new Promise(() => {})
      },
    )
    render(() => <AuthModal />)
    openAuthModal('login')

    await waitFor(() => expect(captured).toBeDefined())
    expect(captured?.aborted).toBe(false)

    fireEvent.click(screen.getByTestId('auth-modal-close'))
    await waitFor(() => expect(captured?.aborted).toBe(true))
  })

  it('signs in when the reader picks the passkey out of autofill', async () => {
    armConditional()
    passkeyMocks.signInWithPasskey.mockResolvedValue({ token: 'jwt' })
    const onAuthenticated = vi.fn()
    render(() => <AuthModal onAuthenticated={onAuthenticated} />)
    openAuthModal('login')

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1))
  })
})
