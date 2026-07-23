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

const encoder = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function bearer(secret: string): Promise<string> {
  const header = b64url(encoder.encode(JSON.stringify({ alg: 'HS256' })))
  const payload = b64url(
    encoder.encode(
      JSON.stringify({
        sub: 'anonymous-user',
        provider: 'anonymous',
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ),
  )
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(`${header}.${payload}`),
    ),
  )
  return `${header}.${payload}.${b64url(signature)}`
}

describe('UVR worker routing protections', () => {
  it('does not let an authenticated headerless process request reach the container', async () => {
    const secret = 'test-secret'
    const getByName = vi.fn()
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/process', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(secret)}` },
      }),
      {
        JWT_SECRET: secret,
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(400)
    expect(getByName).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Browser mode'),
    })
  })

  it('does not fall back to the container when RunPod is unconfigured', async () => {
    const secret = 'test-secret'
    const getByName = vi.fn()
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/process', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await bearer(secret)}`,
          'X-UVR-Provider': 'runpod',
        },
      }),
      {
        JWT_SECRET: secret,
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(503)
    expect(getByName).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Server processing is not available'),
    })
  })
})
