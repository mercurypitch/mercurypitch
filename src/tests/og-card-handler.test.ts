import { describe, expect, it } from 'vitest'
import { OG_CARD_SIZE } from '@/lib/mirror/shared-voiceprint'
import { handleOgCardRequest, ogCardExists } from '@/og-card-handler'
import type { Env } from '@/worker'

/** The opening of a real JPEG: start of image, the JFIF block every encoder
 *  writes first, then the frame header that says how big the picture is.
 *  Nothing after that is read by the store. */
function jpeg(width = OG_CARD_SIZE, height = OG_CARD_SIZE): ArrayBuffer {
  const bytes = new Uint8Array(64)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, 0xffd8) // SOI
  view.setUint16(2, 0xffe0) // APP0 ...
  view.setUint16(4, 16) // ... sixteen bytes of it, length included
  view.setUint16(20, 0xffc0) // SOF0
  view.setUint16(22, 17)
  view.setUint8(24, 8) // bits a sample
  view.setUint16(25, height)
  view.setUint16(27, width)
  return bytes.buffer
}

/** A PNG's first bytes — what the share sheet gets, and not what this takes. */
function png(): ArrayBuffer {
  const bytes = new Uint8Array(64)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
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
  it('stores a card and serves it back as an image', async () => {
    const env = fakeEnv()
    expect((await handleOgCardRequest(put(ID, jpeg()), env))?.status).toBe(204)

    const got = await handleOgCardRequest(
      new Request(`https://mercurypitch.com/api/og/card/${ID}.jpg`),
      env,
    )
    expect(got?.status).toBe(200)
    expect(got?.headers.get('Content-Type')).toBe('image/jpeg')
    expect(got?.headers.get('Cache-Control')).toContain('immutable')
  })

  it('404s for a card that was never stored, or has expired', async () => {
    const got = await handleOgCardRequest(
      new Request(`https://mercurypitch.com/api/og/card/${ID}.jpg`),
      fakeEnv(),
    )
    expect(got?.status).toBe(404)
  })

  it('refuses anything that is not a JPEG', async () => {
    // The store is served back with an image content type, so accepting
    // arbitrary bytes would make us a host for them.
    const res = await handleOgCardRequest(
      put(ID, new TextEncoder().encode('<script>alert(1)</script>').buffer),
      fakeEnv(),
    )
    expect(res?.status).toBe(415)
    // The PNG the share sheet gets is 2 MB of painted portrait. It is not
    // what an unfurl wants, and the store does not take it.
    expect((await handleOgCardRequest(put(ID, png()), fakeEnv()))?.status).toBe(
      415,
    )
  })

  it('reads the size from the frame header, past whatever comes first', async () => {
    // Truncated before the frame header: no size, so not a card.
    const cut = jpeg().slice(0, 22)
    expect((await handleOgCardRequest(put(ID, cut), fakeEnv()))?.status).toBe(
      415,
    )
    // A segment length of zero would never advance.
    const stuck = new Uint8Array(jpeg())
    new DataView(stuck.buffer).setUint16(4, 0)
    expect(
      (await handleOgCardRequest(put(ID, stuck.buffer), fakeEnv()))?.status,
    ).toBe(415)
  })

  it('refuses to overwrite an id that already exists', async () => {
    const env = fakeEnv()
    await handleOgCardRequest(put(ID, jpeg()), env)
    const second = await handleOgCardRequest(put(ID, jpeg()), env)
    expect(second?.status).toBe(409)
  })

  it('takes only a picture of the size the tags declare', async () => {
    // A data card shared in the tall story format is 1080x1920. The tags say
    // 1080 square, so the app uploads a square drawing and the store holds
    // it to that — which also stops this being somewhere to park any image.
    const env = fakeEnv()
    const tall = await handleOgCardRequest(put(ID, jpeg(1080, 1920)), env)
    expect(tall?.status).toBe(415)
    const tiny = await handleOgCardRequest(put(ID, jpeg(1, 1)), env)
    expect(tiny?.status).toBe(415)
    // Refused means not stored.
    expect(await ogCardExists(env, ID)).toBe(false)
  })

  it('serves a stranger’s bytes as an image and as nothing else', async () => {
    const env = fakeEnv()
    await handleOgCardRequest(put(ID, jpeg()), env)
    const got = await handleOgCardRequest(
      new Request(`https://mercurypitch.com/api/og/card/${ID}.jpg`),
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
        body: jpeg(),
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

    await handleOgCardRequest(put(ID, jpeg()), env)
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
