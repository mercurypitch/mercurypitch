// ============================================================
// AppErrorBoundary — what counts as a crash
// ============================================================
//
// Two listeners are attached to `error` and `unhandledrejection`: one from
// src/lib/global-error-handler.ts at boot, and one from this component on
// mount. The first calls preventDefault() for network failures, which is easy
// to read as "handled" — it is not. preventDefault suppresses the browser's
// default action only; every other listener on the target still runs. So the
// component's own handler needs the same filter, or the app shows a crash
// screen every time the backend is briefly unreachable.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupGlobalErrorHandler } from '@/components/AppErrorBoundary'
import { appError, setAppError } from '@/stores/app-store'

/**
 * jsdom has no PromiseRejectionEvent constructor, and the handler only reads
 * `.reason`, so a plain Event carrying one is a faithful stand-in for what the
 * browser dispatches.
 */
function dispatchRejection(reason: unknown): void {
  const event = new Event('unhandledrejection') as Event & { reason: unknown }
  event.reason = reason
  window.dispatchEvent(event)
}

describe('setupGlobalErrorHandler', () => {
  let teardown: (() => void) | undefined

  beforeEach(() => {
    teardown?.()
    setAppError(null)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    teardown = setupGlobalErrorHandler()
  })

  it.each([
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
  ])('does not raise a crash for: %s', (message) => {
    dispatchRejection(new Error(message))
    expect(appError()).toBeNull()
  })

  it('still raises a crash for a genuine application error', () => {
    // The negative control. Without this, a handler that swallowed everything
    // would pass every case above.
    dispatchRejection(new TypeError('cannot read properties of undefined'))
    expect(appError()?.error.message).toBe(
      'cannot read properties of undefined',
    )
  })

  it('ignores a ResizeObserver loop, which browsers surface as an error', () => {
    const event = new ErrorEvent('error', {
      message: 'ResizeObserver loop completed with undelivered notifications.',
    })
    window.dispatchEvent(event)
    expect(appError()).toBeNull()
  })

  it('stops listening once torn down', () => {
    teardown?.()
    teardown = undefined
    dispatchRejection(new TypeError('after teardown'))
    expect(appError()).toBeNull()
  })
})
