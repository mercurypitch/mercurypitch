import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initGlobalErrorHandlers, isNetworkError, isStaleBuildError, } from './global-error-handler'
import { requestUpdateCheck } from './pwa-service-worker'

// The service worker is not the subject here — only whether this module reaches
// for it — so the whole registration path is replaced by one spy.
vi.mock('./pwa-service-worker', () => ({ requestUpdateCheck: vi.fn() }))

const askedForUpdate = vi.mocked(requestUpdateCheck)

/** jsdom has no PromiseRejectionEvent, and the handler only reads `.reason`. */
function rejection(reason: unknown): Event & { reason: unknown } {
  const event = new Event('unhandledrejection', {
    cancelable: true,
  }) as Event & {
    reason: unknown
  }
  event.reason = reason
  return event
}

describe('isNetworkError', () => {
  it.each([
    ['a browser TypeError', new TypeError('Failed to fetch')],
    ['a bare string', 'NetworkError when attempting to fetch resource.'],
    ['something error-shaped', { message: 'Load failed' }],
  ])('recognises %s', (_label, reason) => {
    expect(isNetworkError(reason)).toBe(true)
  })

  it.each([
    ['an application bug', new TypeError('x is not a function')],
    ['a value with no message at all', 42],
    ['nothing', null],
  ])('leaves %s alone', (_label, reason) => {
    expect(isNetworkError(reason)).toBe(false)
  })
})

describe('isStaleBuildError', () => {
  it.each([
    'Failed to fetch dynamically imported module: /assets/Exercises-D3adB33f.js',
    'error loading dynamically imported module: /assets/Exercises-D3adB33f.js',
    'Importing a module script failed.',
    "Unexpected token '<'",
    "expected expression, got '<'",
    "Unexpected token: '<'",
    `Unexpected token '<', "<!doctype "... is not valid JSON`,
  ])('recognises a build the origin no longer serves: %s', (message) => {
    expect(isStaleBuildError(new SyntaxError(message))).toBe(true)
  })

  it.each([
    'x is not a function',
    'Cannot read properties of undefined',
    'Unexpected token }',
    'Failed to fetch',
  ])('does not claim an ordinary failure: %s', (message) => {
    expect(isStaleBuildError(new Error(message))).toBe(false)
  })
})

describe('the global handlers', () => {
  // initGlobalErrorHandlers() wraps console.error itself, so the spy has to be
  // in place first — afterwards, `console.error` is the wrapper, not the mock.
  const consoleError = vi.fn()
  const consoleInfo = vi.fn()
  const consoleLog = vi.fn()

  beforeAll(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(consoleError)
    vi.spyOn(console, 'info').mockImplementation(consoleInfo)
    vi.spyOn(console, 'log').mockImplementation(consoleLog)
    initGlobalErrorHandlers()
  })

  beforeEach(() => {
    askedForUpdate.mockClear()
  })

  it('checks for an update when a chunk from a replaced build fails', () => {
    const event = rejection(
      new TypeError(
        'Failed to fetch dynamically imported module: /assets/Exercises-D3adB33f.js',
      ),
    )

    window.dispatchEvent(event)

    // Checked before the network filter, which the same message also matches:
    // only this branch asks for the update that actually fixes it.
    expect(askedForUpdate).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('checks for an update when HTML is parsed as a script', () => {
    const event = new ErrorEvent('error', {
      message: "Uncaught SyntaxError: Unexpected token '<'",
      error: new SyntaxError("Unexpected token '<'"),
      cancelable: true,
    })

    window.dispatchEvent(event)

    expect(askedForUpdate).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('recognises the same failure when only the message survives', () => {
    // A cross-origin or browser-injected script gives no error object.
    const event = new ErrorEvent('error', {
      message: "Uncaught SyntaxError: expected expression, got '<'",
      cancelable: true,
    })

    window.dispatchEvent(event)

    expect(askedForUpdate).toHaveBeenCalledTimes(1)
  })

  it('does not ask for an update when the backend is simply unreachable', () => {
    const event = rejection(new TypeError('Failed to fetch'))

    window.dispatchEvent(event)

    expect(askedForUpdate).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('does not ask for an update for an application bug', () => {
    consoleError.mockClear()

    window.dispatchEvent(rejection(new TypeError('x is not a function')))

    expect(askedForUpdate).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      'Unhandled promise rejection:',
      expect.any(TypeError),
    )
  })

  it('treats an unreachable backend as degraded, not broken', () => {
    const event = new ErrorEvent('error', {
      message: 'Failed to fetch',
      error: new TypeError('Failed to fetch'),
      cancelable: true,
    })

    window.dispatchEvent(event)

    expect(askedForUpdate).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('reports a genuine error, with or without an error object', () => {
    consoleError.mockClear()

    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'x is not a function',
        error: new TypeError('x is not a function'),
        cancelable: true,
      }),
    )
    window.dispatchEvent(
      new ErrorEvent('error', { message: 'Script error.', cancelable: true }),
    )

    expect(consoleError).toHaveBeenNthCalledWith(
      1,
      'Global error:',
      expect.any(TypeError),
    )
    expect(consoleError).toHaveBeenNthCalledWith(
      2,
      'Global error:',
      'Script error.',
    )
    expect(askedForUpdate).not.toHaveBeenCalled()
  })

  it('keeps capturing console output for the in-app developer console', () => {
    consoleInfo.mockClear()
    consoleLog.mockClear()

    console.info('info line')
    console.log('log line')

    expect(consoleInfo).toHaveBeenCalledWith('info line')
    expect(consoleLog).toHaveBeenCalledWith('log line')
  })

  it('leaves ResizeObserver noise alone', () => {
    const event = new ErrorEvent('error', {
      message: 'ResizeObserver loop completed with undelivered notifications.',
      cancelable: true,
    })

    window.dispatchEvent(event)

    expect(askedForUpdate).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })
})
