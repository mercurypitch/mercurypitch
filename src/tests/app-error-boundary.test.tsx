import { cleanup, render } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { STALE_RELOAD_STAMP_KEY } from '@/components/StaleBuildRecovery'
import { reloadToLatest } from '@/lib/pwa-service-worker'
import { appError } from '@/stores'

vi.mock('@/lib/pwa-service-worker', () => ({
  reloadToLatest: vi.fn(async () => Promise.resolve()),
  requestUpdateCheck: vi.fn(),
}))

const ThrowError: Component = () => {
  throw new Error('Test crash')
  return <div>Not rendered</div>
}

// What Solid's lazy() surfaces when a deploy has replaced this build's chunks:
// the dynamic import rejects during render, so the error reaches the
// ErrorBoundary fallback — never the window listeners that filter stale-build
// failures. Reproduces the dev crash of 2026-08-16 (ChallengeResultCard).
const ThrowStaleImport: Component = () => {
  throw new TypeError(
    'Failed to fetch dynamically imported module: https://dev.mercurypitch.com/assets/ChallengeResultCard-BqIUZ1HO.js',
  )
  return <div>Not rendered</div>
}

describe('AppErrorBoundary', () => {
  afterEach(cleanup)
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.removeItem(STALE_RELOAD_STAMP_KEY)
  })

  it('catches render errors and displays CrashModal', async () => {
    // Silence expected React/Solid error logs for cleaner test output
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { findByText } = render(() => (
      <AppErrorBoundary>
        <ThrowError />
      </AppErrorBoundary>
    ))

    // Wait for the modal to be displayed
    const title = await findByText('Application Error')
    expect(title).toBeDefined()

    // Check if the specific error message from the thrown error is displayed
    const message = await findByText('Test crash')
    expect(message).toBeDefined()

    // Check that the global appError signal was properly populated
    expect(appError()).not.toBeNull()
    expect(appError()?.error.message).toBe('Test crash')

    errSpy.mockRestore()
  })

  it('treats a stale-chunk render error as an update, not a crash', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { queryByText, findByText } = render(() => (
      <AppErrorBoundary>
        <ThrowStaleImport />
      </AppErrorBoundary>
    ))

    // The recovery UI, not the crash modal: this failure is fixed by moving to
    // the current build, and "Reload App" on the crash modal could not do that
    // (a plain reload re-serves the same dead build from the worker's cache).
    const notice = await findByText(/new version/i)
    expect(notice).toBeDefined()
    expect(queryByText('Application Error')).toBeNull()
    // And it recovers on its own — the reload that escapes the worker cache.
    expect(reloadToLatest).toHaveBeenCalledTimes(1)

    errSpy.mockRestore()
    warnSpy.mockRestore()
  })
})
