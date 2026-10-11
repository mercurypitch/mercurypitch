// ============================================================
// The Turnstile widget
// ============================================================
//
// This component decides whether the CAPTCHA exists at all: it renders only
// when a site key is configured, and the token it hands back is the only
// thing standing between a user and the worker's fail-closed gate. Until now
// none of that was covered, because the site key is empty in a test build and
// the whole enabled path was unreachable.
//
// The site key is read at module load, so each test resets the module
// registry and imports a fresh copy rather than trying to change a const.

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SITE_KEY = '0xTESTSITEKEY'

let appended: HTMLScriptElement[] = []

beforeEach(() => {
  vi.resetModules()
  appended = []
  vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
    appended.push(node as HTMLScriptElement)
    return node
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete window.turnstile
})

/** Load the component with a site key configured. */
async function withSiteKey(key: string = SITE_KEY) {
  vi.doMock('@/lib/defaults', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    TURNSTILE_SITE_KEY: key,
  }))
  return await import('./Turnstile')
}

/** Load the component the way every build without a key sees it. */
async function withoutSiteKey() {
  vi.doMock('@/lib/defaults', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    TURNSTILE_SITE_KEY: '',
  }))
  return await import('./Turnstile')
}

function fakeTurnstile() {
  // Typed parameters, not bare `vi.fn()`: without them `mock.calls` infers as
  // an empty tuple and every read of an argument is a type error.
  const api = {
    render: vi.fn(
      (_el: HTMLElement, _opts: Record<string, unknown>) => 'widget-1',
    ),
    remove: vi.fn((_id: string) => undefined),
    reset: vi.fn((_id?: string) => undefined),
  }
  window.turnstile = api
  return api
}

/** Let the injected <script> report success, then settle the microtasks. */
async function scriptLoads(): Promise<void> {
  appended[0]?.onload?.(new Event('load'))
  await Promise.resolve()
  await Promise.resolve()
}

describe('with no site key configured', () => {
  it('renders nothing and never reaches for the network', async () => {
    // Every build until a key is set. The forms must look untouched.
    const mod = await withoutSiteKey()
    const onToken = vi.fn()
    const { container } = render(() => <mod.default onToken={onToken} />)

    expect(container.innerHTML).toBe('')
    expect(appended).toHaveLength(0)
    expect(onToken).not.toHaveBeenCalled()
  })

  it('reports the captcha as disabled', async () => {
    const mod = await withoutSiteKey()
    expect(mod.turnstileEnabled).toBe(false)
  })
})

describe('with a site key configured', () => {
  it('reports the captcha as enabled', async () => {
    const mod = await withSiteKey()
    expect(mod.turnstileEnabled).toBe(true)
  })

  it('loads the script once and renders the widget with the key', async () => {
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    render(() => <mod.default onToken={vi.fn()} />)

    expect(appended).toHaveLength(1)
    expect(appended[0].src).toContain('challenges.cloudflare.com')
    await scriptLoads()

    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1))
    const opts = api.render.mock.calls[0][1] as { sitekey: string }
    expect(opts.sitekey).toBe(SITE_KEY)
  })

  it('draws the widget only when Cloudflare needs the person, when asked to', async () => {
    // The native sign-in sheet. The token is still demanded; only the drawing
    // changes.
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    render(() => (
      <mod.default onToken={vi.fn()} appearance="interaction-only" />
    ))

    await scriptLoads()

    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1))
    const opts = api.render.mock.calls[0][1] as { appearance?: string }
    expect(opts.appearance).toBe('interaction-only')
  })

  it("leaves a form that asks nothing on Cloudflare's defaults", async () => {
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    render(() => <mod.default onToken={vi.fn()} />)

    await scriptLoads()

    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1))
    expect(Object.keys(api.render.mock.calls[0][1])).not.toContain('appearance')
    expect(Object.keys(api.render.mock.calls[0][1])).not.toContain('size')
  })

  it('passes the size it is asked for', async () => {
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    render(() => <mod.default onToken={vi.fn()} size="flexible" />)

    await scriptLoads()

    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1))
    const opts = api.render.mock.calls[0][1] as { size?: string }
    expect(opts.size).toBe('flexible')
  })

  it('injects the script once no matter how many widgets ask', async () => {
    // Two forms on one page (a modal over the reset route) must not race two
    // copies of the same script into the head.
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    render(() => (
      <>
        <mod.default onToken={vi.fn()} />
        <mod.default onToken={vi.fn()} />
      </>
    ))
    await scriptLoads()

    expect(appended).toHaveLength(1)
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(2))
  })

  it('hands the issued token to its caller', async () => {
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    const onToken = vi.fn()
    render(() => <mod.default onToken={onToken} />)
    await scriptLoads()
    await waitFor(() => expect(api.render).toHaveBeenCalled())

    const opts = api.render.mock.calls[0][1] as unknown as {
      callback: (t: string) => void
    }
    opts.callback('a-fresh-token')
    expect(onToken).toHaveBeenCalledWith('a-fresh-token')
  })

  it('clears the token when the widget errors or the token expires', async () => {
    // Both leave the form holding a token the server would refuse. Clearing
    // is what re-disables the submit button rather than letting it fail.
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    const onToken = vi.fn()
    render(() => <mod.default onToken={onToken} />)
    await scriptLoads()
    await waitFor(() => expect(api.render).toHaveBeenCalled())

    const opts = api.render.mock.calls[0][1] as unknown as Record<
      string,
      () => void
    >
    opts['error-callback']()
    opts['expired-callback']()
    expect(onToken).toHaveBeenNthCalledWith(1, '')
    expect(onToken).toHaveBeenNthCalledWith(2, '')
  })

  it('clears the token when the script cannot be loaded at all', async () => {
    // An ad blocker or an offline device. The caller must learn it has no
    // token, or the submit button stays armed over nothing.
    const mod = await withSiteKey()
    const onToken = vi.fn()
    render(() => <mod.default onToken={onToken} />)

    appended[0]?.onerror?.(new Event('error'))
    await waitFor(() => expect(onToken).toHaveBeenCalledWith(''))
  })

  it('does nothing when the script loads but the API never appears', async () => {
    const mod = await withSiteKey()
    const onToken = vi.fn()
    render(() => <mod.default onToken={onToken} />)
    await scriptLoads()
    expect(onToken).not.toHaveBeenCalled()
  })

  it('removes its widget when it unmounts', async () => {
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    const { unmount } = render(() => <mod.default onToken={vi.fn()} />)
    await scriptLoads()
    await waitFor(() => expect(api.render).toHaveBeenCalled())

    unmount()
    expect(api.remove).toHaveBeenCalledWith('widget-1')
  })
})

