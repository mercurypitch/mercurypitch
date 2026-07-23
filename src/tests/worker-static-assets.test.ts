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

function envWithAsset(response: Response): Env {
  return {
    ASSETS: {
      fetch: vi.fn().mockResolvedValue(response),
    },
    UVR_SERVICE: {
      getByName: vi.fn(),
    },
  } as unknown as Env
}

describe('static asset routing', () => {
  it('returns a real 404 when the SPA fallback answers a missing JS chunk', async () => {
    const response = await worker.fetch(
      new Request('https://app.test/assets/SessionEditor-stale.js'),
      envWithAsset(
        new Response('<!doctype html><title>MercuryPitch</title>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      ),
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toContain('text/plain')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('passes through an existing JavaScript asset unchanged', async () => {
    const asset = new Response('export const loaded = true', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript' },
    })

    const response = await worker.fetch(
      new Request('https://app.test/assets/SessionEditor-current.js'),
      envWithAsset(asset),
    )

    expect(response).toBe(asset)
  })
})
