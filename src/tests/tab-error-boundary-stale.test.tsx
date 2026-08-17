// ============================================================
// TabErrorBoundary and the build that no longer exists
// ============================================================
//
// Every tab renders inside TabErrorBoundary, so a lazy route whose chunk a
// deploy has replaced rejects HERE first — AppErrorBoundary's stale-build
// handling (in place since 38c6d2bb) never saw it, and the owner got the
// crash modal on the Progress tab instead of the auto-recovery
// (ProgressRoute-BtOPqb-9.js, dev, 2026-08-17). The tab boundary must make
// the same distinction the app boundary makes: a missing chunk is an
// update, not a crash.

import { cleanup, render } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STALE_RELOAD_STAMP_KEY } from '@/components/StaleBuildRecovery'
import { TabErrorBoundary } from '@/components/TabErrorBoundary'
import { reloadToLatest } from '@/lib/pwa-service-worker'
import { setAppError } from '@/stores/app-store'

vi.mock('@/lib/pwa-service-worker', () => ({
  reloadToLatest: vi.fn(async () => Promise.resolve()),
  requestUpdateCheck: vi.fn(),
}))

// What Solid's lazy() surfaces when the origin has replaced this build's
// chunks: the dynamic import rejects during render, inside the boundary —
// the window listeners that filter stale-build failures never run.
const ThrowStaleImport: Component = () => {
  throw new TypeError(
    'Failed to fetch dynamically imported module: https://dev.mercurypitch.com/assets/ProgressRoute-BtOPqb-9.js',
  )
  return <div>Not rendered</div>
}

const ThrowError: Component = () => {
  throw new Error('Test crash')
  return <div>Not rendered</div>
}

describe('TabErrorBoundary', () => {
  afterEach(() => {
    cleanup()
    setAppError(null)
  })
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.removeItem(STALE_RELOAD_STAMP_KEY)
  })

  it('treats a stale-chunk render error as an update, not a tab crash', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { queryByText, findByText } = render(() => (
      <TabErrorBoundary tabName="Progress">
        <ThrowStaleImport />
      </TabErrorBoundary>
    ))

    const notice = await findByText(/new version/i)
    expect(notice).toBeDefined()
    expect(queryByText('Application Error')).toBeNull()
    // It recovers on its own — the reload that escapes the worker cache.
    expect(reloadToLatest).toHaveBeenCalledTimes(1)

    errSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('still isolates an ordinary tab crash into the crash modal', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { findByText } = render(() => (
      <TabErrorBoundary tabName="Progress">
        <ThrowError />
      </TabErrorBoundary>
    ))

    const title = await findByText('Application Error')
    expect(title).toBeDefined()
    expect(reloadToLatest).not.toHaveBeenCalled()

    errSpy.mockRestore()
  })
})
