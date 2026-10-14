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
