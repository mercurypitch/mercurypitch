// Journey portrait texture tests — cap owned mobile images and retire interrupted decodes.
import { SRGBColorSpace, Texture } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { disposeJourneyPortraitTexture, loadJourneyPortraitTexture, } from './portrait-texture'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function decoding(width: number, height: number) {
  const bitmap = { width, height, close: vi.fn() }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(new Blob(['portrait']))),
  )
  const decode = vi.fn().mockResolvedValue(bitmap)
  vi.stubGlobal('createImageBitmap', decode)
  return { bitmap, decode }
}

it.each([
  [768, 1152],
  [1024, 1536],
])(
  'caps a %ix%i mobile portrait on its longest dimension',
  async (width, height) => {
    const { bitmap, decode } = decoding(width, height)
    const resized = { width: 683, height: 1024, close: vi.fn() }
    const resize = vi.fn(async () => resized as unknown as TexImageSource)

    const texture = await loadJourneyPortraitTexture(
      '/portrait.webp',
      new AbortController().signal,
      { assetProfile: 'mobile', resizeImage: resize },
    )

    expect(resize).toHaveBeenCalledWith(bitmap, { width: 683, height: 1024 })
    expect(texture.image).toBe(resized)
    expect(texture.colorSpace).toBe(SRGBColorSpace)
    expect(texture.flipY).toBe(false)
    expect(texture.repeat.toArray()).toEqual([1, 1])
    expect(decode).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: 'flipY',
      premultiplyAlpha: 'none',
    })
    expect(bitmap.close).toHaveBeenCalledOnce()
    const dispose = vi.spyOn(texture, 'dispose')
    disposeJourneyPortraitTexture(texture)
    disposeJourneyPortraitTexture(texture)
    expect(dispose).toHaveBeenCalledOnce()
    expect(resized.close).toHaveBeenCalledOnce()
  },
)

it('leaves the default full portrait and bitmap orientation unchanged', async () => {
  const { bitmap } = decoding(1024, 1536)
  const texture = await loadJourneyPortraitTexture(
    '/portrait.webp',
    new AbortController().signal,
  )
  expect(texture.image).toBe(bitmap)
  expect(texture.flipY).toBe(false)
  expect(bitmap.close).not.toHaveBeenCalled()
  disposeJourneyPortraitTexture(texture)
  expect(bitmap.close).toHaveBeenCalledOnce()
})

it.each(['abort', 'late-abort', 'invalid', 'resize-error'] as const)(
  'retires the portrait texture and current owned image after %s during resize',
  async (failure) => {
    const { bitmap } = decoding(1024, 1536)
    const attempt = new AbortController()
    const replacement = {
      width: failure === 'invalid' ? 1024 : 683,
      height: 1024,
      close: vi.fn(),
    }
    const dispose = vi.spyOn(Texture.prototype, 'dispose')
    if (failure === 'late-abort')
      bitmap.close.mockImplementation(() => attempt.abort())
    const resize = vi.fn(async () => {
      if (failure === 'abort') attempt.abort()
      if (failure === 'resize-error') throw new Error('resize failed')
      return replacement as unknown as TexImageSource
    })

    const pending = loadJourneyPortraitTexture(
      '/portrait.webp',
      attempt.signal,
      { assetProfile: 'mobile', resizeImage: resize },
    )
    if (failure === 'abort' || failure === 'late-abort')
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    else
      await expect(pending).rejects.toThrow(
        failure === 'invalid' ? 'returned invalid dimensions' : 'resize failed',
      )

    expect(dispose).toHaveBeenCalledOnce()
    expect(bitmap.close).toHaveBeenCalledOnce()
    if (failure !== 'resize-error')
      expect(replacement.close).toHaveBeenCalledOnce()
  },
)
