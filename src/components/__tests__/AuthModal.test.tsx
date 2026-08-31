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

vi.mock('@/db/services/auth-service', () => mocks)

vi.mock('@/db/services/auth-mfa-service', () => ({
  verifyTwofa: (...a: unknown[]) => mfaMocks.verifyTwofa(...a),
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
