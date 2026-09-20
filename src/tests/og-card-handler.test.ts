import { describe, expect, it } from 'vitest'
import { handleOgCardRequest } from '@/og-card-handler'
import type { Env } from '@/worker'

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function png(extra = 32): ArrayBuffer {
  const bytes = new Uint8Array(PNG_HEAD.length + extra)
  bytes.set(PNG_HEAD, 0)
  return bytes.buffer
}

function fakeEnv(): Env {
  const store = new Map<string, unknown>()
  return {
    SHARE_STORE: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: unknown) => {
        store.set(key, value)
      },
    },
  } as unknown as Env
}

const ID = 'aB3xY9zQ01'

function put(id: string, body: ArrayBuffer | string): Request {
  return new Request(`https://mercurypitch.com/api/og/card/${id}`, {
    method: 'PUT',
    body,
  })
}

describe('the OG card store', () => {
  it('stores a PNG and serves it back as an image', async () => {
    const env = fakeEnv()
    expect((await handleOgCardRequest(put(ID, png()), env))?.status).toBe(204)

    const got = await handleOgCardRequest(
      new Request(`https://mercurypitch.com/api/og/card/${ID}.png`),
      env,
    )
    expect(got?.status).toBe(200)
    expect(got?.headers.get('Content-Type')).toBe('image/png')
    expect(got?.headers.get('Cache-Control')).toContain('immutable')
  })

  it('404s for a card that was never stored, or has expired', async () => {
    const got = await handleOgCardRequest(
      new Request(`https://mercurypitch.com/api/og/card/${ID}.png`),
      fakeEnv(),
    )
    expect(got?.status).toBe(404)
  })

  it('refuses anything that is not a PNG', async () => {
    // The store is served back with an image content type, so accepting
    // arbitrary bytes would make us a host for them.
    const res = await handleOgCardRequest(
      put(ID, new TextEncoder().encode('<script>alert(1)</script>').buffer),
      fakeEnv(),
    )
    expect(res?.status).toBe(415)
  })

  it('refuses to overwrite an id that already exists', async () => {
    const env = fakeEnv()
    await handleOgCardRequest(put(ID, png()), env)
    const second = await handleOgCardRequest(put(ID, png(64)), env)
    expect(second?.status).toBe(409)
  })

  it('refuses an empty body', async () => {
    const res = await handleOgCardRequest(
      put(ID, new ArrayBuffer(0)),
      fakeEnv(),
    )
    expect(res?.status).toBe(400)
  })

  it('rate limits uploads from one address', async () => {
    const env = fakeEnv()
    const ids = Array.from({ length: 12 }, (_, i) =>
      `rate${String(i).padStart(6, '0')}`.slice(0, 10),
    )
    const codes: number[] = []
    for (const id of ids) {
      const req = new Request(`https://mercurypitch.com/api/og/card/${id}`, {
        method: 'PUT',
        body: png(),
        headers: { 'CF-Connecting-IP': '203.0.113.7' },
      })
      codes.push((await handleOgCardRequest(req, env))?.status ?? 0)
    }
    expect(codes.filter((c) => c === 204).length).toBe(10)
    expect(codes.filter((c) => c === 429).length).toBe(2)
  })

  it('ignores a path that is not its own', async () => {
    expect(
      await handleOgCardRequest(
        new Request('https://mercurypitch.com/api/share/s/abc'),
        fakeEnv(),
      ),
    ).toBeNull()
  })
})
