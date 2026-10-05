// Journey surface texture tests — preserve PBR sampling and retire partial decodes.

import { NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadJourneyMarbleTextures, loadJourneySurfaceTexture, } from './surface-textures'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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

  it('bounds mobile marble data without changing color, normal or sampling', async () => {
    const bitmaps = Array.from({ length: 3 }, () => ({
      width: 1024,
      height: 1024,
      close: vi.fn(),
    }))
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(async () => new Response(new Blob(['marble']))),
    )
    vi.stubGlobal(
      'createImageBitmap',
      vi
        .fn()
        .mockResolvedValueOnce(bitmaps[0])
        .mockResolvedValueOnce(bitmaps[1])
        .mockResolvedValueOnce(bitmaps[2]),
    )
    const resized = { width: 512, height: 512, close: vi.fn() }
    const resize = vi.fn(async () => resized as unknown as TexImageSource)

    const marble = await loadJourneyMarbleTextures(
      {
        basecolor: '/base.webp',
        normal: '/normal.webp',
        roughness: '/roughness.webp',
      },
      new AbortController().signal,
      undefined,
      { assetProfile: 'mobile', resizeImage: resize },
    )

    expect(resize).toHaveBeenCalledOnce()
    expect(resize).toHaveBeenCalledWith(bitmaps[2], { width: 512, height: 512 })
    expect(marble.map.image).toBe(bitmaps[0])
    expect(marble.normalMap.image).toBe(bitmaps[1])
    expect(marble.roughnessMap.image).toBe(resized)
    expect(marble.map.colorSpace).toBe(SRGBColorSpace)
    expect(marble.normalMap.colorSpace).toBe(NoColorSpace)
    expect(marble.roughnessMap.colorSpace).toBe(NoColorSpace)
    for (const texture of [marble.map, marble.normalMap, marble.roughnessMap]) {
      expect(texture.flipY).toBe(false)
      expect(texture.repeat.toArray()).toEqual([2, 2])
      expect(texture.wrapS).toBe(RepeatWrapping)
      expect(texture.anisotropy).toBe(4)
    }
    const disposals = [marble.map, marble.normalMap, marble.roughnessMap].map(
      (texture) => vi.spyOn(texture, 'dispose'),
    )
    marble.dispose()
    marble.dispose()
    expect(disposals.every((dispose) => dispose.mock.calls.length === 1)).toBe(
      true,
    )
    for (const bitmap of [...bitmaps, resized])
      expect(bitmap.close).toHaveBeenCalledOnce()
  })

  it.each(['abort', 'late-abort', 'invalid', 'resize-error'] as const)(
    'retires the surface texture and owned images after %s during resize',
    async (failure) => {
      const bitmap = { width: 2048, height: 2048, close: vi.fn() }
      const replacement = {
        width: failure === 'invalid' ? 2048 : 1024,
        height: 1024,
        close: vi.fn(),
      }
      const attempt = new AbortController()
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(new Blob(['surface']))),
      )
      vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
      const dispose = vi.spyOn(Texture.prototype, 'dispose')
      if (failure === 'late-abort')
        bitmap.close.mockImplementation(() => attempt.abort())
      const resize = vi.fn(async () => {
        if (failure === 'abort') attempt.abort()
        if (failure === 'resize-error') throw new Error('resize failed')
        return replacement as unknown as TexImageSource
      })

      const pending = loadJourneySurfaceTexture(
        '/surface.webp',
        attempt.signal,
        { interpretation: 'color' },
        { assetProfile: 'mobile', resizeImage: resize },
      )
      if (failure === 'abort' || failure === 'late-abort')
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
      else
        await expect(pending).rejects.toThrow(
          failure === 'invalid'
            ? 'returned invalid dimensions'
            : 'resize failed',
        )

      expect(dispose).toHaveBeenCalledOnce()
      expect(bitmap.close).toHaveBeenCalledOnce()
      if (failure !== 'resize-error')
        expect(replacement.close).toHaveBeenCalledOnce()
    },
  )

  it('keeps the third-argument marble loader and passes each mobile slot explicitly', async () => {
    const load = vi
      .fn<typeof loadJourneySurfaceTexture>()
      .mockImplementation(async () => new Texture())
    const attempt = new AbortController()
    const marble = await loadJourneyMarbleTextures(
      {
        basecolor: '/base.webp',
        normal: '/normal.webp',
        roughness: '/roughness.webp',
      },
      attempt.signal,
      load,
      { assetProfile: 'mobile' },
    )
    expect(load.mock.calls.map((call) => [call[0], call[3]])).toEqual([
      ['/base.webp', { assetProfile: 'mobile', slot: 'map' }],
      ['/normal.webp', { assetProfile: 'mobile', slot: 'normalMap' }],
      ['/roughness.webp', { assetProfile: 'mobile', slot: 'roughnessMap' }],
    ])
    marble.dispose()
  })

  it('retires every marble map when sibling completion arrives after cancellation', async () => {
    const attempt = new AbortController()
    const maps = Array.from(
      { length: 3 },
      () => new Texture({ close: vi.fn() }),
    )
    const disposals = maps.map((texture) => vi.spyOn(texture, 'dispose'))
    let index = 0
    const load = vi
      .fn<typeof loadJourneySurfaceTexture>()
      .mockImplementation(async () => {
        const texture = maps[index++]!
        if (index === 3) attempt.abort()
        return texture
      })

    await expect(
      loadJourneyMarbleTextures(
        {
          basecolor: '/base.webp',
          normal: '/normal.webp',
          roughness: '/roughness.webp',
        },
        attempt.signal,
        load,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce()
    for (const texture of maps)
      expect(texture.image.close).toHaveBeenCalledOnce()
  })
})
