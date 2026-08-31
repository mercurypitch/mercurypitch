// ── The four conditions, each of which is a way this could become a nag ──
//
// The strip appears unprompted, to somebody who did not ask to sign in. So the
// tests that matter most are the ones asserting it stays HIDDEN: before
// onboarding, for a first-time device, for somebody already signed in, and
// after a dismissal.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as LastSignIn from '@/lib/last-sign-in'

const mocks = vi.hoisted(() => ({
  restoreAuth: vi.fn(async () => undefined),
  fetchMe: vi.fn(),
  signInWithPasskey: vi.fn(),
  startGoogleSignIn: vi.fn(async () => null),
  lastSignInMethod: vi.fn(() => 'passkey' as string),
  isFirstRun: vi.fn(() => false),
  openAuthModal: vi.fn(),
  showNotification: vi.fn(),
  returningPromptDismissed: vi.fn(() => false),
  dismissReturningPrompt: vi.fn(),
}))

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'http://api.test' }))

vi.mock('@/db/services/auth-service', () => ({
  restoreAuth: () => mocks.restoreAuth(),
  fetchMe: () => mocks.fetchMe(),
}))

vi.mock('@/db/services/auth-passkey-service', () => ({
  signInWithPasskey: (...a: unknown[]) => mocks.signInWithPasskey(...a),
}))

vi.mock('@/lib/google-sign-in', () => ({
  startGoogleSignIn: () => mocks.startGoogleSignIn(),
  googleSignInPending: () => false,
  googleSignInUnavailableReason: null,
}))

// The device's note is stubbed so each test can set it, but the LABEL is the
// real one: the assertions below are about the words a reader sees, and a
// stubbed label would let them pass while the button said something else.
vi.mock('@/lib/last-sign-in', async () => ({
  ...(await vi.importActual<typeof LastSignIn>('@/lib/last-sign-in')),
  lastSignInMethod: () => mocks.lastSignInMethod(),
  returningPromptDismissed: () => mocks.returningPromptDismissed(),
  dismissReturningPrompt: () => mocks.dismissReturningPrompt(),
}))

vi.mock('@/stores/onboarding-store', () => ({
  isFirstRun: () => mocks.isFirstRun(),
}))

vi.mock('@/stores/ui-store', () => ({
  openAuthModal: (...a: unknown[]) => mocks.openAuthModal(...a),
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: (...a: unknown[]) => mocks.showNotification(...a),
}))

vi.mock('@/lib/webauthn', () => ({
  describeWebAuthnError: (err: unknown) =>
    err instanceof Error ? err.message : '',
}))

import { ReturningSignIn } from '@/components/account/ReturningSignIn'

/** A signed-out probe: an anonymous device identity, not a real account. */
const SIGNED_OUT = { user: { authProvider: 'anonymous' }, profile: null }
const SIGNED_IN = { user: { authProvider: 'password' }, profile: null }

