import { describe, expect, it } from 'vitest'
import { OG_CARD_SIZE } from '@/lib/mirror/shared-voiceprint'
import { handleOgCardRequest, ogCardExists } from '@/og-card-handler'
import type { Env } from '@/worker'

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** The opening of a real PNG: the signature, then an IHDR chunk saying how
 *  big the picture is. Nothing after that is read by the store. */
function png(width = OG_CARD_SIZE, height = OG_CARD_SIZE): ArrayBuffer {
  const bytes = new Uint8Array(64)
  bytes.set(PNG_HEAD, 0)
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12) // "IHDR"
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes.buffer
}

function fakeEnv(): Env & { cancelled: () => number } {
  const store = new Map<string, unknown>()
  let cancelled = 0
  return {
    cancelled: () => cancelled,
    SHARE_STORE: {
      // KV hands a stream back when asked for one. The store only ever asks
      // in order to find out whether the key is there, and must let go of
      // what it opened.
      get: async (key: string, type?: string) => {
        const value = store.get(key) ?? null
        if (value === null || type !== 'stream') return value
        return {
          cancel: async () => {
            cancelled++
          },
        }
      },
      put: async (key: string, value: unknown) => {
        store.set(key, value)
      },
    },
  } as unknown as Env & { cancelled: () => number }
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
    const second = await handleOgCardRequest(put(ID, png()), env)
    expect(second?.status).toBe(409)
  })

  it('takes only a picture of the size the tags declare', async () => {
    // A data card shared in the tall story format is 1080x1920. The tags say
    // 1080 square, so the app uploads a square drawing and the store holds
    // it to that — which also stops this being somewhere to park any PNG.
    const env = fakeEnv()
    const tall = await handleOgCardRequest(put(ID, png(1080, 1920)), env)
    expect(tall?.status).toBe(415)
    const tiny = await handleOgCardRequest(put(ID, png(1, 1)), env)
    expect(tiny?.status).toBe(415)
    // Refused means not stored.
    expect(await ogCardExists(env, ID)).toBe(false)
  })

  it('serves a stranger’s bytes as an image and as nothing else', async () => {
    const env = fakeEnv()
    await handleOgCardRequest(put(ID, png()), env)
    const got = await handleOgCardRequest(
      new Request(`https://mercurypitch.com/api/og/card/${ID}.png`),
      env,
    )
    expect(got?.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(got?.headers.get('Content-Security-Policy')).toContain(
      "default-src 'none'",
    )
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

  it('says whether a card is there, and lets go of what it opened', async () => {
    const env = fakeEnv()
    expect(await ogCardExists(env, ID)).toBe(false)

    await handleOgCardRequest(put(ID, png()), env)
    const before = env.cancelled()
    expect(await ogCardExists(env, ID)).toBe(true)
    // The value is a few hundred kilobytes. Asking whether it exists must
    // not leave a stream of it open behind every unfurl.
    expect(env.cancelled()).toBe(before + 1)
  })

  it('does not take an id of the wrong shape to the store at all', async () => {
    const env = fakeEnv()
    expect(await ogCardExists(env, '../share/abc')).toBe(false)
    expect(await ogCardExists(env, '')).toBe(false)
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
