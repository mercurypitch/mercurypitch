// ============================================================
// Voice Mirror: the account dialog's host
// ============================================================
//
// The chunk the ask loads. A tap opens the shared dialog on its sign-up pane,
// marked as a host that adopts after a Google sign-up so the redirect carries
// the voiceprint hint. A Google return that lands here is said in a toast, a
// launch gift claimed with it is read, and a second factor still owed opens
// the dialog on its code pane.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthModalProps } from '@/components/account/AuthModal'
import type { GoogleRedirectResult } from '@/db/services/auth-service'
import { rememberGiftOffered, syncPromoClaims, } from '@/stores/launch-gift-store'
import { showNotification } from '@/stores/notifications-store'
import { openAuthModal } from '@/stores/ui-store'
import { askForAccount, resetAccountAskForTests, signUpAsked, takeGoogleLanding, } from './account-ask'
import MirrorAccountHost from './MirrorAccountHost'

const harness = vi.hoisted(() => ({
  result: null as GoogleRedirectResult | null,
  twofa: false,
  modalProps: [] as AuthModalProps[],
}))

vi.mock('@/db/services/account-known', () => ({
  accountKnownHere: () => false,
}))
vi.mock('@/db/services/auth-service', () => ({
  takeGoogleRedirectResult: () => {
    const taken = harness.result
    harness.result = null
    return taken
  },
  googleTwofaPending: () => harness.twofa,
}))
vi.mock('@/components/account/AuthModal', () => ({
  AuthModal: (props: AuthModalProps) => {
    harness.modalProps.push(props)
    return null
  },
}))
vi.mock('@/components/Notifications', () => ({ Notifications: () => null }))
vi.mock('@/stores/ui-store', () => ({ openAuthModal: vi.fn() }))
vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))
vi.mock('@/stores/launch-gift-store', () => ({
  rememberGiftOffered: vi.fn(),
  syncPromoClaims: vi.fn(async () => undefined),
}))

beforeEach(() => {
  harness.result = null
  harness.twofa = false
  harness.modalProps.length = 0
  vi.mocked(openAuthModal).mockClear()
  vi.mocked(showNotification).mockClear()
  vi.mocked(rememberGiftOffered).mockClear()
  vi.mocked(syncPromoClaims).mockClear()
})

afterEach(() => {
  cleanup()
  resetAccountAskForTests()
})

/** The host opens the dialog a microtask after it mounts (focus trap). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('a tap on the ask', () => {
  it('opens the dialog on its sign-up pane, as a host that adopts', async () => {
    askForAccount()
    render(() => <MirrorAccountHost />)
    await settle()

    expect(vi.mocked(openAuthModal).mock.calls).toEqual([['register']])
    expect(signUpAsked()).toBe(false)
    expect(harness.modalProps[0].adoptsGoogleSignup).toBe(true)
    // Remembered beside the gift, so a code that runs out is said later.
    expect(rememberGiftOffered).toHaveBeenCalledTimes(1)
  })

  it('opens it again on the next tap, with the host already loaded', async () => {
    askForAccount()
    render(() => <MirrorAccountHost />)
    await settle()

    askForAccount()
    await settle()

    expect(vi.mocked(openAuthModal).mock.calls).toEqual([
      ['register'],
      ['register'],
    ])
  })
})

describe('a Google return landing here', () => {
  it('says the sign-in landed and reads a launch gift claimed with it', () => {
    harness.result = { ok: true }
    takeGoogleLanding()
    render(() => <MirrorAccountHost />)

    expect(showNotification).toHaveBeenCalledWith(
      'Signed in with Google',
      'info',
    )
    expect(syncPromoClaims).toHaveBeenCalledWith({
      upgraded: true,
      verified: true,
    })
    expect(openAuthModal).not.toHaveBeenCalled()
  })

  it('says why a Google sign-in failed', () => {
    harness.result = { ok: false, error: 'that sign-in link expired.' }
    takeGoogleLanding()
    render(() => <MirrorAccountHost />)

    expect(showNotification).toHaveBeenCalledWith(
      'Google sign-in failed: that sign-in link expired.',
      'error',
    )
    expect(syncPromoClaims).not.toHaveBeenCalled()
  })

  it('says a sign-in canceled at Google in plain words, not its code', () => {
    harness.result = { ok: false, error: 'access_denied' }
    takeGoogleLanding()
    render(() => <MirrorAccountHost />)

    expect(showNotification).toHaveBeenCalledWith(
      'Google sign-in was canceled.',
      'error',
    )
  })

  it('opens the code pane when a second factor is still owed', async () => {
    harness.twofa = true
    takeGoogleLanding()
    render(() => <MirrorAccountHost />)
    await settle()

    expect(vi.mocked(openAuthModal).mock.calls).toEqual([['login']])
    expect(showNotification).not.toHaveBeenCalled()
  })
})
