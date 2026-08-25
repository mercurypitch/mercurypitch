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

import { getGoogleSignInUnavailableReason, GOOGLE_SIGN_IN_PR_PREVIEW_UNAVAILABLE, GOOGLE_SIGN_IN_UNREACHABLE, googleSignInPending, resetGoogleSignInPending, startGoogleSignIn, } from '@/lib/google-sign-in'

beforeEach(() => {
  vi.clearAllMocks()
  resetGoogleSignInPending()
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
  it('explains why Google is unavailable only on pull request previews', () => {
    expect(getGoogleSignInUnavailableReason(true)).toBe(
      GOOGLE_SIGN_IN_PR_PREVIEW_UNAVAILABLE,
    )
    expect(getGoogleSignInUnavailableReason(false)).toBeNull()
  })

  it('does not contact the auth worker from a pull request preview', async () => {
    vi.resetModules()
    vi.doMock('@/lib/defaults', () => ({ IS_PR_PREVIEW: true }))

    try {
      const previewSignIn = await import('@/lib/google-sign-in')

      await expect(previewSignIn.startGoogleSignIn()).resolves.toBe(
        GOOGLE_SIGN_IN_PR_PREVIEW_UNAVAILABLE,
      )
      expect(mocks.googleSignInUrl).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock('@/lib/defaults')
      vi.resetModules()
    }
  })

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

  it('rolls back a prepared return intent when fetching the consent url fails', async () => {
    const rollback = vi.fn()
    const prepareRedirect = vi.fn(() => rollback)
    mocks.googleSignInUrl.mockRejectedValue(new Error('offline'))

    await expect(startGoogleSignIn({ prepareRedirect })).resolves.toBe(
      GOOGLE_SIGN_IN_UNREACHABLE,
    )

    expect(prepareRedirect).toHaveBeenCalledOnce()
    expect(rollback).toHaveBeenCalledOnce()
    expect(mocks.assign).not.toHaveBeenCalled()
  })

  it('rolls back a prepared return intent when browser navigation throws', async () => {
    const rollback = vi.fn()
    const prepareRedirect = vi.fn(() => rollback)
    mocks.assign.mockImplementationOnce(() => {
      throw new Error('navigation blocked')
    })

    await expect(startGoogleSignIn({ prepareRedirect })).resolves.toBe(
      GOOGLE_SIGN_IN_UNREACHABLE,
    )

    expect(prepareRedirect).toHaveBeenCalledOnce()
    expect(rollback).toHaveBeenCalledOnce()
  })

  it('never rejects, so a click handler cannot die silently', async () => {
    // The reason this returns a message rather than throwing. A rejected
    // handler leaves the button looking dead: nothing navigates, nothing is
    // said, and the only trace is an unhandled rejection in a console the
    // singer is not reading.
    mocks.googleSignInUrl.mockRejectedValue(new Error('500'))

    await expect(startGoogleSignIn()).resolves.not.toThrow()
  })

  it('is pending while the consent url is in flight, and eats the double click', async () => {
    // On a slow connection the fetch takes visible seconds; the buttons
    // read this signal to disable themselves and show progress, and a
    // second press must not start a second redirect (owner report,
    // 2026-08-17).
    let release: (url: string) => void = () => {}
    mocks.googleSignInUrl.mockReturnValue(
      new Promise<string>((resolve) => {
        release = resolve
      }),
    )

    const first = startGoogleSignIn()
    expect(googleSignInPending()).toBe(true)
    await expect(startGoogleSignIn()).resolves.toBeNull() // the double click
    release('https://accounts.google.com/consent?x=2')
    await first

    expect(mocks.googleSignInUrl).toHaveBeenCalledTimes(1)
    expect(mocks.assign).toHaveBeenCalledTimes(1)
    // Still pending after success: the page is about to unload, and
    // re-enabling for that instant invites the double redirect.
    expect(googleSignInPending()).toBe(true)
  })

  it('clears pending after a failure so the button works again', async () => {
    mocks.googleSignInUrl.mockRejectedValue(new Error('offline'))
    await startGoogleSignIn()
    expect(googleSignInPending()).toBe(false)
  })

  it('every Google button is wired to the shared pending state', async () => {
    const { readFileSync } = await import('node:fs')
    for (const file of [
      'src/components/account/AuthModal.tsx',
      'src/components/account/AccountSection.tsx',
      'src/features/karaoke-night/KaraokeAccount.tsx',
    ]) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).toContain('disabled={googleSignInPending()}')
      expect(source, file).toContain("'Opening Google\\u2026'")
    }
  })
})
