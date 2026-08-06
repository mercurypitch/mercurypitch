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

describe('standalone entry routing', () => {
  it('serves the dedicated vocal-range document when the request reaches the worker', async () => {
    const { env, fetch } = entryEnv()
    const response = await worker.fetch(
      new Request('https://mercurypitch.test/vocal-range-test?utm_source=test'),
      env,
    )

    await expect(response.text()).resolves.toBe('/vocal-range-test.html')
    expect(fetch).toHaveBeenCalledOnce()
    expect(new URL(fetch.mock.calls[0][0].url).search).toBe('?utm_source=test')
  })

  it('keeps Voice Mirror on its own document', async () => {
    const { env } = entryEnv()
    const response = await worker.fetch(
      new Request('https://mercurypitch.test/mirror'),
      env,
    )

    await expect(response.text()).resolves.toBe('/mirror.html')
  })
})
