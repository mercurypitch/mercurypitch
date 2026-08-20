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