// The sign-in dialog asks for 'interaction-only'. Cloudflare then draws
// nothing unless it needs a click, and the host must not hold the widget's
// spacing open around nothing. Measured against Cloudflare's test keys: the
// always-passes key drew 0px and issued a token at 1.7s, the forced
// interactive key fired before-interactive-callback and drew 70px, and the
// always-blocks key drew 0px and fired only error-callback.
describe('hidden until Cloudflare needs a click', () => {
  async function renderHidden(onToken = vi.fn()) {
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    const view = render(() => (
      <mod.default onToken={onToken} appearance="interaction-only" />
    ))
    await scriptLoads()
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1))
    const opts = api.render.mock.calls[0][1] as unknown as Record<
      string,
      (arg?: string) => void
    >
    return { ...view, opts, onToken }
  }

  it('takes no room until the check needs the person', async () => {
    const { getByTestId, opts } = await renderHidden()
    const host = getByTestId('turnstile-host')

    expect(host).toHaveAttribute('data-turnstile', 'hidden')
    expect(host.style.margin).toBe('')

    opts['before-interactive-callback']()
    expect(host).toHaveAttribute('data-turnstile', 'drawn')
    expect(host.style.margin).toBe('4px 0px 12px')

    // Ticked: Cloudflare keeps its 69px "Success" on screen, so the host
    // keeps its spacing. Dropping it moved the widget up 4px and left no gap
    // above the button (review of PR #979, measured on the forced-click key).
    // Cloudflare's after-interactive callback says only that the click is
    // done, so the widget no longer listens for it.
    expect(opts['after-interactive-callback']).toBeUndefined()
    opts.callback('a-fresh-token')
    expect(host).toHaveAttribute('data-turnstile', 'drawn')
    expect(host.style.margin).toBe('4px 0px 12px')
  })

  it('takes no room again once the page resets the check', async () => {
    // A failed sign-in resets every widget, and the new run is hidden again
    // unless it needs another click.
    const { getByTestId, opts } = await renderHidden()
    const mod = await import('./Turnstile')
    const host = getByTestId('turnstile-host')

    opts['before-interactive-callback']()
    opts.callback('a-fresh-token')
    mod.resetTurnstile()
    expect(host).toHaveAttribute('data-turnstile', 'hidden')
    expect(host.style.margin).toBe('')
  })

  it('follows the drawn height where the browser can measure it', async () => {
    // A real browser reports the widget's own box: 69px while Cloudflare
    // shows a checkbox or its "Success", 0px while it shows nothing.
    let report: ((height: number) => void) | undefined
    class FakeResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        report = (height) => {
          cb(
            [{ contentRect: { height } } as unknown as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          )
        }
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    try {
      const { getByTestId, opts } = await renderHidden()
      const host = getByTestId('turnstile-host')

      opts['before-interactive-callback']()
      report?.(69)
      opts.callback('a-fresh-token')
      expect(host).toHaveAttribute('data-turnstile', 'drawn')

      report?.(0)
      expect(host).toHaveAttribute('data-turnstile', 'hidden')
      expect(host.style.margin).toBe('')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('leaves a failure to the widget once it has drawn itself', async () => {
    // A failed click shows Cloudflare's own message in the drawn widget.
    const { queryByRole, opts } = await renderHidden()

    opts['before-interactive-callback']()
    opts['error-callback']('600010')
    expect(queryByRole('status')).toBeNull()
  })

  it('keeps an always-drawn widget spaced from the start', async () => {
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    const { getByTestId } = render(() => <mod.default onToken={vi.fn()} />)
    await scriptLoads()
    await waitFor(() => expect(api.render).toHaveBeenCalled())

    expect(getByTestId('turnstile-host')).toHaveAttribute(
      'data-turnstile',
      'drawn',
    )
  })

  it('says so when the hidden check fails, and stops once it passes', async () => {
    // Nothing on screen would explain the disabled button otherwise.
    const { findByRole, queryByRole, opts, onToken } = await renderHidden()

    opts['error-callback']('600010')
    const note = await findByRole('status')
    expect(note.textContent).toBe(
      "The security check didn't go through. Close this and try again.",
    )
    expect(onToken).toHaveBeenLastCalledWith('')

    opts.callback('a-fresh-token')
    await waitFor(() => expect(queryByRole('status')).toBeNull())
    expect(onToken).toHaveBeenLastCalledWith('a-fresh-token')
  })

  it('says so when the browser cannot run the check at all', async () => {
    const { findByRole, opts, onToken } = await renderHidden()

    opts['unsupported-callback']()
    const note = await findByRole('status')
    expect(note.textContent).toBe(
      "This browser can't run the security check. Try another browser.",
    )
    expect(onToken).toHaveBeenLastCalledWith('')
  })

  it('leaves the failure to the widget when the widget is drawn', async () => {
    // Cloudflare draws its own failure message there; a second one under it
    // would say the same thing twice.
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    const { queryByRole } = render(() => <mod.default onToken={vi.fn()} />)
    await scriptLoads()
    await waitFor(() => expect(api.render).toHaveBeenCalled())

    const opts = api.render.mock.calls[0][1] as unknown as Record<
      string,
      () => void
    >
    opts['error-callback']()
    expect(queryByRole('status')).toBeNull()
  })
})

describe('resetTurnstile', () => {
  it('resets every widget on the page', async () => {
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    mod.resetTurnstile()
    expect(api.reset).toHaveBeenCalledTimes(1)
  })

  it('is safe to call when no widget exists', async () => {
    const mod = await withSiteKey()
    expect(() => mod.resetTurnstile()).not.toThrow()
  })

  it('swallows a widget that throws on reset', async () => {
    // Called from a catch block on a failed submit; it must never become the
    // error the user sees instead of the real one.
    window.turnstile = {
      render: vi.fn((_el: HTMLElement, _opts: Record<string, unknown>) => 'w'),
      remove: vi.fn((_id: string) => undefined),
      reset: vi.fn((_id?: string) => {
        throw new Error('widget is gone')
      }),
    }
    const mod = await withSiteKey()
    expect(() => mod.resetTurnstile()).not.toThrow()
  })
})

describe('when the widget cannot load at all', () => {
  it('starts out expecting the widget to work', async () => {
    const mod = await withSiteKey()
    expect(mod.turnstileUnavailable()).toBe(false)
  })

  it('reports itself unavailable when the script is blocked', async () => {
    // A CSP that does not allow challenges.cloudflare.com, an ad blocker, a
    // captive network. This is the state that left the Sign in button
    // disabled forever: no widget, so no token, so nothing to enable it.
    const mod = await withSiteKey()
    render(() => <mod.default onToken={vi.fn()} />)

    appended[0]?.onerror?.(new Event('error'))
    await waitFor(() => expect(mod.turnstileUnavailable()).toBe(true))
  })

  it('reports itself unavailable when the script loads but defines nothing', async () => {
    const mod = await withSiteKey()
    render(() => <mod.default onToken={vi.fn()} />)
    await scriptLoads()

    await waitFor(() => expect(mod.turnstileUnavailable()).toBe(true))
  })

  it('says so on the form rather than leaving a silent dead button', async () => {
    const mod = await withSiteKey()
    const { findByRole } = render(() => <mod.default onToken={vi.fn()} />)

    appended[0]?.onerror?.(new Event('error'))

    const note = await findByRole('status')
    expect(note.textContent).toMatch(/verification widget could not load/i)
  })

  it('stays available when a challenge merely fails', async () => {
    // A failed challenge is retryable — the widget is there and working.
    // Only a widget that never existed should open the form back up.
    const api = fakeTurnstile()
    const mod = await withSiteKey()
    render(() => <mod.default onToken={vi.fn()} />)
    await scriptLoads()
    await waitFor(() => expect(api.render).toHaveBeenCalled())

    const opts = api.render.mock.calls[0][1] as unknown as Record<
      string,
      () => void
    >
    opts['error-callback']()
    opts['expired-callback']()

    expect(mod.turnstileUnavailable()).toBe(false)
  })
})
