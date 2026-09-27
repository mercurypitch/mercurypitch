// Mobile asset texture tests — decoded image caps apply before upload and release superseded bitmaps.

import { Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Texture, } from 'three'
import { expect, it, vi } from 'vitest'
import { applyAssetTextureProfile, collectAssetTextureImages, releaseAssetTextureImages, } from './asset-texture-profile'

function image(width: number, height = width) {
  return { width, height, close: vi.fn() } as unknown as TexImageSource & {
    close: ReturnType<typeof vi.fn>
  }
}

it('caps color and packed data independently and releases their full images', async () => {
  const colorImage = image(2048)
  const packedImage = image(2048)
  const color = new Texture(colorImage)
  const packed = new Texture(packedImage)
  const material = new MeshStandardMaterial({
    map: color,
    metalnessMap: packed,
    roughnessMap: packed,
  })
  const root = new Group().add(new Mesh(new PlaneGeometry(), material))
  const resize = vi.fn(async (_source, target) =>
    image(target.width, target.height),
  )

  await expect(
    applyAssetTextureProfile(root, 'mobile', resize),
  ).resolves.toEqual({ resizedSources: 2, releasedSources: 2 })

  expect(resize.mock.calls.map((call) => call[1])).toEqual([
    { width: 1024, height: 1024 },
    { width: 512, height: 512 },
  ])
  expect(colorImage.close).toHaveBeenCalledOnce()
  expect(packedImage.close).toHaveBeenCalledOnce()
})

it('resizes a shared source once at the largest material-slot cap', async () => {
  const sharedImage = image(2048, 1024)
  const normal = new Texture(sharedImage)
  const roughness = normal.clone()
  const material = new MeshStandardMaterial({
    normalMap: normal,
    roughnessMap: roughness,
  })
  const root = new Group().add(new Mesh(new PlaneGeometry(), material))
  const resize = vi.fn(async (_source, target) =>
    image(target.width, target.height),
  )

  await applyAssetTextureProfile(root, 'mobile', resize)

  expect(resize).toHaveBeenCalledOnce()
  expect(resize).toHaveBeenCalledWith(sharedImage, { width: 1024, height: 512 })
  expect(normal.image).toBe(roughness.image)
})

it('replaces every live source for a shared image before releasing it', async () => {
  const sharedImage = image(2048)
  const color = new Texture(sharedImage)
  color.colorSpace = SRGBColorSpace
  color.flipY = false
  color.premultiplyAlpha = true
  const clearcoat = new Texture(sharedImage)
  const material = new MeshPhysicalMaterial({
    clearcoat: 1,
    clearcoatMap: clearcoat,
    map: color,
  })
  const root = new Group().add(new Mesh(new PlaneGeometry(), material))
  const resized = image(1024)
  const resize = vi.fn(async () => resized)

  await expect(
    applyAssetTextureProfile(root, 'mobile', resize),
  ).resolves.toEqual({ resizedSources: 1, releasedSources: 1 })

  expect(color.source).not.toBe(clearcoat.source)
  expect(color.source.data).toBe(resized)
  expect(clearcoat.source.data).toBe(resized)
  expect(sharedImage.close).toHaveBeenCalledOnce()
  expect(color.colorSpace).toBe(SRGBColorSpace)
  expect(color.flipY).toBe(false)
  expect(color.premultiplyAlpha).toBe(true)
  expect(collectAssetTextureImages(root)).toEqual(new Set([resized]))
  expect(releaseAssetTextureImages(root)).toBe(1)
  expect(resized.close).toHaveBeenCalledOnce()
})

it('leaves full assets and already bounded mobile images untouched', async () => {
  const sourceImage = image(1024)
  const texture = new Texture(sourceImage)
  const root = new Group().add(
    new Mesh(new PlaneGeometry(), new MeshStandardMaterial({ map: texture })),
  )
  const resize = vi.fn()

  await expect(applyAssetTextureProfile(root, 'full', resize)).resolves.toEqual(
    {
      resizedSources: 0,
      releasedSources: 0,
    },
  )
  await expect(
    applyAssetTextureProfile(root, 'mobile', resize),
  ).resolves.toEqual({ resizedSources: 0, releasedSources: 0 })
  expect(resize).not.toHaveBeenCalled()
  expect(sourceImage.close).not.toHaveBeenCalled()
})

it('rejects a resize result that did not honor the requested dimensions', async () => {
  const sourceImage = image(2048)
  const texture = new Texture(sourceImage)
  const root = new Group().add(
    new Mesh(new PlaneGeometry(), new MeshStandardMaterial({ map: texture })),
  )
  const invalid = image(2048)

  await expect(
    applyAssetTextureProfile(root, 'mobile', async () => invalid),
  ).rejects.toThrow('returned invalid dimensions')

  expect(texture.source.data).toBe(sourceImage)
  expect(sourceImage.close).not.toHaveBeenCalled()
  expect(invalid.close).toHaveBeenCalledOnce()
})

it('stops between resizes and closes a replacement completed after abort', async () => {
  const firstImage = image(2048)
  const secondImage = image(2048)
  const firstTexture = new Texture(firstImage)
  const secondTexture = new Texture(secondImage)
  const root = new Group().add(
    new Mesh(
      new PlaneGeometry(),
      new MeshStandardMaterial({
        map: firstTexture,
        normalMap: secondTexture,
      }),
    ),
  )
  let finishResize!: (image: TexImageSource) => void
  const resize = vi.fn(
    () =>
      new Promise<TexImageSource>((resolve) => {
        finishResize = resolve
      }),
  )
  const attempt = new AbortController()
  const pending = applyAssetTextureProfile(
    root,
    'mobile',
    resize,
    attempt.signal,
  )
  await vi.waitFor(() => expect(resize).toHaveBeenCalledOnce())
  const replacement = image(1024)

  attempt.abort()
  finishResize(replacement)
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })

  expect(resize).toHaveBeenCalledOnce()
  expect(firstTexture.source.data).toBe(firstImage)
  expect(secondTexture.source.data).toBe(secondImage)
  expect(firstImage.close).not.toHaveBeenCalled()
  expect(secondImage.close).not.toHaveBeenCalled()
  expect(replacement.close).toHaveBeenCalledOnce()
})
