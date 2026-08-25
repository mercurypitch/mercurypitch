// Turnstile gate tests — the CAPTCHA in front of the public auth routes.
// ============================================================
//
// The gate's whole value is that it FAILS CLOSED. Every test here is really
// asking the same question: when something is missing or broken, does the
// door stay shut? The one deliberate exception is a local development origin
// with no secret configured, which is how the auth flow stays workable on a
// laptop without anybody minting test credentials.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './auth'
import { verifyTurnstile } from './turnstile'

function envWith(overrides: Partial<Env> = {}): Env {
  return { ...overrides } as Env
}

function request(ip = '203.0.113.7'): Request {
  return new Request('https://api.mercurypitch.com/api/auth/login', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': ip },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('verifyTurnstile', () => {
  describe('with no secret configured', () => {
    it('lets a local development origin through', async () => {
      const ok = await verifyTurnstile(
        request(),
        envWith({ ALLOWED_ORIGINS: 'http://localhost:5173' }),
        undefined,
      )
      expect(ok).toBe(true)
    })

    it('refuses a deployed origin rather than silently dropping the gate', async () => {
      // The failure this exists to prevent: shipping to production having
      // forgotten the secret, and never noticing because sign-up still works.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const ok = await verifyTurnstile(
        request(),
        envWith({ ALLOWED_ORIGINS: 'https://mercurypitch.com' }),
        'a-token',
      )
      expect(ok).toBe(false)
      expect(warn).toHaveBeenCalled()
    })

    it('refuses when the origin allowlist is not configured at all', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const ok = await verifyTurnstile(request(), envWith(), 'a-token')
      expect(ok).toBe(false)
      expect(warn).toHaveBeenCalled()
    })
  })

  describe('with a secret configured', () => {
    const configured = envWith({
      TURNSTILE_SECRET: 'test-secret',
      ALLOWED_ORIGINS: 'https://mercurypitch.com',
    })

    it('refuses a request carrying no token', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      expect(await verifyTurnstile(request(), configured, undefined)).toBe(
        false,
      )
      // Cheaper than a round trip, and Cloudflare is not asked to adjudicate
      // a request that plainly has nothing to adjudicate.
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('accepts a token Cloudflare confirms, and sends the caller IP', async () => {
      // Typed parameters so `mock.calls` is readable; a bare `vi.fn()` here
      // infers an empty tuple and every argument read is a type error.
      const fetchMock = vi.fn(
        async (_url: string, _init: RequestInit) =>
          new Response(JSON.stringify({ success: true })),
      )
      vi.stubGlobal('fetch', fetchMock)

      expect(await verifyTurnstile(request(), configured, 'good-token')).toBe(
        true,
      )
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      )
      const sent = new URLSearchParams(init.body as string)
      expect(sent.get('secret')).toBe('test-secret')
      expect(sent.get('response')).toBe('good-token')
      expect(sent.get('remoteip')).toBe('203.0.113.7')
    })

    it('refuses a token Cloudflare rejects', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                success: false,
                'error-codes': ['invalid-input-secret'],
                hostname: 'dev.mercurypitch.com',
                action: 'login',
              }),
            ),
        ),
      )
      expect(await verifyTurnstile(request(), configured, 'bad-token')).toBe(
        false,
      )
      expect(warn).toHaveBeenCalledWith(
        'Turnstile Siteverify rejected an authentication token.',
        {
          errorCodes: ['invalid-input-secret'],
          hostname: 'dev.mercurypitch.com',
          action: 'login',
        },
      )
      expect(JSON.stringify(warn.mock.calls)).not.toContain('bad-token')
      expect(JSON.stringify(warn.mock.calls)).not.toContain('test-secret')
      expect(JSON.stringify(warn.mock.calls)).not.toContain('203.0.113.7')
    })

    it('refuses when the verification response says nothing either way', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({}))),
      )
      expect(await verifyTurnstile(request(), configured, 'odd-token')).toBe(
        false,
      )
    })

    it('refuses when Cloudflare cannot be reached', async () => {
      // An outage must not become an open door.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('network down')
        }),
      )
      expect(await verifyTurnstile(request(), configured, 'good-token')).toBe(
        false,
      )
      expect(warn).toHaveBeenCalledWith(
        'Turnstile Siteverify was unavailable or returned malformed data; failing CAPTCHA verification closed.',
      )
    })

    it('refuses when the response is not JSON at all', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('<html>502</html>')),
      )
      expect(await verifyTurnstile(request(), configured, 'good-token')).toBe(
        false,
      )
    })

    it('sends an empty remoteip when the request has no caller IP', async () => {
      const fetchMock = vi.fn(
        async (_url: string, _init: RequestInit) =>
          new Response(JSON.stringify({ success: true })),
      )
      vi.stubGlobal('fetch', fetchMock)
      const bare = new Request('https://api.mercurypitch.com/api/auth/login', {
        method: 'POST',
      })

      expect(await verifyTurnstile(bare, configured, 'good-token')).toBe(true)
      const [, init] = fetchMock.mock.calls[0]
      expect(new URLSearchParams(init.body as string).get('remoteip')).toBe('')
    })
  })
})
