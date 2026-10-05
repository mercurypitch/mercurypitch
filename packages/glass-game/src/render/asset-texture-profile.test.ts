// Mobile asset texture tests — decoded image caps apply before upload and release superseded bitmaps.

import { Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Texture, } from 'three'
import { expect, it, vi } from 'vitest'
import { applyAssetTextureProfile, applyOwnedAssetTextureProfile, collectAssetTextureImages, estimateAssetTextureBytes, releaseAssetTextureImages, } from './asset-texture-profile'

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

it('bounds the museum glass transmission mask without changing its material or geometry', async () => {
  const source = image(2048)
  const transmission = new Texture(source)
  const material = new MeshPhysicalMaterial({
    transmission: 1,
    transmissionMap: transmission,
  })
  const geometry = new PlaneGeometry()
  const mesh = new Mesh(geometry, material)
  const resize = vi.fn(async (_source, target) =>
    image(target.width, target.height),
  )

  await applyAssetTextureProfile(mesh, 'mobile', resize)

  expect(resize).toHaveBeenCalledWith(source, { width: 512, height: 512 })
  expect(source.close).toHaveBeenCalledOnce()
  expect(mesh.geometry).toBe(geometry)
  expect(mesh.material).toBe(material)
  expect(material.transmission).toBe(1)
  expect(material.transmissionMap).toBe(transmission)
})

it('estimates unique image storage with mip levels rather than compressed file size', () => {
  const source = image(1024)
  const color = new Texture(source)
  const roughness = new Texture(source)
  const material = new MeshStandardMaterial({
    map: color,
    roughnessMap: roughness,
  })
  const root = new Group().add(new Mesh(new PlaneGeometry(), material))
  // Ten smaller square mips plus the 1024-square base, counted once for shared images.
  expect(estimateAssetTextureBytes(root)).toBe(5_592_404)
  color.generateMipmaps = false
  roughness.generateMipmaps = false
  expect(estimateAssetTextureBytes(root)).toBe(4_194_304)
})

it('applies the same caps to a standalone owned texture while retaining sampler state', async () => {
  const source = image(1024)
  const texture = new Texture(source)
  texture.colorSpace = SRGBColorSpace
  texture.flipY = false
  texture.repeat.set(2, 3)
  const resize = vi.fn(async (_source, target) =>
    image(target.width, target.height),
  )

  await expect(
    applyOwnedAssetTextureProfile(texture, 'roughnessMap', 'mobile', resize),
  ).resolves.toEqual({ resizedSources: 1, releasedSources: 1 })

  expect(resize).toHaveBeenCalledWith(source, { width: 512, height: 512 })
  expect(source.close).toHaveBeenCalledOnce()
  expect(texture.image).toMatchObject({ width: 512, height: 512 })
  expect(texture.colorSpace).toBe(SRGBColorSpace)
  expect(texture.flipY).toBe(false)
  expect(texture.repeat.toArray()).toEqual([2, 3])
  await expect(
    applyOwnedAssetTextureProfile(texture, 'roughnessMap', 'mobile', resize),
  ).resolves.toEqual({ resizedSources: 0, releasedSources: 0 })
  expect(resize).toHaveBeenCalledOnce()

  const fullSource = image(2048)
  const full = new Texture(fullSource)
  await expect(
    applyOwnedAssetTextureProfile(full, 'map', 'full', resize),
  ).resolves.toEqual({ resizedSources: 0, releasedSources: 0 })
  expect(full.image).toBe(fullSource)
  expect(fullSource.close).not.toHaveBeenCalled()
})

it.each(['abort', 'invalid'] as const)(
  'retires a standalone replacement on %s without relinquishing the original',
  async (failure) => {
    const source = image(2048)
    const texture = new Texture(source)
    const attempt = new AbortController()
    const replacement = image(failure === 'invalid' ? 2048 : 1024)
    const resize = vi.fn(async () => {
      if (failure === 'abort') attempt.abort()
      return replacement
    })

    const pending = applyOwnedAssetTextureProfile(
      texture,
      'map',
      'mobile',
      resize,
      attempt.signal,
    )
    if (failure === 'abort')
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    else await expect(pending).rejects.toThrow('returned invalid dimensions')

    expect(texture.image).toBe(source)
    expect(source.close).not.toHaveBeenCalled()
    expect(replacement.close).toHaveBeenCalledOnce()
  },
)
