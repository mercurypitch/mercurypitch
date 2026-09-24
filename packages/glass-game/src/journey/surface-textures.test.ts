// Journey surface texture tests — preserve PBR sampling and retire partial decodes.

import { NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadJourneyMarbleTextures, loadJourneySurfaceTexture, } from './surface-textures'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('journey surface textures', () => {
  it('decodes an upright repeating map with explicit color semantics', async () => {
    const bitmap = { close: vi.fn() }
    const decode = vi.fn().mockResolvedValue(bitmap)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob(['marble'])),
      }),
    )
    vi.stubGlobal('createImageBitmap', decode)

    const texture = await loadJourneySurfaceTexture(
      '/carrara.webp',
      new AbortController().signal,
      {
        interpretation: 'color',
        wrap: 'repeat',
        repeat: [2, 3],
      },
    )

    expect(texture.colorSpace).toBe(SRGBColorSpace)
    expect(texture.wrapS).toBe(RepeatWrapping)
    expect(texture.wrapT).toBe(RepeatWrapping)
    expect(texture.repeat.toArray()).toEqual([2, 3])
    expect(texture.flipY).toBe(false)
    expect(texture.name).toBe('journey-surface:/carrara.webp')
    expect(decode).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: 'flipY',
      premultiplyAlpha: 'none',
    })
  })

  it('retires successful sibling maps when one PBR channel fails', async () => {
    const firstBitmap = { close: vi.fn() }
    const thirdBitmap = { close: vi.fn() }
    const first = new Texture(firstBitmap)
    const third = new Texture(thirdBitmap)
    const disposeFirst = vi.spyOn(first, 'dispose')
    const disposeThird = vi.spyOn(third, 'dispose')
    const failure = new Error('normal unavailable')
    const load = vi
      .fn<typeof loadJourneySurfaceTexture>()
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(third)

    await expect(
      loadJourneyMarbleTextures(
        {
          basecolor: '/base.webp',
          normal: '/normal.webp',
          roughness: '/roughness.webp',
        },
        new AbortController().signal,
        load,
      ),
    ).rejects.toBe(failure)

    expect(first.colorSpace).toBe(NoColorSpace)
    expect(disposeFirst).toHaveBeenCalledOnce()
    expect(disposeThird).toHaveBeenCalledOnce()
    expect(firstBitmap.close).toHaveBeenCalledOnce()
    expect(thirdBitmap.close).toHaveBeenCalledOnce()
  })
})
