import { afterEach, describe, expect, it, vi } from 'vitest'
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

function stubDb(status = 200, body: unknown = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UVR worker routing protections', () => {
  it('does not let an authenticated headerless process request reach the container', async () => {
    const secret = 'test-secret'
    const getByName = vi.fn()
    stubDb()
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/process', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(secret)}` },
      }),
      {
        JWT_SECRET: secret,
        DB_API_URL: 'https://db.test',
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
    stubDb()
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
        DB_API_URL: 'https://db.test',
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(503)
    expect(getByName).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Server processing is not available'),
    })
  })

  it('blocks a suspended account before any UVR backend call', async () => {
    const secret = 'test-secret'
    const getByName = vi.fn()
    const dbFetch = stubDb(403, {
      error: 'This account is suspended.',
      code: 'account_suspended',
    })
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/delete-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(secret)}` },
      }),
      {
        JWT_SECRET: secret,
        DB_API_URL: 'https://db.test',
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(403)
    expect(getByName).not.toHaveBeenCalled()
    expect(dbFetch).toHaveBeenCalledOnce()
    await expect(response.json()).resolves.toEqual({
      error: 'This account is suspended.',
      code: 'account_suspended',
    })
  })

  it('blocks a server-revoked token before any UVR backend call', async () => {
    const secret = 'test-secret'
    const getByName = vi.fn()
    stubDb(401, { error: 'Unauthorized' })
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/delete-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(secret)}` },
      }),
      {
        JWT_SECRET: secret,
        DB_API_URL: 'https://db.test',
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(401)
    expect(getByName).not.toHaveBeenCalled()
  })

  it('fails closed when the DB validation binding is missing', async () => {
    const secret = 'test-secret'
    const getByName = vi.fn()
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/delete-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(secret)}` },
      }),
      {
        JWT_SECRET: secret,
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(503)
    expect(getByName).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      error: 'Account validation is unavailable',
    })
  })

  it('does not confuse an unrelated DB authorization failure with suspension', async () => {
    const secret = 'test-secret'
    const getByName = vi.fn()
    stubDb(403, { error: 'Different policy', code: 'different_policy' })
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/delete-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(secret)}` },
      }),
      {
        JWT_SECRET: secret,
        DB_API_URL: 'https://db.test',
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(403)
    expect(getByName).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
  })

  it('uses safe copy when a suspension response has no human message', async () => {
    const secret = 'test-secret'
    const getByName = vi.fn()
    stubDb(403, { error: 42, code: 'account_suspended' })
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/delete-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(secret)}` },
      }),
      {
        JWT_SECRET: secret,
        DB_API_URL: 'https://db.test',
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(403)
    expect(getByName).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      error: 'This account is suspended.',
      code: 'account_suspended',
    })
  })

  it('fails closed on an unexpected DB validation response', async () => {
    const secret = 'test-secret'
    const getByName = vi.fn()
    stubDb(500, { error: 'Internal server error' })
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/delete-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(secret)}` },
      }),
      {
        JWT_SECRET: secret,
        DB_API_URL: 'https://db.test',
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(503)
    expect(getByName).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      error: 'Account validation is unavailable',
    })
  })

  it('fails closed when account validation is unavailable', async () => {
    const secret = 'test-secret'
    const getByName = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline')
      }),
    )
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/delete-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer(secret)}` },
      }),
      {
        JWT_SECRET: secret,
        DB_API_URL: 'https://db.test',
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(503)
    expect(getByName).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      error: 'Account validation is unavailable',
    })
  })
})
