// ============================================================
// Canvas pictures: decoded as bitmaps, released when the room goes
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPictureSet, decodePicture, decodePictures, releasePicture, } from './canvas-picture'

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
