// ============================================================
// Canvas pictures: decoded as bitmaps, released when the room goes
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPictureSet, decodePicture, decodePictures, inlineBlob, releasePicture, } from './canvas-picture'

class FakeBitmap {
  closed = false
  constructor(readonly url = '') {}
  close(): void {
    this.closed = true
  }
}

/** fetch and createImageBitmap as a browser has them; `missing` 404s. */
function browserWithBitmaps(missing = '') {
  const urlOf = new WeakMap<Blob, string>()
  const fetch = vi.fn((url: string) => {
    const blob = new Blob([url])
    urlOf.set(blob, url)
    return Promise.resolve({
      ok: url !== missing,
      blob: () => Promise.resolve(blob),
    })
  })
  const made: FakeBitmap[] = []
  const createImageBitmap = vi.fn((blob: Blob) => {
    const bitmap = new FakeBitmap(urlOf.get(blob))
    made.push(bitmap)
    return Promise.resolve(bitmap)
  })
  vi.stubGlobal('ImageBitmap', FakeBitmap)
  vi.stubGlobal('fetch', fetch)
  vi.stubGlobal('createImageBitmap', createImageBitmap)
  return { fetch, createImageBitmap, made }
}

const img = (): HTMLImageElement => document.createElement('img')

/** A blob's bytes, through a reader: jsdom's Blob has no arrayBuffer(). */
const bytesOf = (blob: Blob): Promise<number[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve([...new Uint8Array(reader.result as ArrayBuffer)])
    reader.onerror = () => reject(reader.error ?? new Error('unreadable'))
    reader.readAsArrayBuffer(blob)
  })
const textOf = async (blob: Blob): Promise<string> =>
  new TextDecoder().decode(new Uint8Array(await bytesOf(blob)))
const failing = (): Promise<HTMLImageElement> =>
  Promise.reject(new Error('will not load'))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a canvas picture', () => {
  it('is the file decoded as a bitmap, from its own bytes', async () => {
    const { fetch, createImageBitmap } = browserWithBitmaps()
    const fallback = vi.fn(() => Promise.resolve(img()))

    const picture = await decodePicture('/a.webp', fallback)

    expect(fetch).toHaveBeenCalledWith('/a.webp')
    expect(createImageBitmap).toHaveBeenCalledOnce()
    expect(picture).toBeInstanceOf(FakeBitmap)
    expect(fallback).not.toHaveBeenCalled()
  })

  it('is read from its own address when the build inlined it, with no fetch', async () => {
    const { fetch, createImageBitmap } = browserWithBitmaps()
    const fallback = vi.fn(() => Promise.resolve(img()))
    const inlined = `data:image/webp;base64,${btoa('RIFF\u0000\u00ffWEBP')}`

    const picture = await decodePicture(inlined, fallback)

    expect(fetch).not.toHaveBeenCalled()
    expect(picture).toBeInstanceOf(FakeBitmap)
    expect(fallback).not.toHaveBeenCalled()
    const blob = createImageBitmap.mock.calls[0]?.[0]
    expect(blob?.type).toBe('image/webp')
    expect(await bytesOf(blob!)).toEqual([
      0x52, 0x49, 0x46, 0x46, 0x00, 0xff, 0x57, 0x45, 0x42, 0x50,
    ])
  })

  it('is the <img>, still with no fetch, when an inlined address will not read', async () => {
    const { fetch } = browserWithBitmaps()
    const shown = img()

    await expect(
      decodePicture('data:image/webp;base64,not base64!', () =>
        Promise.resolve(shown),
      ),
    ).resolves.toBe(shown)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('is the <img> where there is no createImageBitmap', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const shown = img()

    await expect(
      decodePicture('/a.webp', () => Promise.resolve(shown)),
    ).resolves.toBe(shown)
  })

  it('lets a bitmap go when released, and leaves an <img> alone', () => {
    vi.stubGlobal('ImageBitmap', FakeBitmap)
    const bitmap = new FakeBitmap()

    releasePicture(bitmap as unknown as ImageBitmap)

    expect(bitmap.closed).toBe(true)
    expect(() => releasePicture(img())).not.toThrow()
  })

  it('releases the pictures that loaded when one of a set will not', async () => {
    const { made } = browserWithBitmaps('/b.webp')

    await expect(
      decodePictures(['/a.webp', '/b.webp'], failing),
    ).rejects.toThrow()

    expect(made).toHaveLength(1)
    expect(made[0]?.closed).toBe(true)
  })
})

describe('an inlined picture’s bytes', () => {
  it('are read from base64, with the address’s type', async () => {
    const blob = inlineBlob(`data:image/png;base64,${btoa('abc')}`)

    expect(blob?.type).toBe('image/png')
    expect(await textOf(blob!)).toBe('abc')
  })

  it('are read from a percent-encoded address, as an inlined SVG is written', async () => {
    const blob = inlineBlob(
      'data:image/svg+xml,%3csvg xmlns=%22http://www.w3.org/2000/svg%22/%3e',
    )

    expect(blob?.type).toBe('image/svg+xml')
    expect(await textOf(blob!)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    )
  })

  it('keep the type and drop its parameters', () => {
    expect(
      inlineBlob(`data:image/svg+xml;charset=utf-8;base64,${btoa('<svg/>')}`)
        ?.type,
    ).toBe('image/svg+xml')
  })

  it('are null for a file’s address, and for an address that will not read', () => {
    expect(inlineBlob('/assets/a.webp')).toBeNull()
    expect(inlineBlob('https://example.test/a.webp')).toBeNull()
    expect(inlineBlob('data:image/webp;base64')).toBeNull()
    expect(inlineBlob('data:image/webp;base64,not base64!')).toBeNull()
    expect(inlineBlob('data:image/svg+xml,%E0%A4%A')).toBeNull()
  })
})

describe('a room’s picture set', () => {
  it('decodes once however often it is asked', async () => {
    const { fetch } = browserWithBitmaps()
    const set = createPictureSet(() => ['/a.webp', '/b.webp'], failing)

    const [first, second] = await Promise.all([set.get(), set.get()])

    expect(first).toBe(second)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('closes every bitmap on release', async () => {
    const { made } = browserWithBitmaps()
    const set = createPictureSet(() => ['/a.webp', '/b.webp'], failing)
    await set.get()

    set.release()
    await Promise.resolve()

    expect(made.map((b) => b.closed)).toEqual([true, true])
  })

  it('closes bitmaps that decode after the room has gone', async () => {
    const { made } = browserWithBitmaps()
    const set = createPictureSet(() => ['/a.webp'], failing)
    const asked = set.get()

    set.release()

    await expect(asked).rejects.toThrow()
    expect(made.map((b) => b.closed)).toEqual([true])
  })
})
