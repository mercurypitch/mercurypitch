// ============================================================
// startGoogleSignIn — the shared half of "Continue with Google"
// ============================================================
//
// The three surfaces that offer the button each had their own copy of this,
// and only one copy was tested. This is the copy that is left.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  googleSignInUrl: vi.fn(async () => 'https://accounts.google.com/consent?x=1'),
  assign: vi.fn(),
}))

vi.mock('@/db/services/auth-service', () => ({
  googleSignInUrl: mocks.googleSignInUrl,
}))

import { GOOGLE_SIGN_IN_UNREACHABLE, startGoogleSignIn, } from '@/lib/google-sign-in'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.googleSignInUrl.mockResolvedValue(
    'https://accounts.google.com/consent?x=1',
  )
  // jsdom refuses a real navigation; the assertion is that we asked for one.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign: mocks.assign, href: 'http://localhost/' },
  })
})

describe('startGoogleSignIn', () => {
  it('navigates to the consent url the worker handed back', async () => {
    await expect(startGoogleSignIn()).resolves.toBeNull()

    expect(mocks.assign).toHaveBeenCalledWith(
      'https://accounts.google.com/consent?x=1',
    )
    // Asked for, not assembled — the device secret rides in the POST body,
    // and a secret in a query string lands in history and Referer headers.
    expect(mocks.googleSignInUrl).toHaveBeenCalledTimes(1)
  })

  it('reports the failure instead of navigating to nothing', async () => {
    mocks.googleSignInUrl.mockRejectedValue(new Error('offline'))

    await expect(startGoogleSignIn()).resolves.toBe(GOOGLE_SIGN_IN_UNREACHABLE)
    expect(mocks.assign).not.toHaveBeenCalled()
  })

  it('never rejects, so a click handler cannot die silently', async () => {
    // The reason this returns a message rather than throwing. A rejected
    // handler leaves the button looking dead: nothing navigates, nothing is
    // said, and the only trace is an unhandled rejection in a console the
    // singer is not reading.
    mocks.googleSignInUrl.mockRejectedValue(new Error('500'))

    await expect(startGoogleSignIn()).resolves.not.toThrow()
  })
})
