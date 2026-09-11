// Whether a foreground is worth a round trip, and whether one happens.
//
// The failure this guards against is quiet in both directions: refresh on
// every app switch and the app spends a request each time it is glanced at;
// refresh on none and a phone opened once a fortnight meets a sign-in screen
// on day thirty-one, with no anonymous fallback behind it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  tokenIssuedAt: vi.fn<() => number | null>(() => null),
  refreshSession: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@/db/services/auth-service', () => ({
  tokenIssuedAt: () => mocks.tokenIssuedAt(),
  refreshSession: () => mocks.refreshSession(),
}))

import { installForegroundSessionRefresh, REFRESH_AFTER_MS, sessionNeedsRefresh, } from '@/features/account/session-refresh'

const NOW = Date.UTC(2026, 8, 11, 12, 0, 0)

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

let teardown: (() => void) | null = null

beforeEach(() => {
  setVisibility('visible')
  mocks.tokenIssuedAt.mockReturnValue(null)
})

afterEach(() => {
  teardown?.()
  teardown = null
  vi.clearAllMocks()
})

describe('sessionNeedsRefresh', () => {
  it('says no when there is no session at all', () => {
    mocks.tokenIssuedAt.mockReturnValue(null)

    expect(sessionNeedsRefresh(NOW)).toBe(false)
  })

  it('says no for a token issued this morning', () => {
    mocks.tokenIssuedAt.mockReturnValue(NOW - 60_000)

    expect(sessionNeedsRefresh(NOW)).toBe(false)
  })

  it('says yes once it has passed the threshold', () => {
    mocks.tokenIssuedAt.mockReturnValue(NOW - REFRESH_AFTER_MS - 1)

    expect(sessionNeedsRefresh(NOW)).toBe(true)
  })
})

describe('installForegroundSessionRefresh', () => {
  it('refreshes an old session as soon as it is installed', () => {
    // A cold start IS a foreground arrival, and it follows the longest gap —
    // an app not opened in three weeks never fires a visibility change at all.
    mocks.tokenIssuedAt.mockReturnValue(Date.now() - REFRESH_AFTER_MS - 1)

    teardown = installForegroundSessionRefresh()

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
  })

  it('refreshes when the app comes back to the foreground', async () => {
    mocks.tokenIssuedAt.mockReturnValue(Date.now() - 60_000)
    teardown = installForegroundSessionRefresh()
    expect(mocks.refreshSession).not.toHaveBeenCalled()

    mocks.tokenIssuedAt.mockReturnValue(Date.now() - REFRESH_AFTER_MS - 1)
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
  })

  it('does nothing on the way out', () => {
    mocks.tokenIssuedAt.mockReturnValue(Date.now() - REFRESH_AFTER_MS - 1)
    setVisibility('hidden')

    teardown = installForegroundSessionRefresh()
    document.dispatchEvent(new Event('visibilitychange'))

    expect(mocks.refreshSession).not.toHaveBeenCalled()
  })

  it('does not stack requests while one is in flight', async () => {
    let release: (() => void) | undefined
    mocks.refreshSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(null)
        }),
    )
    mocks.tokenIssuedAt.mockReturnValue(Date.now() - REFRESH_AFTER_MS - 1)

    teardown = installForegroundSessionRefresh()
    document.dispatchEvent(new Event('visibilitychange'))
    document.dispatchEvent(new Event('visibilitychange'))

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
    release?.()
    await Promise.resolve()
  })

  it('stops listening when torn down', () => {
    mocks.tokenIssuedAt.mockReturnValue(Date.now() - REFRESH_AFTER_MS - 1)
    const stop = installForegroundSessionRefresh()
    mocks.refreshSession.mockClear()

    stop()
    document.dispatchEvent(new Event('visibilitychange'))

    expect(mocks.refreshSession).not.toHaveBeenCalled()
  })
})