beforeEach(() => {
  localStorage.clear()
  mocks.fetchMe.mockResolvedValue(SIGNED_OUT)
  mocks.lastSignInMethod.mockReturnValue('passkey')
  mocks.isFirstRun.mockReturnValue(false)
  mocks.returningPromptDismissed.mockReturnValue(false)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('when it stays out of the way', () => {
  it('says nothing to a visitor who has never finished onboarding', async () => {
    // The condition asked for by name: no sign-in prompt before somebody has
    // actually used the app. There is nothing to keep yet.
    mocks.isFirstRun.mockReturnValue(true)
    render(() => <ReturningSignIn />)

    await waitFor(() => expect(mocks.fetchMe).toHaveBeenCalled())
    expect(screen.queryByTestId('returning-signin')).toBeNull()
  })

  it('says nothing on a device that has never signed in', async () => {
    // No remembered method means no guess to offer. This is also every
    // first-time visitor, onboarding finished or not.
    mocks.lastSignInMethod.mockReturnValue('')
    render(() => <ReturningSignIn />)

    await waitFor(() => expect(mocks.fetchMe).toHaveBeenCalled())
    expect(screen.queryByTestId('returning-signin')).toBeNull()
  })

  it('says nothing to somebody already signed in', async () => {
    mocks.fetchMe.mockResolvedValue(SIGNED_IN)
    render(() => <ReturningSignIn />)

    await waitFor(() => expect(mocks.fetchMe).toHaveBeenCalled())
    expect(screen.queryByTestId('returning-signin')).toBeNull()
  })

  it('never provisions an identity just by rendering', async () => {
    // Home renders on every load. If this restored-and-created, every visit
    // would mint an account.
    render(() => <ReturningSignIn />)
    await waitFor(() => expect(mocks.restoreAuth).toHaveBeenCalled())
    expect(mocks.fetchMe).toHaveBeenCalledTimes(1)
  })

  it('records the dismissal, permanently', async () => {
    render(() => <ReturningSignIn />)

    await waitFor(() =>
      expect(screen.getByTestId('returning-signin')).toBeTruthy(),
    )
    fireEvent.click(screen.getByTestId('returning-signin-dismiss'))

    // Written through to the device, not just hidden for this render: a
    // prompt that has to be dismissed twice is a nag.
    expect(mocks.dismissReturningPrompt).toHaveBeenCalledTimes(1)
  })

  it('says nothing once the visitor has dismissed it', async () => {
    mocks.returningPromptDismissed.mockReturnValue(true)
    render(() => <ReturningSignIn />)

    await waitFor(() => expect(mocks.fetchMe).toHaveBeenCalled())
    expect(screen.queryByTestId('returning-signin')).toBeNull()
  })
})

describe('when it offers a way back in', () => {
  it('offers the passkey, and never names the person', async () => {
    // Privacy: the strip knows only the method. A shared laptop must not
    // announce who practises on it.
    render(() => <ReturningSignIn />)

    const strip = await screen.findByTestId('returning-signin')
    expect(screen.getByTestId('returning-signin-action').textContent).toBe(
      'Sign in with your passkey',
    )
    expect(strip.textContent).not.toMatch(/@/)
  })

  it('opens the system dialog on a press, not before', async () => {
    // A press is the one moment a non-conditional get() is correct. Rendering
    // must not have called it.
    mocks.signInWithPasskey.mockResolvedValue({ token: 'jwt' })
    render(() => <ReturningSignIn />)

    await screen.findByTestId('returning-signin-action')
    expect(mocks.signInWithPasskey).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('returning-signin-action'))
    await waitFor(() =>
      expect(mocks.signInWithPasskey).toHaveBeenCalledTimes(1),
    )
    expect(mocks.showNotification).toHaveBeenCalledWith('Signed in', 'info')
  })

  it('starts the Google redirect when that is the remembered way', async () => {
    mocks.lastSignInMethod.mockReturnValue('google')
    render(() => <ReturningSignIn />)

    const action = await screen.findByTestId('returning-signin-action')
    expect(action.textContent).toBe('Continue with Google')
    fireEvent.click(action)
    await waitFor(() => expect(mocks.startGoogleSignIn).toHaveBeenCalled())
  })

  it('sends the password and mailed-code methods to the form', async () => {
    // Neither can complete without one, and the modal already is that form.
    mocks.lastSignInMethod.mockReturnValue('emailcode')
    render(() => <ReturningSignIn />)

    fireEvent.click(await screen.findByTestId('returning-signin-action'))
    await waitFor(() =>
      expect(mocks.openAuthModal).toHaveBeenCalledWith('login'),
    )
  })

  it('always offers another way, because the guess can be wrong', async () => {
    // Somebody who has since changed how they sign in must not be cornered by
    // a remembered method that no longer works for them.
    render(() => <ReturningSignIn />)

    fireEvent.click(await screen.findByTestId('returning-signin-other'))
    expect(mocks.openAuthModal).toHaveBeenCalledWith('login')
  })

  it('shows a failed passkey inline and keeps the strip', async () => {
    mocks.signInWithPasskey.mockRejectedValue(new Error('That was cancelled.'))
    render(() => <ReturningSignIn />)

    fireEvent.click(await screen.findByTestId('returning-signin-action'))

    await waitFor(() =>
      expect(screen.getByTestId('returning-signin-error').textContent).toBe(
        'That was cancelled.',
      ),
    )
    expect(screen.getByTestId('returning-signin')).toBeTruthy()
  })
})
