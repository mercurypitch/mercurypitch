import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Env } from '@/worker'
import worker from '@/worker'

vi.mock('@cloudflare/containers', () => ({
  Container: class Container {
    readonly mock = true
  },
  ContainerProxy: class ContainerProxy {
    readonly mock = true
  },
}))

// public/_headers gives every /email/* answer a year of immutable caching,
// and the asset layer applies it to a 404 too (seen on dev and under
// `wrangler dev`, 14 Oct 2026). A picture asked for a moment before its
// deploy lands would then stay missing for a year in any image proxy or mail
// app that cached the miss. The stub below answers the way the asset layer
// does: the _headers rule on every response, whatever the status.
const IMMUTABLE = 'public, max-age=31536000, immutable'

function assetsAnswering(status: number) {
  const fetch = vi.fn(
    async () =>
      new Response(status === 304 ? null : 'body', {
        status,
        headers: { 'Cache-Control': IMMUTABLE, 'X-From': 'assets' },
      }),
  )
  return { env: { ASSETS: { fetch } } as unknown as Env, fetch }
}

async function cacheControlFor(
  status: number,
  method = 'GET',
): Promise<string | null> {
  const { env, fetch } = assetsAnswering(status)
  const response = await worker.fetch(
    new Request('https://mercurypitch.test/email/wordmark-v2-2x.png', {
      method,
    }),
    env,
  )
  expect(fetch).toHaveBeenCalledOnce()
  expect(response.status).toBe(status)
  expect(response.headers.get('X-From')).toBe('assets')
  return response.headers.get('Cache-Control')
}

describe('mail pictures', () => {
  it.each([200, 304])(
    'keep the year of caching when they exist (%i)',
    async (status) => {
      expect(await cacheControlFor(status)).toBe(IMMUTABLE)
    },
  )

  it.each([404, 405, 500, 503])(
    'are never cached when the answer is an error (%i)',
    async (status) => {
      expect(await cacheControlFor(status)).toBe('no-store')
    },
  )

  it('are never cached when a HEAD finds nothing', async () => {
    expect(await cacheControlFor(404, 'HEAD')).toBe('no-store')
  })

  // The asset layer answers every missing path with the same 404 page and its
  // ETag. A cache that stored that page under a picture's URL revalidates
  // with it, and prod answers 304 with the year of caching (curl with the
  // page's If-None-Match, 14 Oct 2026). A picture is never HTML, so such a
  // 304 has to become the uncached 404 it stands for.
  it('are never cached when a revalidation finds the 404 page', async () => {
    const fetch = vi.fn(async (request: Request) =>
      request.headers.has('If-None-Match')
        ? new Response(null, {
            status: 304,
            headers: {
              'Cache-Control': IMMUTABLE,
              'Content-Type': 'text/html',
            },
          })
        : new Response('<!doctype html>404', {
            status: 404,
            headers: {
              'Cache-Control': IMMUTABLE,
              'Content-Type': 'text/html',
            },
          }),
    )
    const response = await worker.fetch(
      new Request('https://mercurypitch.test/email/wordmark-v2-2x.png', {
        headers: { 'If-None-Match': '"404-page"' },
      }),
      { ASSETS: { fetch } } as unknown as Env,
    )
    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('keep a 304 for a picture that exists', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, {
          status: 304,
          headers: { 'Cache-Control': IMMUTABLE, 'Content-Type': 'image/png' },
        }),
    )
    const response = await worker.fetch(
      new Request('https://mercurypitch.test/email/wordmark-v2-2x.png', {
        headers: { 'If-None-Match': '"picture"' },
      }),
      { ASSETS: { fetch } } as unknown as Env,
    )
    expect(fetch).toHaveBeenCalledOnce()
    expect(response.status).toBe(304)
    expect(response.headers.get('Cache-Control')).toBe(IMMUTABLE)
  })

  it('reach the worker at all: /email/* is in run_worker_first', () => {
    // Without the entry the asset layer answers /email/* on its own, and the
    // worker never sees the 404 it has to fix.
    const config = readFileSync(
      resolve(__dirname, '../../wrangler.jsonc'),
      'utf8',
    )
    const block = config.match(/"run_worker_first"\s*:\s*\[([\s\S]*?)\]/)
    expect(block).not.toBeNull()
    const listed = [
      ...(block as RegExpMatchArray)[1].matchAll(/"([^"]+)"/g),
    ].map((m) => m[1])
    expect(listed).toContain('/email/*')
  })
})
