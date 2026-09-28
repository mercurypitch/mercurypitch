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

// The native app (plan S8, Stage 2) runs on capacitor://localhost on iOS and
// https://localhost on Android, so every separation call it makes is
// cross-origin. The web app's own calls are same-origin and must come back
// exactly as they did: no CORS header of any kind.
describe('separation for the native app', () => {
  const NATIVE = ['capacitor://localhost', 'https://localhost']

  for (const origin of NATIVE) {
    it(`answers the preflight from ${origin} itself, before any backend`, async () => {
      const getByName = vi.fn()
      const upstream = stubDb()
      const response = await worker.fetch(
        new Request('https://app.test/api/uvr/process', {
          method: 'OPTIONS',
          headers: {
            Origin: origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers':
              'authorization,content-type,x-uvr-provider,x-uvr-duration-seconds,x-uvr-model',
          },
        }),
        { UVR_SERVICE: { getByName } } as unknown as Env,
      )

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin)
      expect(
        response.headers
          .get('Access-Control-Allow-Methods')
          ?.split(/,\s*/u)
          .sort(),
      ).toEqual(['DELETE', 'GET', 'OPTIONS', 'POST'])
      expect(
        response.headers
          .get('Access-Control-Allow-Headers')
          ?.toLowerCase()
          .split(/,\s*/u)
          .sort(),
      ).toEqual([
        'authorization',
        'content-type',
        'x-uvr-duration-seconds',
        'x-uvr-model',
        'x-uvr-provider',
      ])
      expect(response.headers.get('Vary')).toBe('Origin')
      expect(getByName).not.toHaveBeenCalled()
      expect(upstream).not.toHaveBeenCalled()
    })
  }

  it('spends the app’s songs for the app, and the whole balance for the web', async () => {
    // S7 D9: from the app, only the songs the app can spend. The db-worker
    // hears it from the main worker, which spends for the app from a server.
    const secret = 'test-secret'
    const admitted: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith('/api/billing/uvr-admit')) {
          admitted.push(JSON.parse(String(init?.body)))
          return new Response(JSON.stringify({ error: 'Not enough credits' }), {
            status: 402,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('{}', {
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )

    for (const origin of ['capacitor://localhost', 'https://localhost', null]) {
      const response = await worker.fetch(
        new Request('https://app.test/api/uvr/process', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${await bearer(secret)}`,
            'X-UVR-Provider': 'runpod',
            ...(origin === null ? {} : { Origin: origin }),
          },
        }),
        {
          JWT_SECRET: secret,
          DB_API_URL: 'https://db.test',
          RUNPOD_API_KEY: 'runpod-key',
          RUNPOD_ENDPOINT_ID_GPU: 'ep-gpu',
          UVR_SERVICE: { getByName: vi.fn() },
        } as unknown as Env,
      )
      expect(response.status).toBe(402)
    }

    expect(admitted.map((body) => body.from)).toEqual(['app', 'app', undefined])
  })

  it('lets the native app read a refusal, so it can say why', async () => {
    const getByName = vi.fn()
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/process', {
        method: 'POST',
        headers: { Origin: 'capacitor://localhost' },
      }),
      {
        JWT_SECRET: 'test-secret',
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'capacitor://localhost',
    )
    expect(response.headers.get('Vary')).toBe('Origin')
    expect(getByName).not.toHaveBeenCalled()
  })

  it('hands the native app a stem itself, never a redirect it cannot follow', async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('https://api.runpod.ai/')) {
        return new Response(
          JSON.stringify({
            status: 'COMPLETED',
            output: {
              stems: [
                {
                  stem: 'vocal',
                  filename: 'Song_(Vocals).mp3',
                  url: 'https://stems.example/runpod-dev/job-1/Song_(Vocals).mp3',
                },
              ],
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('the stem', { status: 200 })
    })
    vi.stubGlobal('fetch', upstream)

    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/output/rp_gpu_job-1/vocal', {
        headers: { Origin: 'capacitor://localhost' },
      }),
      {
        RUNPOD_API_KEY: 'runpod-key',
        RUNPOD_ENDPOINT_ID_GPU: 'ep-gpu',
        UVR_SERVICE: { getByName: vi.fn() },
      } as unknown as Env,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'capacitor://localhost',
    )
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(await response.text()).toBe('the stem')
  })

  it('gives the web app no CORS header, and still redirects it to the stem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 'COMPLETED',
              output: {
                stems: [
                  {
                    stem: 'vocal',
                    filename: 'v.flac',
                    url: 'https://stems.example/runpod/job-1/v.flac',
                  },
                ],
              },
            }),
            { headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    )

    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/output/rp_gpu_job-1/vocal'),
      {
        RUNPOD_API_KEY: 'runpod-key',
        RUNPOD_ENDPOINT_ID_GPU: 'ep-gpu',
        UVR_SERVICE: { getByName: vi.fn() },
      } as unknown as Env,
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(
      'https://stems.example/runpod/job-1/v.flac',
    )
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('gives any other origin nothing it could read', async () => {
    const getByName = vi.fn()
    const response = await worker.fetch(
      new Request('https://app.test/api/uvr/process', {
        method: 'POST',
        headers: { Origin: 'https://elsewhere.example' },
      }),
      {
        JWT_SECRET: 'test-secret',
        UVR_SERVICE: { getByName },
      } as unknown as Env,
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
