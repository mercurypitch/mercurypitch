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

function entryEnv() {
  const fetch = vi.fn(async (request: Request) => {
    return new Response(new URL(request.url).pathname)
  })
  return {
    env: { ASSETS: { fetch } } as unknown as Env,
    fetch,
  }
}

// The worker must always ask ASSETS for the EXTENSIONLESS path and let
// html_handling resolve it to the .html file. Asking for '/x.html' makes the
// asset layer answer with its own drop-`.html` 307 instead of the content,
// and the worker passes that through — which had mirror.mercurypitch.com/
// and every glass alias redirecting instead of serving (live, 2026-08-08).
describe('standalone entry routing', () => {
  it('serves the dedicated vocal-range document when the request reaches the worker', async () => {
    const { env, fetch } = entryEnv()
    const response = await worker.fetch(
      new Request('https://mercurypitch.test/vocal-range-test?utm_source=test'),
      env,
    )

    await expect(response.text()).resolves.toBe('/vocal-range-test')
    expect(fetch).toHaveBeenCalledOnce()
    expect(new URL(fetch.mock.calls[0][0].url).search).toBe('?utm_source=test')
  })

  it('keeps Voice Mirror on its own document', async () => {
    const { env } = entryEnv()
    const response = await worker.fetch(
      new Request('https://mercurypitch.test/mirror'),
      env,
    )

    await expect(response.text()).resolves.toBe('/mirror')
  })

  it('serves the mirror document at the mirror subdomain root', async () => {
    const { env } = entryEnv()
    const response = await worker.fetch(
      new Request('https://mirror.mercurypitch.test/'),
      env,
    )

    await expect(response.text()).resolves.toBe('/mirror')
  })

  it('serves glass at its aliases with the URL preserved, not a redirect', async () => {
    for (const alias of [
      '/break-glass-with-your-voice',
      '/high-note-test',
      '/shatter',
    ]) {
      const { env, fetch } = entryEnv()
      const response = await worker.fetch(
        new Request(`https://mercurypitch.test${alias}`),
        env,
      )

      await expect(response.text()).resolves.toBe('/glass')
      expect(new URL(fetch.mock.calls[0][0].url).pathname).toBe('/glass')
    }
  })

  it('serves Karaoke Night for both path spellings', async () => {
    for (const path of ['/karaoke-night', '/karaoke']) {
      const { env } = entryEnv()
      const response = await worker.fetch(
        new Request(`https://mercurypitch.test${path}`),
        env,
      )

      await expect(response.text()).resolves.toBe('/karaoke')
    }
  })

  it('leaves Piano Night document paths unchanged for Cloudflare Assets', async () => {
    // Piano Night needs no Worker rewrite: Cloudflare Assets resolves the
    // clean path through html_handling and serves the emitted HTML file
    // directly. If either request reaches the Worker anyway, preserving its
    // path and query is what keeps the asset layer authoritative.
    for (const path of ['/piano-night', '/piano-night.html']) {
      const { env, fetch } = entryEnv()
      const response = await worker.fetch(
        new Request(
          `https://mercurypitch.test${path}?project=project-7&room=afterglow`,
        ),
        env,
      )

      await expect(response.text()).resolves.toBe(path)
      expect(fetch).toHaveBeenCalledOnce()

      const forwarded = new URL(fetch.mock.calls[0][0].url)
      expect(forwarded.pathname).toBe(path)
      expect(forwarded.search).toBe('?project=project-7&room=afterglow')
    }
  })

  it('never asks the asset layer for a .html path', async () => {
    for (const path of [
      '/mirror',
      '/vocal-range-test',
      '/karaoke-night',
      '/glass',
      '/shatter',
    ]) {
      const { env, fetch } = entryEnv()
      await worker.fetch(new Request(`https://mercurypitch.test${path}`), env)

      expect(new URL(fetch.mock.calls[0][0].url).pathname).not.toMatch(
        /\.html$/,
      )
    }
  })
})
