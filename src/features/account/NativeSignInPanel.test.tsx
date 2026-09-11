// ============================================================
// The developer screen offers what the platform actually has
// ============================================================
//
// The panel is a diagnostic: its whole job is to tell "this device cannot do
// Apple sign-in" apart from "this build is misconfigured". An Apple button on
// Android collapses those two into one failure box, which is the opposite of
// what the screen is for — so it uses the same predicate the product surfaces
// do, and says so plainly if it is somehow pressed anyway.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class NativeSignInError extends Error {
    readonly kind: string
    constructor(kind: string, message: string) {
      super(message)
      this.kind = kind
      this.name = 'NativeSignInError'
    }
  }
  return {
    NativeSignInError,
    appleOffered: true,
    signInWithApple: vi.fn(),
    signInWithGoogle: vi.fn(),
  }
})

vi.mock('./sign-in-methods', () => ({
  appleSignInOffered: () => mocks.appleOffered,
  nativeGoogleSignInOffered: () => true,
  webGoogleSignInOffered: () => false,
}))

vi.mock('./native-sign-in', () => ({
  NativeSignInError: mocks.NativeSignInError,
  signInWithApple: () => mocks.signInWithApple(),
  signInWithGoogle: () => mocks.signInWithGoogle(),
}))

vi.mock('@/db/services/auth-service', () => ({
  authErrorDetails: () => null,
  isTwofaChallenge: (outcome: unknown) =>
    (outcome as { twofaRequired?: boolean } | null)?.twofaRequired === true,
  refreshSession: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@/db/services/user-service', () => ({
  getUserId: () => 'device-user-id',
}))

vi.mock('@/lib/storage-port', () => ({
  flushStoragePort: () => Promise.resolve(),
  storageDurable: () => true,
  storagePortSnapshot: () => ({
    'mp:userId': null,
    'mp:deviceSecret': null,
    'mp:authToken': null,
  }),
}))

import { NativeSignInPanel } from './NativeSignInPanel'

beforeEach(() => {
  mocks.appleOffered = true
  vi.clearAllMocks()
  mocks.signInWithGoogle.mockResolvedValue({
    token: 'jwt',
    userId: 'u-1',
    isNew: false,
    user: { authProvider: 'google', email: 'a@b.com' },
  })
})

describe('on a platform that offers Apple', () => {
  it('draws the Apple button beside the others', () => {
    render(() => <NativeSignInPanel />)

    expect(screen.getByTestId('native-signin-apple')).toBeTruthy()
    expect(screen.getByTestId('native-signin-google')).toBeTruthy()
  })
})

describe('on Android', () => {
  beforeEach(() => {
    mocks.appleOffered = false
  })

  it('does not draw the Apple button at all', () => {
    render(() => <NativeSignInPanel />)

    expect(screen.queryByTestId('native-signin-apple')).toBeNull()
  })

  it('still draws every button that does work there', () => {
    render(() => <NativeSignInPanel />)

    expect(screen.getByTestId('native-signin-google')).toBeTruthy()
    expect(screen.getByTestId('native-signin-refresh')).toBeTruthy()
    expect(screen.getByTestId('native-signin-storage')).toBeTruthy()
  })
})

describe('an Apple press that gets through anyway', () => {
  it('says the platform does not offer it, and asks the plugin nothing', async () => {
    // The button is drawn, then the platform answer changes under it — which
    // is the only way to reach this branch, and exactly why the branch is
    // there: a stale render must not send a sheet request to a phone with no
    // sheet and report the refusal as a configuration fault.
    render(() => <NativeSignInPanel />)
    mocks.appleOffered = false

    fireEvent.click(screen.getByTestId('native-signin-apple'))

    await waitFor(() => {
      const output = screen.getByTestId(
        'native-signin-result',
      ) as HTMLTextAreaElement
      expect(output.value).toContain('not offered on this platform')
    })
    expect(mocks.signInWithApple).not.toHaveBeenCalled()
  })
})
